import type { Building, Camp, GameState } from '../types';
// De spelstand (G): alles wat er nu in de wereld is. Ook een nieuw spel starten.
import { CN, CX, CY, TAU, W } from '../config';
import { PLACES } from '../data/names';
import { RKEYS } from '../data/resources';
import { placeBuilding, spawnFoe, spawnVillager } from './entities';
import { afterLoad } from './save';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { cam } from '../render/scene';
import { note } from '../ui/hud';
import { dist } from '../util/math';
import { mulberry32 } from '../util/random';
import { buildLists, genWorld, inb, node, passable } from '../world/world';

/** Het lopende spel. Wordt gezet door newGame() en bij laden. */
export let G!: GameState;
/** Gebouwen op id. */
export const bById = new Map<number, Building>();
/** Wat geselecteerd is: dorpelingen, soldaten, een gebouw, een kamp of een grondstoftegel. */
export const sel = {
  vs: new Set<number>(),
  us: new Set<number>(),
  b: null as number | null,
  camp: null as number | null,
  node: -1,
};
export function baseState(seed: number): GameState {
  const g: GameState = {
    seed,
    age: 0,
    res: {},
    t: 0,
    clock: 7,
    day: 1,
    speed: 1,
    unl: new Array(CN * CN).fill(0),
    bs: [],
    vs: [],
    us: [],
    foes: [],
    proj: [],
    fx: [],
    regrow: [],
    camps: [],
    spawnQ: [],
    log: [],
    nid: 1,
    raids: 0,
    tools: 1,
    carryCap: 10,
    autoTrain: true,
    trainQ: 0,
    toolLvl: 0,
    armsLvl: 0,
    rain: 0,
    groups: {},
    hist: [],
    offer: null,
    stance: 'guard',
    diff: 1,
    tech: {},
    research: null,
    buff: {},
    forceRaid: 0,
    event: null,
    lastEvent: 0,
    training: false,
    trainT: 0,
    peaceful: false,
    won: false,
    over: false,
    bought: 0,
    hungry: false,
    stats: { gathered: 0, killed: 0, born: 0, camps: 0, trained: 0, knight: 0 },
  };
  RKEYS.forEach(k => (g.res[k] = 0));
  return g;
}
export function newGame(seed?: number, diff = 1) {
  seed = seed || (Math.random() * 1e9) | 0;
  G = baseState(seed);
  G.diff = diff;
  G.peaceful = diff === 0;
  Object.assign(
    G.res,
    diff === 2 ? { food: 150, wood: 120, stone: 40 } : { food: 200, wood: 160, stone: 60 },
  );
  // Je begint met de vier gebieden in het midden van de kaart
  for (const [x, y] of [
    [CN / 2 - 1, CN / 2 - 1],
    [CN / 2, CN / 2 - 1],
    [CN / 2 - 1, CN / 2],
    [CN / 2, CN / 2],
  ])
    G.unl[y * CN + x] = 1;
  genWorld(seed);
  buildLists();
  bById.clear();
  placeBuilding('townhall', CX - 1, CY - 1, true);
  for (let k = 0; k < 5; k++) spawnVillager(CX - 1 + (k % 3) * 0.7, CY + 1.5 + (k > 2 ? 0.8 : 0));
  genCamps(seed);
  clearSel();
  centerOn(CX, CY, true);
  cam.z = 1;
  note(`Je stam vestigt zich in ${placeName()}.`);
  afterLoad();
}
export const placeName = () => PLACES[G.seed % PLACES.length];
// Vijandelijke kampen: zwakke dichtbij, sterke ver weg. Op een grote kaart twee per niveau.
function genCamps(seed: number) {
  const R = mulberry32(seed + 77),
    spread = (W / 128) * 0.85,
    perTier = W >= 256 ? 2 : 1,
    RANGES = [
      [22, 28],
      [27, 35],
      [33, 42],
      [39, 48],
      [45, 54],
      [50, 58],
    ];
  for (let tier = 0; tier < 6; tier++)
    for (let n = 0; n < perTier; n++)
      for (let tries = 0; tries < 300; tries++) {
        const a = R() * TAU,
          r = (RANGES[tier][0] + R() * (RANGES[tier][1] - RANGES[tier][0])) * spread;
        const x = Math.round(CX + Math.cos(a) * r),
          y = Math.round(CY + Math.sin(a) * r);
        if (!inb(x - 1, y - 1) || !inb(x + 2, y + 2)) continue;
        let ok = true;
        for (let dy = -1; dy <= 2; dy++)
          for (let dx = -1; dx <= 2; dx++) if (!passable((y + dy) * W + x + dx)) ok = false;
        if (!ok || G.camps.some(c => dist(c.x, c.y, x, y) < 14 * spread)) continue;
        for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) node[(y + dy) * W + x + dx] = 0;
        const camp: Camp = {
          id: G.nid++,
          kind: 'c',
          x,
          y,
          tier,
          hp: 500 * (1 + tier * 1.2),
          mhp: 500 * (1 + tier * 1.2),
          alive: true,
        };
        G.camps.push(camp);
        spawnCampGuards(camp);
        break;
      }
}
function spawnCampGuards(c: Camp) {
  const n = 3 + c.tier * 2;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    spawnFoe(
      // Het sterkste kamp heeft ook pantserwagens
      c.tier === 5 && k % 2 ? 6 : c.tier,
      c.x + 1 + Math.cos(a) * 2,
      c.y + 1 + Math.sin(a) * 2,
      1 + c.tier * 0.15,
      c,
    );
  }
}
export function setGame(v: GameState) {
  G = v;
  return v;
}
