// Houdt de 3D-wereld gelijk met de spelstand (nieuwe gebouwen, mensen die lopen).
import * as T3 from 'three';
import { store } from '../core/store.js';
import { CN, CS, H, TAU, W } from '../config.js';
import { B } from '../data/buildings.js';
import { RES } from '../data/resources.js';
import { G, sel } from '../game/state.js';
import { RINGG, quadG } from './decals.js';
import { bx, mat, mergeStatic } from './kit.js';
import { makeBuilding, makeCamp, wallMask } from './models.js';
import { nodesNeedUpdate, rebuildNodes } from './nodes.js';
import { FOEK, makeUnit, makeVillager } from './people.js';
import { S3 } from './scene.js';
import { buildTerrain, flushTerrain, paintAll, pendingTiles, repaintTile } from './terrain.js';
import { dirtyGround, node, road } from '../world/world.js';

export const BG3 = new T3.Group(),
  EG3 = new T3.Group(),
  CG3 = new T3.Group();
S3.add(BG3, EG3, CG3);
export const bRec = new Map(),
  eRec = new Map(),
  cRec = new Map();
let lastG = null,
  terrSnap = null,
  unlSig = '';
function scaffold(g, s, h) {
  const m = mat('#8a6a40');
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    bx(g, 0.05, h, 0.05, m, x * s * 0.46, 0, z * s * 0.46);
  bx(g, s * 0.95, 0.04, 0.04, m, 0, h * 0.6, s * 0.46);
  bx(g, 0.04, 0.04, s * 0.95, m, s * 0.46, h * 0.6, 0);
}
export function syncBuildings() {
  const seen = new Set();
  for (const b of G.bs) {
    const d = B[b.type],
      s = d.size;
    seen.add(b.id);
    const key =
      b.type +
      '|' +
      (b.type === 'townhall' ? G.age : '') +
      '|' +
      (b.done ? 1 : 0) +
      '|' +
      (d.wall ? wallMask(b) : '');
    let r = bRec.get(b.id);
    if (!r || r.key !== key) {
      if (r) BG3.remove(r.g);
      const g = new T3.Group(),
        m = makeBuilding(b.type, G.age, b);
      g.add(m);
      g.position.set(b.x + s / 2, 0, b.y + s / 2);
      const box = new T3.Box3().setFromObject(m);
      const h = Math.max(0.3, box.max.y);
      if (!b.done) {
        scaffold(g, s, Math.max(0.5, h * 0.9));
        const f = new T3.Mesh(quadG, mat('#a58a62'));
        f.scale.set(s * 0.98, 1, s * 0.98);
        f.position.y = 0.02;
        f.receiveShadow = true;
        g.add(f);
      }
      g.traverse(o => {
        o.userData.bid = b.id;
      });
      BG3.add(g);
      const fires = [],
        flags = [],
        pumps = [],
        lamps = [],
        spins = [];
      g.traverse(o => {
        if (o.userData.fire) fires.push(o);
        if (o.userData.flag) flags.push(o);
        if (o.userData.pump) pumps.push(o);
        if (o.userData.lamp) lamps.push(o);
        if (o.userData.spin) spins.push(o);
      });
      r = { g, m, key, h, fires, flags, pumps, lamps, spins };
      bRec.set(b.id, r);
      store.mapVersion++;
    }
    if (!b.done) {
      const p = Math.min(1, b.prog / b.bt);
      r.m.scale.set(1, 0.12 + 0.88 * p, 1);
    } else {
      const pt = b.pop_t != null ? G.t - b.pop_t : 9;
      r.m.scale.setScalar(pt < 0.45 ? 1 + Math.sin((pt / 0.45) * Math.PI) * 0.08 : 1);
    }
    for (const f of r.fires) {
      const k = 0.85 + Math.sin(store.TM * 13 + b.id) * 0.1 + Math.sin(store.TM * 7.3 + b.id * 2) * 0.08;
      f.scale.set(1, k * (b.on === false ? 0.2 : 1), 1);
    }
    for (const f of r.flags) f.rotation.y = Math.sin(store.TM * 2 + b.id) * 0.25;
    for (const p of r.pumps) if (b.on && b.done) p.rotation.z = Math.sin(store.TM * 2.2 + b.id) * 0.25;
    // Draaiende delen (molenwieken, waterrad, ringen) draaien alleen als het gebouw af is en aan staat
    if (b.done && b.on !== false)
      for (const o of r.spins) o.rotation[o.userData.axis || 'y'] = store.TM * o.userData.spin + b.id;
  }
  for (const [id, r] of bRec)
    if (!seen.has(id)) {
      BG3.remove(r.g);
      bRec.delete(id);
      store.mapVersion++;
    }
}
function entKey(e) {
  return e.kind === 'v' ? 'v' + e.job : e.kind === 'u' ? 'u' + e.k : 'f' + e.type;
}
const BASEG = new T3.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
/** Positie om te tekenen: tussen vorige en huidige speltik in. Bij een grote sprong (teleport) niet. */
export function smoothPos(e) {
  if (e.prevX == null || Math.abs(e.x - e.prevX) + Math.abs(e.y - e.prevY) > 2) return [e.x, e.y];
  const a = store.alpha;
  return [e.prevX + (e.x - e.prevX) * a, e.prevY + (e.y - e.prevY) * a];
}

// Grote eenheden (paarden, wagens, geschut) krijgen een grotere selectiecirkel
const BIG_RING = new Set([
  'tank',
  'knight',
  'chariot',
  'cuirassier',
  'trebuchet',
  'bombard',
  'rocket',
  'mech',
]);
function syncEnt(e, make) {
  let r = eRec.get(e.id);
  const key = entKey(e);
  if (!r || r.key !== key) {
    if (r) EG3.remove(r.g);
    // g = de houder (positie, draaiing, cirkels eronder), body = alleen het figuur zelf (voor de omlijning)
    const body = make(),
      g = new T3.Group();
    g.add(body);
    body.traverse(o => {
      if (o.isMesh) o.castShadow = e.kind !== 'v' && !(e.kind === 'f' && e.camp);
    });
    EG3.add(g);
    r = { g, body, key, px: e.x, py: e.y, ang: 0, mv: 0, selT: -9 };
    const ring = new T3.Mesh(
      RINGG,
      new T3.MeshBasicMaterial({ color: '#9fe28a', transparent: true, opacity: 0.95, depthWrite: false }),
    );
    r.ringSize = e.kind === 'u' && BIG_RING.has(e.k) ? 0.42 : 0.28;
    ring.scale.setScalar(r.ringSize);
    // Gekleurde schijf onder elk figuur, zodat je in één oogopslag ziet wie wie is:
    // licht = dorpeling, blauw = jouw leger, rood = vijand
    const base = new T3.Mesh(
      BASEG,
      new T3.MeshBasicMaterial({
        color: e.kind === 'v' ? '#f1e6c4' : e.kind === 'u' ? '#3d8bff' : '#ff4a3a',
        transparent: true,
        opacity: e.kind === 'v' ? 0.32 : 0.55,
        depthWrite: false,
      }),
    );
    base.scale.setScalar(
      e.kind === 'v' ? 0.18 : e.kind === 'u' && (e.k === 'tank' || e.k === 'knight') ? 0.4 : 0.25,
    );
    base.position.y = 0.025;
    base.renderOrder = 2;
    g.add(base);
    ring.position.y = 0.03;
    ring.renderOrder = 3;
    g.add(ring);
    r.ring = ring;
    g.traverse(o => {
      o.userData.eid = e.id;
    });
    eRec.set(e.id, r);
  }
  r.seen = 1;
  // Teken tussen de vorige en de huidige speltik in (zie store.alpha), voor vloeiende beweging
  const [ex, ey] = smoothPos(e);
  e.rx = ex;
  e.ry = ey;
  const g = r.g,
    dx = ex - r.px,
    dy = ey - r.py,
    sp = Math.hypot(dx, dy);
  r.mv = r.mv * 0.8 + sp * 60 * 0.2;
  if (sp > 0.002) r.ang = Math.atan2(dx, dy);
  else if (e.tgt && e.tgt.x != null && !e.tgt.dead) {
    const tx = e.tgt.x + (e.tgt.kind === 'b' ? B[e.tgt.type].size / 2 : 0),
      ty = e.tgt.y + (e.tgt.kind === 'b' ? B[e.tgt.type].size / 2 : 0);
    if (Math.hypot(tx - ex, ty - ey) > 0.05) r.ang = Math.atan2(tx - ex, ty - ey);
  }
  r.px = ex;
  r.py = ey;
  g.position.set(ex, 0, ey);
  const da = ((r.ang - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
  g.rotation.y += da * 0.25;
  return r;
}
function animPerson(g, walk, work, t) {
  const L = g.userData.limbs;
  if (!L) return;
  const s = walk ? Math.sin(t * 11) * 0.6 : 0;
  L.lL.rotation.x = s;
  L.lR.rotation.x = -s;
  L.aL.rotation.x = -s * 0.7;
  L.aR.rotation.x = work ? -1.2 + Math.sin(t * 9) * 0.9 : s * 0.7;
}
// Selectiecirkel: verschijnt met een kort "plopje" (groter, dan terug naar normaal) en pulseert zacht
function showRing(r, on) {
  if (on && !r.ring.visible) r.selT = store.TM;
  r.ring.visible = on;
  if (!on) return;
  const pop = Math.max(0, 1 - (store.TM - r.selT) / 0.22);
  r.ring.scale.setScalar(r.ringSize * (1 + pop * 0.6));
  r.ring.material.opacity = 0.75 + Math.sin(store.TM * 4) * 0.15 + pop * 0.1;
}

export function syncEntities() {
  for (const r of eRec.values()) r.seen = 0;
  for (const v of G.vs) {
    if (v.hidden) continue;
    const r = syncEnt(v, () => makeVillager(v.job));
    const work = v.state === 'gather' || v.state === 'build';
    animPerson(r.body, r.mv > 0.3, work, store.TM + v.id);
    const c = r.body.userData.carry;
    if (c) {
      c.visible = v.carry.amt > 0;
      if (c.visible) c.material = mat(RES[v.carry.res] ? RES[v.carry.res].c : '#8a6a44');
    }
    showRing(r, sel.vs.has(v.id));
  }
  for (const u of G.us) {
    const r = syncEnt(u, () => makeUnit(u.k, false));
    const f = r.body.userData.fly;
    if (f) {
      f.position.y = 0.9 + Math.sin(store.TM * 3 + u.id) * 0.06;
      f.traverse(o => {
        if (o.userData.rotor) o.rotation.y = store.TM * 30;
      });
    } else
      animPerson(
        r.body.userData.rider || r.body,
        r.mv > 0.3,
        u.cd > 0 && u.tgt && r.mv < 0.3,
        store.TM + u.id,
      );
    showRing(r, sel.us.has(u.id));
  }
  for (const f of G.foes) {
    const r = syncEnt(f, () => makeUnit(FOEK[f.type] || 'plunder', true));
    const fl = r.body.userData.fly;
    if (fl) {
      fl.position.y = 0.9 + Math.sin(store.TM * 3 + f.id) * 0.06;
      fl.traverse(o => {
        if (o.userData.rotor) o.rotation.y = store.TM * 30;
      });
    } else animPerson(r.body, r.mv > 0.3, false, store.TM + f.id);
    r.g.visible = !f.retreat || f.alpha > 0.05;
    r.ring.visible = false;
  }
  for (const [id, r] of eRec)
    if (!r.seen) {
      EG3.remove(r.g);
      eRec.delete(id);
    }
}
export function syncCamps() {
  const seen = new Set();
  for (const c of G.camps) {
    if (!c.alive) continue;
    seen.add(c.id);
    let r = cRec.get(c.id);
    if (!r) {
      const g = new T3.Group();
      makeCamp(g, c.tier);
      mergeStatic(g);
      g.position.set(c.x + 1, 0, c.y + 1);
      g.traverse(o => {
        o.userData.camp = c.id;
      });
      CG3.add(g);
      const fires = [];
      g.traverse(o => {
        if (o.userData.fire) fires.push(o);
      });
      r = { g, fires };
      cRec.set(c.id, r);
    }
    for (const f of r.fires) f.scale.y = 0.85 + Math.sin(store.TM * 12 + c.id) * 0.15;
  }
  for (const [id, r] of cRec)
    if (!seen.has(id)) {
      CG3.remove(r.g);
      cRec.delete(id);
    }
}
function resetWorld3D() {
  for (const m of [bRec, eRec, cRec]) for (const r of m.values()) (r.g.parent || S3).remove(r.g);
  bRec.clear();
  eRec.clear();
  cRec.clear();
  buildTerrain();
  paintAll();
  rebuildNodes(true);
  terrSnap = road.slice();
  unlSig = G.unl.join('');
  store.nodeSnap = node.slice();
  store.nodeAge = G.age;
  lastG = G;
}
export function checkWorld() {
  if (lastG !== G) {
    resetWorld3D();
    return;
  }
  // Nieuw gebied gekocht: alleen die stukken grond (plus een rand) opnieuw schilderen
  const us = G.unl.join('');
  if (us !== unlSig) {
    const before = unlSig;
    unlSig = us;
    for (let c = 0; c < CN * CN; c++) {
      if (before[c] === us[c]) continue;
      const cx = (c % CN) * CS,
        cy = Math.floor(c / CN) * CS;
      for (let y = cy - 1; y <= cy + CS; y++)
        for (let x = cx - 1; x <= cx + CS; x++) if (x >= 0 && y >= 0 && x < W && y < H) repaintTile(x, y);
    }
    rebuildNodes(false);
    store.nodeSnap = node.slice();
  }
  for (const i of dirtyGround) repaintTile(i % W, (i / W) | 0);
  dirtyGround.clear();
  for (let i = 0; i < W * H; i++)
    if (road[i] !== terrSnap[i]) {
      terrSnap[i] = road[i];
      repaintTile(i % W, (i / W) | 0);
    }
  if (pendingTiles()) store.mapVersion++;
  flushTerrain();
  let nc = G.age !== store.nodeAge || nodesNeedUpdate();
  if (!nc)
    for (let i = 0; i < W * H; i++)
      if (node[i] !== store.nodeSnap[i]) {
        nc = true;
        break;
      }
  if (nc) {
    store.mapVersion++;
    store.nodeSnap = node.slice();
    store.nodeAge = G.age;
    rebuildNodes(false);
  }
}
