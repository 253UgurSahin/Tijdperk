// Gebouwen plaatsen en nieuw gebied kopen.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { CN, CS, W } from '../config.js';
import { B } from '../data/buildings.js';
import { NI, NODES } from '../data/nodes.js';
import { RES } from '../data/resources.js';
import { computeAvail } from './caches.js';
import { has, pay } from './economy.js';
import { placeBuilding } from './entities.js';
import { fxRing } from './fx.js';
import { G } from './state.js';
import { mul } from './bonus.js';
import { roadTier } from './upgrades.js';
import { mouse } from '../input/input.js';
import { resetV, selVills } from '../input/selection.js';
import { fmt } from '../ui/format.js';
import { toast } from '../ui/hud.js';
import { TER, bmap, inb, isUnl, node, nodeVis, road, ter } from '../world/world.js';
import { SUCCESSOR, canMake } from '../data/succession.js';

/** Wat een gebouw nu kost. Muren en poorten worden goedkoper door bonussen (zoals 'wall.cost'). */
export function buildCost(type) {
  const d = B[type];
  const factor = d.wall ? mul('wall.cost') : 1;
  if (factor === 1) return d.cost;
  const cost = {};
  for (const k in d.cost) cost[k] = Math.round(d.cost[k] * factor);
  return cost;
}
export function chunkCost() {
  const m = 1 + G.bought * 0.55,
    c = { food: Math.round(80 * m), wood: Math.round(80 * m), stone: Math.round(40 * m) };
  if (G.age >= 3) c.gold = Math.round(12 * m);
  if (G.age >= 5) c.steel = Math.round(5 * m);
  // Bonussen (zoals Zeekaarten) maken uitbreiden goedkoper
  const factor = mul('chunk.cost');
  if (factor !== 1) for (const k in c) c[k] = Math.round(c[k] * factor);
  return c;
}
export function canBuyChunk(cx, cy) {
  if (cx < 0 || cy < 0 || cx >= CN || cy >= CN || G.unl[cy * CN + cx]) return false;
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => {
    const x = cx + dx,
      y = cy + dy;
    return x >= 0 && y >= 0 && x < CN && y < CN && G.unl[y * CN + x];
  });
}
export function buyChunk(cx, cy) {
  const c = chunkCost();
  if (!has(c)) {
    toast('Te weinig grondstoffen voor dit gebied.', 'bad');
    return;
  }
  pay(c);
  G.unl[cy * CN + cx] = 1;
  G.bought++;
  computeAvail();
  const found = new Set();
  for (let y = cy * CS; y < cy * CS + CS; y++)
    for (let x = cx * CS; x < cx * CS + CS; x++) {
      const n = node[y * W + x];
      if (n && NODES[n].age <= G.age && !['tree', 'bush', 'rock', 'sand'].includes(NODES[n].k))
        found.add(NODES[n].n.toLowerCase());
    }
  toast('Nieuw gebied ontgonnen' + (found.size ? `. Gevonden: ${[...found].join(', ')}.` : '.'), 'good');
  fxRing(cx * CS + 8, cy * CS + 8, '#ffffff');
  store.uiDirty = true;
}
const CLEAR = new Set(['tree', 'bush', 'rock', 'sand']);
export function lackText(c) {
  const m = Object.keys(c)
    .filter(k => G.res[k] < c[k])
    .map(k => `${fmt(Math.ceil(c[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
  return m.length > 1 ? m.slice(0, -1).join(', ') + ' en ' + m[m.length - 1] : m[0] || '';
}
export function ghostPos() {
  const s = B[store.placing].size;
  return [Math.floor(mouse.tx - s / 2 + 0.5), Math.floor(mouse.ty - s / 2 + 0.5)];
}
export function canPlace(type, x, y, skipCost) {
  const d = B[type];
  if (G.age < d.age) return 'Nog niet ontdekt';
  if (!canMake(type, G.age)) return 'Verouderd: bouw een ' + B[SUCCESSOR[type]].n.toLowerCase();
  if (d.road) {
    if (!isUnl(x, y)) return 'Buiten je gebied';
    const i = y * W + x;
    if (ter[i] === TER.WATER) return 'Hier is water';
    if (ter[i] === TER.ROCK) return 'Hier zijn bergen';
    if (bmap[i]) return 'Hier staat al iets';
    if (nodeVis(i)) return NODES[node[i]].n + ' in de weg';
    if (road[i] >= roadTier()) return 'Hier ligt al een weg';
    if (!skipCost && !has(buildCost(type))) return 'Nog ' + lackText(buildCost(type)) + ' nodig';
    return null;
  }
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) {
      const xx = x + dx,
        yy = y + dy;
      if (!inb(xx, yy)) return 'Buiten de kaart';
      if (!isUnl(xx, yy)) return 'Buiten je gebied';
      const i = yy * W + xx;
      if (ter[i] === TER.WATER) return 'Hier is water';
      if (ter[i] === TER.ROCK) return 'Hier zijn bergen';
      if (bmap[i]) return 'Hier staat al iets';
      if (d.needNode) {
        if (node[i] !== NI.oil) return 'Een oliepomp moet op een oliebron staan';
      } else if (nodeVis(i) && !CLEAR.has(NODES[node[i]].k)) return NODES[node[i]].n + ' in de weg';
      if (G.camps.some(c => c.alive && xx >= c.x - 1 && xx <= c.x + 2 && yy >= c.y - 1 && yy <= c.y + 2))
        return 'Hier ligt een vijandelijk kamp';
    }
  if (type === 'command' && G.bs.some(b => b.type === 'command'))
    return 'Er kan maar één commandocentrum zijn';
  if (type === 'stargate' && G.bs.some(b => b.type === 'stargate'))
    return 'Er kan maar één sterrenpoort zijn';
  if (!skipCost && !has(buildCost(type))) return 'Nog ' + lackText(buildCost(type)) + ' nodig';
  if (d.wall && G.vs.some(v => !v.hidden && (v.x | 0) === x && (v.y | 0) === y)) return 'Er staat iemand';
  return null;
}
export function lineTiles(a, b) {
  const t = [];
  const sx = Math.sign(b[0] - a[0]) || 1,
    sy = Math.sign(b[1] - a[1]) || 1;
  for (let x = a[0]; x !== b[0] + sx; x += sx) t.push([x, a[1]]);
  for (let y = a[1] + sy; y !== b[1] + sy && a[1] !== b[1]; y += sy) t.push([b[0], y]);
  return t.slice(0, 60);
}
export function placeLine(a, b) {
  const d = B[store.placing];
  let n = 0,
    first = null,
    why = null;
  for (const [x, y] of lineTiles(a, b)) {
    const err = canPlace(store.placing, x, y);
    if (err) {
      why = why || err;
      continue;
    }
    pay(buildCost(store.placing));
    n++;
    if (d.road) {
      road[y * W + x] = roadTier();
    } else {
      const nb = placeBuilding(store.placing, x, y, false);
      first = first || nb;
    }
  }
  if (n) {
    sfx('place');
    if (first)
      for (const v of selVills()) {
        resetV(v);
        v.job = 'build';
        v.prefSite = first;
      }
    toast(
      d.road
        ? `${n} ${n === 1 ? 'stuk' : 'stukken'} ${d.n.toLowerCase()} aangelegd.`
        : `${n} × ${d.n.toLowerCase()} uitgezet.`,
    );
  } else if (why) toast(why + '.', 'bad');
  store.uiDirty = true;
}
export function tryPlace(keep) {
  const [x, y] = ghostPos();
  if (B[store.placing].road || B[store.placing].wall) {
    placeLine([x, y], [x, y]);
    return;
  }
  const err = canPlace(store.placing, x, y);
  if (err) {
    toast(err + '.', 'bad');
    return;
  }
  pay(buildCost(store.placing));
  const b = placeBuilding(store.placing, x, y, false);
  sfx('place');
  for (const v of selVills()) {
    resetV(v);
    v.job = 'build';
    v.prefSite = b;
  }
  toast(`${B[store.placing].n} uitgezet. Dorpelingen komen het bouwen.`);
  if (!keep) store.placing = null;
  store.uiDirty = true;
}
