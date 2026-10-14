import type { GameState, Mobile, Target } from '../types';
import type { Limbs } from './units';
import * as THREE from 'three';
import { H, TAU, W } from '../core/constants';
import { B } from '../data/buildings';
import { RES } from '../data/resources';
import { RINGG, quadG } from './decals';
import { bx, mat, mergeStatic } from './kit';
import { makeBuilding, makeCamp, wallMask } from './models';
import { nodeAge, nodeSnap, rebuildNodes, setNodeAge, setNodeSnap } from './nodes';
import { S3, TM } from './scene';
import { TTEX, buildTerrain, paintAll, paintTile, tctx, timg } from './terrain';
import { FOEK, makeUnit, makeVillager } from './units';
import { G, sel } from '../sim/state';
import { node, road } from '../sim/world';

// ---- scene sync ----
export const BG3 = new THREE.Group();
const EG3 = new THREE.Group();
export const CG3 = new THREE.Group();
S3.add(BG3, EG3, CG3);
/** Scene record of a building: wrapper group, model, rebuild key, model height and animated parts. */
interface BRec { g: THREE.Group; m: THREE.Group; key: string; h: number; fires: THREE.Object3D[]; flags: THREE.Object3D[]; pumps: THREE.Object3D[]; lamps: THREE.Object3D[] }
/** Scene record of a villager, unit or foe: last position, heading, smoothed speed and selection ring. */
interface ERec { g: THREE.Group; key: string; px: number; py: number; ang: number; mv: number; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; seen: number }
interface CRec { g: THREE.Group; fires: THREE.Object3D[] }
export const bRec = new Map<number, BRec>();
const eRec = new Map<number, ERec>(), cRec = new Map<number, CRec>();
let lastG: GameState | null = null, terrSnap: Uint8Array | null = null, unlSig = '';
export let seasonSig = '';
function scaffold(g: THREE.Group, s: number, h: number) {
    const m = mat('#8a6a40');
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
        bx(g, .05, h, .05, m, x * s * .46, 0, z * s * .46);
    bx(g, s * .95, .04, .04, m, 0, h * .6, s * .46);
    bx(g, .04, .04, s * .95, m, s * .46, h * .6, 0);
}
export function syncBuildings() {
    const seen = new Set<number>();
    for (const b of G.bs) {
        const d = B[b.type], s = d.size;
        seen.add(b.id);
        const key = b.type + '|' + (b.type === 'townhall' ? G.age : '') + '|' + (b.done ? 1 : 0) + '|' + (d.wall ? wallMask(b) : '');
        let r = bRec.get(b.id);
        if (!r || r.key !== key) {
            if (r)
                BG3.remove(r.g);
            const g = new THREE.Group(), m = makeBuilding(b.type, G.age, b);
            g.add(m);
            g.position.set(b.x + s / 2, 0, b.y + s / 2);
            const box = new THREE.Box3().setFromObject(m);
            const h = Math.max(.3, box.max.y);
            if (!b.done) {
                scaffold(g, s, Math.max(.5, h * .9));
                const f = new THREE.Mesh(quadG, mat('#a58a62'));
                f.scale.set(s * .98, 1, s * .98);
                f.position.y = .02;
                f.receiveShadow = true;
                g.add(f);
            }
            g.traverse(o => {
                o.userData.bid = b.id;
            });
            BG3.add(g);
            const fires: THREE.Object3D[] = [], flags: THREE.Object3D[] = [], pumps: THREE.Object3D[] = [], lamps: THREE.Object3D[] = [];
            g.traverse(o => {
                if (o.userData.fire)
                    fires.push(o);
                if (o.userData.flag)
                    flags.push(o);
                if (o.userData.pump)
                    pumps.push(o);
                if (o.userData.lamp)
                    lamps.push(o);
            });
            r = { g, m, key, h, fires, flags, pumps, lamps };
            bRec.set(b.id, r);
        }
        if (!b.done) {
            const p = Math.min(1, b.prog / b.bt);
            r.m.scale.set(1, .12 + .88 * p, 1);
        }
        else {
            const pt = b.pop_t != null ? G.t - b.pop_t : 9;
            r.m.scale.setScalar(pt < .45 ? 1 + Math.sin(pt / .45 * Math.PI) * .08 : 1);
        }
        for (const f of r.fires) {
            const k = .85 + Math.sin(TM * 13 + b.id) * .1 + Math.sin(TM * 7.3 + b.id * 2) * .08;
            f.scale.set(1, k * (b.on === false ? .2 : 1), 1);
        }
        for (const f of r.flags)
            f.rotation.y = Math.sin(TM * 2 + b.id) * .25;
        for (const p of r.pumps)
            if (b.on && b.done)
                p.rotation.z = Math.sin(TM * 2.2 + b.id) * .25;
    }
    for (const [id, r] of bRec)
        if (!seen.has(id)) {
            BG3.remove(r.g);
            bRec.delete(id);
        }
}
function entKey(e: Mobile): string {
    return e.kind === 'v' ? 'v' + e.job : e.kind === 'u' ? 'u' + e.k : 'f' + e.type;
}
function syncEnt(e: Mobile, make: () => THREE.Group) {
    let r = eRec.get(e.id);
    const key = entKey(e);
    if (!r || r.key !== key) {
        if (r)
            EG3.remove(r.g);
        const g = make();
        g.traverse(o => {
            o.userData.eid = e.id;
            if ((o as THREE.Mesh).isMesh)
                o.castShadow = e.kind !== 'v' && !(e.kind === 'f' && e.camp);
        });
        EG3.add(g);
        r = { g, key, px: e.x, py: e.y, ang: 0, mv: 0 } as ERec;
        const ring = new THREE.Mesh(RINGG, new THREE.MeshBasicMaterial({ color: '#9fe28a', transparent: true, opacity: .95, depthWrite: false }));
        ring.scale.setScalar(e.kind === 'u' && (e.k === 'tank' || e.k === 'knight') ? .42 : .28);
        ring.position.y = .03;
        ring.renderOrder = 3;
        g.add(ring);
        r.ring = ring;
        eRec.set(e.id, r);
    }
    r.seen = 1;
    const g = r.g, dx = e.x - r.px, dy = e.y - r.py, sp = Math.hypot(dx, dy);
    r.mv = r.mv * .8 + sp * 60 * .2;
    if (sp > .002)
        r.ang = Math.atan2(dx, dy);
    else if (e.tgt && (e.tgt as Target).x != null && !(e.tgt as Target).dead) {
        const t = e.tgt as Target, tx = t.x + (t.kind === 'b' ? B[t.type].size / 2 : 0), ty = t.y + (t.kind === 'b' ? B[t.type].size / 2 : 0);
        if (Math.hypot(tx - e.x, ty - e.y) > .05)
            r.ang = Math.atan2(tx - e.x, ty - e.y);
    }
    r.px = e.x;
    r.py = e.y;
    g.position.set(e.x, 0, e.y);
    const da = ((r.ang - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
    g.rotation.y += da * .25;
    return r;
}
function animPerson(g: THREE.Object3D, walk: boolean, work: boolean | null, t: number) {
    const L = g.userData.limbs as Limbs | undefined;
    if (!L)
        return;
    const s = walk ? Math.sin(t * 11) * .6 : 0;
    L.lL.rotation.x = s;
    L.lR.rotation.x = -s;
    L.aL.rotation.x = -s * .7;
    L.aR.rotation.x = work ? -1.2 + Math.sin(t * 9) * .9 : s * .7;
}
export function syncEntities() {
    for (const r of eRec.values())
        r.seen = 0;
    for (const v of G.vs) {
        if (v.hidden)
            continue;
        const r = syncEnt(v, () => makeVillager(v.job));
        const work = v.state === 'gather' || v.state === 'build';
        animPerson(r.g, r.mv > .3, work, TM + v.id);
        const c = r.g.userData.carry as THREE.Mesh | undefined;
        if (c) {
            c.visible = v.carry.amt > 0;
            if (c.visible)
                c.material = mat(RES[v.carry.res!] ? RES[v.carry.res!].c : '#8a6a44');
        }
        r.ring.visible = sel.vs.has(v.id);
        r.ring.material.color.set('#9fe28a');
    }
    for (const u of G.us) {
        const r = syncEnt(u, () => makeUnit(u.k, false));
        const f = r.g.userData.fly as THREE.Group | undefined;
        if (f) {
            f.position.y = .9 + Math.sin(TM * 3 + u.id) * .06;
            f.traverse(o => {
                if (o.userData.rotor)
                    o.rotation.y = TM * 30;
            });
        }
        else
            animPerson(r.g.userData.rider || r.g, r.mv > .3, u.cd > 0 && u.tgt && r.mv < .3, TM + u.id);
        r.ring.visible = sel.us.has(u.id);
        r.ring.material.color.set('#9fe28a');
    }
    for (const f of G.foes) {
        const r = syncEnt(f, () => makeUnit(FOEK[f.type] || 'plunder', true));
        const fl = r.g.userData.fly as THREE.Group | undefined;
        if (fl) {
            fl.position.y = .9 + Math.sin(TM * 3 + f.id) * .06;
            fl.traverse(o => {
                if (o.userData.rotor)
                    o.rotation.y = TM * 30;
            });
        }
        else
            animPerson(r.g, r.mv > .3, false, TM + f.id);
        r.g.visible = !f.retreat || f.alpha > .05;
        r.ring.visible = false;
    }
    for (const [id, r] of eRec)
        if (!r.seen) {
            EG3.remove(r.g);
            eRec.delete(id);
        }
}
export function syncCamps() {
    const seen = new Set<number>();
    for (const c of G.camps) {
        if (!c.alive)
            continue;
        seen.add(c.id);
        let r = cRec.get(c.id);
        if (!r) {
            const g = new THREE.Group();
            makeCamp(g, c.tier);
            mergeStatic(g);
            g.position.set(c.x + 1, 0, c.y + 1);
            g.traverse(o => {
                o.userData.camp = c.id;
            });
            CG3.add(g);
            const fires: THREE.Object3D[] = [];
            g.traverse(o => {
                if (o.userData.fire)
                    fires.push(o);
            });
            r = { g, fires };
            cRec.set(c.id, r);
        }
        for (const f of r.fires)
            f.scale.y = .85 + Math.sin(TM * 12 + c.id) * .15;
    }
    for (const [id, r] of cRec)
        if (!seen.has(id)) {
            CG3.remove(r.g);
            cRec.delete(id);
        }
}
function resetWorld3D() {
    for (const m of [bRec, eRec, cRec])
        for (const r of m.values())
            (r.g.parent || S3).remove(r.g);
    bRec.clear();
    eRec.clear();
    cRec.clear();
    buildTerrain();
    paintAll();
    rebuildNodes(true);
    terrSnap = road.slice();
    unlSig = G.unl.join('');
    setNodeSnap(node.slice());
    setNodeAge(G.age);
    lastG = G;
}
export function checkWorld() {
    if (lastG !== G) {
        resetWorld3D();
        return;
    }
    const us = G.unl.join('');
    if (us !== unlSig) {
        unlSig = us;
        paintAll();
        rebuildNodes(false);
        setNodeSnap(node.slice());
        return;
    }
    let rc = false;
    for (let i = 0; i < W * H; i++)
        if (road[i] !== terrSnap![i]) {
            terrSnap![i] = road[i];
            paintTile(i % W, (i / W) | 0);
            rc = true;
        }
    if (rc) {
        tctx.putImageData(timg!, 0, 0);
        TTEX.needsUpdate = true;
    }
    let nc = G.age !== nodeAge;
    if (!nc)
        for (let i = 0; i < W * H; i++)
            if (node[i] !== nodeSnap![i]) {
                nc = true;
                break;
            }
    if (nc) {
        setNodeSnap(node.slice());
        setNodeAge(G.age);
        rebuildNodes(false);
    }
}
export function setSeasonSig(v: string) {
    seasonSig = v;
    return v;
}
