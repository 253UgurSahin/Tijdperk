// Spelregels voor uitdagingen en de wereld van de dag: wat er anders is dan in een gewoon spel. Puur.
import type { Bonus } from '../types';

/*
 * Elke spelregel:
 * - k: vaste sleutel (wordt opgeslagen in G.mods), n: naam, g: pictogram (zie ui/glyphs.ts)
 * - d: wat er anders is, in gewone taal en met dezelfde getallen als in `bonus`
 * - hard: true als het spel er moeilijker van wordt, anders wordt het makkelijker
 * - bonus: sleutels uit src/data/bonus.ts; die gelden het hele spel (het bonusregister telt ze mee)
 * - rule: een vlag die de spelcode zelf afhandelt; zoek op hasRule('...') om te zien waar
 * - not: soorten doelen waar deze regel niet bij past (zie data/scenarios.ts), bijv. geen leger
 *   en toch kampen moeten veroveren
 */
/** Een spelregel van een uitdaging (zie de uitleg hierboven). */
export interface ModifierDef {
  k: string;
  n: string;
  g: string;
  hard: boolean;
  d: string;
  rule?: string;
  bonus?: Bonus;
  /** Soorten doelen waar deze regel niet bij past. */
  not?: string[];
}

export const MODIFIERS: ModifierDef[] = [
  // Moeilijker
  {
    k: 'longWinter',
    n: 'Lange winter',
    g: '❄',
    hard: true,
    d: 'Elke winter duurt 6 dagen; lente, zomer en herfst maar 2',
    rule: 'longWinter',
  },
  {
    k: 'meteorShower',
    n: 'Meteorietenregen',
    g: '☄',
    hard: true,
    d: 'Al vanaf dag 1 vallen er 3 keer zoveel meteorieten. Ze brengen erts, maar beschadigen ook je huizen',
    rule: 'meteorShower',
    bonus: { 'meteor.rate': 2 },
  },
  {
    k: 'noArmy',
    n: 'Geen leger',
    g: '⛨',
    hard: true,
    d: 'Je kunt geen soldaten trainen. Torens doen 30% meer schade en schieten 1 tegel verder',
    rule: 'noArmy',
    bonus: { 'tower.dmg': 0.3, 'tower.range': 1 },
    not: ['camps'],
  },
  {
    k: 'raidsX2',
    n: 'Dubbele aanvallen',
    g: '⚔',
    hard: true,
    d: 'Elke aanval komt in twee golven: om negen uur ’s avonds en rond middernacht',
    rule: 'raidsX2',
  },
  {
    k: 'bigRaids',
    n: 'Grote aanvallen',
    g: '⚔',
    hard: true,
    d: 'Aanvallen zijn anderhalf keer zo groot',
    bonus: { 'raid.size': 0.5 },
  },
  {
    k: 'strongFoes',
    n: 'Taaie vijand',
    g: '♥',
    hard: true,
    d: 'Aanvallers hebben 50% meer levens',
    bonus: { 'raid.hp': 0.5 },
  },
  {
    k: 'poorSoil',
    n: 'Kale grond',
    g: '▤',
    hard: true,
    d: 'Bomen, struiken, stenen en ertsaders hebben de helft minder. Akkers oogsten 25% trager',
    rule: 'poorSoil',
    bonus: { farm: -0.25 },
  },
  {
    k: 'fastDays',
    n: 'Snelle dagen',
    g: '☉',
    hard: true,
    d: 'Dag en nacht gaan anderhalf keer zo snel',
    rule: 'fastDays',
  },
  {
    k: 'noTrade',
    n: 'Gesloten grenzen',
    g: '⚖',
    hard: true,
    d: 'Er komen geen reizende handelaars, en de markt geeft 30% slechtere prijzen',
    rule: 'noTrade',
    bonus: { market: -0.3 },
  },

  // Makkelijker
  {
    k: 'richStart',
    n: 'Rijke start',
    g: '⛁',
    hard: false,
    d: 'Drie keer zoveel grondstoffen bij het begin, en 3 dorpelingen extra',
    rule: 'richStart',
  },
  {
    k: 'goldRush',
    n: 'Goudkoorts',
    g: '⛏',
    hard: false,
    d: 'Steen en erts winnen gaat 40% sneller, en de markt geeft 30% betere prijzen',
    bonus: { 'gather.mine': 0.4, market: 0.3 },
  },
  {
    k: 'quickMinds',
    n: 'Snelle geesten',
    g: '✎',
    hard: false,
    d: 'Onderzoek duurt 40% korter',
    bonus: { 'research.time': -0.4 },
  },
  {
    k: 'fertile',
    n: 'Vruchtbaar land',
    g: '⚘',
    hard: false,
    d: 'Akkers oogsten 30% sneller en voedsel verzamelen gaat 20% sneller',
    bonus: { farm: 0.3, 'gather.food': 0.2 },
  },
];

/** Spelregel opzoeken op sleutel: MODIFIER.longWinter */
export const MODIFIER: Record<string, ModifierDef> = Object.fromEntries(MODIFIERS.map(m => [m.k, m]));

/** Een nette lijst spelregels: alleen bestaande, elk één keer. Kapot of leeg wordt een lege lijst. */
export const cleanMods = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((k, i) => MODIFIER[k] && list.indexOf(k) === i) : [];

/** De bonussen van de spelregels in een spel (G.mods bewaart alleen de sleutels). */
export const modifierBonuses = (keys: unknown): (Bonus | undefined)[] =>
  cleanMods(keys)
    .map(k => MODIFIER[k].bonus)
    .filter(Boolean);

/** Geldt deze vlag (zoals 'noArmy') bij deze spelregels? */
export const modsHaveRule = (keys: unknown, flag: string): boolean =>
  cleanMods(keys).some(k => MODIFIER[k].rule === flag);

/** Hoeveel dagen elk seizoen duurt: lente, zomer, herfst, winter. Met Lange winter is het vooral winter. */
export const seasonDays = (longWinter: boolean): number[] => (longWinter ? [2, 2, 2, 6] : [4, 4, 4, 4]);

/** Welk seizoen het is op een dag (0 = lente, 1 = zomer, 2 = herfst, 3 = winter). Dag 1 is de eerste lentedag. */
export function seasonIndex(day: number, longWinter = false): number {
  const days = seasonDays(longWinter);
  const year = days.reduce((sum, n) => sum + n, 0);
  let dayOfYear = (((day - 1) % year) + year) % year;
  for (let i = 0; i < days.length; i++) {
    if (dayOfYear < days[i]) return i;
    dayOfYear -= days[i];
  }
  return 0;
}
