// Opslaan en laden in de browser.
import { store } from '../core/store.js';
import { CX, CY, H, TH, TW, W } from '../config.js';
import { ACHIEVEMENT } from '../data/achievements.js';
import { BLESSING } from '../data/blessings.js';
import { B } from '../data/buildings.js';
import { cleanDiff } from '../data/difficulty.js';
import { cleanActiveEvent, cleanBuffs, cleanEventsSeen, cleanFollowups } from '../data/events.js';
import { cleanMods } from '../data/modifiers.js';
import { DEFAULT_PEOPLE, PEOPLE } from '../data/peoples.js';
import { RKEYS } from '../data/resources.js';
import { cleanScenarioState } from '../data/scenarios.js';
import { VICTORY } from '../data/victories.js';
import { computeAvail, computeCaches } from './caches.js';
import { spawnFoe, spawnUnit, spawnVillager } from './entities.js';
import { loadRivals, saveRivals } from './rivals.js';
import { G, bById, baseState, gameOpts, setGame } from './state.js';
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
// Oude tijdperknummers (6 tijdperken) naar de nieuwe (9 tijdperken)
const OLD_AGE = [0, 1, 3, 5, 6, 7];
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
  ])
    g[k] = G[k];
  return JSON.stringify({
    v: 4,
    size: W,
    ages: 9,
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
  G.groups = G.groups || {};
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
    const f = spawnFoe(fromOld ? (OLD_AGE[o.type] ?? o.type) : o.type, o.x, o.y, 1, c);
    f.hp = o.hp;
    f.mhp = o.mhp;
    f.hx = c.x + 1 + (Math.random() - 0.5) * 3;
    f.hy = c.y + 1 + (Math.random() - 0.5) * 3;
  }
  // Rivalen: opslag van daarvóór heeft er geen. Het gekozen aantal is wat er in het spel zit.
  loadRivals(s.rivals);
  G.opts.rivals = G.rivals.length;
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
