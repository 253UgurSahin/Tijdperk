// Gebeurtenissen in het spel: wanneer ze komen, wat een keuze doet, vervolgen en tijdelijke bonussen.
// Ook de reizende handelaar. Welke gebeurtenissen er zijn, staat in data/events.js.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { DAYLEN, H, W } from '../config.js';
import { B } from '../data/buildings.js';
import { difficulty } from '../data/difficulty.js';
import {
  CHOICE_TIME,
  EVENT,
  EVENTS,
  allowedChoices,
  amountsFor,
  choiceMood,
  choiceProblem,
  defaultChoice,
  eventAllowed,
  eventWeight,
  fillText,
  inAge,
  oreFor,
} from '../data/events.js';
import { NI } from '../data/nodes.js';
import { GATHER, RES } from '../data/resources.js';
import { canMake } from '../data/succession.js';
import { UNITS } from '../data/units.js';
import { applyBonusChange, mul } from './bonus.js';
import { built } from './chapters.js';
import { pay } from './economy.js';
import { spawnUnit, spawnVillager } from './entities.js';
import { burst } from './fx.js';
import { spawnRaid } from './military.js';
import { dayPace, hasRule } from './mods.js';
import { G, placeName, sel } from './state.js';
import { isNight, raidNight, season } from './time.js';
import { bMaxHp } from './upgrades.js';
import { sigs } from '../ui/header.js';
import { note, pulseRes, toast } from '../ui/hud.js';
import { dist } from '../util/math.js';
import { inb, isUnl, node, nodeLists, walkable } from '../world/world.js';

export const th = () => G.bs.find(b => b.type === 'townhall');
/** De beste soldaat die je kazerne nu kan trainen (voor huurlingen en zegeningen). */
export function bestMerc() {
  return Object.keys(UNITS)
    .filter(k => UNITS[k].src === 'barracks' && canMake(k, G.age, G.people))
    .pop();
}

// Hoe vaak gebeurtenissen komen: na een gebeurtenis minstens zoveel seconden rust,
// daarna gemiddeld elke RANDOM_WAIT seconden (alleen overdag). Samen ongeveer om de twee dagen.
const QUIET_TIME = 170;
const RANDOM_WAIT = 220;
// Een vervolg komt op zijn dag, maar niet vlak na een andere gebeurtenis
const FOLLOW_GAP = 45;
// Dezelfde gebeurtenis komt niet terug binnen de laatste zoveel gebeurtenissen
const NO_REPEAT = 6;
// Om dit uur beginnen de aanvallen 's nachts (zie game/time.js)
const RAID_HOUR = 21;

/** De regels van dit spel die bepalen welke keuzes zin hebben (zie choiceAllowed in data/events.js). */
export const eventRules = () => ({
  peaceful: G.peaceful,
  noArmy: hasRule('noArmy'),
  noTrade: hasRule('noTrade'),
});

/** Wat je nu hebt, om te zien of je een keuze kunt betalen. */
export const haveNow = () => ({ res: G.res, units: G.us.length });

/** Hoe lang een dag duurt in seconden speltijd (met de spelregel Snelle dagen korter). */
export const dayLength = () => DAYLEN / dayPace();

// Wat er in je wereld moet zijn voor een gebeurtenis (de lijst met uitleg staat in data/events.js)
const NEED_CHECKS = {
  barracks: () => built('barracks'),
  forest: () => forestTile() != null,
  crowd: () => G.vs.length >= 8,
  town: () => G.bs.length > 6,
  farm: () => built('farm'),
  maker: () => G.bs.some(b => b.done && B[b.type].conv),
  stormy: () => season().n !== 'Zomer',
  dry: () => season().n === 'Lente' || season().n === 'Zomer',
};

/** Kan deze gebeurtenis nu komen? Kijkt naar de spelregels en naar je wereld. */
function canHappen(def) {
  const rules = eventRules();
  if (!eventAllowed(def, rules)) return false;
  if (!(def.need || []).every(k => NEED_CHECKS[k] && NEED_CHECKS[k]())) return false;
  const threatens = allowedChoices(def, rules).some(i => def.choices[i].raid);
  if (!threatens) return true;
  // Dreigen met een aanval vannacht heeft alleen zin als er vannacht nog geen komt,
  // en als je moet kiezen voordat de aanval zou beginnen
  return !raidNight() && choiceEndsBeforeRaid();
}

/** Valt het einde van de keuzetijd nog vandaag vóór 21 uur, als de aanvallen beginnen? */
function choiceEndsBeforeRaid() {
  const choiceHours = (CHOICE_TIME * 24) / dayLength();
  return G.clock >= 6 && G.clock + choiceHours < RAID_HOUR;
}

// Kies er één, waarbij een gewicht van 2 twee keer zoveel kans geeft als 1
function weightedPick(list, weightOf) {
  const total = list.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return null;
}

/** Elke speltik: bonussen die aflopen, een gebeurtenis die verloopt, en of er een nieuwe komt. */
export function updateEvents(dt) {
  expireBuffs();
  if (G.event) {
    const def = EVENT[G.event.k];
    if (G.t > G.event.until) resolveEvent(def ? defaultChoice(def) : 0, true);
    return;
  }
  if (G.day < 2 || isNight()) return;
  // Eerst een vervolg dat vandaag aan de beurt is
  const due = G.followups.find(f => f.day <= G.day);
  if (due) {
    if (G.t - G.lastEvent < FOLLOW_GAP) return;
    G.followups = G.followups.filter(f => f !== due);
    const def = EVENT[due.k];
    // Kan het vervolg niet meer (bijv. omdat de vredige modus nu aan staat)? Dan vervalt het.
    if (def && eventAllowed(def, eventRules())) startEvent(def, due.from);
    return;
  }
  if (G.t - G.lastEvent > QUIET_TIME && Math.random() < dt / RANDOM_WAIT) spawnEvent();
}

/** Kies een willekeurige gebeurtenis die nu kan, en laat hem zien. */
export function spawnEvent() {
  const recent = G.eventsSeen.slice(-NO_REPEAT);
  const traderMul = mul('trader.rate');
  const pool = EVENTS.filter(
    def =>
      inAge(def, G.age) &&
      !recent.includes(def.k) &&
      !(def.once && G.eventsSeen.includes(def.k)) &&
      canHappen(def),
  );
  const def = weightedPick(pool, d => eventWeight(d, traderMul));
  if (def) startEvent(def);
}

/** Laat gebeurtenis def nu zien. `from` = de gebeurtenis waar dit een vervolg op is. */
export function startEvent(def, from = '') {
  const ev = { k: def.k, until: G.t + CHOICE_TIME, text: fillText(def.x, textWords()), from };
  // Een bosbrand heeft een plek nodig
  if (def.choices.some(choice => choice.burn)) {
    const i = forestTile();
    if (i == null) return false;
    ev.fx = i % W;
    ev.fy = (i / W) | 0;
  }
  G.event = ev;
  G.lastEvent = G.t;
  G.eventsSeen.push(def.k);
  if (G.eventsSeen.length > 60) G.eventsSeen.shift();
  sfx('alarm');
  sigs.ev = null;
  note(`${def.n}: ${ev.text}`, 'age');
  return true;
}

// De woorden die in het verhaal worden ingevuld
function textWords() {
  const soldier = bestMerc();
  return {
    plaats: placeName(),
    erts: RES[oreFor(G.age)].n.toLowerCase(),
    soldaat: soldier ? UNITS[soldier].n.toLowerCase() : 'soldaat',
  };
}

/**
 * Kies keuze i van de gebeurtenis die openstaat. `timeout`: de tijd is om en de keuze
 * die vanzelf gebeurt wordt uitgevoerd.
 */
export function resolveEvent(i, timeout = false) {
  const ev = G.event;
  if (!ev) return;
  const def = EVENT[ev.k];
  if (!def) return closeEvent();
  const options = allowedChoices(def, eventRules());
  // Is de keuze die vanzelf gebeurt intussen niet meer mogelijk (vredige modus aangezet)? Neem dan de
  // laatste keuze die wel kan; kan er niets, dan sluit het kaartje gewoon.
  if (timeout && !options.includes(i))
    i = options.filter(o => !choiceProblem(def.choices[o], G.age, haveNow())).pop() ?? -1;
  const choice = def.choices[i];
  const possible = choice && options.includes(i) && !choiceProblem(choice, G.age, haveNow());
  if (!possible) {
    // Een knop die niet kan: niets doen. De tijd is om en niets kan: het kaartje gaat dicht.
    if (timeout) closeEvent();
    return;
  }
  runChoice(def, choice, ev);
  if (timeout) note(`Geen keuze gemaakt: ${choice.l.toLowerCase()}.`);
  const mood = choiceMood(choice);
  // In de melding ook wat je kreeg, zoals "(+200 goud)"
  const gains = Object.entries(amountsFor(choice.gain, G.age) || {}).map(
    ([r, n]) => `+${n} ${RES[r].n.toLowerCase()}`,
  );
  toast(`${def.n} · ${choice.d}${gains.length ? ` (${gains.join(', ')})` : ''}`, mood);
  if (mood !== 'bad') sfx('upgrade');
  closeEvent();
}

function closeEvent() {
  G.event = null;
  sigs.ev = null;
  store.uiDirty = true;
}

// Voer een keuze uit: betalen, krijgen, mensen erbij of eraf, bonussen, vervolgen, ...
function runChoice(def, choice, ev) {
  const age = G.age;
  const cost = amountsFor(choice.cost, age);
  if (cost) pay(cost);
  for (const [r, n] of Object.entries(amountsFor(choice.gain, age) || {})) {
    G.res[r] += n;
    pulseRes(r);
  }
  for (const [r, n] of Object.entries(amountsFor(choice.lose, age) || {}))
    G.res[r] = Math.max(0, G.res[r] - n);
  if (choice.villagers > 0) addVillagers(choice.villagers);
  if (choice.villagers < 0) removeVillagers(-choice.villagers);
  if (choice.units) addSoldiers(choice.units);
  if (choice.sendUnits) sendSoldiersAway(choice.sendUnits);
  if (choice.buff) addBuff(def, choice);
  // Aanvallen en vijanden nooit in de vredige modus (die kan aangezet zijn terwijl het kaartje openstond)
  if (choice.raid && !G.peaceful) raidTonight();
  if (choice.foes && !G.peaceful) spawnBand(choice.foes.n, choice.foes.type ?? G.age);
  if (choice.damage) damageBuildings(choice.damage);
  if (choice.burn && ev.fx != null) burnForest(ev.fx, ev.fy);
  if (choice.meteor) G.nextMeteor = Math.min(G.nextMeteor ?? Infinity, G.t + 3);
  if (choice.follow) scheduleFollowUp(def, choice.follow);
}

// "Vannacht een aanval": om 21 uur. Is dat uur al voorbij en kwam er nog geen aanval, dan komt hij meteen.
function raidTonight() {
  if (G.clock >= 6 && G.clock < RAID_HOUR) G.forceRaid = G.day;
  else if (!raidNight()) spawnRaid();
}

function addVillagers(n) {
  const home = th();
  if (!home) return;
  for (let k = 0; k < n; k++)
    spawnVillager(home.x + 0.5 + (k % 4) * 0.6, home.y + 2.4 + Math.floor(k / 4) * 0.6);
}

// Dorpelingen die sterven of vertrekken; er blijven er altijd minstens 3 over
function removeVillagers(n) {
  for (let k = 0; k < n && G.vs.length > 3; k++) {
    const v = G.vs[(Math.random() * G.vs.length) | 0];
    G.vs = G.vs.filter(x => x !== v);
    sel.vs.delete(v.id);
    G.stats.lost++; // telt mee voor de medailles van uitdagingen, net als in een gevecht
  }
}

function addSoldiers(n) {
  const home = th(),
    kind = bestMerc();
  if (!home || !kind) return;
  for (let i = 0; i < n; i++) {
    const soldier = spawnUnit(kind, home.x + 1 + i * 0.6, home.y + 3);
    soldier.stance = G.stance;
  }
}

// Soldaten die op reis gaan: de laatst getrainde vertrekken
function sendSoldiersAway(n) {
  const leaving = G.us.slice(-n);
  for (const u of leaving) {
    burst(u.x, u.y, '#d8c8a8');
    sel.us.delete(u.id);
  }
  G.us = G.us.filter(u => !leaving.includes(u));
}

/** Een tijdelijke bonus erbij. Komt dezelfde gebeurtenis nog eens, dan vervangt de nieuwe de oude. */
function addBuff(def, choice) {
  const buff = {
    k: def.k,
    n: def.n,
    g: def.g,
    l: choice.l,
    d: choice.d,
    bonus: { ...choice.buff.bonus },
    until: G.t + choice.buff.days * dayLength(),
  };
  // Via het bonusregister: geeft de bonus meer levens, dan groeit wat er staat mee
  applyBonusChange(() => {
    G.buffs = G.buffs.filter(b => b.k !== def.k);
    G.buffs.push(buff);
  });
  sigs.buffs = null;
}

// Tijdelijke bonussen die voorbij zijn, gaan eraf
function expireBuffs() {
  const over = G.buffs.filter(b => b.until <= G.t);
  if (!over.length) return;
  applyBonusChange(() => (G.buffs = G.buffs.filter(b => b.until > G.t)));
  for (const b of over) note(`${b.n}: het effect is voorbij.`);
  sigs.buffs = null;
}

// Een vervolg plannen: over zoveel dagen komt het (of één van een paar, bij toeval)
function scheduleFollowUp(def, follow) {
  const keys = Array.isArray(follow.k) ? follow.k : [follow.k];
  const k = keys[(Math.random() * keys.length) | 0];
  G.followups.push({ k, day: G.day + follow.days, from: def.k });
}

// Een groepje vijanden dat nu meteen aanvalt, vanaf de rand van je gebied
function spawnBand(n, type) {
  const edge = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!walkable(x, y)) continue;
      if (!isUnl(x - 1, y) || !isUnl(x + 1, y) || !isUnl(x, y - 1) || !isUnl(x, y + 1)) edge.push([x, y]);
    }
  if (!edge.length) return;
  const anchor = edge[(Math.random() * edge.length) | 0],
    near = edge.filter(e => dist(e[0], e[1], anchor[0], anchor[1]) < 7),
    scale = difficulty(G.diff).raidHp;
  for (let k = 0; k < n; k++) {
    const e = near[(Math.random() * near.length) | 0];
    G.spawnQ.push({ type, x: e[0] + 0.5, y: e[1] + 0.5, scale, at: G.t + k * 0.7 });
  }
  store.notePos = [anchor[0], anchor[1]];
  store.raidPing = { x: anchor[0], y: anchor[1], t: 8 };
  sfx('alarm');
}

function damageBuildings(n) {
  const list = G.bs.filter(b => b.done && b.type !== 'townhall');
  for (let k = 0; k < n && list.length; k++) {
    const b = list.splice((Math.random() * list.length) | 0, 1)[0];
    b.hp = Math.max(1, b.hp - bMaxHp(b) * 0.35);
    b.flash = 0.4;
  }
  G.rain = 1;
}

// Een willekeurige boom in je eigen gebied (voor een bosbrand), of null als je geen bos hebt
function forestTile() {
  const mine = nodeLists[NI.tree].filter(i => node[i] === NI.tree && isUnl(i % W, (i / W) | 0));
  return mine.length ? mine[(Math.random() * mine.length) | 0] : null;
}
function burnForest(x, y) {
  let n = 0;
  for (let yy = y - 4; yy <= y + 4; yy++)
    for (let xx = x - 4; xx <= x + 4; xx++) {
      if (!inb(xx, yy) || dist(xx, yy, x, y) > 4) continue;
      const i = yy * W + xx;
      if (node[i] === NI.tree) {
        node[i] = 0;
        G.regrow.push({ i, t: NI.tree, at: G.t + 300 });
        n++;
        if (n % 2) burst(xx + 0.5, yy + 0.5, '#3a2a20');
      }
    }
  store.notePos = [x, y];
  note(`Het vuur verwoestte ${n} bomen.`, 'bad');
}

export function makeOffer() {
  const gath = GATHER.filter(r => RES[r].age <= G.age),
    want = gath[(Math.random() * gath.length) | 0];
  let give = gath[(Math.random() * gath.length) | 0];
  if (give === want) give = gath[(gath.indexOf(want) + 1) % gath.length];
  const amt = 100 + G.age * 60,
    price = Math.round((amt * (1.1 + Math.random() * 0.7) * (RES[want].age + 1)) / (RES[give].age + 1));
  G.offer = { want, amt, give, price, until: G.t + 70 };
  store.notePos = null;
  toast(
    `Een reizende handelaar biedt ${amt} ${RES[want].n.toLowerCase()} voor ${price} ${RES[give].n.toLowerCase()}.`,
  );
  sfx('select');
  sigs.offer = null;
}
