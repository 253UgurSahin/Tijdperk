// Uitdagingen (vaste opdrachten met een doel en medailles) en de wereld van de dag. Puur.
import type { Bonus, Cost, ScenarioState } from '../types';
import { DAYLEN } from '../config';
import { AGES } from './ages';
import { B } from './buildings';
import { DEFAULT_MAP, MAPS } from './maps';
import { MODIFIERS, cleanMods } from './modifiers';
import type { ModifierDef } from './modifiers';
import { DEFAULT_PEOPLE, PEOPLES } from './peoples';
import { MEDALS } from './score';
import type { MedalKey } from './score';
import { mulberry32 } from '../util/random';
import { SEED_MAX } from '../util/seedcode';

/*
 * Elke uitdaging:
 * - k: vaste sleutel (wordt bewaard in G.scenario en in je profiel), n: naam, g: pictogram
 * - story: twee korte zinnen voor het keuzescherm
 * - people: vast volk (zonder kies je zelf), diff: moeilijkheid (standaard Normaal), map: kaartsoort
 * - startAge: tijdperk waarin je begint; startRes: grondstoffen bij het begin (anders die van de moeilijkheid)
 * - villagers: zoveel dorpelingen extra bij het begin
 * - modifiers: spelregels uit data/modifiers.ts
 * - goal: { type, value }: 'age' (bereik tijdperk), 'survive' (nachten), 'build' (gebouw), 'pop' (inwoners),
 *   'camps' (kampen veroveren)
 * - timeLimit: zoveel speltijd (seconden) heb je; zonder grens duurt het zo lang als het doel
 * - medals: { by, goud, zilver, brons }: grenzen voor de medailles. by 'time': speltijd in seconden tot
 *   het doel gehaald is; by 'lost': dorpelingen en gebouwen die je kwijtraakte. Bij allebei is lager beter.
 */
/** Het doel van een uitdaging, zoals { type: 'age', value: 3 }. Bij 'build' is value een gebouw. */
export type ScenarioGoal =
  { type: 'age' | 'survive' | 'pop' | 'camps'; value: number } | { type: 'build'; value: string };

/** Grenzen voor de medailles: speltijd in seconden ('time') of wat je kwijtraakte ('lost'). Lager is beter. */
export interface ScenarioMedals {
  by: 'time' | 'lost';
  goud: number;
  zilver: number;
  brons: number;
}

/** Doel, tijdsgrens en medailles: wat elke uitdaging heeft (zie ook DAILY_PLANS). */
export interface ScenarioPlan {
  goal: ScenarioGoal;
  timeLimit?: number;
  medals: ScenarioMedals;
}

/** Een uitdaging zoals hij in de lijst staat (zie de uitleg hierboven); withDefaults vult de rest aan. */
export interface RawScenario extends ScenarioPlan {
  k: string;
  n: string;
  g: string;
  story: string;
  modifiers?: string[];
  people?: string;
  diff?: number;
  map?: string;
  startAge?: number;
  startRes?: Cost;
  villagers?: number;
  /** Alleen bij de wereld van de dag: een eigen wereld en de datum. */
  seed?: number;
  date?: string;
}

/** Een uitdaging met alle standaardwaarden ingevuld (zie withDefaults). */
export interface ScenarioDef extends RawScenario {
  seed: number;
  diff: number;
  map: string;
  startAge: number;
  villagers: number;
  modifiers: string[];
}

/**
 * Wat er over een uitdaging bewaard is, zoals G.scenario: { k, date, ... }. Oude of kapotte opslag kan
 * rare waarden hebben; daarom kijkt cleanScenarioState alles na.
 */
export interface ScenarioRef {
  k: string;
  date?: unknown;
  doneAt?: unknown;
  failed?: unknown;
  warned?: unknown;
}

/** Wat goalProgress wil weten uit het spel (zie goalFacts in game/scenario.ts). */
export interface GoalFacts {
  age: number;
  startAge?: number;
  day: number;
  pop: number;
  camps: number;
  /** Gebouwen die klaar zijn, en alle gebouwen (ook die nog in aanbouw zijn). */
  built?: string[];
  placed?: string[];
}

/** Hoe ver je met een doel bent: frac van 0 tot 1, een korte tekst, en soms een heel korte ("5/10"). */
export interface GoalProgress {
  frac: number;
  text: string;
  short?: string;
}

const MIN = 60;
const RAW_SCENARIOS: RawScenario[] = [
  {
    k: 'bronze',
    n: 'Snelle bronstijd',
    g: '⌛',
    story:
      'Je buren smeden al brons, en jouw stam heeft nog stenen bijlen. Haal ze in, al gaan de dagen hier sneller voorbij.',
    modifiers: ['fastDays'],
    goal: { type: 'age', value: 1 },
    timeLimit: 25 * MIN,
    medals: { by: 'time', goud: 13 * MIN, zilver: 18 * MIN, brons: 25 * MIN },
  },
  {
    k: 'winter',
    n: 'Lange winter',
    g: '❄',
    story:
      'Dit jaar is de winter lang en streng. Laat je stam groeien zolang het nog kan, en leg voorraad aan voor de kou.',
    modifiers: ['longWinter'],
    goal: { type: 'pop', value: 18 },
    timeLimit: 40 * MIN,
    medals: { by: 'time', goud: 25 * MIN, zilver: 32 * MIN, brons: 40 * MIN },
  },
  {
    k: 'siege',
    n: 'Belegering',
    g: '☾',
    story:
      'Vijanden hebben je vallei omsingeld. Om de nacht komen ze terug, met anderhalf keer zoveel krijgers.',
    modifiers: ['bigRaids'],
    goal: { type: 'survive', value: 10 },
    medals: { by: 'lost', goud: 0, zilver: 3, brons: 8 },
  },
  {
    k: 'towers',
    n: 'Alleen torens',
    g: '⛨',
    story:
      'Je volk wil niet vechten, maar wel overleven. Alleen torens, muren en je stamhuis houden de vijand buiten.',
    modifiers: ['noArmy'],
    goal: { type: 'survive', value: 12 },
    medals: { by: 'lost', goud: 0, zilver: 3, brons: 8 },
  },
  {
    k: 'meteors',
    n: 'Meteorietenregen',
    g: '☄',
    story:
      'Er vallen sterren uit de hemel, vaker dan ooit. Ze brengen kostbaar erts, maar wie te dicht bij een inslag bouwt, moet veel herstellen.',
    startAge: 1,
    startRes: { food: 400, wood: 400, stone: 250, copper: 60, tin: 60 },
    modifiers: ['meteorShower'],
    goal: { type: 'age', value: 3 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 28 * MIN, zilver: 36 * MIN, brons: 45 * MIN },
  },
  {
    k: 'islands',
    n: 'Eilandvolk',
    g: '≈',
    story:
      'Je stam landt op een eiland midden in een grote zee. Er komen geen handelaars, dus de buit moet van de kampen op de andere eilanden komen.',
    people: 'norse',
    map: 'islands',
    modifiers: ['noTrade'],
    goal: { type: 'camps', value: 2 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 25 * MIN, zilver: 35 * MIN, brons: 45 * MIN },
  },
  {
    k: 'bare',
    n: 'Kale grond',
    g: '▤',
    story:
      'De grond is uitgeput en de bossen zijn dun. Ga zuinig om met wat er groeit en zoek op tijd nieuw land.',
    modifiers: ['poorSoil'],
    goal: { type: 'age', value: 2 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 28 * MIN, zilver: 36 * MIN, brons: 45 * MIN },
  },
  {
    k: 'rich',
    n: 'Rijke start, sterke vijand',
    g: '⛁',
    story:
      'Je stam begint met volle schuren, maar de buren zijn jaloers. Elke nacht komen ze, groter en taaier dan je gewend bent.',
    diff: 2,
    modifiers: ['richStart', 'strongFoes'],
    goal: { type: 'age', value: 3 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 28 * MIN, zilver: 36 * MIN, brons: 45 * MIN },
  },
  {
    k: 'gold',
    n: 'Goudkoorts',
    g: '⛏',
    story:
      'In de heuvels is goud gevonden en iedereen wil zijn deel. Bouw een markt, word rijk en breng je stad naar de Gouden Eeuw.',
    people: 'hanze',
    startAge: 3,
    startRes: { food: 700, wood: 700, stone: 500, iron: 200, gold: 60 },
    villagers: 5,
    modifiers: ['goldRush'],
    goal: { type: 'age', value: 4 },
    timeLimit: 40 * MIN,
    medals: { by: 'time', goud: 22 * MIN, zilver: 30 * MIN, brons: 40 * MIN },
  },
  {
    k: 'stars',
    n: 'Sprint naar de sterren',
    g: '✹',
    story:
      'Je stad begint in het Dronetijdperk, met een flinke voorraad en veel handen. Bereik het Sterrentijdperk voordat de tijd op is.',
    startAge: 7,
    startRes: {
      food: 4000,
      wood: 1500,
      stone: 2000,
      iron: 800,
      gold: 600,
      coal: 600,
      steel: 1200,
      oil: 300,
      fuel: 200,
      sand: 200,
      silicon: 200,
      lithium: 100,
      chips: 200,
      battery: 200,
    },
    villagers: 20,
    modifiers: ['quickMinds'],
    goal: { type: 'age', value: 8 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 28 * MIN, zilver: 36 * MIN, brons: 45 * MIN },
  },
];

/** Een getal uit een stukje tekst, voor een vaste wereld per uitdaging of per dag (altijd een code van 4 tekens). */
export function textSeed(text: string): number {
  // FNV-1a: een eenvoudige, vaste "hash". Dezelfde tekst geeft altijd hetzelfde getal.
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0)!; // ch is altijd één teken, dus er is een code
    h = Math.imul(h, 16777619);
  }
  return 1 + ((h >>> 0) % (SEED_MAX - 1));
}

// Wat een uitdaging niet zelf noemt, krijgt de standaard: een vaste wereld, Normaal, een continent, de Steentijd
const withDefaults = (s: RawScenario): ScenarioDef => ({
  seed: textSeed('uitdaging:' + s.k),
  diff: 1,
  map: DEFAULT_MAP,
  startAge: 0,
  villagers: 0,
  modifiers: [],
  ...s,
});

/** Alle uitdagingen, in de volgorde van het keuzescherm. */
export const SCENARIOS = RAW_SCENARIOS.map(withDefaults);

/** Uitdaging opzoeken op sleutel: SCENARIO.siege */
export const SCENARIO: Record<string, ScenarioDef> = Object.fromEntries(SCENARIOS.map(s => [s.k, s]));

// ---- doelen ----

/** Pictogram per soort doel (zie ui/glyphs.ts). */
export const GOAL_ICON: Record<string, string> = {
  age: '▲',
  survive: '☾',
  build: '⚒',
  pop: '☺',
  camps: '⚔',
};

/** "de Bronstijd", maar "het Dronetijdperk". */
export const ageName = (age: number): string =>
  `${AGES[age].n.endsWith('tijdperk') ? 'het' : 'de'} ${AGES[age].n}`;

/** Het doel in een paar woorden, zoals "Houd 10 nachten stand". */
export function goalText(goal: ScenarioGoal): string {
  // Na de vraag naar `type` weet TypeScript of `v` een getal is of (bij 'build') de sleutel van een gebouw
  const { type, value: v } = goal;
  if (type === 'age') return `Bereik ${ageName(v)}`;
  if (type === 'survive') return `Houd ${v} nachten stand`;
  if (type === 'pop') return `Groei naar ${v} inwoners`;
  if (type === 'camps') return `Verover ${v} vijandelijke ${v === 1 ? 'kamp' : 'kampen'}`;
  if (type === 'build') return `Bouw een ${B[v].n.toLowerCase()}`;
  return '';
}

/** Het doel midden in een zin: alleen de eerste letter klein ("bereik de Gouden Eeuw"). */
export function goalInSentence(goal: ScenarioGoal): string {
  const text = goalText(goal);
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Houd een getal tussen 0 en 1 (voor de voortgangsbalk)
const between0and1 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Hoe ver je met het doel bent: frac van 0 tot 1 (1 = gehaald) en een korte tekst ("5 van 10 nachten").
 * Soms ook `short` ("5/10"), voor waar weinig plek is.
 * `f` zijn de feiten uit het spel: { age, startAge, day, pop, camps, built: [klare gebouwen], placed: [alle gebouwen] }.
 */
export function goalProgress(goal: ScenarioGoal, f: GoalFacts): GoalProgress {
  // Na de vraag naar `type` weet TypeScript of `v` een getal is of (bij 'build') de sleutel van een gebouw
  const { type, value: v } = goal;
  if (type === 'age') {
    const from = f.startAge || 0;
    const left = v - f.age;
    const text = left <= 0 ? 'klaar' : `nog ${left} ${left === 1 ? 'tijdperk' : 'tijdperken'}`;
    return { frac: between0and1((f.age - from) / Math.max(1, v - from)), text };
  }
  if (type === 'survive') {
    // Elke nieuwe dag begint na een doorstane nacht: op dag 11 heb je er 10 achter de rug
    const nights = Math.min(Math.max(0, f.day - 1), v);
    return { frac: between0and1(nights / v), text: `${nights} van ${v} nachten`, short: `${nights}/${v}` };
  }
  if (type === 'pop') {
    const pop = Math.min(f.pop, v);
    return { frac: between0and1(f.pop / v), text: `${pop} van ${v} inwoners`, short: `${pop}/${v}` };
  }
  if (type === 'camps') {
    const camps = Math.min(f.camps, v);
    return { frac: between0and1(f.camps / v), text: `${camps} van ${v} kampen`, short: `${camps}/${v}` };
  }
  if (type === 'build') {
    const done = (f.built || []).includes(v);
    const busy = (f.placed || []).includes(v);
    return {
      frac: done ? 1 : busy ? 0.5 : 0,
      text: done ? 'klaar' : busy ? 'in aanbouw' : 'nog niet gebouwd',
    };
  }
  return { frac: 0, text: '' };
}

/** Ongeveer hoeveel minuten speltijd een uitdaging duurt (de tijdsgrens, of de nachten die je moet overleven). */
export function challengeMinutes(s: ScenarioDef): number | null {
  if (s.timeLimit) return Math.round(s.timeLimit / MIN);
  if (s.goal.type === 'survive') {
    const pace = s.modifiers.includes('fastDays') ? 1.5 : 1;
    return Math.round((s.goal.value * DAYLEN) / MIN / pace);
  }
  return null;
}

/** Speltijd als klok: 754 seconden wordt "12:34". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / MIN)}:${String(s % MIN).padStart(2, '0')}`;
}

// ---- medailles ----

/** Medailles van goud naar brons (dezelfde als bij de score, zie data/score.ts). */
export const MEDAL_ORDER = MEDALS.map(m => m.k);

/**
 * De medaille voor een gespeelde uitdaging: 'goud', 'zilver', 'brons', of '' (geen).
 * Alleen als het doel gehaald is. `time`: speltijd tot het doel, `lost`: wat je kwijtraakte.
 */
export function challengeMedal(
  medals: ScenarioMedals,
  { won = false, time = 0, lost = 0 }: { won?: boolean; time?: number; lost?: number } = {},
): string {
  if (!won || !medals) return '';
  const value = medals.by === 'lost' ? lost : time;
  return MEDAL_ORDER.find(k => value <= medals[k]) || '';
}

/** Hoe goed een medaille is: 0 = goud, 1 = zilver, 2 = brons, 3 = geen. */
// `k` mag elke tekst zijn ('' = geen medaille); daarom zoeken we in de lijst als in een lijst teksten.
export const medalRank = (k: string): number =>
  (MEDAL_ORDER as string[]).includes(k) ? (MEDAL_ORDER as string[]).indexOf(k) : MEDAL_ORDER.length;

/** De beste van twee medailles. */
export const betterMedal = (a: string, b: string): string =>
  medalRank(a) <= medalRank(b) ? a || '' : b || '';

/** Wat je voor een medaille moet doen, zoals "binnen 13 min" of "niets verloren". */
export function medalRuleText(medals: ScenarioMedals, k: MedalKey): string {
  const v = medals[k];
  if (medals.by === 'lost') return v === 0 ? 'niets verloren' : `hoogstens ${v} verloren`;
  return `binnen ${Math.round(v / MIN)} min`;
}

// ---- wereld van de dag ----

/** De sleutel waarmee de wereld van de dag in G.scenario en in het profiel staat. */
export const DAILY = 'daily';

/** Volken die iedereen heeft: de wereld van de dag kiest daaruit, zodat hij voor iedereen hetzelfde is. */
const FREE_PEOPLES = PEOPLES.filter(p => !p.locked);

/** Mogelijke doelen voor de wereld van de dag, elk tussen de 20 en 45 minuten. */
export const DAILY_PLANS: ScenarioPlan[] = [
  {
    goal: { type: 'age', value: 2 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 28 * MIN, zilver: 36 * MIN, brons: 45 * MIN },
  },
  {
    goal: { type: 'pop', value: 20 },
    timeLimit: 40 * MIN,
    medals: { by: 'time', goud: 24 * MIN, zilver: 32 * MIN, brons: 40 * MIN },
  },
  {
    goal: { type: 'camps', value: 2 },
    timeLimit: 45 * MIN,
    medals: { by: 'time', goud: 25 * MIN, zilver: 35 * MIN, brons: 45 * MIN },
  },
  {
    goal: { type: 'survive', value: 9 },
    medals: { by: 'lost', goud: 0, zilver: 3, brons: 8 },
  },
];

/** De datum als tekst, zoals "2026-10-15", in de tijd van je eigen computer (niet die van Londen). */
export function dateKey(date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Is dit een datum zoals dateKey die maakt? */
export const isDateKey = (text: unknown): text is string =>
  typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text);

/** Een datum kort in het Nederlands: "2026-10-15" wordt "15 oktober". */
export function dateText(key: string): string {
  const MONTHS = 'januari februari maart april mei juni juli augustus september oktober november december';
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS.split(' ')[m - 1]}`;
}

// Kies iets uit een lijst met een vaste reeks toevalsgetallen
const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)];

/**
 * De wereld van de dag: elke datum geeft dezelfde wereld, hetzelfde volk, hetzelfde doel en twee spelregels
 * (één die het moeilijker maakt en één die helpt). Zo speelt iedereen op dezelfde dag dezelfde wereld.
 */
export function dailyWorld(date: string): ScenarioDef {
  const seed = textSeed('dag:' + date);
  const random = mulberry32(seed);
  const plan = pick(DAILY_PLANS, random);
  const fits = (m: ModifierDef) => !(m.not || []).includes(plan.goal.type);
  const hard = pick(
    MODIFIERS.filter(m => m.hard && fits(m)),
    random,
  );
  // De hulp en het volk mogen de moeilijke regel niet gewoon opheffen (zoals Kale grond met Vruchtbaar land
  // op de akkers, of Gesloten grenzen met de Hanze en hun markt)
  const sameKeys = (m: { bonus?: Bonus }) =>
    Object.keys(m.bonus || {}).some(key => key in (hard.bonus || {}));
  const help = pick(
    MODIFIERS.filter(m => !m.hard && fits(m) && !sameKeys(m)),
    random,
  );
  const people = pick(
    FREE_PEOPLES.filter(p => !sameKeys(p)),
    random,
  );
  return withDefaults({
    k: DAILY,
    date,
    n: 'Wereld van de dag',
    g: '☉',
    story: `De wereld van ${dateText(date)}: vandaag voor iedereen hetzelfde. Haal het doel en zet een zo hoog mogelijke score neer.`,
    seed,
    people: people ? people.k : DEFAULT_PEOPLE,
    map: pick(MAPS, random).k,
    modifiers: [hard.k, help.k],
    ...plan,
  });
}

/**
 * De uitdaging bij wat er in G.scenario staat: { k, date } (of alleen de sleutel). De wereld van de dag
 * wordt opnieuw gemaakt uit de datum. Geeft null als de uitdaging niet (meer) bestaat.
 */
export function scenarioDef(ref: ScenarioRef | string | null | undefined): ScenarioDef | null {
  const k = typeof ref === 'string' ? ref : ref && ref.k;
  // Een losse sleutel (tekst) heeft geen datum: dan is `saved.date` undefined en komt er null uit
  const saved = ref as ScenarioRef | null | undefined;
  if (k === DAILY) return saved && isDateKey(saved.date) ? dailyWorld(saved.date) : null;
  // Zonder sleutel (null) geeft SCENARIO[k] gewoon undefined, en dus null
  return SCENARIO[k as string] || null;
}

/**
 * Een nette G.scenario uit opslag: wat er bewaard is over deze uitdaging, of null bij een gewoon spel.
 * - k, date: welke uitdaging (date alleen bij de wereld van de dag)
 * - doneAt: speltijd waarop het doel gehaald werd (of null)
 * - failed: 'time' als de tijd op was
 * - warned: hoeveel seconden voor het einde de laatste waarschuwing kwam (0 = nog geen)
 */
export function cleanScenarioState(raw: ScenarioRef | null | undefined): ScenarioState | null {
  if (!raw || typeof raw !== 'object' || !scenarioDef(raw)) return null;
  // scenarioDef keek de datum van de wereld van de dag al na, en Number.isFinite zegt dat het een getal is
  return {
    k: raw.k,
    date: raw.k === DAILY ? (raw.date as string) : '',
    doneAt: Number.isFinite(raw.doneAt) ? (raw.doneAt as number) : null,
    failed: raw.failed === 'time' ? 'time' : '',
    warned: Number.isFinite(raw.warned) ? (raw.warned as number) : 0,
  };
}

/**
 * Waarmee newGame een uitdaging begint (zie game/state.ts). `people` is je eigen keuze; die geldt alleen
 * als de uitdaging geen vast volk heeft.
 */
export function startOptions(s: ScenarioDef, people = DEFAULT_PEOPLE) {
  return {
    seed: s.seed,
    people: s.people || people,
    diff: s.diff,
    map: s.map,
    mods: cleanMods(s.modifiers),
    scenario: { k: s.k, date: s.date || '' },
  };
}
