// Selecteren en opdrachten geven (lopen, aanvallen, verzamelen).
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { CN, W } from '../config.js';
import { B } from '../data/buildings.js';
import { NODES } from '../data/nodes.js';
import { RES } from '../data/resources.js';
import { UNITS } from '../data/units.js';
import { burst, fxRing } from '../game/fx.js';
import { buyChunk, canBuyChunk, tryPlace } from '../game/placement.js';
import { G, bById, sel } from '../game/state.js';
import { walkTo } from '../game/villagers.js';
import { mouse } from './input.js';
import { proj, s2iso, s2t } from '../render/camera.js';
import { nearScreen, pickGroup } from '../render/picking.js';
import { BG3, CG3 } from '../render/sync.js';
import { RG3 } from '../render/rivals3d.js';
import { landOwner, orderRivalAttack, rbById } from '../game/rivals.js';
import { RIVAL } from '../data/rivals.js';
import { setExpand, toast } from '../ui/hud.js';
import { demolish } from '../ui/inspector.js';
import { canDemolish } from '../game/wonders.js';
import { bmap, inb, isUnl, node, nodeVis, road, walkable } from '../world/world.js';
import { VH, VW } from '../render/scene.js';

export const selVills = () => G.vs.filter(v => sel.vs.has(v.id));
export const selUnits = () => G.us.filter(u => sel.us.has(u.id));
export function resetV(v) {
  if (v.hidden) {
    v.hidden = false;
    const b = bById.get(v.shelter);
    if (b) {
      v.x = b.x + 0.5;
      v.y = b.y + B[b.type].size + 0.2;
    }
  }
  v.tgt = null;
  v.path = null;
  v.state = 'idle';
  v.wait = 0;
  v.prefSite = null;
  v.keep = null;
}
const LIFT = e => (e.kind === 'u' ? (UNITS[e.k].fly ? 1 : 0.35) : e.kind === 'f' ? (e.air ? 1 : 0.35) : 0.35);
export const villAt = (X, Y) => nearScreen(G.vs, X, Y, 16, LIFT);
export const unitAt = (X, Y) => nearScreen(G.us, X, Y, 16, LIFT);
export const foeAt = (X, Y) => nearScreen(G.foes, X, Y, 18, LIFT);
export function campAt(X, Y) {
  const id = pickGroup(X, Y, CG3, 'camp');
  if (id != null) return G.camps.find(c => c.id === id && c.alive);
  const [tx, ty] = s2t(X, Y);
  return G.camps.find(
    c => c.alive && tx >= c.x - 0.6 && tx <= c.x + 2.6 && ty >= c.y - 0.6 && ty <= c.y + 2.6,
  );
}
export function bAtScreen(X, Y) {
  const id = pickGroup(X, Y, BG3, 'bid');
  if (id != null) {
    const b = bById.get(id);
    if (b) return b;
  }
  const [tx, ty] = s2t(X, Y),
    ix = Math.floor(tx),
    iy = Math.floor(ty);
  if (!inb(ix, iy)) return null;
  return bById.get(bmap[iy * W + ix]) || null;
}
/** Het gebouw van een rivaal op deze plek van het scherm, of null. */
export function rbAt(X, Y) {
  const id = pickGroup(X, Y, RG3, 'rbid');
  if (id != null && rbById.get(id)) return rbById.get(id);
  const [tx, ty] = s2t(X, Y),
    ix = Math.floor(tx),
    iy = Math.floor(ty);
  if (!inb(ix, iy)) return null;
  return rbById.get(bmap[iy * W + ix]) || null;
}
export function clearSel() {
  sel.vs.clear();
  sel.us.clear();
  sel.b = null;
  sel.camp = null;
  sel.node = -1;
  sel.rb = null;
  sel.rival = null;
  sel.rivalUnit = null;
  store.demolishArm = 0;
}
function command(X, Y, tx, ty) {
  const us = selUnits(),
    vs = selVills();
  let did = false;
  if (us.length) {
    const f = foeAt(X, Y),
      c = !f && campAt(X, Y),
      rb = !f && !c && rbAt(X, Y);
    if (f || c || rb) {
      const target = f || c || rb;
      // Een gebouw van een rivaal: ze blijven daarna in hun stad (zie game/rivals.js)
      if (rb) orderRivalAttack(us, rb);
      else
        for (const u of us) {
          u.tgt = target;
          u.order = 'attack';
          u.path = null;
        }
      const s = rb ? B[rb.type].size / 2 : 1;
      fxRing(f ? f.x : target.x + s, f ? f.y : target.y + s, '#c0473b');
      toast(`${us.length} ${us.length === 1 ? 'eenheid valt' : 'eenheden vallen'} aan.`);
      did = true;
    } else {
      const n = us.length,
        cols = Math.ceil(Math.sqrt(n));
      us.forEach((u, k) => {
        u.tgt = null;
        u.order = 'move';
        u.path = null;
        u.gx = tx + ((k % cols) - (cols - 1) / 2) * 0.8;
        u.gy = ty + (Math.floor(k / cols) - (cols - 1) / 2) * 0.8;
      });
      fxRing(tx, ty, '#ffffff');
      did = true;
    }
  }
  if (vs.length) {
    const ix = Math.floor(tx),
      iy = Math.floor(ty),
      b = bAtScreen(X, Y);
    if (b && !b.done) {
      vs.forEach(v => {
        resetV(v);
        v.job = 'build';
        v.prefSite = b;
      });
      toast(`${vs.length} × naar de bouwplaats.`);
      did = true;
    } else if (b && b.type === 'farm') {
      vs.forEach(v => {
        resetV(v);
        v.job = 'food';
        v.keep = { k: 'farm', b };
      });
      toast(`${vs.length} × naar de akker.`);
      did = true;
    } else {
      const i = iy * W + ix;
      if (inb(ix, iy) && nodeVis(i) && !NODES[node[i]].pump && isUnl(ix, iy)) {
        const r = NODES[node[i]].res;
        vs.forEach(v => {
          resetV(v);
          v.job = r;
          v.keep = { k: 'node', i };
        });
        toast(`${vs.length} × naar ${RES[r].n.toLowerCase()}.`);
        did = true;
      } else if (walkable(ix, iy)) {
        vs.forEach(v => {
          resetV(v);
          walkTo(v, ix, iy, 'hold');
        });
        did = true;
      }
    }
    if (did) fxRing(ix + 0.5, iy + 0.5, '#ffffff');
  }
  if (did) sfx('tick');
  store.uiDirty = true;
  return did;
}
export function leftClick(sx, sy, shift, ctrl) {
  const [X, Y] = s2iso(sx, sy),
    [tx, ty] = s2t(sx, sy),
    ix = Math.floor(tx),
    iy = Math.floor(ty);
  if (store.expandMode) {
    const cx = ix >> 4,
      cy = iy >> 4;
    const rival = inb(ix, iy) && landOwner(cy * CN + cx);
    if (inb(ix, iy) && canBuyChunk(cx, cy)) buyChunk(cx, cy);
    else if (rival) toast(`Dit land is van ${RIVAL[rival.k].n}. Verwoest hun stamhuis om het te veroveren.`);
    else toast('Kies een gemarkeerd gebied dat aan je land grenst.');
    return;
  }
  if (store.placing) {
    tryPlace(shift);
    return;
  }
  if (store.demoMode) {
    const b = bAtScreen(X, Y);
    // Het stamhuis en een af wereldwonder breek je niet af (zie canDemolish)
    if (b && canDemolish(b)) {
      demolish(b);
      sfx('boom');
    } else if (inb(ix, iy) && road[iy * W + ix]) {
      road[iy * W + ix] = 0;
      burst(ix + 0.5, iy + 0.5, '#8a7a62');
      sfx('tick');
    } else if (b) toast(`${B[b.type].n} kun je niet afbreken.`, 'bad');
    return;
  }
  if (store.cmdMode && sel.us.size) {
    issueOrder(store.cmdMode, tx, ty);
    return;
  }
  const u = unitAt(X, Y);
  if (u && ctrl) return selectSameType(u);
  if (u) {
    sfx('select');
    if (!shift) clearSel();
    sel.vs.clear();
    sel.b = null;
    if (sel.us.has(u.id) && shift) sel.us.delete(u.id);
    else sel.us.add(u.id);
    store.uiDirty = true;
    return;
  }
  const v = villAt(X, Y);
  if (v && ctrl) return selectSameType(v);
  if (v) {
    sfx('select');
    if (!shift) clearSel();
    sel.us.clear();
    sel.b = null;
    if (sel.vs.has(v.id) && shift) sel.vs.delete(v.id);
    else sel.vs.add(v.id);
    store.uiDirty = true;
    return;
  }
  if (sel.us.size && (foeAt(X, Y) || campAt(X, Y) || rbAt(X, Y))) {
    command(X, Y, tx, ty);
    return;
  }
  if (sel.vs.size && inb(ix, iy)) {
    const b = bAtScreen(X, Y),
      i = iy * W + ix;
    if ((b && (!b.done || b.type === 'farm')) || (nodeVis(i) && !NODES[node[i]].pump && isUnl(ix, iy))) {
      command(X, Y, tx, ty);
      return;
    }
  }
  const b = bAtScreen(X, Y);
  if (b) {
    sfx('select');
    clearSel();
    sel.b = b.id;
    store.uiDirty = true;
    return;
  }
  const c = campAt(X, Y);
  if (c) {
    clearSel();
    sel.camp = c.id;
    store.uiDirty = true;
    return;
  }
  // Iets van een rivaal: een gebouw selecteren, of bij een soldaat de rivaal zelf bekijken
  const rb = rbAt(X, Y);
  if (rb) {
    sfx('select');
    clearSel();
    sel.rb = rb.id;
    store.uiDirty = true;
    return;
  }
  const rf = foeAt(X, Y);
  if (rf && rf.rival) {
    sfx('select');
    clearSel();
    sel.rival = rf.rival;
    sel.rivalUnit = rf.id; // zo kan de kaart ook "Val deze soldaat aan" tonen
    store.uiDirty = true;
    return;
  }
  if (mouse.touch && (sel.us.size || sel.vs.size) && inb(ix, iy) && !nodeVis(iy * W + ix)) {
    command(X, Y, tx, ty);
    return;
  }
  if (inb(ix, iy) && nodeVis(iy * W + ix)) {
    clearSel();
    sel.node = iy * W + ix;
    store.uiDirty = true;
    return;
  }
  if (!shift) clearSel();
  store.uiDirty = true;
}
export function rightClick(sx, sy) {
  const [X, Y] = s2iso(sx, sy),
    [tx, ty] = s2t(sx, sy);
  if (store.cmdMode) {
    store.cmdMode = null;
    store.uiDirty = true;
    return;
  }
  if (store.demoMode) {
    store.demoMode = false;
    store.uiDirty = true;
    return;
  }
  if (store.placing) {
    store.placing = null;
    store.uiDirty = true;
    return;
  }
  if (store.expandMode) {
    setExpand(false);
    return;
  }
  if (sel.vs.size || sel.us.size) {
    command(X, Y, tx, ty);
    return;
  }
  const b = sel.b && bById.get(sel.b);
  if (b && B[b.type].train) {
    b.rally = { x: tx, y: ty };
    fxRing(tx, ty, '#ffffff');
    toast('Verzamelpunt gezet.');
    return;
  }
  clearSel();
  store.uiDirty = true;
}
function issueOrder(mode, tx, ty) {
  const us = selUnits(),
    n = us.length,
    cols = Math.ceil(Math.sqrt(n));
  us.forEach((u, k) => {
    u.tgt = null;
    u.path = null;
    u.order = mode;
    u.px = u.x;
    u.py = u.y;
    u.gx = tx + ((k % cols) - (cols - 1) / 2) * 0.8;
    u.gy = ty + (Math.floor(k / cols) - (cols - 1) / 2) * 0.8;
  });
  fxRing(tx, ty, mode === 'amove' ? '#e3584a' : '#e2b92c');
  toast(
    mode === 'amove'
      ? `Aanvalsmars: ${n} ${n === 1 ? 'eenheid' : 'eenheden'} vechten onderweg.`
      : `Patrouille: ${n} ${n === 1 ? 'eenheid loopt' : 'eenheden lopen'} heen en weer.`,
  );
  sfx('tick');
  store.cmdMode = null;
  store.uiDirty = true;
}
/** Eenheden en dorpelingen binnen een kader op het scherm (soldaten gaan voor als die erin staan). */
export function entitiesInBox(x0, y0, x1, y1) {
  const a = Math.min(x0, x1),
    b = Math.min(y0, y1),
    c = Math.max(x0, x1),
    d = Math.max(y0, y1);
  const inBox = e => {
    const [sx, sy] = proj(e.rx ?? e.x, 0.3, e.ry ?? e.y);
    return sx >= a && sx <= c && sy >= b && sy <= d;
  };
  const us = G.us.filter(inBox);
  return { us, vs: us.length ? [] : G.vs.filter(v => !v.hidden && inBox(v)) };
}

/** Kader-selectie. Met add (Shift) komt het erbij in plaats van de oude selectie te vervangen. */
export function boxSelect(x0, y0, x1, y1, add) {
  const { us, vs } = entitiesInBox(x0, y0, x1, y1);
  if (!add) clearSel();
  if (us.length) sel.vs.clear();
  us.forEach(u => sel.us.add(u.id));
  if (!us.length && !sel.us.size) vs.forEach(v => sel.vs.add(v.id));
  if (us.length || vs.length) sfx('select');
  store.uiDirty = true;
}

/** Selecteer alles van hetzelfde soort dat nu in beeld is (dubbelklik of Ctrl-klik). */
export function selectSameType(e) {
  const onScreen = o => {
    const [sx, sy, sz] = proj(o.rx ?? o.x, 0.3, o.ry ?? o.y);
    return sz < 1 && sx >= 0 && sy >= 0 && sx <= VW && sy <= VH;
  };
  clearSel();
  if (e.kind === 'u') G.us.filter(o => o.k === e.k && onScreen(o)).forEach(o => sel.us.add(o.id));
  else G.vs.filter(o => !o.hidden && o.job === e.job && onScreen(o)).forEach(o => sel.vs.add(o.id));
  sfx('select');
  store.uiDirty = true;
}
