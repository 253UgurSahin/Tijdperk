// De spelstand (G): alles wat er nu in de wereld is. Ook een nieuw spel starten.
import { CN, CX, CY, TAU, W } from '../config.js';
import { FIRST_BLESSING_AT } from '../data/blessings.js';
import { cleanDiff, difficulty } from '../data/difficulty.js';
import { cleanMap } from '../data/maps.js';
import { PLACES } from '../data/names.js';
import { DEFAULT_PEOPLE, PEOPLE } from '../data/peoples.js';
import { RKEYS } from '../data/resources.js';
import { cleanVictories } from '../data/victories.js';
import { placeBuilding, spawnFoe, spawnVillager } from './entities.js';
import { afterLoad } from './save.js';
import { clearSel } from '../input/selection.js';
import { centerOn } from '../render/camera.js';
import { cam } from '../render/scene.js';
import { note } from '../ui/hud.js';
import { dist } from '../util/math.js';
import { mulberry32 } from '../util/random.js';
import { codeFromSeed, randomSeed } from '../util/seedcode.js';
import { buildLists, genWorld, inb, node, passable } from '../world/world.js';

export let G = null;
export const bById = new Map();
export const sel = { vs: new Set(), us: new Set(), b: null, camp: null, node: -1 };
export function baseState(seed) {
  const g = {
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
    people: DEFAULT_PEOPLE, // je volk (sleutel uit data/peoples.js)
    blessings: [], // gekozen zegeningen (sleutels uit data/blessings.js)
    blessingQueue: [], // zegeningen die je nog mag kiezen, zie game/blessings.js
    buff: {},
    forceRaid: 0,
    event: null,
    lastEvent: 0,
    training: false,
    trainT: 0,
    peaceful: false,
    won: false,
    wonBy: '', // waarmee je won (sleutel uit data/victories.js), of leeg
    over: false,
    bought: 0,
    hungry: false,
    // Tellers voor doelen, prestaties en de score
    stats: {
      gathered: 0,
      killed: 0,
      born: 0,
      camps: 0,
      trained: 0,
      knight: 0,
      walls: 0, // muren en poorten gebouwd
      survived: 0, // aanvallen doorstaan
      raidDay: 0, // de dag waarop de laatste aanval echt begon
      meteors: 0, // meteorieten ingeslagen
      peaceUsed: false, // stond de vredige modus ooit aan in dit spel? (dan telt de score half)
    },
    achieved: [], // prestaties die je in dít spel voor het eerst haalde
    result: null, // de eindscore, zodra het spel gewonnen of verloren is (zie game/achievements.js)
    countedAsPlayed: false, // telt dit spel al mee bij "gespeeld" in je profiel?
    opts: gameOpts(seed), // de keuzes van het nieuw-spelscherm (zie gameOpts hieronder)
  };
  RKEYS.forEach(k => (g.res[k] = 0));
  return g;
}
/**
 * De keuzes voor een wereld, netjes gemaakt: wat ontbreekt of niet (meer) bestaat, wordt de standaard.
 * people: volk · diff: moeilijkheid · map: kaartsoort · seedCode: zaadcode · victories: manieren om te winnen
 */
export function gameOpts(seed, o = {}) {
  return {
    people: PEOPLE[o.people] ? o.people : DEFAULT_PEOPLE,
    diff: cleanDiff(o.diff),
    map: cleanMap(o.map),
    seedCode: codeFromSeed(seed),
    victories: cleanVictories(o.victories),
  };
}

/**
 * Begin een nieuwe wereld. `o` zijn de keuzes van het nieuw-spelscherm: { seed, people, diff, map, victories }.
 * Zonder seed komt er een willekeurige wereld.
 */
export function newGame(o = {}) {
  const seed = Number.isInteger(o.seed) && o.seed >= 0 ? o.seed : randomSeed();
  G = baseState(seed);
  G.opts = gameOpts(seed, o);
  // Het volk meteen zetten: zijn bonussen tellen mee voor alles wat hieronder gebouwd wordt
  G.people = G.opts.people;
  G.diff = G.opts.diff;
  const level = difficulty(G.diff);
  G.peaceful = level.peaceful;
  G.stats.peaceUsed = G.peaceful;
  G.blessingQueue = [{ age: 0, at: FIRST_BLESSING_AT }];
  Object.assign(G.res, level.start);
  // Startvoordeel van je volk: wat extra grondstoffen en soms extra dorpelingen
  const start = PEOPLE[G.people].start || {};
  for (const [r, n] of Object.entries(start.res || {})) G.res[r] += n;
  // Je begint met de vier gebieden in het midden van de kaart
  for (const [x, y] of [
    [CN / 2 - 1, CN / 2 - 1],
    [CN / 2, CN / 2 - 1],
    [CN / 2 - 1, CN / 2],
    [CN / 2, CN / 2],
  ])
    G.unl[y * CN + x] = 1;
  genWorld(seed, G.opts.map);
  buildLists();
  bById.clear();
  placeBuilding('townhall', CX - 1, CY - 1, true);
  const villagers = 5 + (start.villagers || 0);
  for (let k = 0; k < villagers; k++)
    spawnVillager(CX - 1 + (k % 3) * 0.7, CY + 1.5 + Math.floor(k / 3) * 0.8);
  genCamps(seed);
  clearSel();
  centerOn(CX, CY, true);
  cam.z = 1;
  note(`Je stam vestigt zich in ${placeName()}.`);
  afterLoad();
}
export const placeName = () => PLACES[G.seed % PLACES.length];
// Vijandelijke kampen: zwakke dichtbij, sterke ver weg. Op een grote kaart twee per niveau.
function genCamps(seed) {
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
        const camp = {
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
function spawnCampGuards(c) {
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
export function setGame(v) {
  G = v;
  return v;
}
