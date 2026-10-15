// De eindscore van een spel en de medaille die erbij hoort. Puur, zodat het te testen is.
import { DIFFICULTIES } from './difficulty.js';

/** Punten per onderdeel. Tijdperken tellen vanaf de Steentijd (0). Dagen kosten punten: hoe sneller, hoe beter. */
export const POINTS = { age: 1000, wonders: 500, camps: 200, kills: 5, days: -15 };

/** De moeilijkheden, zoals op het nieuw-spelscherm (zie data/difficulty.js). */
export const DIFF_NAMES = DIFFICULTIES.map(d => d.n);

/** De score gaat keer dit getal, per moeilijkheid (0 = Vredig, 1 = Normaal, 2 = Zwaar, 3 = Meedogenloos). */
export const DIFF_FACTOR = DIFFICULTIES.map(d => d.score);

/** Medailles, van hoog naar laag. Onder de laagste grens krijg je geen medaille. */
export const MEDALS = [
  { k: 'goud', n: 'Goud', min: 10000 },
  { k: 'zilver', n: 'Zilver', min: 6000 },
  { k: 'brons', n: 'Brons', min: 2500 },
];

/** De medaille bij een score, of null als de score te laag is. */
export const medalFor = score => MEDALS.find(m => score >= m.min) || null;

/**
 * De eindscore uitgerekend, met elke regel apart voor het eindscherm.
 * Tijdperk ×1000 + wonderen ×500 + kampen ×200 + vijanden ×5 − dagen ×15 (nooit onder 0),
 * en dat keer de factor voor de moeilijkheid.
 */
export function gameScore({ age = 0, wonders = 0, camps = 0, kills = 0, days = 0, diff = 1 } = {}) {
  const rows = [
    { k: 'age', n: 'Nieuwe tijdperken', count: age, per: POINTS.age },
    { k: 'wonders', n: 'Wonderen', count: wonders, per: POINTS.wonders },
    { k: 'camps', n: 'Kampen veroverd', count: camps, per: POINTS.camps },
    { k: 'kills', n: 'Vijanden verslagen', count: kills, per: POINTS.kills },
    { k: 'days', n: 'Dagen', count: days, per: POINTS.days },
  ].map(row => ({ ...row, pts: row.count * row.per }));
  // raw: alles opgeteld (kan onder 0 zijn), sum: hetzelfde maar nooit onder 0
  const raw = rows.reduce((total, row) => total + row.pts, 0);
  const sum = Math.max(0, raw);
  const factor = DIFF_FACTOR[diff] ?? 1;
  const total = Math.round(sum * factor);
  return { rows, raw, sum, factor, total, medal: medalFor(total) };
}
