// Kampioenen: na elk nieuw tijdperk leidt een sterke aanvoerder met een eigen naam de eerste aanval. Puur.
import type { PendingBoss } from '../types';

/** Zoveel keer meer levens dan een gewone aanvaller van zijn soort. */
export const BOSS_HP = 6;
/** Zoveel keer meer schade. */
export const BOSS_DMG = 2;
/** Zoveel keer groter getekend, zodat je hem meteen ziet tussen de rest. */
export const BOSS_SCALE = 1.7;

/*
 * Elke kampioen hoort bij één tijdperk (de Steentijd heeft er geen: daar begint het spel).
 * - age: na dit nieuwe tijdperk komt hij, n: naam, title: bijnaam ("de Verscheurder")
 * - role: wie hij is, in een paar woorden
 * - foe: welk soort vijand hij is (nummer in FOES; meestal de vijanden van zijn eigen tijdperk)
 */
/** Een kampioen (zie de uitleg hierboven). */
export interface BossDef {
  age: number;
  n: string;
  title: string;
  role: string;
  foe: number;
}

export const BOSSES: BossDef[] = [
  { age: 1, n: 'Grimnar', title: 'de Verscheurder', role: 'Aanvoerder van de plunderaars', foe: 1 },
  { age: 2, n: 'Brennos', title: 'IJzervuist', role: 'Koning van de barbaren', foe: 2 },
  { age: 3, n: 'Roderik', title: 'de Zwarte Ridder', role: 'Heer van de roofridders', foe: 3 },
  { age: 4, n: 'Kaptein Roodbaard', title: 'de Schrik der Zeeën', role: 'Leider van de kapers', foe: 4 },
  { age: 5, n: 'Kolonel Kruyt', title: 'de Ongenadige', role: 'Baas van de huurlingen', foe: 5 },
  { age: 6, n: 'Behemoth', title: 'de Stalen Muur', role: 'Het grootste pantser van het leger', foe: 6 },
  { age: 7, n: 'Argus', title: 'het Moederschip', role: 'Stuurt de vijandelijke zwerm aan', foe: 7 },
  { age: 8, n: 'Vex', title: 'de Sterrenvreter', role: 'Koning van de ruimtepiraten', foe: 8 },
];

/** De kampioen van een tijdperk, of null (de Steentijd, of een nummer dat niet bestaat). */
export const bossForAge = (age: number | undefined): BossDef | null =>
  BOSSES.find(b => b.age === age) || null;

/** Zijn hele naam: "Grimnar de Verscheurder". */
export const bossName = (boss: BossDef): string => `${boss.n} ${boss.title}`;

/**
 * De kampioen die nog moet komen, netjes voor de opslag: { age } of null.
 * Opslag van daarvóór (of een tijdperk zonder kampioen) geeft null: dan komt er geen.
 */
export function cleanPendingBoss(o: unknown): PendingBoss | null {
  if (!o || typeof o !== 'object') return null;
  // o is nu een object, maar age kan nog van alles zijn: bossForAge vindt alleen iets bij een echt tijdperk
  return bossForAge((o as PendingBoss).age) ? { age: (o as PendingBoss).age } : null;
}
