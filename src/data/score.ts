// De eindscore van een spel en de medaille die erbij hoort. Puur, zodat het te testen is.
import { DIFFICULTIES } from './difficulty';

/** Punten per onderdeel. Tijdperken tellen vanaf de Steentijd (0). Dagen kosten punten: hoe sneller, hoe beter. */
export const POINTS = { age: 1000, wonders: 500, camps: 200, kills: 5, days: -15, rivals: 1500 };

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

/** Extra punten in een uitdaging: voor het gehaalde doel, en voor de medaille (zie data/scenarios.js). */
export const CHALLENGE_POINTS = { goal: 2000, goud: 1500, zilver: 1000, brons: 500 };

/**
 * De eindscore uitgerekend, met elke regel apart voor het eindscherm.
 * Tijdperk ×1000 + wonderen ×500 + kampen ×200 + vijanden ×5 − dagen ×15 (nooit onder 0),
 * en dat keer de factor voor de moeilijkheid.
 * Versloeg je rivalen (`rivals`), dan krijg je per rivaal 1500 punten extra (een eigen regel op het eindscherm).
 * In een uitdaging (`challenge`: { won, medal }) komen er punten bij voor het doel en de medaille.
 */
export function gameScore({
  age = 0,
  wonders = 0,
  camps = 0,
  kills = 0,
  days = 0,
  diff = 1,
  rivals = 0,
  challenge = null,
} = {}) {
  const list = [
    { k: 'age', n: 'Nieuwe tijdperken', count: age, per: POINTS.age },
    { k: 'wonders', n: 'Wonderen', count: wonders, per: POINTS.wonders },
    { k: 'camps', n: 'Kampen veroverd', count: camps, per: POINTS.camps },
    { k: 'kills', n: 'Vijanden verslagen', count: kills, per: POINTS.kills },
    { k: 'days', n: 'Dagen', count: days, per: POINTS.days },
  ];
  if (rivals > 0) list.push({ k: 'rivals', n: 'Rivalen verslagen', count: rivals, per: POINTS.rivals });
  if (challenge) {
    list.push({ k: 'goal', n: 'Doel gehaald', count: challenge.won ? 1 : 0, per: CHALLENGE_POINTS.goal });
    const medal = MEDALS.find(m => m.k === challenge.medal);
    if (medal)
      list.push({
        k: 'medal',
        n: `Medaille ${medal.n.toLowerCase()}`,
        count: 1,
        per: CHALLENGE_POINTS[medal.k],
      });
  }
  const rows = list.map(row => ({ ...row, pts: row.count * row.per }));
  // raw: alles opgeteld (kan onder 0 zijn), sum: hetzelfde maar nooit onder 0
  const raw = rows.reduce((total, row) => total + row.pts, 0);
  const sum = Math.max(0, raw);
  const factor = DIFF_FACTOR[diff] ?? 1;
  const total = Math.round(sum * factor);
  return { rows, raw, sum, factor, total, medal: medalFor(total) };
}
