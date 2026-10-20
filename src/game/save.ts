// Opslaan en laden in de browser: drie eigen plekken en één automatische (zie data/saveslots.ts).
import type { Building, GameState, Stance } from '../types';
import { store } from '../core/store';
import { SET } from '../core/settings';
import { CX, CY, H, TH, TW, W, setMapSize } from '../config';
import { ACHIEVEMENT } from '../data/achievements';
import { BLESSING } from '../data/blessings';
import { B } from '../data/buildings';
import { UNITS, FOES } from '../data/units';
import { TK } from '../data/tech';
import { cleanDiff } from '../data/difficulty';
import { cleanMapSize } from '../data/maps';
import { cleanPendingBoss } from '../data/bosses';
import { cleanActiveEvent, cleanBuffs, cleanEventsSeen, cleanFollowups } from '../data/events';
import { cleanFinale, resetCharge } from '../data/finale';
import { cleanMods } from '../data/modifiers';
import { DEFAULT_PEOPLE, PEOPLE } from '../data/peoples';
import { RKEYS } from '../data/resources';
import {
  AUTO_SLOT,
  MANUAL_SLOTS,
  OLD_AGE,
  OLD_SAVE_KEY,
  SLOTS,
  SLOT_INDEX_KEY,
  cleanSlotIndex,
  cleanSlotMeta,
  latestSlot,
  metaFromSave,
  sameGame,
  saveErrorText,
  slotKey,
} from '../data/saveslots';
import type { SlotIndex, SlotMeta } from '../data/saveslots';
import { cleanScenarioState } from '../data/scenarios';
import { VICTORY } from '../data/victories';
import { cleanWonders } from '../data/wonders';
import { cleanGroups } from '../data/army';
import { restoreKills } from './army';
import { computeAvail, computeCaches } from './caches';
import { spawnFoe, spawnUnit, spawnVillager } from './entities';
import { loadRivals, saveRivals } from './rivals';
import type { SavedRival } from './rivals';
import { currentChallenge } from './scenario';
import { G, bById, baseState, gameOpts, placeName, setGame } from './state';
import { refreshWonders } from './wonders';
import { setZoom } from '../input/input';
import { clearSel } from '../input/selection';
import { clampCam } from '../render/camera';
import { cam } from '../render/scene';
import { onAgeChange } from '../ui/age';
import { sigs } from '../ui/header';
import { setSpeed, toast } from '../ui/hud';
import { rate } from '../ui/resources';
import { bigMapOpen, setBigMap } from '../render/minimap';
import { $ } from '../util/dom';
import { fromBase64, packZeros, toBase64, unpackZeros } from '../util/pack';
import { amt, bmap, buildLists, genWorld, node, road, setBlk } from '../world/world';

// Kaartrijen inpakken: veel nullen worden kort opgeschreven (zie util/pack.ts). Oude opslag heeft dit nog niet.
const packArray = (bytes: Uint8Array): string => toBase64(packZeros(bytes));
const unpackArray = (text: string, length: number, packed: boolean): Uint8Array =>
  packed ? unpackZeros(fromBase64(text), length) : fromBase64(text);
export function serialize(): string {
  const g: Record<string, unknown> = {};
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
    'forceRaid',
    'lastEvent',
    'event',
    'buffs',
    'followups',
    'eventsSeen',
    'nextMeteor',
    'blessings',
    'blessingQueue',
    'people',
    'achieved',
    'result',
    'countedAsPlayed',
    'opts',
    'wonBy',
    'scenario',
    'mods',
    'wonders',
    'traderDay',
    'finale',
    'boss',
    'regrow', // gekapte bomen die terug moeten groeien
    'spawnQ', // aanvallers die nog komen
    'meteor',
    'starMeteor',
    'training',
    'trainT',
  ] as const)
    g[k] = G[k];
  return JSON.stringify({
    v: 4,
    size: W,
    ages: 9,
    seed: G.seed,
    g,
    // Wegen, grondstoffen en hoeveelheden op de kaart, ingepakt (pack: 1)
    pack: 1,
    road: packArray(road),
    node: packArray(node),
    amt: packArray(new Uint8Array(amt.buffer)),
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
    // Het nummer (id) bewaren we, zodat groepen na het laden nog kloppen; kills = overwinningen (veteranen)
    vs: G.vs.map(v => ({ x: v.x, y: v.y, name: v.name, job: v.job, hp: v.hp, id: v.id })),
    us: G.us.map(u => ({
      k: u.k,
      x: u.x,
      y: u.y,
      hp: u.hp,
      st: u.stance || 'guard',
      id: u.id,
      kills: u.kills || 0,
    })),
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
    // Een aanval die bezig is (geen kampbewakers, geen soldaten van rivalen: die bewaart saveRivals)
    raiders: G.foes
      .filter(f => !f.camp && !f.rival && !f.dead && !f.retreat)
      .map(f => ({ type: f.type, x: f.x, y: f.y, hp: f.hp, mhp: f.mhp, dmg: f.dmg, boss: f.boss })),
    rivals: saveRivals(), // rivalen met hun gebouwen en soldaten (zie game/rivals.ts)
    cam: { x: cam.x, y: cam.y, z: cam.z },
    cv: 2,
  });
}
/** Wat er in localStorage staat (opslagformaat v4). */
interface SaveData {
  v: number;
  size: number;
  ages?: number;
  seed: number;
  g: Partial<GameState>;
  /**
   * Wegen, grondstoffen en hoeveelheden op de kaart (base64). Met pack: 1 zijn de nullen ingepakt
   * (zie util/pack.ts); oudere opslag heeft dat nog niet.
   */
  road?: string;
  node: string;
  amt: string;
  pack?: number;
  bs: (Pick<Building, 'id' | 'type' | 'x' | 'y' | 'hp' | 'done' | 'prog' | 'bt' | 'on' | 'q' | 'rally'> & {
    lvl: number;
  })[];
  /** Opslag van vóór de groepen heeft geen id bij dorpelingen, en van vóór de veteranen geen kills. */
  vs: { x: number; y: number; name: string; job: string; hp: number; id?: number }[];
  us: { k: string; x: number; y: number; hp: number; st?: Stance; id?: number; kills?: number }[];
  camps: { id: number; x: number; y: number; tier: number; hp: number; mhp: number; alive: boolean }[];
  guards: { type: number; x: number; y: number; hp: number; mhp: number; camp: number }[];
  /** Aanvallers die onderweg waren (ontbreekt in oudere opslag). */
  raiders?: { type: number; x: number; y: number; hp: number; mhp: number; dmg: number; boss?: number }[];
  /** Rivalen met hun gebouwen en soldaten (ontbreekt in opslag van vóór de rivalen). */
  rivals?: SavedRival[];
  cam?: { x: number; y: number; z?: number };
  cv?: number;
}
/**
 * Is dit een opslag die we kunnen laden? Alles wat we straks nodig hebben, controleren we hier eerst:
 * de vorm (lijsten die er moeten zijn), de kaartgegevens (base64 die te lezen is) en de sleutels van
 * gebouwen, eenheden en onderzoek. Pas als dit goed is, raken we het lopende spel aan.
 */
function checkSave(s: SaveData): string {
  if (!s || typeof s !== 'object') return 'geen opslag';
  if (s.v !== 4) return 'onbekende versie';
  if (cleanMapSize(s.size) !== s.size) return 'onbekende kaartgrootte';
  if (!s.g || typeof s.g !== 'object' || typeof s.seed !== 'number') return 'spelstand ontbreekt';
  for (const k of ['bs', 'vs', 'us', 'camps', 'guards'] as const)
    if (!Array.isArray(s[k])) return `lijst ${k} ontbreekt`;
  if (typeof s.node !== 'string' || typeof s.amt !== 'string') return 'kaart ontbreekt';
  const packed = s.pack === 1,
    n = s.size * s.size;
  try {
    if (unpackArray(s.node, n, packed).length !== n) return 'kaart heeft de verkeerde maat';
    if (unpackArray(s.amt, n * 2, packed).length !== n * 2) return 'voorraden hebben de verkeerde maat';
    if (s.road && unpackArray(s.road, n, packed).length !== n) return 'wegen hebben de verkeerde maat';
  } catch (e) {
    return 'kaart is niet te lezen';
  }
  for (const o of s.bs)
    if (!o || typeof o.x !== 'number' || typeof o.y !== 'number') return 'gebouw zonder plek';
  return '';
}

// Is het lopende spel al aangeraakt door deserialize? (zie loadSlot)
let loadTouched = false;
// Een nummer uit de opslag, of een vaste waarde als het er niet (goed) in staat
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

export function deserialize(str: string): boolean {
  const s: SaveData = JSON.parse(str);
  const problem = checkSave(s);
  if (problem) {
    console.warn('Opslag niet geladen: ' + problem);
    return false;
  }
  // Gebouwen, eenheden en onderzoek die niet (meer) bestaan, slaan we over in plaats van te crashen
  s.bs = s.bs.filter(o => B[o.type]);
  s.us = s.us.filter(o => UNITS[o.k]);
  s.vs = s.vs.filter(o => o && typeof o.x === 'number');
  s.camps = s.camps.filter(c => c && typeof c.x === 'number');
  s.guards = s.guards.filter(o => FOES[o.type]);
  // Vanaf hier raken we het lopende spel aan (zie loadSlot: gaat het alsnog mis, dan zetten we het terug)
  loadTouched = true;
  // Eerst de kaartgrootte van deze opslag: de spelstand en de wereld hieronder hangen ervan af
  setMapSize(s.size);
  // De keuzes van het nieuw-spelscherm. Opslag van daarvóór: volk en moeilijkheid uit het spel, de rest standaard
  // (een continent, winnen met de sterrenpoort). De kaartsoort is nodig om dezelfde wereld te maken.
  const opts = gameOpts(s.seed, { people: s.g.people, diff: s.g.diff, ...s.g.opts, size: s.size });
  setGame(baseState(s.seed));
  genWorld(s.seed, opts.map);
  Object.assign(G, s.g);
  G.opts = opts;
  // Uitdaging en spelregels: opslag van daarvóór (of een uitdaging die niet meer bestaat) is een gewoon spel.
  // Dit moet vóór het terugzetten van soldaten: spelregels kunnen hun levens veranderen.
  G.scenario = cleanScenarioState(s.g.scenario);
  G.mods = cleanMods(s.g.mods);
  // Al gewonnen in opslag van vóór de keuze: dat was altijd met de sterrenpoort. Een uitdaging wint met haar doel.
  const knownVictory = !!s.g.wonBy && !!VICTORY[s.g.wonBy];
  const wonChallenge = s.g.wonBy === 'scenario' && !!G.scenario;
  // In beide gevallen staat er een sleutel in s.g.wonBy
  const wonBy = knownVictory || wonChallenge ? s.g.wonBy! : 'stargate';
  G.wonBy = G.won ? wonBy : '';
  // Opslag van vóór de negen tijdperken: zet oude tijdperk- en vijandnummers om
  const fromOld = s.ages !== 9;
  if (fromOld) G.age = OLD_AGE[G.age] ?? G.age;
  G.groups = cleanGroups(s.g.groups); // groep 1 tot 5; opslag zonder groepen begint zonder
  // Zegeningen: opslag van vóór de zegeningen mag er meteen één kiezen.
  // Dit moet vóór het terugzetten van soldaten, want die krijgen hun levens mede door zegeningen.
  if (!Array.isArray(s.g.blessings)) {
    G.blessings = [];
    G.blessingQueue = [{ age: G.age, at: 0 }];
  }
  G.blessings = G.blessings.filter(k => BLESSING[k]); // zegeningen die niet meer bestaan vallen weg
  // Gebeurtenissen: tijdelijke bonussen, vervolgen en het open kaartje. Ook vóór de soldaten (levens).
  G.buffs = cleanBuffs(s.g.buffs);
  // Opslag van vóór de tijdelijke bonussen: een lopend oogstfeest wordt er gewoon één
  // (buff.work is dan de speltijd waarop het feest ophoudt)
  if (s.g.buff && s.g.buff.work! > G.t)
    G.buffs.push({
      k: 'feast',
      n: 'Oogstfeest',
      g: '⚘',
      d: 'Al het verzamelwerk 25% sneller',
      bonus: { 'gather.all': 0.25 },
      until: s.g.buff.work!,
    });
  delete G.buff;
  G.followups = cleanFollowups(s.g.followups);
  G.eventsSeen = cleanEventsSeen(s.g.eventsSeen);
  G.event = cleanActiveEvent(s.g.event);
  // Wereldwonderen (ook vóór de soldaten: het Colosseum geeft levens). Opslag van daarvóór: geen wonderen,
  // en de handelaar van het Oost-Indisch Huis is nog niet geweest. Na de gebouwen kijken we het nog na.
  G.wonders = cleanWonders(s.g.wonders);
  // Number.isInteger geeft alleen true bij een heel getal: dan is traderDay er zeker
  G.traderDay = Number.isInteger(s.g.traderDay) ? s.g.traderDay! : 0;
  // De finale en de kampioen die nog komt. Opslag van daarvóór: geen finale en geen kampioen.
  // (Een kampioen die in het veld stond, komt terug met de volgende aanval: aanvallers worden niet bewaard.)
  G.finale = cleanFinale(s.g.finale);
  G.boss = cleanPendingBoss(s.g.boss);
  // Volk: opslag van vóór de volken (of met een volk dat niet meer bestaat) speelt als Friezen
  if (!PEOPLE[G.people]) G.people = DEFAULT_PEOPLE;
  if (!Array.isArray(G.blessingQueue)) G.blessingQueue = [];
  // Grondstoffen die toen nog niet bestonden (buskruit, sterrenmetaal, ...) beginnen op 0;
  // anders telt 'undefined' als genoeg en wordt de voorraad NaN
  for (const k of RKEYS) if (!Number.isFinite(G.res[k])) G.res[k] = 0;
  // De grafiek-geschiedenis had toen minder kolommen: begin die opnieuw
  G.hist = fromOld ? [] : G.hist || [];
  G.offer = null;
  G.stats = Object.assign(baseState(0).stats, s.g.stats);
  // Prestaties en score: opslag van vóór het profiel begint zonder (het spel telt dan nog mee)
  G.achieved = Array.isArray(s.g.achieved) ? s.g.achieved.filter(k => ACHIEVEMENT[k]) : [];
  G.result = s.g.result || null;
  G.countedAsPlayed = !!s.g.countedAsPlayed;
  G.log = s.g.log || [];
  G.toolLvl = s.g.toolLvl || 0;
  G.armsLvl = s.g.armsLvl || 0;
  G.tech = G.tech || {};
  if (G.research && !TK[G.research.k]) G.research = null; // onderzoek dat niet meer bestaat
  G.diff = cleanDiff(G.diff);
  // Teruggroei, aanvallers in de wachtrij, meteoriet en training: oudere opslag heeft ze niet
  G.regrow = Array.isArray(s.g.regrow) ? s.g.regrow.filter(r => r && Number.isFinite(r.i)) : [];
  G.spawnQ = Array.isArray(s.g.spawnQ) ? s.g.spawnQ.filter(q => q && FOES[q.type]) : [];
  G.meteor = s.g.meteor && typeof s.g.meteor === 'object' ? s.g.meteor : null;
  G.starMeteor = !!s.g.starMeteor;
  G.training = !!s.g.training;
  G.trainT = num(s.g.trainT, 0);
  // Opslag van vóór deze teller: stond de vredige modus aan (of speel je Vredig), dan telt dat als gebruikt
  if (G.peaceful || G.diff === 0) G.stats.peaceUsed = true;
  const packed = s.pack === 1;
  if (s.road) road.set(unpackArray(s.road, road.length, packed));
  node.set(unpackArray(s.node, node.length, packed));
  amt.set(new Uint16Array(unpackArray(s.amt, amt.length * 2, packed).buffer));
  buildLists();
  bById.clear();
  for (const o of s.bs) {
    const d = B[o.type];
    const b: Building = {
      ...o,
      kind: 'b',
      cd: 0,
      ct: 0,
      // Elke centrale op een ander punt in zijn stooktijd: dan beslissen ze niet allemaal in dezelfde tik
      gt: d.gen ? Math.random() * (d.gen.t ?? 0) : 0,
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
    if (o.id) v.id = o.id; // opslag van daarvóór: een nieuw nummer (de groep raakt die dorpeling dan kwijt)
  }
  for (const o of s.us) {
    const u = spawnUnit(o.k, o.x, o.y);
    restoreKills(u, o.kills); // opslag van vóór de veteranen: 0 overwinningen
    u.hp = Math.min(o.hp, u.mhp);
    u.stance = o.st || 'guard';
    if (o.id) u.id = o.id;
  }
  G.camps = s.camps.map(c => ({ ...c, kind: 'c' as const }));
  for (const o of s.guards) {
    const c = G.camps.find(c => c.id === o.camp);
    if (!c) continue;
    const f = spawnFoe(fromOld ? (OLD_AGE[o.type] ?? o.type) : o.type, o.x, o.y, 1, c);
    f.hp = o.hp;
    f.mhp = o.mhp;
    f.hx = c.x + 1 + (Math.random() - 0.5) * 3;
    f.hy = c.y + 1 + (Math.random() - 0.5) * 3;
  }
  // Een aanval die bezig was, gaat gewoon door (anders telde hij straks ten onrechte als doorstaan)
  for (const o of s.raiders || []) {
    if (!FOES[o.type]) continue;
    const f = spawnFoe(o.type, o.x, o.y, 1);
    f.hp = num(o.hp, f.hp);
    f.mhp = num(o.mhp, f.mhp);
    f.dmg = num(o.dmg, f.dmg);
    if (o.boss) f.boss = o.boss;
    f.aggro = true;
  }
  // Rivalen: opslag van daarvóór heeft er geen. Het gekozen aantal is wat er in het spel zit.
  loadRivals(s.rivals);
  G.opts.rivals = G.rivals.length;
  // Wereldwonderen: wie welk wonder heeft, volgt uit de gebouwen die er nu weer staan
  refreshWonders();
  // Laadde de poort op, maar staat hij er niet meer? Dan is die lading weg (zoals bij een verwoeste poort)
  const gateStands = G.bs.some(b => b.type === 'stargate' && b.done);
  if (G.finale && !G.finale.done && !gateStands) resetCharge(G.finale);
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
  liveGame = G;
  return true;
}
// ---- opslagplekken ----

// Het spel dat nu draait en echt gespeeld wordt (geladen of opgeslagen). Een nieuwe wereld is een ander object,
// zo weet "Verder spelen" of het dit spel kan voortzetten of de nieuwste opslag moet laden.
let liveGame: GameState | null = null;
/** Draait er een spel dat je kunt voortzetten (geladen of opgeslagen, en niet verloren)? */
export const isLiveGame = (): boolean => !!G && liveGame === G && !G.over;

// Browsers noemen een volle opslag elk anders
const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException &&
  (e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014);

/**
 * De lijst met kaartjes. Staat er op een plek wel een opslag maar geen kaartje (bijv. omdat de lijst niet
 * bewaard kon worden), dan maken we het kaartje uit de opslag zelf: zo is geen enkele opslag onzichtbaar.
 */
function readIndex(): SlotIndex {
  let index: SlotIndex;
  try {
    index = cleanSlotIndex(JSON.parse(localStorage.getItem(SLOT_INDEX_KEY) || '{}'));
  } catch (e) {
    index = cleanSlotIndex({});
  }
  for (const id of SLOTS) {
    if (index[id]) continue;
    try {
      const text = localStorage.getItem(slotKey(id));
      if (text) index[id] = metaFromSave(JSON.parse(text));
    } catch (e) {
      // Niet te lezen: de plek lijkt leeg, maar de opslag zelf blijft staan
    }
  }
  return index;
}
function writeIndex(index: SlotIndex): void {
  localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(index));
}

/**
 * De ene opslag van vóór de plekken verhuist naar de automatische plek, of (staat daar al iets) naar
 * de eerste lege eigen plek. Pas als dat gelukt is, gaat de oude weg. Is er geen plek vrij, dan blijft
 * hij gewoon staan. Zo raak je nooit een spel kwijt.
 */
function moveOldSave(): void {
  try {
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (!old) return;
    const index = readIndex();
    // Staat precies deze opslag al op een plek? Dan hoeft hij er niet nog een keer bij.
    const alreadyMoved = SLOTS.some(id => index[id] && localStorage.getItem(slotKey(id)) === old);
    if (!alreadyMoved) {
      const free = SLOTS.find(id => !index[id]);
      if (!free) return;
      localStorage.setItem(slotKey(free), old);
      index[free] = metaFromSave(JSON.parse(old));
      writeIndex(index);
    }
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch (e) {
    // Opslag vol of de oude opslag is kapot: dan blijft hij gewoon staan
  }
}
moveOldSave();

/** Alle plekken met hun kaartje (plaats, volk, tijdperk, dag, tijd), of null als een plek leeg is. */
export const listSlots = (): SlotIndex => readIndex();

/** Het kaartje van het spel dat nu draait, zoals het na opslaan op een plek staat. */
export function currentMeta(at = Date.now()): SlotMeta {
  const challenge = currentChallenge();
  // Er is altijd een kaartje: we geven een object mee
  return cleanSlotMeta({
    place: placeName(),
    challenge: challenge ? challenge.n : '',
    people: G.people,
    age: G.age,
    day: G.day,
    at,
    won: G.won,
    seed: G.seed,
    map: G.opts.map,
    size: W,
  })!;
}

/**
 * Raak je het spel dat nu draait kwijt als er iets anders op de automatische plek komt (laden, nieuwe wereld,
 * uitdaging)? Ja, als het niet ook op een eigen plek (1, 2 of 3) staat. Een verloren spel telt niet.
 */
export function liveGameAtRisk(): boolean {
  if (!isLiveGame()) return false;
  const index = readIndex(),
    now = currentMeta();
  return !MANUAL_SLOTS.some(id => sameGame(index[id], now));
}

/**
 * Het spel dat nu draait veiligstellen voordat er iets anders op de automatische plek komt (nieuwe wereld,
 * snel spel, nog een keer): het gaat naar een vrije eigen plek. Geeft die plek, of '' als er niets te
 * bewaren valt of als alle eigen plekken vol zijn (dan moet de speler zelf kiezen).
 */
export function parkLiveGame(): string {
  if (!liveGameAtRisk()) return '';
  const free = MANUAL_SLOTS.find(id => !readIndex()[id]);
  if (!free) return '';
  return saveToSlot(free) === '' ? free : '';
}

/** Het spel op een plek bewaren. Geeft '' als het lukte, anders 'quota' (de opslag is vol) of 'blocked'. */
export function saveToSlot(id: string): string {
  liveGame = G;
  if (id !== AUTO_SLOT) {
    // Zelf opslaan: dit tabblad neemt het spel weer over
    otherTab = false;
    claimTab();
  }
  try {
    const index = readIndex(),
      key = slotKey(id),
      before = localStorage.getItem(key);
    localStorage.setItem(key, serialize());
    index[id] = currentMeta();
    try {
      writeIndex(index);
    } catch (e) {
      // De lijst past er niet meer bij: dan ook de opslag zelf terugdraaien, anders klopt het kaartje niet
      if (before) localStorage.setItem(key, before);
      else localStorage.removeItem(key);
      throw e;
    }
    return '';
  } catch (e) {
    return isQuotaError(e) ? 'quota' : 'blocked';
  }
}

/**
 * Het spel van een plek laden. Lukt het niet (leeg of kapot), dan blijft het huidige spel staan: gaat het
 * halverwege mis, dan zetten we het spel van daarvoor terug. Een kapotte opslag krijgt een eigen sleutel
 * (`-kapot`), zodat het automatisch opslaan er niet overheen schrijft en er niets verloren gaat.
 */
export function loadSlot(id: string): boolean {
  let text: string | null = null;
  try {
    text = localStorage.getItem(slotKey(id));
  } catch (e) {
    return false;
  }
  if (!text) return false;
  const backup = G ? serialize() : null;
  loadTouched = false;
  try {
    if (deserialize(text)) return true;
  } catch (e) {
    console.error('Laden mislukt', e);
    if (backup && loadTouched)
      try {
        deserialize(backup);
      } catch (e2) {
        console.error('Terugzetten mislukt', e2);
      }
  }
  keepBroken(id, text);
  return false;
}
// Een opslag die niet te laden is, bewaren we apart en halen we van de plek af
function keepBroken(id: string, text: string): void {
  try {
    localStorage.setItem(slotKey(id) + '-kapot', text);
    localStorage.removeItem(slotKey(id));
    const index = readIndex();
    index[id] = null;
    writeIndex(index);
  } catch (e) {
    // Opslag vol of geblokkeerd: dan blijft hij staan
  }
}

/** Een plek leegmaken. */
export function deleteSlot(id: string): void {
  try {
    localStorage.removeItem(slotKey(id));
    const index = readIndex();
    index[id] = null;
    writeIndex(index);
  } catch (e) {
    // Opslag niet bereikbaar: dan blijft alles zoals het was
  }
}

// Twee tabbladen met hetzelfde spel zouden elkaars opslag overschrijven. Elk tabblad heeft daarom een eigen
// nummer; wie het laatst opslaat, is de baas. Ziet een tabblad dat een ander tabblad opslaat, dan stopt het
// zelf met automatisch opslaan (zelf opslaan op een plek kan nog wel).
const OWNER_KEY = 'tijdperken-tab';
const tabId = Math.random().toString(36).slice(2);
let otherTab = false;
addEventListener('storage', e => {
  if (e.key !== OWNER_KEY || !e.newValue || e.newValue === tabId || otherTab) return;
  otherTab = true;
  toast('Dit spel is ook in een ander tabblad open. Hier wordt niet meer automatisch opgeslagen.', 'bad');
});
function claimTab(): void {
  try {
    localStorage.setItem(OWNER_KEY, tabId);
  } catch (e) {
    // (geen opslag: dan is er ook niets te overschrijven)
  }
}

// Een volle opslag melden we één keer, niet elke minuut opnieuw (tot opslaan weer lukt)
let autoSaveWarned = false;
/** Automatisch opslaan: elke minuut, als je het tabblad verlaat, en voor je naar het hoofdmenu gaat. */
export function save(): boolean {
  if (otherTab) return false;
  claimTab();
  const error = saveToSlot(AUTO_SLOT);
  const line = $('#saved').lastChild!; // de tekst achter het bolletje (zie index.html)
  if (!error) {
    line.textContent = `Automatisch opgeslagen op dag ${G.day}`;
    autoSaveWarned = false;
    return true;
  }
  line.textContent =
    error === 'quota' ? 'Opslaan mislukt: de opslag is vol' : 'Opslaan lukt niet in deze browser';
  if (!autoSaveWarned) toast(saveErrorText(error), 'bad');
  autoSaveWarned = true;
  return false;
}
/** De nieuwste opslag laden (bij het opstarten). Is die kapot, dan de volgende; zo raak je nooit alles kwijt. */
export function load(): boolean {
  for (let tries = 0; tries < SLOTS.length; tries++) {
    const id = latestSlot(readIndex());
    if (!id) return false;
    if (loadSlot(id)) return true;
    // (loadSlot heeft de kapotte plek apart gezet, dus de volgende ronde kiest een andere)
  }
  return false;
}
/**
 * Dit spel is voorbij: de automatische opslag weg, zodat "Verder spelen" er niet naar teruggaat.
 * Alleen als daar echt dit spel staat: een ander spel op die plek blijft bewaard.
 */
export function wipe(): void {
  if (sameGame(readIndex()[AUTO_SLOT], currentMeta())) deleteSlot(AUTO_SLOT);
}
export function afterLoad(): void {
  computeCaches();
  computeAvail();
  onAgeChange();
  setSpeed(1);
  setZoom(cam.z);
  for (const k in sigs) sigs[k] = null;
  resetUiState();
  store.uiDirty = true;
}
/** Wat er van het vorige spel in de UI kan blijven hangen (plaatsmodus, bevelen, pings, tempo's): allemaal weg. */
function resetUiState(): void {
  store.placing = null;
  store.expandMode = false;
  store.cmdMode = null;
  store.demoMode = false;
  store.demolishArm = 0;
  store.raidPing = null;
  store.notePos = null;
  store.rateSnap = null;
  store.rateT = 0;
  for (const k in rate) delete rate[k]; // oude tempo's zouden grondstoffen ten onrechte rood kleuren
  if (bigMapOpen()) setBigMap(false);
  $('#resPop').hidden = true;
}
// Je verlaat het tabblad: bewaren (alleen tijdens het spelen, niet op het titelscherm)
const saveOnLeave = () => {
  if (document.hidden && G && !G.over && SET.autosave && $('#title').hidden) save();
};
addEventListener('visibilitychange', saveOnLeave);
// (op iOS komt bij het sluiten van een tabblad soms alleen pagehide)
addEventListener('pagehide', () => {
  if (G && !G.over && SET.autosave && $('#title').hidden) save();
});
