// Opslaan en laden in de browser.
import { store } from '../core/store.js';
import { CX, CY, H, TH, TW, W } from '../config.js';
import { B } from '../data/buildings.js';
import { computeAvail, computeCaches } from './caches.js';
import { spawnFoe, spawnUnit, spawnVillager } from './entities.js';
import { G, bById, baseState, setGame } from './state.js';
import { setZoom } from '../input/input.js';
import { clearSel } from '../input/selection.js';
import { clampCam } from '../render/camera.js';
import { cam } from '../render/scene.js';
import { onAgeChange } from '../ui/age.js';
import { sigs } from '../ui/header.js';
import { setSpeed, toast } from '../ui/hud.js';
import { $ } from '../util/dom.js';
import { amt, bmap, buildLists, genWorld, node, road, setBlk } from '../world/world.js';

// Versie 4: grotere, nieuwe wereldgenerator. Oude opslag (v3) past daar niet meer bij.
export const SKEY = 'tijdperken-save-v4';
function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000)
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function ub64(b) {
  const s = atob(b),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
export function serialize() {
  const g = {};
  for (const k of [
    'age',
    'res',
    't',
    'clock',
    'day',
    'unl',
    'raids',
    'tools',
    'carryCap',
    'autoTrain',
    'peaceful',
    'won',
    'bought',
    'stats',
    'nid',
    'trainQ',
    'log',
    'toolLvl',
    'armsLvl',
    'rain',
    'groups',
    'hist',
    'stance',
    'diff',
    'tech',
    'research',
    'buff',
    'forceRaid',
    'lastEvent',
    'nextMeteor',
  ])
    g[k] = G[k];
  return JSON.stringify({
    v: 4,
    size: W,
    seed: G.seed,
    g,
    road: b64(road),
    node: b64(node),
    amt: b64(new Uint8Array(amt.buffer)),
    bs: G.bs.map(b => ({
      id: b.id,
      type: b.type,
      lvl: b.lvl || 0,
      x: b.x,
      y: b.y,
      hp: b.hp,
      done: b.done,
      prog: b.prog,
      bt: b.bt,
      on: b.on,
      q: b.q,
      rally: b.rally,
    })),
    vs: G.vs.map(v => ({ x: v.x, y: v.y, name: v.name, job: v.job, hp: v.hp })),
    us: G.us.map(u => ({ k: u.k, x: u.x, y: u.y, hp: u.hp, st: u.stance || 'guard', id: u.id })),
    camps: G.camps.map(c => ({
      id: c.id,
      x: c.x,
      y: c.y,
      tier: c.tier,
      hp: c.hp,
      mhp: c.mhp,
      alive: c.alive,
    })),
    guards: G.foes
      .filter(f => f.camp)
      .map(f => ({ type: f.type, x: f.x, y: f.y, hp: f.hp, mhp: f.mhp, camp: f.camp })),
    cam: { x: cam.x, y: cam.y, z: cam.z },
    cv: 2,
  });
}
export function deserialize(str) {
  const s = JSON.parse(str);
  if (s.v !== 4 || s.size !== W) return false;
  setGame(baseState(s.seed));
  genWorld(s.seed);
  Object.assign(G, s.g);
  G.groups = G.groups || {};
  G.hist = G.hist || [];
  G.offer = null;
  G.stats = Object.assign(baseState(0).stats, s.g.stats);
  G.log = s.g.log || [];
  G.toolLvl = s.g.toolLvl || 0;
  G.armsLvl = s.g.armsLvl || 0;
  G.tech = G.tech || {};
  G.buff = G.buff || {};
  G.diff = G.diff == null ? 1 : G.diff;
  G.event = null;
  if (s.road) road.set(ub64(s.road));
  node.set(ub64(s.node));
  amt.set(new Uint16Array(ub64(s.amt).buffer));
  buildLists();
  bById.clear();
  for (const o of s.bs) {
    const d = B[o.type];
    const b = {
      ...o,
      kind: 'b',
      cd: 0,
      ct: 0,
      gt: d.gen ? d.gen.t : 0,
      run: false,
      qt: 0,
      act: 0,
      q: o.q || [],
    };
    G.bs.push(b);
    bById.set(b.id, b);
    for (let dy = 0; dy < d.size; dy++)
      for (let dx = 0; dx < d.size; dx++) bmap[(b.y + dy) * W + b.x + dx] = b.id;
    if (b.done) setBlk(b, true);
  }
  for (const o of s.vs) {
    const v = spawnVillager(o.x, o.y);
    v.name = o.name;
    v.job = o.job;
    v.hp = o.hp;
  }
  for (const o of s.us) {
    const u = spawnUnit(o.k, o.x, o.y);
    u.hp = o.hp;
    u.stance = o.st || 'guard';
    if (o.id) u.id = o.id;
  }
  G.camps = s.camps.map(c => ({ ...c, kind: 'c' }));
  for (const o of s.guards) {
    const c = G.camps.find(c => c.id === o.camp);
    if (!c) continue;
    const f = spawnFoe(o.type, o.x, o.y, 1, c);
    f.hp = o.hp;
    f.mhp = o.mhp;
    f.hx = c.x + 1 + (Math.random() - 0.5) * 3;
    f.hy = c.y + 1 + (Math.random() - 0.5) * 3;
  }
  if (s.cam) {
    let x = s.cam.x,
      y = s.cam.y;
    if (s.cv !== 2) {
      const X = x,
        Y = y;
      x = (X / TW + Y / TH) / 2;
      y = (Y / TH - X / TW) / 2;
      if (!(x >= 0 && x <= W && y >= 0 && y <= H)) {
        x = CX;
        y = CY;
      }
    }
    cam.x = x;
    cam.y = y;
    cam.z = s.cam.z || 1;
    clampCam();
  }
  clearSel();
  afterLoad();
  return true;
}
export function save(manual) {
  try {
    localStorage.setItem(SKEY, serialize());
    $('#saved').lastChild.textContent = `Opgeslagen op dag ${G.day}`;
    if (manual) toast('Spel opgeslagen.', 'good');
  } catch (e) {
    $('#saved').lastChild.textContent = 'Opslaan lukt niet in deze browser';
    if (manual) toast('Opslaan lukt niet in deze browser.', 'bad');
  }
}
export function load() {
  try {
    const s = localStorage.getItem(SKEY);
    if (!s) return false;
    return deserialize(s);
  } catch (e) {
    return false;
  }
}
export function wipe() {
  try {
    localStorage.removeItem(SKEY);
  } catch (e) {}
}
export function afterLoad() {
  computeCaches();
  computeAvail();
  onAgeChange();
  setSpeed(1);
  setZoom(cam.z);
  for (const k in sigs) sigs[k] = null;
  store.uiDirty = true;
}
addEventListener('visibilitychange', () => {
  if (document.hidden && G && !G.over) save();
});
