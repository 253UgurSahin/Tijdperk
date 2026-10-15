import type { Building } from '../types';
// De kaart: terrein, grondstoffen en wie waar mag lopen.
import { CN, H, W } from '../config';
import { B } from '../data/buildings';
import { NODES } from '../data/nodes';
import { G } from '../game/state';
import { clamp, dist } from '../util/math';
import { fbm, hash2, vnoise } from '../util/random';
import { BIOME, TER, generateWorld, isPassable, type GeneratedWorld } from './generate';

export { BIOME, TER };
// ter: terreinsoort (water, land, zand, ...) · biome: landschap · node: grondstof op de tegel · amt: hoeveelheid
// ground: kleur van de grond per tegel (r, g, b)
export let levels!: GeneratedWorld['levels'],
  ter!: Uint8Array,
  biome!: Uint8Array,
  elev!: Float32Array,
  node!: Uint8Array,
  amt!: Uint16Array,
  bmap!: Int32Array,
  ground!: Uint8Array,
  nodeLists!: number[][],
  unreach!: Float32Array,
  claims!: Uint8Array,
  blk!: Uint8Array,
  road!: Uint8Array;

/** Maak de wereld uit een seed en een kaartsoort (zie data/maps.ts). */
export function genWorld(seed: number, mapKind: string) {
  const w = generateWorld(seed, W, H, mapKind);
  ({ ter, biome, elev, node, amt, levels } = w);
  blk = new Uint8Array(W * H);
  road = new Uint8Array(W * H);
  bmap = new Int32Array(W * H);
  unreach = new Float32Array(W * H);
  claims = new Uint8Array(W * H);
  ground = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paintGround(x, y, seed);
}

/** Bepaal de kleur van de grond op een tegel, afhankelijk van het landschap. */
export function paintGround(x: number, y: number, seed: number) {
  const i = y * W + x,
    n = vnoise(x / 6, y / 6, seed + 9),
    v = hash2(x, y, 5),
    e = elev[i];
  let c;
  switch (biome[i]) {
    case BIOME.WATER: {
      const deep = clamp((levels.sea - e) / (levels.sea - levels.deep), 0, 1);
      c = [48 - deep * 14, 86 - deep * 22, 94 - deep * 10];
      break;
    }
    case BIOME.BEACH:
      c = [180 + n * 14, 162 + n * 12, 114 + n * 10];
      break;
    case BIOME.DESERT:
      c = [200 + n * 14 + v * 4, 174 + n * 12, 116 + n * 8];
      break;
    case BIOME.SALT:
      c = [196 + v * 8, 200 + v * 6, 192 + v * 6];
      break;
    case BIOME.FOREST:
      c = [50 + n * 14 + v * 5, 76 + n * 16 + v * 5, 38 + n * 8];
      break;
    case BIOME.HILLS:
      c = [100 + n * 18 + v * 6, 104 + n * 14 + v * 5, 60 + n * 10];
      break;
    case BIOME.MOUNTAIN:
      c =
        mountainHeight(i) > 0.6
          ? [214 + v * 10, 220 + v * 8, 226 + v * 6]
          : [122 + n * 20 + v * 8, 118 + n * 18 + v * 6, 110 + n * 14];
      break;
    default: {
      const g = fbm(x / 22, y / 22, seed + 3);
      c = [70 + g * 34 + n * 16 + v * 6, 98 + g * 26 + n * 16 + v * 5, 44 + g * 10 + n * 8];
    }
  }
  for (let k = 0; k < 3; k++) ground[i * 3 + k] = clamp(c[k] | 0, 0, 255);
}

/** Hoe hoog een bergtegel is, van 0 (voet) tot 1 (hoogste top). */
export const mountainHeight = (i: number): number =>
  clamp((elev[i] - levels.peak) / (levels.top - levels.peak), 0, 1);

// Tegels waarvan de grondkleur veranderd is (bijv. een krater); de weergave tekent ze opnieuw
export const dirtyGround = new Set<number>();
export const markGroundDirty = (x: number, y: number) => dirtyGround.add(y * W + x);

export function buildLists() {
  nodeLists = NODES.map(() => []);
  for (let i = 0; i < W * H; i++) if (node[i]) nodeLists[node[i]].push(i);
}
/** Kan iemand over tegel i lopen? (geen water, geen berg) */
export const passable = (i: number): boolean => isPassable(ter[i]);
export const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
export const isUnl = (x: number, y: number): boolean => inb(x, y) && G.unl[(y >> 4) * CN + (x >> 4)] === 1;
export const walkable = (x: number, y: number): boolean =>
  isUnl(x, y) && passable(y * W + x) && blk[y * W + x] !== 1;
export const freeWalk = (x: number, y: number): boolean =>
  inb(x, y) && passable(y * W + x) && blk[y * W + x] !== 1;
export const foeWalk = (x: number, y: number): boolean => inb(x, y) && passable(y * W + x) && !blk[y * W + x];
export function setBlk(b: Building, on: boolean) {
  const d = B[b.type];
  if (!d.wall) return;
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) blk[(b.y + dy) * W + b.x + dx] = on ? (d.gate ? 2 : 1) : 0;
}
export function nearestWall(x: number, y: number): Building | null {
  let best = null,
    bd = 1e9;
  for (const b of G.bs) {
    if (!b.done || !B[b.type].wall) continue;
    const d = dist(x, y, b.x + 0.5, b.y + 0.5);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
export const nodeVis = (i: number): boolean => !!node[i] && NODES[node[i]].age <= G.age;
