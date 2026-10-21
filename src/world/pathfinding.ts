import type { Mobile, Path, Tile } from '../types';
// Padvinding: hoe dorpelingen en soldaten om obstakels heen lopen (A*-zoekmethode).
import { screenRight } from '../core/view';
import { H, W, onMapSize } from '../config';
import { mul } from '../game/bonus';
import { clamp } from '../util/math';
import { landParts } from './generate';
import { foeWalk, freeWalk, passable, road, ter, walkable } from './world';

// Werkgeheugen per tegel (kosten, waar je vandaan kwam, en of een tegel al bekeken is); zo groot als de kaart
let gS = new Float32Array(W * H),
  came = new Int32Array(W * H),
  stp = new Uint32Array(W * H),
  cls = new Uint32Array(W * H);
let stamp = 0;
// De open lijst van het zoeken: een binaire hoop met de laagste kosten (f) bovenaan, met bij elke kosten de tegel (i).
// Twee rijen getallen in plaats van een lijst met paartjes: dat scheelt veel tijd en geheugen. Groeit als het nodig is.
let heapF = new Float64Array(4096),
  heapI = new Int32Array(4096),
  heapN = 0;
function heapPush(f: number, i: number) {
  if (heapN === heapF.length) {
    const biggerF = new Float64Array(heapN * 2),
      biggerI = new Int32Array(heapN * 2);
    biggerF.set(heapF);
    biggerI.set(heapI);
    heapF = biggerF;
    heapI = biggerI;
  }
  let k = heapN++;
  heapF[k] = f;
  heapI[k] = i;
  // Omhoog schuiven zolang de ouder hogere kosten heeft
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (heapF[p] <= heapF[k]) break;
    heapSwap(p, k);
    k = p;
  }
}
/** Haal de tegel met de laagste kosten uit de hoop. */
function heapPop(): number {
  const top = heapI[0];
  heapN--;
  if (heapN) {
    heapF[0] = heapF[heapN];
    heapI[0] = heapI[heapN];
    // Omlaag schuiven zolang een kind lagere kosten heeft
    let k = 0;
    for (;;) {
      const l = 2 * k + 1,
        r = l + 1;
      let m = k;
      if (l < heapN && heapF[l] < heapF[m]) m = l;
      if (r < heapN && heapF[r] < heapF[m]) m = r;
      if (m === k) break;
      heapSwap(m, k);
      k = m;
    }
  }
  return top;
}
function heapSwap(a: number, b: number) {
  const f = heapF[a],
    i = heapI[a];
  heapF[a] = heapF[b];
  heapI[a] = heapI[b];
  heapF[b] = f;
  heapI[b] = i;
}
onMapSize(() => {
  gS = new Float32Array(W * H);
  came = new Int32Array(W * H);
  stp = new Uint32Array(W * H);
  cls = new Uint32Array(W * H);
  stamp = 0;
});
// Hoeveel tegels een gewone zoektocht mag bekijken (gewone kaart: 40000). Op een grotere kaart meer, want de
// routes zijn er langer; maar niet evenredig met de oppervlakte: een zoektocht die niets vindt (een doel achter
// muren) bekijkt alles tot dit maximum, en dat mag niet te lang duren.
const searchLimit = () => Math.round((40000 * W) / 256);

// Van welk stuk land is elke tegel (zie landParts in generate.ts)? Eén keer per wereld uitgerekend:
// water en bergen veranderen niet tijdens het spel.
let landPart: Int32Array = new Int32Array(0),
  landFor: Uint8Array | null = null;
function landPartsNow(): Int32Array {
  if (landFor !== ter || landPart.length !== W * H) {
    landPart = landParts(ter, W, H);
    landFor = ter;
  }
  return landPart;
}
// Alleen water en bergen houden je tegen (muren niet): voor lange routes van rivalen, zie game/rivals.ts
const landWalk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && passable(y * W + x);
/**
 * Zoek een route van (sx, sy) naar (tx, ty). `free`: false = alleen in je eigen gebied, true = overal,
 * 2 = als een vijand (poorten zijn dicht), 3 = over alle begaanbare grond, ook door muren heen.
 * `maxSteps`: zoveel tegels mag het zoeken hoogstens bekijken (lange routes mogen meer).
 */
export function findPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  free: boolean | 2 | 3,
  maxSteps = searchLimit(),
): Path | null {
  sx = clamp(sx, 0, W - 1);
  sy = clamp(sy, 0, H - 1);
  tx = clamp(tx, 0, W - 1);
  ty = clamp(ty, 0, H - 1);
  const ok0 = free === 3 ? landWalk : free === 2 ? foeWalk : free ? freeWalk : walkable,
    goalI = ty * W + tx,
    ok = (x: number, y: number) => ok0(x, y) || (free && x === tx && y === ty && passable(goalI));
  if (sx === tx && sy === ty) return [];
  if (!ok(tx, ty)) return null;
  // Ligt het doel op een ander stuk land (een ander eiland)? Dan is er nooit een route: niet zoeken.
  // (Dat scheelt veel: anders bekijkt het zoeken alles wat je wel kunt bereiken.)
  const parts = landPartsNow(),
    fromPart = parts[sy * W + sx],
    toPart = parts[ty * W + tx];
  if (fromPart && toPart && fromPart !== toPart) return null;
  stamp++;
  heapN = 0;
  // Wat een stap kost per soort weg (0 = geen weg): sneller lopen = goedkoper (één keer uitgerekend)
  const costByTier = [1, 1 / roadBoost(1), 1 / roadBoost(2), 1 / roadBoost(3)];
  // De schatting naar het doel telt iets lichter (×0,7), omdat een stap over een weg ook minder kost: zo blijft
  // het zoeken een omweg via een weg overwegen in plaats van altijd rechtstreeks te gaan
  const hz = (x: number, y: number) => {
    const dx = Math.abs(x - tx),
      dy = Math.abs(y - ty);
    return (dx + dy - 0.586 * Math.min(dx, dy)) * H_SCALE;
  };
  const st = sy * W + sx,
    goal = ty * W + tx;
  gS[st] = 0;
  stp[st] = stamp;
  came[st] = -1;
  heapPush(hz(sx, sy), st);
  let exp = 0;
  while (heapN) {
    const c = heapPop();
    if (c === goal) {
      const path: Tile[] = [];
      let k = goal;
      while (k !== st && k >= 0) {
        path.push([k % W, (k / W) | 0]);
        k = came[k];
      }
      return path.reverse();
    }
    if (cls[c] === stamp) continue;
    cls[c] = stamp;
    if (++exp > maxSteps) return null; // geef op bij heel lange of onmogelijke routes
    const cx = c % W,
      cy = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx,
          ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
        // Een stap over een weg kost minder: zo kiezen dorpelingen en soldaten vanzelf de weg als die er ligt
        const ni = ny * W + nx,
          ng = gS[c] + (dx && dy ? 1.414 : 1) * costByTier[road[ni]];
        if (stp[ni] !== stamp || ng < gS[ni]) {
          stp[ni] = stamp;
          gS[ni] = ng;
          came[ni] = c;
          heapPush(ng + hz(nx, ny), ni);
        }
      }
  }
  return null;
}
/** Hoeveel sneller je over een weg van soort rt loopt (als factor boven 1): pad +34%, klinkers +46%, asfalt +58%. */
export const roadBoost = (rt: number): number => (rt ? 1 + (0.22 + rt * 0.12) * mul('road') : 1);
const H_SCALE = 0.7;
export function follow(e: Mobile, dt: number, spd: number): boolean {
  if (!e.path || !e.path.length) return true;
  spd *= roadBoost(road[(e.y | 0) * W + (e.x | 0)]);
  const p = e.path[0],
    tx = p[0] + 0.5,
    ty = p[1] + 0.5,
    dx = tx - e.x,
    dy = ty - e.y,
    d = Math.hypot(dx, dy),
    st = spd * dt;
  {
    const sd = screenRight(dx, dy);
    if (sd) e.dir = sd < 0 ? -1 : 1;
  }
  if (d <= st) {
    e.x = tx;
    e.y = ty;
    e.path.shift();
    return !e.path.length;
  }
  e.x += (dx / d) * st;
  e.y += (dy / d) * st;
  return false;
}
