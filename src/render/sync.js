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
import { animEntity, clearDying, initAnim, startDeath } from './animate.js';
import { LAYER, clearParticles, emit, puff } from './particles.js';
import { markOrder } from './effects.js';
import { camDist } from './camera.js';
import { S3, cam } from './scene.js';
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
// Steigers rond een bouwplaats: palen, liggers op een paar hoogtes en een schoor
function scaffold(g, s, h) {
  const m = mat('#8a6a40'),
    plank = mat('#9a7c52'),
    e = s * 0.5;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, 1],
    [1, 0],
  ])
    bx(g, 0.045, h, 0.045, m, x * e, 0, z * e);
  for (let y = 0.3; y < h; y += 0.38) {
    bx(g, s, 0.035, 0.035, m, 0, y, e);
    bx(g, 0.035, 0.035, s, m, e, y, 0);
    // Loopplank op de voorkant
    bx(g, s * 0.98, 0.02, 0.12, plank, 0, y + 0.03, e + 0.07);
  }
  const brace = bx(g, 0.03, Math.hypot(e, h) * 0.95, 0.03, m, -e * 0.5, 0, e);
  brace.rotation.z = -Math.atan2(e, h);
}
let lastBT = 0;
const tmpV = new T3.Vector3();
// Rook uit schoorstenen: dunne pluimpjes bij huizen, dikkere grijze rook bij werkplaatsen die draaien
function chimneySmoke(r, b, d, dt) {
  if (!r.chims.length || !b.done) return;
  const busy = (d.conv || d.gen) && b.act > 0;
  const rate = busy ? 2.6 : 1.6;
  r.smokeT = (r.smokeT || Math.random()) - dt * rate;
  if (r.smokeT > 0) return;
  r.smokeT += 1;
  if (Math.abs(r.g.position.x - cam.x) + Math.abs(r.g.position.z - cam.y) > camDist() * 1.6) return;
  for (const c of r.chims)
    emit(
      LAYER.soft,
      c[0],
      c[1],
      c[2],
      0.12 + Math.random() * 0.06,
      busy ? 0.5 : 0.32,
      -0.06,
      busy ? 3.4 : 3.2,
      0.05,
      busy ? 0.45 : 0.32,
      busy ? 0x8f8b84 : 0xdedad2,
      busy ? 0.55 : 0.5,
    );
}
// Bouwplaats: stofwolkjes zolang er gewerkt wordt; bij oplevering een stofring en wat glinstering
function buildDust(r, b, s, dt) {
  if (b.prog > (r.prevProg ?? b.prog) && Math.random() < dt * 5) {
    const side = Math.random() * 4,
      u = Math.random() - 0.5;
    const x = side < 1 ? u * s : side < 2 ? s / 2 : side < 3 ? u * s : -s / 2,
      z = side < 1 ? s / 2 : side < 2 ? u * s : side < 3 ? -s / 2 : u * s;
    puff(LAYER.soft, 2, r.g.position.x + x, 0.08, r.g.position.z + z, 0.4, 0.3, 1, 0.06, 0.2, 0xc9b48a, 0.55);
  }
  r.prevProg = b.prog;
}
function finishedBurst(g, s) {
  const p = g.position;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    emit(
      LAYER.soft,
      p.x + Math.sin(a) * s * 0.5,
      0.08,
      p.z + Math.cos(a) * s * 0.5,
      Math.sin(a) * 1.2,
      0.15,
      Math.cos(a) * 1.2,
      1.1,
      0.08,
      0.3,
      0xd2c09a,
      0.6,
    );
  }
  puff(LAYER.glow, 10, p.x, 0.6, p.z, 0.8, 1.5, 0.9, 0.04, 0.01, 0xffe6a0, 0.9, -1.5);
}
// Treffer op een gebouw: stof en een paar vonken ergens op de gevel
function buildingHit(r, s) {
  const p = r.g.position,
    x = p.x + (Math.random() - 0.5) * s * 0.8,
    z = p.z + (Math.random() - 0.5) * s * 0.8,
    y = 0.2 + Math.random() * r.h * 0.7;
  puff(LAYER.soft, 3, x, y, z, 0.5, 0.4, 0.9, 0.06, 0.22, 0x9a8c76, 0.6);
  puff(LAYER.glow, 3, x, y, z, 1.4, 1.4, 0.3, 0.035, 0.01, 0xffc070, 1, -4);
}
export function syncBuildings() {
  const seen = new Set(),
    dt = lastBT ? Math.min(0.1, store.TM - lastBT) : 0;
  lastBT = store.TM;
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
      const justFinished = r && !r.done && b.done;
      if (r) BG3.remove(r.g);
      const g = new T3.Group(),
        m = makeBuilding(b.type, G.age, b);
      g.add(m);
      g.position.set(b.x + s / 2, 0, b.y + s / 2);
      const box = new T3.Box3().setFromObject(m);
      const h = Math.max(0.3, box.max.y);
      if (!b.done) {
        scaffold(g, s, Math.max(0.6, h * 0.85));
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
        spins = [],
        chims = [];
      g.updateMatrixWorld(true);
      g.traverse(o => {
        if (o.userData.chim) {
          o.getWorldPosition(tmpV);
          chims.push([tmpV.x, tmpV.y, tmpV.z]);
        }
        if (o.userData.fire) fires.push(o);
        if (o.userData.flag) flags.push(o);
        if (o.userData.pump) pumps.push(o);
        if (o.userData.lamp) lamps.push(o);
        if (o.userData.spin) spins.push(o);
      });
      r = { g, m, key, h, fires, flags, pumps, lamps, spins, chims, done: b.done, flPrev: 0 };
      bRec.set(b.id, r);
      if (justFinished) finishedBurst(g, s);
      store.mapVersion++;
    }
    chimneySmoke(r, b, d, dt);
    const fl = b.flash || 0;
    if (fl > r.flPrev + 0.05) buildingHit(r, s);
    r.flPrev = fl;
    if (!b.done) {
      buildDust(r, b, s, dt);
      // Het gebouw rijst langzaam uit de grond op, binnen de steigers
      const p = Math.min(1, b.prog / b.bt);
      r.m.position.y = -r.h * (1 - (0.12 + 0.88 * p));
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
// Gereedschap dat een dorpeling vasthoudt, voor de juiste werkbeweging
const TOOL = { food: 'hoe', sand: 'hoe', build: 'hammer' };
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
    r.base = base;
    ring.position.y = 0.03;
    ring.renderOrder = 3;
    g.add(ring);
    r.ring = ring;
    g.traverse(o => {
      o.userData.eid = e.id;
    });
    initAnim(r, e.kind, e.kind === 'v' ? 'v' : e.kind === 'u' ? e.k : FOEK[e.type] || 'plunder');
    eRec.set(e.id, r);
  }
  r.seen = 1;
  r.e = e;
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
    const work = (v.state === 'gather' || v.state === 'build') && r.mv < 0.3;
    animEntity(r, v, r.mv > 0.3, work, TOOL[v.job] || (v.state === 'build' ? 'hammer' : 'pick'));
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
    }
    animEntity(r, u, r.mv > 0.3, false);
    // Nieuw looporder voor een geselecteerde eenheid: een markering op de bestemming
    if (u.gx !== r.gx || u.gy !== r.gy) {
      if (r.gx !== undefined && sel.us.has(u.id) && (u.order === 'move' || u.order === 'amove'))
        markOrder(u.gx, u.gy, u.order === 'amove');
      r.gx = u.gx;
      r.gy = u.gy;
    }
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
    }
    animEntity(r, f, r.mv > 0.3, false);
    r.g.visible = !f.retreat || f.alpha > 0.05;
    r.ring.visible = false;
  }
  for (const [id, r] of eRec)
    if (!r.seen) {
      EG3.remove(r.g);
      eRec.delete(id);
      // Gesneuveld (niet: naar binnen gegaan of gevlucht)? Dan laten omvallen.
      if (r.e && r.e.dead && !r.e.retreat && !r.e.hidden) startDeath(r);
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
  clearDying();
  clearParticles();
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
