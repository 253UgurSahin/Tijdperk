// Opslaan en laden in de browser: drie eigen plekken en één automatische (zie data/saveslots.js).
import { store } from '../core/store.js';
import { SET } from '../core/settings.js';
import { CX, CY, H, TH, TW, W } from '../config.js';
import { ACHIEVEMENT } from '../data/achievements.js';
import { BLESSING } from '../data/blessings.js';
import { B } from '../data/buildings.js';
import { cleanDiff } from '../data/difficulty.js';
import { cleanPendingBoss } from '../data/bosses.js';
import { cleanActiveEvent, cleanBuffs, cleanEventsSeen, cleanFollowups } from '../data/events.js';
import { cleanFinale, resetCharge } from '../data/finale.js';
import { cleanMods } from '../data/modifiers.js';
import { DEFAULT_PEOPLE, PEOPLE } from '../data/peoples.js';
import { RKEYS } from '../data/resources.js';
import {
  AUTO_SLOT,
  MANUAL_SLOTS,
  OLD_AGE,
  OLD_SAVE_KEY,
  SLOT_INDEX_KEY,
  cleanSlotIndex,
  cleanSlotMeta,
  latestSlot,
  metaFromSave,
  sameGame,
  saveErrorText,
  slotKey,
} from '../data/saveslots.js';
import { cleanScenarioState } from '../data/scenarios.js';
import { VICTORY } from '../data/victories.js';
import { cleanWonders } from '../data/wonders.js';
import { cleanGroups } from '../data/army.js';
import { restoreKills } from './army.js';
import { computeAvail, computeCaches } from './caches.js';
import { spawnFoe, spawnUnit, spawnVillager } from './entities.js';
import { loadRivals, saveRivals } from './rivals.js';
import { currentChallenge } from './scenario.js';
import { G, bById, baseState, gameOpts, placeName, setGame } from './state.js';
import { refreshWonders } from './wonders.js';
import { setZoom } from '../input/input.js';
import { clearSel } from '../input/selection.js';
import { clampCam } from '../render/camera.js';
import { cam } from '../render/scene.js';
import { onAgeChange } from '../ui/age.js';
import { sigs } from '../ui/header.js';
import { setSpeed, toast } from '../ui/hud.js';
import { $ } from '../util/dom.js';
import { fromBase64, packZeros, toBase64, unpackZeros } from '../util/pack.js';
import { amt, bmap, buildLists, genWorld, node, road, setBlk } from '../world/world.js';

// Kaartrijen inpakken: veel nullen worden kort opgeschreven (zie util/pack.js). Oude opslag heeft dit nog niet.
const packArray = bytes => toBase64(packZeros(bytes));
const unpackArray = (text, length, packed) =>
  packed ? unpackZeros(fromBase64(text), length) : fromBase64(text);
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
  ])
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
    rivals: saveRivals(), // rivalen met hun gebouwen en soldaten (zie game/rivals.js)
    cam: { x: cam.x, y: cam.y, z: cam.z },
    cv: 2,
  });
}
export function deserialize(str) {
  const s = JSON.parse(str);
  if (s.v !== 4 || s.size !== W) return false;
  // De keuzes van het nieuw-spelscherm. Opslag van daarvóór: volk en moeilijkheid uit het spel, de rest standaard
  // (een continent, winnen met de sterrenpoort). De kaartsoort is nodig om dezelfde wereld te maken.
  const opts = gameOpts(s.seed, { people: s.g.people, diff: s.g.diff, ...s.g.opts });
  setGame(baseState(s.seed));
  genWorld(s.seed, opts.map);
  Object.assign(G, s.g);
  G.opts = opts;
  // Uitdaging en spelregels: opslag van daarvóór (of een uitdaging die niet meer bestaat) is een gewoon spel.
  // Dit moet vóór het terugzetten van soldaten: spelregels kunnen hun levens veranderen.
  G.scenario = cleanScenarioState(s.g.scenario);
  G.mods = cleanMods(s.g.mods);
  // Al gewonnen in opslag van vóór de keuze: dat was altijd met de sterrenpoort. Een uitdaging wint met haar doel.
  const knownVictory = !!VICTORY[s.g.wonBy];
  const wonChallenge = s.g.wonBy === 'scenario' && !!G.scenario;
  const wonBy = knownVictory || wonChallenge ? s.g.wonBy : 'stargate';
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
  if (s.g.buff && s.g.buff.work > G.t)
    G.buffs.push({
      k: 'feast',
      n: 'Oogstfeest',
      g: '⚘',
      d: 'Al het verzamelwerk 25% sneller',
      bonus: { 'gather.all': 0.25 },
      until: s.g.buff.work,
    });
  delete G.buff;
  G.followups = cleanFollowups(s.g.followups);
  G.eventsSeen = cleanEventsSeen(s.g.eventsSeen);
  G.event = cleanActiveEvent(s.g.event);
  // Wereldwonderen (ook vóór de soldaten: het Colosseum geeft levens). Opslag van daarvóór: geen wonderen,
  // en de handelaar van het Oost-Indisch Huis is nog niet geweest. Na de gebouwen kijken we het nog na.
  G.wonders = cleanWonders(s.g.wonders);
  G.traderDay = Number.isInteger(s.g.traderDay) ? s.g.traderDay : 0;
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
  G.diff = cleanDiff(G.diff);
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
    if (o.id) v.id = o.id; // opslag van daarvóór: een nieuw nummer (de groep raakt die dorpeling dan kwijt)
  }
  for (const o of s.us) {
    const u = spawnUnit(o.k, o.x, o.y);
    restoreKills(u, o.kills); // opslag van vóór de veteranen: 0 overwinningen
    u.hp = Math.min(o.hp, u.mhp);
    u.stance = o.st || 'guard';
    if (o.id) u.id = o.id;
  }
  G.camps = s.camps.map(c => ({ ...c, kind: 'c' }));
  for (const o of s.guards) {
    const c = G.camps.find(c => c.id === o.camp);
    if (!c) continue;
    const f = spawnFoe(fromOld ? (OLD_AGE[o.type] ?? o.type) : o.type, o.x, o.y, 1, c);
    f.hp = o.hp;
    f.mhp = o.mhp;
    f.hx = c.x + 1 + (Math.random() - 0.5) * 3;
    f.hy = c.y + 1 + (Math.random() - 0.5) * 3;
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
let liveGame = null;
/** Draait er een spel dat je kunt voortzetten (geladen of opgeslagen, en niet verloren)? */
export const isLiveGame = () => !!G && liveGame === G && !G.over;

// Browsers noemen een volle opslag elk anders
const isQuotaError = e =>
  !!e &&
  (e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014);

function readIndex() {
  try {
    return cleanSlotIndex(JSON.parse(localStorage.getItem(SLOT_INDEX_KEY) || '{}'));
  } catch (e) {
    return cleanSlotIndex({});
  }
}
function writeIndex(index) {
  localStorage.setItem(SLOT_INDEX_KEY, JSON.stringify(index));
}

/**
 * De ene opslag van vóór de plekken verhuist naar de automatische plek (als die nog leeg is).
 * Pas als dat gelukt is, gaat de oude weg: zo raak je nooit een spel kwijt.
 */
function moveOldSave() {
  try {
    const old = localStorage.getItem(OLD_SAVE_KEY);
    if (!old) return;
    const index = readIndex();
    if (!index[AUTO_SLOT]) {
      localStorage.setItem(slotKey(AUTO_SLOT), old);
      index[AUTO_SLOT] = metaFromSave(JSON.parse(old));
      writeIndex(index);
    }
    localStorage.removeItem(OLD_SAVE_KEY);
  } catch (e) {}
}
moveOldSave();

/** Alle plekken met hun kaartje (plaats, volk, tijdperk, dag, tijd), of null als een plek leeg is. */
export const listSlots = () => readIndex();

/** Het kaartje van het spel dat nu draait, zoals het na opslaan op een plek staat. */
export function currentMeta(at = Date.now()) {
  const challenge = currentChallenge();
  return cleanSlotMeta({
    place: placeName(),
    challenge: challenge ? challenge.n : '',
    people: G.people,
    age: G.age,
    day: G.day,
    at,
    won: G.won,
    seed: G.seed,
  });
}

/**
 * Raak je het spel dat nu draait kwijt als er iets anders op de automatische plek komt (laden, nieuwe wereld,
 * uitdaging)? Ja, als het niet ook op een eigen plek (1, 2 of 3) staat. Een verloren spel telt niet.
 */
export function liveGameAtRisk() {
  if (!isLiveGame()) return false;
  const index = readIndex(),
    now = currentMeta();
  return !MANUAL_SLOTS.some(id => sameGame(index[id], now));
}

/** Het spel op een plek bewaren. Geeft '' als het lukte, anders 'quota' (de opslag is vol) of 'blocked'. */
export function saveToSlot(id) {
  liveGame = G;
  try {
    localStorage.setItem(slotKey(id), serialize());
    const index = readIndex();
    index[id] = currentMeta();
    writeIndex(index);
    return '';
  } catch (e) {
    return isQuotaError(e) ? 'quota' : 'blocked';
  }
}

/** Het spel van een plek laden. Lukt het niet (leeg of kapot), dan blijft het huidige spel staan. */
export function loadSlot(id) {
  try {
    const text = localStorage.getItem(slotKey(id));
    return !!text && deserialize(text);
  } catch (e) {
    return false;
  }
}

/** Een plek leegmaken. */
export function deleteSlot(id) {
  try {
    localStorage.removeItem(slotKey(id));
    const index = readIndex();
    index[id] = null;
    writeIndex(index);
  } catch (e) {}
}

// Een volle opslag melden we één keer, niet elke minuut opnieuw (tot opslaan weer lukt)
let autoSaveWarned = false;
/** Automatisch opslaan: elke minuut, als je het tabblad verlaat, en voor je naar het hoofdmenu gaat. */
export function save() {
  const error = saveToSlot(AUTO_SLOT);
  const line = $('#saved').lastChild;
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
/** De nieuwste opslag laden (bij het opstarten). */
export function load() {
  const id = latestSlot(readIndex());
  return !!id && loadSlot(id);
}
/** Dit spel is voorbij of wordt vervangen: de automatische opslag weg, zodat "Verder spelen" er niet naar teruggaat. */
export function wipe() {
  deleteSlot(AUTO_SLOT);
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
// Je verlaat het tabblad: bewaren (alleen tijdens het spelen, niet op het titelscherm)
addEventListener('visibilitychange', () => {
  if (document.hidden && G && !G.over && SET.autosave && $('#title').hidden) save();
});
