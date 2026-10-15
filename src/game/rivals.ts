// Rivaliserende beschavingen in het spel: hun land, economie, gebouwen, leger, aanvallen en hun val.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { CN, CS, DAYLEN, H, W } from '../config';
import { AGES } from '../data/ages';
import { B } from '../data/buildings';
import { RES } from '../data/resources';
import {
  PERSONALITY,
  RIVAL,
  ageUpValue,
  attackSize,
  costValue,
  giftFor,
  armyToAttack,
  homeGuard,
  maxChunks,
  nextBuild,
  rivalHp,
  rivalIncome,
  rivalLineup,
  rivalLoot,
  rivalUnits,
  verb,
} from '../data/rivals';
import { UNITS } from '../data/units';
import {
  SAVING_SHOWN,
  TheWonder,
  nextFreeWonder,
  rivalWonderTime,
  theWonder,
  wonderIt,
  wonderStartDay,
  wonderVerb,
} from '../data/wonders';
import { mul } from './bonus';
import { computeAvail } from './caches';
import { gain } from './economy';
import { placeBuilding } from './entities';
import { th } from './events';
import { burst, floater, fxRing } from './fx';
import { compass, fire, foeTarget, isDead, moveToward } from './military';
import { dayPace } from './mods';
import { G, sel } from './state';
import { checkVictory } from './victory';
import { refreshWonders, rivalWonderDone, wonderDestroyed } from './wonders';
import { note, toast } from '../ui/hud';
import { dist } from '../util/math';
import { findPath, follow } from '../world/pathfinding';
import { pickRivalSites } from '../world/rivalsites';
import { blk, bmap, isUnl, node, passable, ter } from '../world/world';

// Rivaalgebouwen op nummer (voor aanklikken en de minikaart). Ze staan niet in G.bs: dat zijn alleen de jouwe.
export const rbById = new Map();
// Van wie is elk gebied? 0 = van niemand (of van jou, zie G.unl), anders het nummer van een rivaal
const owner = new Uint8Array(CN * CN);
// Zo lang een aanval duurt (speltijd) voordat de overlevenden naar huis gaan
const RAID_TIME = DAYLEN * 0.35;
// Lange routes (van hun stad naar de jouwe) mogen de hele kaart doorzoeken
const LONG_SEARCH = W * H;
let secondTimer = 0;

// ---- Opzoeken ----

/** De rivaal met dit nummer (1, 2 of 3), of null. */
export const rivalById = id => (G && G.rivals ? G.rivals.find(r => r.id === id) : null) || null;
/** De kleur van een rivaal, op nummer (voor de weergave). */
export const rivalColour = id => {
  const r = rivalById(id);
  return r ? RIVAL[r.k].c : '#888888';
};
/** Het stamhuis van een rivaal, of null als het er niet meer staat. */
export const rivalHall = r => r.bs.find(b => b.type === 'townhall') || null;
/** Alle soldaten van een rivaal die nog meedoen. */
export const rivalArmy = r => G.foes.filter(f => f.rival === r.id && !f.retreat && !f.dead);
/** "de IJzertijd" of "het Dronetijdperk": het tijdperk met het goede lidwoord. */
export const ageWithArticle = age => (AGES[age].n.endsWith('tijdperk') ? 'het ' : 'de ') + AGES[age].n;

/** Van welke rivaal is gebied `ci`? Geeft de rivaal, of null. */
export const landOwner = ci => (owner[ci] ? rivalById(owner[ci]) : null);
/** Het nummer van de rivaal die tegel (x, y) bezit, of 0. */
export const ownerAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : owner[(y >> 4) * CN + (x >> 4)]);

/** Is dit land bewoond, van jou of van een rivaal? Dan tekent de wereld het in vol licht (wildernis is donkerder). */
export const settled = (x, y) => isUnl(x, y) || ownerAt(x, y) !== 0;

/** Een korte tekst per gebied (van jou, van een rivaal of van niemand): verandert die, dan tekent de grond opnieuw. */
export function landSig() {
  let s = '';
  for (let c = 0; c < CN * CN; c++) s += G.unl[c] ? '1' : owner[c] ? String(owner[c] + 1) : '0';
  return s;
}

// Zet de tabel "van wie is welk gebied" opnieuw, na een verandering
function rebuildLand() {
  owner.fill(0);
  for (const r of G.rivals || []) if (!r.dead) for (const c of r.chunks) owner[c] = r.id;
  store.mapVersion++;
}

// ---- Een nieuw spel ----

/**
 * Zet bij een nieuw spel `count` rivalen neer, ver van je stamhuis (zie world/rivalsites.js).
 * Kampen die op hun land liggen, verdwijnen: daar wonen nu zij.
 */
export function setupRivals(count, seed) {
  G.rivals = [];
  rbById.clear();
  if (!count) {
    rebuildLand();
    return;
  }
  const sites = pickRivalSites(ter, W, H, seed).slice(0, count);
  const lineup = rivalLineup(seed);
  sites.forEach((site, i) => {
    const r = newRival(i + 1, lineup[i], site);
    G.rivals.push(r);
    removeCampsOn(r.chunks);
    clearAround(site.x + 1, site.y + 1, 5);
    const hall = addBuilding(r, 'townhall', site.x, site.y, true);
    hall.mhp = hall.hp = hallHp(0);
    // Twee wachters om mee te beginnen, zodat hun stad niet weerloos is
    for (let k = 0; k < homeGuard(0); k++) spawnRivalUnit(r, rivalUnits(0)[k % 2]);
  });
  rebuildLand();
}

function newRival(id, pick, site) {
  return {
    id, // klein nummer: soldaten en gebouwen verwijzen hiernaar
    k: pick.k, // naam en kleur (data/rivals.js)
    p: pick.p, // karakter: bouwer, krijger of handelaar
    age: 0,
    bank: 0, // spaarpot voor gebouwen en tijdperken (in waarde, zie costValue)
    war: 0, // spaarpot voor soldaten
    trainT: 0, // seconden tot de volgende soldaat klaar is
    trained: 0, // zoveel soldaten getraind (bepaalt welke soort de volgende is)
    x: site.x, // linkerbovenhoek van hun stamhuis
    y: site.y,
    chunks: site.chunks.slice(),
    bs: [], // hun gebouwen (zie addBuilding)
    attacks: 0,
    nextAttack: PERSONALITY[pick.p].first, // dag van de volgende aanval
    grewDay: 1, // dag waarop ze voor het laatst gebied erbij namen
    giftDay: 0,
    angry: -1e9, // speltijd van de laatste keer dat jij hen aanviel
    alarm: -1e9, // speltijd van de laatste treffer op hun stad (dan komen de wachters kijken)
    buildWait: 0, // seconden niet proberen te bouwen (er was geen plek)
    wonderPot: 0, // spaarpot voor een wereldwonder (alleen de Bouwer, in waarde)
    wonderWait: 0, // seconden niet proberen een wonder neer te zetten (er was geen plek)
    dead: false,
    deadDay: 0,
  };
}

// Kampen op het land van een rivaal weghalen, met hun bewakers
function removeCampsOn(chunks) {
  const gone = new Set();
  for (const c of G.camps) {
    const ci = ((c.y + 1) >> 4) * CN + ((c.x + 1) >> 4);
    if (c.alive && chunks.includes(ci)) {
      c.alive = false;
      gone.add(c.id);
    }
  }
  if (gone.size) {
    G.camps = G.camps.filter(c => !gone.has(c.id));
    G.foes = G.foes.filter(f => !gone.has(f.camp));
  }
}

// Bomen en rotsen rond hun stamhuis weg, zodat er een pleintje is
function clearAround(cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if (x >= 0 && y >= 0 && x < W && y < H && dist(x + 0.5, y + 0.5, cx, cy) <= r) node[y * W + x] = 0;
}

// Leven van hun stamhuis: groeit met elk tijdperk
const hallHp = age => Math.round(B.townhall.hp * (1 + 0.4 * age));

// ---- Gebouwen ----

function addBuilding(r, type, x, y, done, id = G.nid++) {
  const d = B[type];
  const b = {
    id,
    kind: 'rb', // gebouw van een rivaal (jouw gebouwen zijn 'b')
    rival: r.id,
    type,
    x,
    y,
    hp: d.hp,
    mhp: d.hp,
    done,
    prog: 0,
    bt: 8 + d.size * 6, // bouwtijd in seconden
    cd: 0,
  };
  if (!done) b.hp = Math.max(1, d.hp * 0.2);
  r.bs.push(b);
  rbById.set(b.id, b);
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) {
      const i = (y + dy) * W + x + dx;
      bmap[i] = b.id;
      node[i] = 0;
    }
  store.mapVersion++;
  return b;
}

function removeBuilding(b) {
  const r = rivalById(b.rival),
    d = B[b.type];
  b.dead = true;
  if (r) r.bs = r.bs.filter(o => o !== b);
  rbById.delete(b.id);
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) {
      const i = (b.y + dy) * W + b.x + dx;
      if (bmap[i] === b.id) bmap[i] = 0;
    }
  if (sel.rb === b.id) sel.rb = null;
  store.mapVersion++;
}

/** Een gebouw van een rivaal is kapotgeschoten (zie hit in game/military.js). */
export function rivalBuildingDestroyed(b) {
  const r = rivalById(b.rival),
    d = B[b.type];
  removeBuilding(b);
  for (let k = 0; k < 6; k++) burst(b.x + Math.random() * d.size, b.y + Math.random() * d.size, '#8a7a62');
  sfx('boom');
  if (!r || r.dead) return;
  if (b.type === 'townhall') {
    rivalDefeated(r);
    return;
  }
  // Een wereldwonder (of de bouwplaats ervan): het wonder is weer vrij
  if (d.wonder) {
    wonderDestroyed(b);
    return;
  }
  store.notePos = [b.x + d.size / 2, b.y + d.size / 2];
  note(`${d.n} van ${RIVAL[r.k].n} verwoest.`, 'good');
  store.uiDirty = true;
}

/** Iets van een rivaal wordt geraakt: ze onthouden dat (minder geschenken) en hun wachters komen kijken. */
export function rivalHurt(target) {
  const r = rivalById(target.rival);
  if (!r) return;
  // Jezelf verdedigen telt niet als aanvallen: alleen treffers op hun gebouwen of op hun eigen land
  const onTheirSide = target.kind === 'rb' || ownerAt(target.x, target.y) === r.id;
  if (!onTheirSide) return;
  r.angry = G.t;
  if (target.kind === 'rb') r.alarm = G.t;
}

// Hoeveel gebouwen van elke soort een rivaal heeft (af of in aanbouw)
function counts(r) {
  const have = {};
  for (const b of r.bs) have[b.type] = (have[b.type] || 0) + 1;
  return have;
}

// Een vrije plek voor een gebouw van `size` op hun land: in ringen rond het stamhuis, met een pad ertussen
function findSpot(r, size) {
  const cx = r.x + 1,
    cy = r.y + 1;
  for (let ring = 3; ring <= 22; ring++)
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = cx + dx,
          y = cy + dy;
        if (fits(r, x, y, size)) return { x, y };
      }
  return null;
}
function fits(r, x, y, size) {
  // Eén tegel ruimte eromheen, zodat gebouwen niet tegen elkaar aan staan
  for (let yy = y - 1; yy <= y + size; yy++)
    for (let xx = x - 1; xx <= x + size; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
      const i = yy * W + xx;
      if (bmap[i]) return false;
      const inside = xx >= x && xx < x + size && yy >= y && yy < y + size;
      if (inside && (!passable(i) || ownerAt(xx, yy) !== r.id)) return false;
    }
  return true;
}

// ---- Soldaten ----

/** Laat een soldaat van een rivaal verschijnen bij hun stad. Hij is een "vijand" (in G.foes) met rival: nummer. */
export function spawnRivalUnit(r, k, x, y) {
  const U = UNITS[k],
    hall = rivalHall(r);
  const { hx, hy } = guardPost(r, rivalArmy(r).length);
  const sx = x ?? (hall ? hall.x + 1 : hx),
    sy = y ?? (hall ? hall.y + 2.6 : hy);
  // Hun wapens en pantser groeien mee met hun tijdperk (zoals bij jou in de smidse)
  const arms = 1 + 0.12 * r.age;
  const f = {
    id: G.nid++,
    kind: 'f',
    rival: r.id, // van welke rivaal
    uk: k, // soort soldaat (sleutel uit UNITS)
    type: Math.min(r.age, 8), // vijandsoort van dit tijdperk (voor wat nog naar FOES kijkt)
    mode: 'home', // home = thuis op wacht · march = onderweg naar jou · raid = valt aan · return = naar huis
    x: sx,
    y: sy,
    hp: U.hp * arms * rivalHp(G.diff),
    mhp: U.hp * arms * rivalHp(G.diff),
    dmg: U.dmg * arms,
    spd: U.spd,
    r: U.r,
    rate: U.rate,
    air: !!U.fly, // bij vijanden betekent air: vliegt
    ride: !!U.ride,
    proj: !!U.proj,
    big: !!U.big,
    splash: U.splash || 0,
    snd: U.snd,
    cd: Math.random(),
    path: null,
    tgt: null,
    rt: 0,
    pt: 0,
    anim: Math.random() * 9,
    dir: 1,
    alpha: 1,
    camp: 0,
    hx,
    hy,
    until: 0,
  };
  G.foes.push(f);
  return f;
}

// Een wachtpost rond hun stamhuis: elke nieuwe soldaat een stukje verder op de cirkel, op begaanbare grond
function guardPost(r, n) {
  for (let k = 0; k < 8; k++) {
    const a = (n + k) * 2.4,
      ring = 3.2 + ((n + k) % 3) * 1.1;
    const hx = r.x + 1 + Math.cos(a) * ring,
      hy = r.y + 1 + Math.sin(a) * ring;
    if (passable((hy | 0) * W + (hx | 0))) return { hx, hy };
  }
  return { hx: r.x + 1, hy: r.y + 2.6 }; // geen plek: vlak voor het stamhuis
}

/**
 * Wat een soldaat van een rivaal nu doet (vanuit fUpdate in game/military.js).
 * Geeft true als hij een doel heeft: dan valt fUpdate aan of loopt erheen. Anders liep hij hier zelf al.
 */
export function rivalThink(f, dt) {
  const r = rivalById(f.rival);
  if (!r || r.dead) {
    f.retreat = true;
    return false;
  }
  f.rt -= dt;
  // In de vredige modus blijft iedereen thuis
  if (G.peaceful && (f.mode === 'march' || f.mode === 'raid')) startReturn(f);
  // Veel te lang onderweg (de route liep vast)? Dan gaan ze terug naar huis
  if (f.mode === 'march' && G.t > f.until) startReturn(f);
  if (f.mode === 'home') return guardHome(f, r, dt);
  if (f.mode === 'march' || f.mode === 'return') {
    walkRoute(f, r, dt);
    return false;
  }
  // Aanvallen, net als de nachtelijke aanvallers; na een tijdje gaan de overlevenden naar huis
  if (G.t > f.until) {
    startReturn(f);
    return false;
  }
  if (!f.tgt || isDead(f.tgt) || f.rt <= 0) {
    const n = foeTarget(f);
    if (n !== f.tgt) f.path = null;
    f.tgt = n;
    f.rt = 2;
  }
  return !!f.tgt;
}

// Thuis op wacht: vecht met wie te dichtbij komt, en loop terug naar de wachtpost als het rustig is
function guardHome(f, r, dt) {
  if (f.rt <= 0 || (f.tgt && isDead(f.tgt))) {
    f.rt = 0.8;
    f.tgt = homeTarget(f, r);
    f.aggro = !!f.tgt;
  }
  // Niet te ver van huis achter iemand aan
  if (f.tgt && dist(f.x, f.y, f.hx, f.hy) > 18) {
    f.tgt = null;
    f.aggro = false;
  }
  if (f.tgt) return true;
  if (dist(f.x, f.y, f.hx, f.hy) > 0.8) moveToward(f, f.hx, f.hy, dt, f.spd * 0.7, f.air);
  return false;
}

// Wie van jou is dicht bij hun stad? Wordt hun stad beschoten, dan kijken ze verder om zich heen.
function homeTarget(f, r) {
  const alarm = G.t - r.alarm < 6;
  const cx = r.x + 1,
    cy = r.y + 1,
    nearCity = alarm ? 22 : 12;
  let best = null,
    bd = 1e9;
  const look = e => {
    const d = dist(f.x, f.y, e.x, e.y);
    if (d < bd && (d < 8 || dist(cx, cy, e.x, e.y) < nearCity)) {
      bd = d;
      best = e;
    }
  };
  for (const u of G.us) if (!UNITS[u.k].fly || f.air || f.proj) look(u);
  for (const v of G.vs) if (!v.hidden) look(v);
  return best;
}

// Een lange route lopen: op weg naar jouw stad (march) of terug naar huis (return)
function walkRoute(f, r, dt) {
  if (f.mode === 'march' && f.rt <= 0) {
    f.rt = 0.7;
    // Iets van jou in de buurt? Dan begint de aanval hier
    if (playerNear(f.x, f.y, 7)) return startRaid(f);
  }
  if (!f.path) {
    const goal = f.mode === 'march' ? marchGoal() : { x: f.hx, y: f.hy };
    f.path = goal ? routeTo(f.x, f.y, goal.x, goal.y) : null;
    if (!f.path) {
      // Geen route te vinden: op weg naar jou gewoon aanvallen, op weg naar huis verdwijnen
      if (f.mode === 'march') return startRaid(f);
      f.retreat = true;
      return;
    }
  }
  // Een muur op de route? Dan moet die eerst kapot: dat doet de gewone aanvalscode
  const next = f.path[0];
  if (f.mode === 'march' && next && blk[next[1] * W + next[0]]) return startRaid(f);
  // Op weg naar jou loopt de groep samen op, in het tempo van de traagste
  const speed = f.mode === 'march' && f.pace ? f.pace : f.spd;
  if (follow(f, dt, speed)) {
    f.path = null;
    if (f.mode === 'march') startRaid(f);
    else f.mode = 'home';
  }
}

// Waar een aanval heen gaat: jouw stamhuis
function marchGoal() {
  const h = th();
  return h ? { x: h.x + 1, y: h.y + 2 } : null;
}

// Een route over de hele kaart. Eerst om muren heen; lukt dat niet, dan dwars over alle begaanbare grond.
function routeTo(x, y, tx, ty) {
  return (
    findPath(x | 0, y | 0, tx | 0, ty | 0, 2, LONG_SEARCH) ||
    findPath(x | 0, y | 0, tx | 0, ty | 0, 3, LONG_SEARCH)
  );
}

function startRaid(f) {
  // De aanval duurt RAID_TIME vanaf aankomst (niet vanaf vertrek), zodat ook traag geschut echt meevecht.
  // Het kleine verschil per soldaat zorgt dat ze niet allemaal in dezelfde tik naar huis gaan.
  if (f.mode === 'march') f.until = G.t + RAID_TIME + (f.id % 6) * 1.5;
  f.mode = 'raid';
  f.path = null;
  f.tgt = null;
  f.rt = 0;
}

function startReturn(f) {
  f.mode = 'return';
  f.path = null;
  f.tgt = null;
  f.aggro = false;
}

// Staat er iets van jou (dorpeling, soldaat of gebouw) binnen r tegels?
function playerNear(x, y, r) {
  for (const u of G.us) if (dist(x, y, u.x, u.y) < r) return true;
  for (const v of G.vs) if (!v.hidden && dist(x, y, v.x, v.y) < r) return true;
  for (const b of G.bs) if (dist(x, y, b.x + 0.5, b.y + 0.5) < r) return true;
  return false;
}

// ---- Elke seconde: economie, bouwen, trainen, groeien, aanvallen ----

/** Werk alle rivalen bij. Torens schieten elke tik; de rest gebeurt eens per seconde. */
export function updateRivals(dt) {
  if (!G.rivals || !G.rivals.length) return;
  rivalTowers(dt);
  secondTimer += dt;
  while (secondTimer >= 1) {
    secondTimer -= 1;
    for (const r of G.rivals) if (!r.dead) rivalSecond(r);
  }
}

function rivalSecond(r) {
  const P = PERSONALITY[r.p];
  const army = rivalArmy(r);
  const wanted = homeGuard(r.age) + attackSize(r.age, r.attacks, r.p, G.diff);
  const income = rivalIncome(r.age, r.chunks.length, G.diff, r.p);
  // Is het leger nog niet groot genoeg, dan gaat een deel van het inkomen naar soldaten
  const short = army.length < wanted;
  if (short) {
    r.war += income * P.war;
    r.bank += income * (1 - P.war);
  } else r.bank += income;
  if (short) train(r);
  build(r);
  wonderWork(r, income);
  grow(r);
  if (!G.peaceful && !G.over) maybeAttack(r, army);
  if (P.gifts) maybeGift(r);
}

function train(r) {
  r.trainT -= 1;
  if (r.trainT > 0) return;
  const list = rivalUnits(r.age);
  const k = list[r.trained % list.length];
  const price = costValue(UNITS[k].cost);
  if (r.war < price) return;
  r.war -= price;
  r.trained++;
  r.trainT = UNITS[k].t;
  spawnRivalUnit(r, k);
}

function build(r) {
  // Wat in aanbouw is, groeit eerst af (een wereldwonder groeit apart, zie wonderWork)
  for (const b of r.bs)
    if (!b.done && !B[b.type].wonder) {
      b.prog += 1;
      b.hp = Math.min(b.mhp, b.hp + (b.mhp * 0.8) / b.bt);
      if (b.prog >= b.bt) {
        b.done = true;
        b.hp = b.mhp;
      }
      return;
    }
  const type = nextBuild(r.age, r.p, counts(r));
  if (r.buildWait > 0) r.buildWait--;
  else if (type) {
    const price = Math.max(10, costValue(B[type].cost));
    if (r.bank < price) return; // sparen voor dit gebouw
    const spot = findSpot(r, B[type].size);
    if (spot) {
      r.bank -= price;
      addBuilding(r, type, spot.x, spot.y, false);
      return;
    }
    r.buildWait = 30; // geen plek: over een halve minuut opnieuw proberen (misschien met meer land)
  }
  // Alles staat (of er is nu geen plek): sparen voor het volgende tijdperk, met dezelfde kosten als voor jou
  const nothingToBuild = !type || r.buildWait > 0;
  if (nothingToBuild && r.age < AGES.length - 1 && r.bank >= ageUpValue(r.age + 1)) rivalAgeUp(r);
}

/** De soldaten die een rivaal nu kan trainen (zie data/rivals.js). */
export const rivalUnitsFor = r => rivalUnits(r.age);

/** Een rivaal gaat naar het volgende tijdperk. */
export function rivalAgeUp(r) {
  r.bank = Math.max(0, r.bank - ageUpValue(r.age + 1));
  r.age++;
  r.buildWait = 0; // nieuw tijdperk: meteen weer proberen te bouwen
  const hall = rivalHall(r);
  if (hall) {
    const frac = hall.hp / hall.mhp;
    hall.mhp = hallHp(r.age);
    hall.hp = hall.mhp * frac;
  }
  store.notePos = [r.x + 1, r.y + 1];
  toast(`${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'bereikt', 'bereiken')} ${ageWithArticle(r.age)}.`);
  store.uiDirty = true;
}

// Meer land: elke paar dagen een gebied erbij, grenzend aan wat ze al hebben
function grow(r) {
  const P = PERSONALITY[r.p];
  if (G.day - r.grewDay < P.grow || r.chunks.length >= maxChunks(r.age)) return;
  r.grewDay = G.day;
  let best = -1,
    bestLand = 0.25;
  for (const c of r.chunks)
    for (const n of neighbours(c)) {
      if (G.unl[n] || owner[n] || hasCamp(n)) continue;
      const land = landShare(n);
      if (land > bestLand) {
        bestLand = land;
        best = n;
      }
    }
  if (best < 0) return;
  r.chunks.push(best);
  r.buildWait = 0;
  rebuildLand();
}
function neighbours(c) {
  const x = c % CN,
    y = Math.floor(c / CN),
    out = [];
  if (x > 0) out.push(c - 1);
  if (x < CN - 1) out.push(c + 1);
  if (y > 0) out.push(c - CN);
  if (y < CN - 1) out.push(c + CN);
  return out;
}
const hasCamp = ci => G.camps.some(c => c.alive && ((c.y + 1) >> 4) * CN + ((c.x + 1) >> 4) === ci);
function landShare(ci) {
  const x0 = (ci % CN) * CS,
    y0 = Math.floor(ci / CN) * CS;
  let land = 0;
  for (let y = y0; y < y0 + CS; y++) for (let x = x0; x < x0 + CS; x++) if (passable(y * W + x)) land++;
  return land / (CS * CS);
}

// ---- Wereldwonderen (alleen de Bouwer) ----

/*
 * Een Bouwer spaart naast zijn gewone inkomen voor een wereldwonder: het oudste dat nog vrij is,
 * en pas vanaf een vaste dag (zie wonderStartDay). Vanaf de helft van de prijs zie je dat hij spaart.
 * Heeft hij genoeg, dan zet hij de bouwplaats neer op zijn land. Hij doet er anderhalf keer zo lang over
 * als jij met 3 bouwers (zie rivalWonderTime), zodat je tijd hebt om het eerst af te maken of de bouwplaats te slopen.
 */
function wonderWork(r, income) {
  const site = r.bs.find(b => B[b.type].wonder && !b.done);
  if (site) {
    growWonder(r, site);
    return;
  }
  const k = savingTarget(r);
  if (!k) return;
  const price = costValue(B[k].cost);
  const before = r.wonderPot || 0;
  r.wonderPot = Math.min(price, before + income * PERSONALITY[r.p].wonders);
  // Over de helft: een seintje, zodat je weet dat er een race aankomt
  if (before < price * SAVING_SHOWN && r.wonderPot >= price * SAVING_SHOWN) {
    store.notePos = [r.x + 1, r.y + 1];
    toast(
      `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'spaart', 'sparen')} voor ${theWonder(k)} en ${verb(RIVAL[r.k], 'heeft', 'hebben')} al de helft. Bouw ${wonderIt(k)} zelf eerst!`,
    );
  }
  if (r.wonderPot < price) return;
  if (r.wonderWait > 0) {
    r.wonderWait--;
    return;
  }
  const spot = findSpot(r, B[k].size);
  if (!spot) {
    r.wonderWait = 30; // geen plek: over een halve minuut opnieuw (misschien met meer land)
    return;
  }
  r.wonderPot -= price;
  const b = addBuilding(r, k, spot.x, spot.y, false);
  b.bt = rivalWonderTime(k);
  const days = Math.max(1, Math.round(b.bt / DAYLEN));
  store.notePos = [spot.x + 1.5, spot.y + 1.5];
  toast(
    `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'begint', 'beginnen')} aan ${theWonder(k)}. Over ongeveer ${days} ${days === 1 ? 'dag' : 'dagen'} ${wonderVerb(k, 'is het', 'zijn ze')} af. ${STOP_HINT}`,
    'bad',
  );
  store.uiDirty = true;
}

// Wat je kunt doen als een rivaal een wonder bouwt
const STOP_HINT = 'Sloop de bouwplaats of maak het zelf eerder af.';

// Voor welk wonder een Bouwer nu spaart: het oudste dat nog vrij is, maar pas vanaf zijn startdag (anders null)
function savingTarget(r) {
  if (!PERSONALITY[r.p].wonders) return null;
  const k = nextFreeWonder(r.age, takenWonders());
  return k && G.day >= wonderStartDay(k) ? k : null;
}

/**
 * Waar een rivaal voor spaart en hoe ver hij is: { k, frac } (frac van 0 tot 1).
 * Pas vanaf de helft van de prijs (SAVING_SHOWN), anders null. Ook null als hij al aan een wonder bouwt.
 */
export function rivalWonderSaving(r) {
  if (r.dead || r.bs.some(b => B[b.type].wonder && !b.done)) return null;
  const k = savingTarget(r);
  if (!k) return null;
  const frac = Math.min(1, (r.wonderPot || 0) / costValue(B[k].cost));
  return frac >= SAVING_SHOWN ? { k, frac } : null;
}

// Wonderen die al een eigenaar hebben, of waar een rivaal al aan bouwt
function takenWonders() {
  const taken = new Set(Object.keys(G.wonders || {}));
  for (const r of G.rivals) if (!r.dead) for (const b of r.bs) if (B[b.type].wonder) taken.add(b.type);
  return taken;
}

// De bouwplaats van een wonder groeit elke seconde een stukje; bij driekwart krijg je een waarschuwing
function growWonder(r, b) {
  const k = b.type;
  const before = b.prog / b.bt;
  b.prog += 1;
  b.hp = Math.min(b.mhp, b.hp + (b.mhp * 0.8) / b.bt);
  if (before < 0.75 && b.prog / b.bt >= 0.75) {
    store.notePos = [b.x + 1.5, b.y + 1.5];
    toast(
      `${TheWonder(k)} van ${RIVAL[r.k].n} ${wonderVerb(k, 'is', 'zijn')} voor 75% klaar. ${STOP_HINT}`,
      'bad',
    );
  }
  if (b.prog < b.bt) return;
  b.done = true;
  b.hp = b.mhp;
  rivalWonderDone(r, b);
}

/** Jij was eerder klaar met hetzelfde wonder: de bouwplaats van de rivaal verdwijnt en hij krijgt zijn spaargeld terug. */
export function cancelRivalWonder(r, b) {
  r.wonderPot = (r.wonderPot || 0) + costValue(B[b.type].cost);
  removeBuilding(b);
}

// ---- Aanvallen ----

function maybeAttack(r, army) {
  const P = PERSONALITY[r.p];
  if (G.day < Math.max(4, P.first) || G.day < r.nextAttack) return;
  // Ze vertrekken 's ochtends, zodat ze er overdag zijn (de nachtelijke aanvallen komen 's avonds)
  if (G.clock < 7 || G.clock > 13) return;
  const home = army.filter(f => f.mode === 'home');
  // Pas aanvallen als er genoeg thuis is: hun wacht plus een groep die groot genoeg is (zie data/rivals.js)
  if (home.length < armyToAttack(r.age, r.attacks, r.p, G.diff)) return;
  const free = home.length - homeGuard(r.age);
  const size = attackSize(r.age, r.attacks, r.p, G.diff);
  launchAttack(r, home.slice(0, Math.min(free, size)));
}

/** Stuur een groep soldaten van een rivaal op weg naar jouw stad, met een waarschuwing. */
export function launchAttack(r, group) {
  const goal = marchGoal();
  if (!goal || !group.length) return;
  const lead = group[0];
  const route = routeTo(lead.x, lead.y, goal.x, goal.y);
  // De groep loopt samen op, in het tempo van de traagste (zoals geschut): zo komen ze tegelijk aan
  const pace = Math.min(...group.map(f => f.spd));
  group.forEach((f, k) => {
    f.mode = route ? 'march' : 'raid';
    f.path = route ? route.slice() : null;
    f.pace = pace;
    f.tgt = null;
    f.aggro = true;
    // Bij aankomst begint de klok van de aanval (zie startRaid). Tot dan geldt een ruime grens: de mars
    // plus een hele aanval. Een gewoon getal, geen Infinity: dat kan de opslag niet bewaren.
    f.until = G.t + marchSeconds(f) + RAID_TIME + k * 1.5;
  });
  r.attacks++;
  r.nextAttack = G.day + PERSONALITY[r.p].every;
  const n = group.length;
  const who = `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'valt', 'vallen')} aan!`;
  const when = `Ze zijn er rond ${clockText(arrivalHour(group))}.`;
  store.notePos = [lead.x, lead.y];
  toast(`${who} ${n} soldaten uit het ${compass(r.x, r.y)}. ${when}`, 'bad');
  sfx('alarm');
  store.raidPing = { x: r.x + 1, y: r.y + 1, t: 8 };
  store.uiDirty = true;
}

// Hoeveel speltijd (seconden) een soldaat nog nodig heeft tot je stad: de rest van zijn route, op zijn marstempo
function marchSeconds(f) {
  const tiles = f.path ? f.path.length : 0;
  // Schuin lopen is iets langer dan recht: daarom keer 1.1
  return (tiles * 1.1) / (f.pace || f.spd);
}

/** Rond welk uur (0 tot 23) deze soldaten bij je stad zijn: wie het verst weg is, telt. */
export function arrivalHour(group) {
  const secs = Math.max(0, ...group.map(marchSeconds));
  return Math.round(G.clock + (secs * 24 * dayPace()) / DAYLEN) % 24;
}

/** Een uur als kloktijd: 9 wordt "09:00". */
export const clockText = hour => `${String(hour).padStart(2, '0')}:00`;

// Een vriendelijke rivaal (Handelaar) stuurt om de paar dagen een geschenk, als je hem met rust laat
function maybeGift(r) {
  if (G.day < 3 || G.day - r.giftDay < 3 || G.clock < 10 || G.clock > 11) return;
  if (G.t - r.angry < DAYLEN * 2) return;
  r.giftDay = G.day;
  const gift = giftFor(r.age);
  gain(gift);
  store.notePos = [r.x + 1, r.y + 1];
  toast(`${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'stuurt', 'sturen')} je een geschenk: ${resText(gift)}.`, 'good');
}

/** "120 voedsel, 80 hout": grondstoffen als korte tekst. */
export const resText = res =>
  Object.entries(res)
    .map(([k, n]) => `${Math.round(n)} ${RES[k].n.toLowerCase()}`)
    .join(', ');

// ---- Verslagen ----

/** Hun stamhuis is gevallen: de rivaal is verslagen. Je krijgt hun land en buit; wat er nog staat, stort in en verdwijnt. */
export function rivalDefeated(r) {
  r.dead = true;
  r.deadDay = G.day;
  // Hun wereldwonderen blijven staan: die worden van jou (zie hieronder)
  const wonders = r.bs.filter(b => b.done && B[b.type].wonder).map(b => ({ type: b.type, x: b.x, y: b.y }));
  // Wat er nog staat, stort in
  for (const b of r.bs.slice()) {
    const d = B[b.type];
    removeBuilding(b);
    if (!d.wonder || !b.done) burst(b.x + d.size / 2, b.y + d.size / 2, '#8a7a62');
  }
  for (const f of G.foes) if (f.rival === r.id) f.retreat = true;
  // Hun land wordt van jou
  for (const c of r.chunks) G.unl[c] = 1;
  rebuildLand();
  for (const w of wonders) placeBuilding(w.type, w.x, w.y, true);
  if (wonders.length) G.stats.wondersTaken = (G.stats.wondersTaken || 0) + wonders.length;
  refreshWonders();
  const loot = rivalLoot(r.age);
  for (const k in loot) loot[k] = Math.round(loot[k] * mul('loot'));
  gain(loot);
  G.stats.rivals = (G.stats.rivals || 0) + 1;
  for (let k = 0; k < 10; k++) burst(r.x + Math.random() * 2, r.y + Math.random() * 2, '#b9822f');
  fxRing(r.x + 1, r.y + 1, '#e2b92c');
  floater(r.x + 1, r.y + 1, 'VERSLAGEN', '#e2b92c');
  store.notePos = [r.x + 1, r.y + 1];
  const names = wonders.map(w => theWonder(w.type));
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}` : names[0];
  const taken = names.length
    ? ` Je krijgt ook hun wereldwonder${names.length > 1 ? 'en' : ''}: ${list}.`
    : '';
  toast(
    `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'is', 'zijn')} verslagen! Hun land is nu van jou. Buit: ${resText(loot)}.${taken}`,
    'good',
  );
  sfx('age');
  if (sel.rival === r.id) {
    sel.rival = null;
    sel.rivalUnit = null;
  }
  computeAvail();
  checkVictory(); // misschien was dit de laatste rivaal (overwinning Verovering)
  store.uiDirty = true;
}

// ---- Torens van rivalen schieten op jouw mensen ----

function rivalTowers(dt) {
  for (const r of G.rivals) {
    if (r.dead) continue;
    for (const b of r.bs) {
      const d = B[b.type];
      if (!d.def || !b.done) continue;
      b.cd -= dt;
      if (b.cd > 0) continue;
      const s = d.size / 2,
        x = b.x + s,
        y = b.y + s;
      const t = nearestOfYours(x, y, d.def.r, d.def.air);
      if (!t) {
        b.cd = 0.3;
        continue;
      }
      const dmg = b.type === 'townhall' ? d.def.dmg * (1 + r.age * 0.8) : d.def.dmg * (1 + 0.1 * r.age);
      fire(b, x, y, t, {
        dmg,
        foe: 1,
        splash: d.def.splash,
        laser: d.def.laser,
        big: b.type === 'cannon',
        col: '#ff9b6b',
        h0: d.h * 0.8,
        snd: d.snd,
      });
      b.cd = d.def.rate;
      b.aim = Math.atan2(t.y - y, t.x - x);
    }
  }
}
// Jouw dichtstbijzijnde soldaat of dorpeling binnen bereik (vliegende alleen als de toren in de lucht kan schieten)
function nearestOfYours(x, y, range, air) {
  let best = null,
    bd = range;
  for (const u of G.us) {
    if (UNITS[u.k].fly && !air) continue;
    const d = dist(x, y, u.x, u.y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  for (const v of G.vs) {
    if (v.hidden) continue;
    const d = dist(x, y, v.x, v.y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

/**
 * Het dichtstbijzijnde gebouw van een rivaal binnen r tegels (voor je soldaten in een aanvalsmars).
 * Met `rivalId` alleen gebouwen van die ene rivaal.
 */
export function nearestRivalBuilding(x, y, r, rivalId = 0) {
  let best = null,
    bd = r;
  for (const b of rbById.values()) {
    if (rivalId && b.rival !== rivalId) continue;
    const s = B[b.type].size / 2;
    const d = dist(x, y, b.x + s, b.y + s) - s;
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

/** Na een gevallen gebouw: het dichtstbijzijnde andere gebouw van dezelfde rivaal (binnen 12 tegels), of null. */
export function nextRivalBuilding(b) {
  const s = B[b.type].size / 2;
  return nearestRivalBuilding(b.x + s, b.y + s, 12, b.rival);
}

/**
 * Stuur jouw soldaten op een gebouw van een rivaal af. Hun wachtpost komt vlak voor dat gebouw,
 * zodat ze daarna in hun stad blijven staan in plaats van helemaal naar huis te lopen.
 */
export function orderRivalAttack(units, b) {
  const s = B[b.type].size;
  units.forEach((u, k) => {
    u.tgt = b;
    u.order = 'attack';
    u.path = null;
    // In rijen van vijf onder het gebouw
    u.gx = b.x + s / 2 + ((k % 5) - 2) * 0.8;
    u.gy = b.y + s + 1 + Math.floor(k / 5) * 0.8;
  });
}

// ---- Opslaan en laden ----

/** De rivalen als gewone gegevens, voor de opslag (zie game/save.js). */
export function saveRivals() {
  return (G.rivals || []).map(r => ({
    ...r,
    bank: Math.round(r.bank),
    war: Math.round(r.war),
    wonderPot: Math.round(r.wonderPot || 0),
    bs: r.bs.map(b => ({
      id: b.id,
      type: b.type,
      x: b.x,
      y: b.y,
      hp: Math.round(b.hp),
      mhp: b.mhp,
      done: b.done,
      prog: b.prog,
      bt: b.bt,
    })),
    units: rivalArmy(r).map(f => ({
      k: f.uk,
      x: f.x,
      y: f.y,
      hp: Math.round(f.hp),
      mhp: f.mhp,
      mode: f.mode,
      hx: f.hx,
      hy: f.hy,
      until: f.until,
      pace: f.pace || 0,
    })),
  }));
}

/** Rivalen terugzetten uit de opslag. Opslag van vóór de rivalen (of kapotte gegevens): geen rivalen. */
export function loadRivals(list) {
  G.rivals = [];
  rbById.clear();
  secondTimer = 0;
  const valid = Array.isArray(list) ? list.filter(o => o && RIVAL[o.k] && PERSONALITY[o.p]) : [];
  valid.forEach((o, i) => {
    const r = { ...newRival(i + 1, o, o), ...o, id: i + 1, bs: [] };
    delete r.units; // de soldaten komen hieronder terug in G.foes
    r.chunks = Array.isArray(o.chunks) ? o.chunks.filter(c => Number.isInteger(c)) : [];
    G.rivals.push(r);
    if (r.dead) return;
    for (const s of o.bs || []) {
      if (!B[s.type]) continue;
      const b = addBuilding(r, s.type, s.x, s.y, !!s.done, Number.isInteger(s.id) ? s.id : G.nid++);
      Object.assign(b, { hp: s.hp, mhp: s.mhp || b.mhp, prog: s.prog || 0, bt: s.bt || b.bt });
    }
    for (const s of o.units || []) {
      if (!UNITS[s.k]) continue;
      const f = spawnRivalUnit(r, s.k, s.x, s.y);
      Object.assign(f, {
        hp: s.hp,
        mhp: s.mhp || f.mhp,
        hx: s.hx ?? f.hx,
        hy: s.hy ?? f.hy,
        until: s.until || 0,
        pace: s.pace || 0, // oudere opslag: geen marstempo, dan lopen ze op hun eigen snelheid
      });
      f.mode = ['home', 'march', 'raid', 'return'].includes(s.mode) ? s.mode : 'home';
    }
  });
  rebuildLand();
}
