// Rivaliserende beschavingen: namen, kleuren, karakters, wat ze bouwen en hoe sterk ze zijn. Puur.
import { AGE_UP } from './ages.js';
import { B } from './buildings.js';
import { RES } from './resources.js';
import { canMake } from './succession.js';
import { UNITS } from './units.js';
import { mulberry32 } from '../util/random.js';

/** Hoeveel rivalen je hoogstens kunt kiezen, en hoeveel er standaard meedoen. */
export const MAX_RIVALS = 3;
export const DEFAULT_RIVALS = 1;

/** Een geldig aantal rivalen (0 tot 3). Wat niet klopt, wordt 0: oude opslag en uitdagingen hebben geen rivalen. */
export const cleanRivalCount = n => (Number.isInteger(n) && n >= 0 && n <= MAX_RIVALS ? n : 0);

/*
 * De rivalen. Per spel kiest de zaadcode er een paar uit (zie rivalLineup).
 * - k: vaste sleutel (wordt opgeslagen), n: naam, c: kleur (vlaggen, daken, soldaten, gebied)
 * - g: teken op hun vaandel (zie ui/glyphs.js)
 * - plural: de naam is meervoud ("De Zoutkoningen vallen aan", niet "valt aan")
 */
export const RIVALS = [
  { k: 'wolven', n: 'Het Wolvenvolk', c: '#7d4fc0', g: '☾' },
  { k: 'zout', n: 'De Zoutkoningen', c: '#169c8c', g: '◆', plural: true },
  { k: 'raven', n: 'Huis Van Ravenstein', c: '#e07b22', g: '⛨' },
  { k: 'veen', n: 'Het Veenvolk', c: '#6c8c1e', g: '♣' },
  { k: 'duin', n: 'De Duinruiters', c: '#d1449a', g: '≈', plural: true },
  { k: 'zon', n: 'De Zonnevorsten', c: '#e8d03a', g: '☉', plural: true },
];
export const RIVAL = Object.fromEntries(RIVALS.map(r => [r.k, r]));

/** Het werkwoord dat bij de naam past: verb(rivaal, 'valt', 'vallen'). */
export const verb = (rival, one, many) => (rival.plural ? many : one);

/*
 * Karakters. Elk getal is een keer-factor of een aantal dagen.
 * - econ: inkomen keer dit · war: dit deel van het inkomen gaat naar het leger
 * - army: hun aanvallen zijn zo groot (keer) · every: dagen tussen twee aanvallen · first: eerste aanval op deze dag
 * - grow: elke zoveel dagen een nieuw gebied · gifts: stuurt af en toe een geschenk
 * - extra: wat ze per tijdperk extra bouwen (home = woning, tower = toren, eco = werkplaats)
 * - wonders: dit deel van hun inkomen sparen ze daarbovenop voor wereldwonderen (0 = bouwt geen wonderen)
 */
export const PERSONALITIES = [
  {
    k: 'bouwer',
    n: 'Bouwer',
    d: 'Bouwt veel, gaat sneller door de tijdperken en bouwt wereldwonderen. Valt om de 4 dagen aan.',
    econ: 1.25,
    war: 0.25,
    army: 0.9,
    every: 4,
    first: 6,
    grow: 2,
    gifts: false,
    extra: ['home', 'eco'],
    wonders: 0.5,
  },
  {
    k: 'krijger',
    n: 'Krijger',
    d: 'Valt om de 2 dagen aan, met 40% grotere legers.',
    econ: 1.2,
    war: 0.4,
    army: 1.4,
    every: 2,
    first: 4,
    grow: 3,
    gifts: false,
    extra: ['tower'],
    wonders: 0,
  },
  {
    k: 'handelaar',
    n: 'Handelaar',
    d: 'Zwak leger en vriendelijk: valt om de 5 dagen aan en stuurt soms een geschenk.',
    econ: 1.1,
    war: 0.2,
    army: 0.7,
    every: 5,
    first: 6,
    grow: 3,
    gifts: true,
    extra: ['eco'],
    wonders: 0,
  },
];
export const PERSONALITY = Object.fromEntries(PERSONALITIES.map(p => [p.k, p]));

/*
 * Per moeilijkheid (zelfde volgorde als data/difficulty.js: Vredig, Normaal, Zwaar, Meedogenloos):
 * - income: hun inkomen keer dit · size: hun aanvallen zijn zo groot (keer) · hp: hun soldaten hebben zoveel meer leven
 */
export const RIVAL_DIFF = [
  { income: 0.7, size: 1, hp: 1 },
  { income: 1, size: 1, hp: 1 },
  { income: 1.3, size: 1.2, hp: 1.1 },
  { income: 1.5, size: 1.4, hp: 1.25 },
];
const diffOf = d => RIVAL_DIFF[d] || RIVAL_DIFF[1];

// Inkomen per seconde (in "waarde", zie costValue) bij Normaal, met 4 gebieden, per tijdperk
const INCOME = [2, 2.3, 2.7, 3.2, 3.7, 4.2, 4.7, 5.2, 6];
// Zoveel gebieden heeft een rivaal bij het begin; elk gebied daarboven geeft 5% meer inkomen
export const START_CHUNKS = 4;
/** Zoveel gebieden kan een rivaal hoogstens hebben in tijdperk `age`: er komt er één per tijdperk bij, tot 10. */
export const maxChunks = age => Math.min(10, START_CHUNKS + age);

/**
 * Wat iets "waard" is: elke grondstof telt, en die van latere tijdperken tellen zwaarder
 * (zoals op de markt). Zo kan een rivaal met één getal rekenen in plaats van met twintig grondstoffen.
 */
export function costValue(cost) {
  let v = 0;
  for (const [r, n] of Object.entries(cost || {})) v += n * (1 + (RES[r] ? RES[r].age : 0) * 0.5);
  return Math.round(v);
}

/** Wat de stap naar tijdperk `age` waard is: dezelfde kosten als voor jou (zie AGE_UP). */
export const ageUpValue = age => (AGE_UP[age] ? costValue(AGE_UP[age].cost) : Infinity);

/** Inkomen van een rivaal per seconde, in waarde. */
export function rivalIncome(age, chunks, diff, personality) {
  const base = INCOME[Math.min(age, INCOME.length - 1)];
  const land = 1 + 0.05 * Math.max(0, chunks - START_CHUNKS);
  return base * land * diffOf(diff).income * PERSONALITY[personality].econ;
}

/*
 * Wat een rivaal per tijdperk bouwt. `base` altijd; `home`, `tower` en `eco` zijn de gebouwen
 * die hij extra bouwt, afhankelijk van zijn karakter (zie `extra` hierboven).
 */
export const BUILD_ORDER = [
  {
    base: ['hut', 'storage', 'farm', 'barracks', 'watchtower', 'campfire', 'hut'],
    home: 'hut',
    tower: 'watchtower',
    eco: 'farm',
  },
  { base: ['house', 'foundry', 'house', 'bronzetower'], home: 'house', tower: 'bronzetower', eco: 'farm' },
  {
    base: ['stonehouse', 'smithy', 'hillfort', 'stonehouse'],
    home: 'stonehouse',
    tower: 'hillfort',
    eco: 'farm',
  },
  {
    base: ['market', 'castletower', 'siegeworks', 'lantern'],
    home: 'stonehouse',
    tower: 'castletower',
    eco: 'farm',
  },
  {
    base: ['windmill', 'canalhouse', 'powdermill', 'bastion'],
    home: 'canalhouse',
    tower: 'bastion',
    eco: 'windmill',
  },
  {
    base: ['rowhouse', 'blastfurnace', 'powerplant', 'workshop', 'cannon'],
    home: 'rowhouse',
    tower: 'cannon',
    eco: 'windmill',
  },
  {
    base: ['apartment', 'refinery', 'silicaworks', 'aa', 'oilplant'],
    home: 'apartment',
    tower: 'aa',
    eco: 'refinery',
  },
  {
    base: ['towerblock', 'chipfab', 'batteryfab', 'hangar', 'laser'],
    home: 'towerblock',
    tower: 'laser',
    eco: 'solar',
  },
  {
    base: ['arcology', 'starforge', 'fusionplant', 'mechbay', 'railgun'],
    home: 'arcology',
    tower: 'railgun',
    eco: 'starforge',
  },
];

/** De bouwlijst van één tijdperk voor een karakter: de vaste gebouwen plus zijn extra's. */
export function buildOrder(age, personality) {
  const order = BUILD_ORDER[age];
  if (!order) return [];
  return [...order.base, ...PERSONALITY[personality].extra.map(slot => order[slot])];
}

/**
 * Wat bouwt een rivaal hierna? `have` telt per soort wat er nu staat (zoals { hut: 2 }).
 * Hij loopt de bouwlijsten af tot en met zijn tijdperk; wat kapot is, bouwt hij opnieuw.
 * Gebouwen die in zijn tijdperk niet meer bestaan (zoals een hut in de IJzertijd), slaat hij over.
 * Geeft null als alles staat: dan spaart hij voor het volgende tijdperk.
 */
export function nextBuild(age, personality, have) {
  const want = {};
  for (let a = 0; a <= age; a++)
    for (const k of buildOrder(a, personality)) {
      want[k] = (want[k] || 0) + 1;
      if (canMake(k, age) && (have[k] || 0) < want[k]) return k;
    }
  return null;
}

/** Welke soldaten een rivaal in dit tijdperk traint: dezelfde als jij, zonder de eigen soldaten van een volk. */
export const rivalUnits = age => Object.keys(UNITS).filter(k => canMake(k, age) && !UNITS[k].people);

/** Zoveel soldaten houdt een rivaal altijd thuis. */
export const homeGuard = age => 2 + Math.floor(age / 2);

/** Zoveel soldaten stuurt een rivaal bij zijn volgende aanval: eerst een paar, later meer (hoogstens 20). */
export function attackSize(age, attacks, personality, diff) {
  const n = (1 + age * 0.7 + attacks * 0.5) * PERSONALITY[personality].army * diffOf(diff).size;
  return Math.max(2, Math.min(20, Math.round(n)));
}

/**
 * Zoveel soldaten moet een rivaal thuis hebben voordat hij aanvalt: zijn vaste wacht plus een groep
 * van minstens 60% van de volgende aanval (en minstens 2).
 */
export function armyToAttack(age, attacks, personality, diff) {
  const group = Math.max(2, Math.ceil(attackSize(age, attacks, personality, diff) * 0.6));
  return homeGuard(age) + group;
}

/** Hoeveel meer leven de soldaten van een rivaal hebben op deze moeilijkheid. */
export const rivalHp = diff => diffOf(diff).hp;

/** Hoe sterk één soldaat of toren is: leven en schade per seconde samen (een ruwe schatting). */
export const unitPower = ({ hp, dmg, rate }) => Math.sqrt(Math.max(0, hp) * (dmg / Math.max(0.1, rate)));

/** De sterkte van een heel leger (een lijst met { hp, dmg, rate }). */
export const armyPower = list => list.reduce((sum, u) => sum + unitPower(u), 0);

/** Een rivaal vergeleken met jou, in één woord: zwakker, gelijk of sterker. */
export function strengthWord(theirs, yours) {
  const ratio = (theirs + 20) / (yours + 20);
  if (ratio < 0.75) return 'zwakker';
  if (ratio > 1.35) return 'sterker';
  return 'gelijk';
}

/**
 * Buit als je een rivaal verslaat: meer naarmate hij verder was.
 * Alleen grondstoffen die in zijn tijdperk al bestaan.
 */
export function rivalLoot(age) {
  const loot = { food: 300 + age * 120, wood: 250 + age * 80, stone: 200 + age * 60 };
  if (age >= 1) loot.bronze = 40 + age * 10;
  if (age >= 2) loot.iron = 60 + age * 15;
  if (age >= 3) loot.gold = 40 + age * 15;
  if (age >= 4) loot.powder = 30 + age * 10;
  if (age >= 5) loot.steel = 20 + age * 10;
  if (age >= 6) loot.fuel = 30 + age * 5;
  if (age >= 7) loot.chips = 20 + age * 4;
  if (age >= 8) loot.starmetal = 40;
  return loot;
}

/** Een geschenk van een vriendelijke rivaal (Handelaar). */
export function giftFor(age) {
  const gift = { food: 60 + age * 30, wood: 40 + age * 20 };
  if (age >= 3) gift.gold = 10 + age * 4;
  return gift;
}

/**
 * Welke rivalen er in een wereld wonen, vast bij de zaadcode: drie verschillende namen
 * en de drie karakters in een door elkaar gehusselde volgorde. Een spel met n rivalen neemt de eerste n.
 */
export function rivalLineup(seed) {
  const R = mulberry32((seed >>> 0) + 9071);
  const names = shuffled(RIVALS, R).slice(0, MAX_RIVALS);
  const kinds = shuffled(PERSONALITIES, R);
  return names.map((r, i) => ({ k: r.k, p: kinds[i % kinds.length].k }));
}
function shuffled(list, R) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Bouwbare gebouwen voor de bouwlijsten van rivalen: geen muren, wegen, stamhuis of gebouwen op een bron
 * (zoals een oliepomp). Wereldwonderen ook niet: die bouwt alleen de Bouwer, apart (zie game/rivals.js).
 */
export const rivalCanBuild = k =>
  !!B[k] && !B[k].nobuild && !B[k].wall && !B[k].road && !B[k].needNode && !B[k].wonder;
