// Manieren om te winnen: welke doelen er zijn, hoe ver je bent, en wat het eindscherm dan zegt. Puur.
import { AGES } from './ages.js';

/** Zoveel nachten moet je doorstaan voor de overwinning "Overleven". */
export const SURVIVE_NIGHTS = 30;
/** Het tijdperk voor het korte spel: de Gouden Eeuw. */
export const SHORT_AGE = 4;
const LAST_AGE = AGES.length - 1;

/*
 * Feiten (`f`) die de doelen gebruiken, zoals game/victory.js ze verzamelt:
 * age (tijdperk), day (dag), stargate (sterrenpoort af), stargateBusy (sterrenpoort neergezet),
 * campsLeft (kampen die nog over zijn), wonders (wonderen gebouwd).
 *
 * Elke manier om te winnen:
 * - k: vaste sleutel (wordt bewaard in G.opts.victories), n: naam, d: wat je moet doen, g: pictogram
 * - len: hoe lang een spel ongeveer duurt
 * - on: staat standaard aan bij een nieuwe wereld
 * - soon: komt later; nog niet te kiezen en nergens te zien
 * - full: een volledige overwinning; alleen die telt voor prestaties als "win een spel"
 * - frac(f): hoe ver je bent, van 0 tot 1 (1 = gewonnen); text(f): hetzelfde in een paar woorden
 * - end: teksten voor het eindscherm; story(f) krijgt ook f.place (naam van je stad) en f.ageName
 */
export const VICTORIES = [
  {
    k: 'stargate',
    n: 'Sterrenpoort',
    d: 'Doorloop alle tijdperken en bouw de sterrenpoort',
    g: '✹',
    len: 'Lang spel',
    on: true,
    full: true,
    frac: f => (f.stargate ? 1 : Math.min(f.age, LAST_AGE) / (LAST_AGE + 1)),
    text: f => {
      if (f.stargate) return 'klaar';
      if (f.age < LAST_AGE) return `tijdperk ${f.age + 1} van ${LAST_AGE + 1}`;
      return f.stargateBusy ? 'in aanbouw' : 'nu bouwen';
    },
    end: {
      eyebrow: `Hoofdstuk ${AGES[LAST_AGE].r} voltooid`,
      title: 'Van vuursteen tot sterrenpoort.',
      story: f => `${f.place} doorliep de hele geschiedenis in ${days(f.day)}.`,
    },
  },
  {
    k: 'survive',
    n: 'Overleven',
    d: `Houd ${SURVIVE_NIGHTS} nachten stand`,
    g: '☾',
    len: 'Middellang spel',
    frac: f => Math.min(1, nightsSurvived(f) / SURVIVE_NIGHTS),
    text: f => `${Math.min(nightsSurvived(f), SURVIVE_NIGHTS)} van ${SURVIVE_NIGHTS} nachten`,
    end: {
      eyebrow: `${SURVIVE_NIGHTS} nachten overleefd`,
      title: 'Niets kon jullie breken.',
      story: f =>
        `${f.place} hield ${SURVIVE_NIGHTS} nachten stand en bereikte de ${f.ageName.toLowerCase()}.`,
    },
  },
  {
    k: 'age',
    n: AGES[SHORT_AGE].n,
    d: `Bereik de ${AGES[SHORT_AGE].n}`,
    g: '♛',
    len: 'Kort spel',
    frac: f => Math.min(1, f.age / SHORT_AGE),
    text: f => (f.age >= SHORT_AGE ? 'klaar' : ageWord(SHORT_AGE - f.age)),
    end: {
      eyebrow: 'Kort spel gewonnen',
      title: 'Een gouden eeuw.',
      story: f => `${f.place} bereikte de ${AGES[SHORT_AGE].n} in ${days(f.day)}.`,
    },
  },
  // Komen later: de gegevens staan klaar, maar je kunt ze nog niet kiezen
  {
    k: 'conquest',
    n: 'Verovering',
    d: 'Verover alle vijandelijke kampen',
    g: '⚔',
    len: 'Middellang spel',
    soon: true,
    frac: f => (f.campsLeft === 0 ? 1 : 0),
    text: f => `nog ${f.campsLeft} kampen`,
    end: {
      eyebrow: 'Alle kampen veroverd',
      title: 'Het land is van jullie.',
      story: f => `${f.place} veroverde alle kampen in ${days(f.day)}.`,
    },
  },
  {
    k: 'wonders',
    n: 'Wonderen',
    d: 'Bouw drie wereldwonderen',
    g: '★',
    len: 'Lang spel',
    soon: true,
    frac: f => Math.min(1, (f.wonders || 0) / 3),
    text: f => `${Math.min(f.wonders || 0, 3)} van 3 wonderen`,
    end: {
      eyebrow: 'Drie wonderen gebouwd',
      title: 'Een wonder van de wereld.',
      story: f => `${f.place} bouwde drie wonderen in ${days(f.day)}.`,
    },
  },
];

// Elke nieuwe dag begint na een doorstane nacht: op dag 31 heb je er 30 achter de rug
const nightsSurvived = f => Math.max(0, f.day - 1);
// "1 dag", "12 dagen"
const days = n => `${n} ${n === 1 ? 'dag' : 'dagen'}`;
// Wat er nog over is, zodat het niet leest alsof het spel minder tijdperken heeft: "nog 1 tijdperk"
const ageWord = n => `nog ${n} ${n === 1 ? 'tijdperk' : 'tijdperken'}`;

/** Overwinning op sleutel, zoals VICTORY.survive. */
export const VICTORY = Object.fromEntries(VICTORIES.map(v => [v.k, v]));

/** De overwinningen die je nu al kunt kiezen (zonder die van later). */
export const SELECTABLE_VICTORIES = VICTORIES.filter(v => !v.soon);

/** Wat standaard aan staat bij een nieuwe wereld. */
export const DEFAULT_VICTORIES = SELECTABLE_VICTORIES.filter(v => v.on).map(v => v.k);

/**
 * Een nette lijst gekozen overwinningen: alleen bestaande en kiesbare, elk één keer, in vaste volgorde.
 * Een lege of kapotte lijst wordt de standaard: er is altijd minstens één manier om te winnen.
 */
export function cleanVictories(list) {
  const chosen = Array.isArray(list) ? list : [];
  const keys = SELECTABLE_VICTORIES.map(v => v.k).filter(k => chosen.includes(k));
  return keys.length ? keys : DEFAULT_VICTORIES.slice();
}

/** De eerste gekozen overwinning die je nu haalt, of null. */
export function reachedVictory(keys, f) {
  const v = cleanVictories(keys)
    .map(k => VICTORY[k])
    .find(v => v.frac(f) >= 1);
  return v ? v.k : null;
}
