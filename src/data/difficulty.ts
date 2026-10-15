// De vier moeilijkheden: hoe vaak en hoe zwaar aanvallen zijn, en waarmee je begint. Puur.
import type { Cost } from '../types';

/*
 * Het nummer in de lijst is G.diff (0 = Vredig, 1 = Normaal, 2 = Zwaar, 3 = Meedogenloos).
 * - n: naam, d: korte uitleg voor het nieuw-spelscherm
 * - peaceful: geen aanvallen (de vredige modus staat meteen aan)
 * - everyNight: elke nacht een aanval in plaats van om de nacht
 * - raidSize: het aantal aanvallers gaat keer dit getal; raidMax: nooit meer aanvallers dan dit
 *   (behalve bij een heel sterk leger: dan hoogstens ±1,6 keer zoveel, zie raidMatch hieronder)
 * - raidHp: aanvallers hebben zoveel keer meer levens
 * - start: grondstoffen bij het begin (je volk kan daar nog wat bij geven)
 * - score: je eindscore gaat keer dit getal
 */
/** Een moeilijkheid (zie de uitleg hierboven). */
export interface DifficultyDef {
  n: string;
  d: string;
  peaceful: boolean;
  everyNight: boolean;
  raidSize: number;
  raidMax: number;
  raidHp: number;
  start: Cost;
  score: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    n: 'Vredig',
    d: 'Geen aanvallen. Alleen bouwen.',
    peaceful: true,
    everyNight: false,
    raidSize: 1,
    raidMax: 30,
    raidHp: 1,
    start: { food: 200, wood: 160, stone: 60 },
    score: 0.5,
  },
  {
    n: 'Normaal',
    d: 'Om de nacht een aanval.',
    peaceful: false,
    everyNight: false,
    raidSize: 1,
    raidMax: 30,
    raidHp: 1,
    start: { food: 200, wood: 160, stone: 60 },
    score: 1,
  },
  {
    n: 'Zwaar',
    d: 'Elke nacht 1,4× zoveel vijanden. Minder voorraad.',
    peaceful: false,
    everyNight: true,
    raidSize: 1.4,
    raidMax: 30,
    raidHp: 1,
    start: { food: 150, wood: 120, stone: 40 },
    score: 1.5,
  },
  {
    n: 'Meedogenloos',
    d: 'Elke nacht 1,7× zoveel vijanden, en sterker. Weinig voorraad.',
    peaceful: false,
    everyNight: true,
    raidSize: 1.7,
    raidMax: 38,
    raidHp: 1.3,
    start: { food: 120, wood: 110, stone: 30 },
    score: 2,
  },
];

/** De standaardmoeilijkheid (Normaal). */
export const DEFAULT_DIFF = 1;

/**
 * Een geldig moeilijkheidsnummer, of Normaal als het nummer niet bestaat.
 * `d` kan van alles zijn (oude of kapotte opslag); na Number.isInteger is het zeker een getal.
 */
export const cleanDiff = (d: unknown): number =>
  Number.isInteger(d) && DIFFICULTIES[d as number] ? (d as number) : DEFAULT_DIFF;

/** De moeilijkheid bij een nummer (met Normaal als het nummer niet bestaat). */
export const difficulty = (d: unknown): DifficultyDef => DIFFICULTIES[cleanDiff(d)];

/*
 * Aanvallen passen zich aan bij je leger. NORMAL_POWER is hoe sterk een gewoon leger met torens is in elk
 * tijdperk, geteld zoals armyPower in data/rivals.ts (ongeveer: het stamhuis, een paar torens en
 * 4 + 3 × tijdperk soldaten van dat tijdperk). Ben je sterker dan normaal, dan komen er meer en taaiere
 * aanvallers; ben je zwakker, dan iets minder. Nooit lichter dan 0,75 en nooit zwaarder dan 2,5 keer.
 */
export const NORMAL_POWER: number[] = [200, 420, 800, 1250, 1400, 1700, 3000, 5500, 8500];
export const RAID_MATCH_MIN = 0.75;
export const RAID_MATCH_MAX = 2.5;
/** De eerste aanval blijft zoals hij was; daarna past het zich in zoveel aanvallen helemaal aan. */
export const RAID_MATCH_RAMP = 4;

/** Hoeveel keer zoveel aanvallers er komen, en hoeveel keer zoveel leven elke aanvaller heeft. */
export interface RaidMatch {
  size: number;
  hp: number;
}

/**
 * Hoe zwaar een aanval wordt, vergeleken met je leger. `power`: de sterkte van je leger en torens
 * (zie yourPower in game/diplomacy.ts) · `age`: je tijdperk · `raids`: de hoeveelste aanval dit is.
 * Het verschil gaat half naar meer aanvallers en half naar meer leven (beide de wortel), zodat de hele
 * aanval ongeveer zoveel sterker wordt als jouw leger sterker is dan normaal.
 */
export function raidMatch(power: number, age: number, raids: number): RaidMatch {
  const normal = NORMAL_POWER[Math.max(0, Math.min(NORMAL_POWER.length - 1, age))];
  const strength = Math.max(RAID_MATCH_MIN, Math.min(RAID_MATCH_MAX, power / normal));
  // De eerste aanvallen van een spel blijven (bijna) zoals ze waren
  const ramp = Math.max(0, Math.min(1, (raids - 1) / RAID_MATCH_RAMP));
  const factor = 1 + (strength - 1) * ramp;
  return { size: Math.sqrt(factor), hp: Math.sqrt(factor) };
}
