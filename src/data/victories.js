// Manieren om te winnen: welke doelen er zijn, hoe ver je bent, en wat het eindscherm dan zegt. Puur.
import { AGES } from './ages.js';
import { CHARGE_NIGHTS, chargePercent } from './finale.js';

/** Zoveel nachten moet je doorstaan voor de overwinning "Overleven". */
export const SURVIVE_NIGHTS = 30;
/** Het tijdperk voor het korte spel: de Gouden Eeuw. */
export const SHORT_AGE = 4;
/** Zoveel wereldwonderen moet je tegelijk hebben voor de overwinning "Wonderen". */
export const WONDER_GOAL = 4;
const LAST_AGE = AGES.length - 1;

/*
 * Feiten (`f`) die de doelen gebruiken, zoals game/victory.js ze verzamelt:
 * age (tijdperk), day (dag), stargate (sterrenpoort af en opgeladen), charging (sterrenpoort laadt op),
 * charge (hoe vol, 0 tot 1), stargateBusy (sterrenpoort neergezet),
 * campsLeft (kampen die nog over zijn), wonders (wereldwonderen die nu van jou zijn),
 * rivals (rivalen in dit spel), rivalsBeaten (rivalen verslagen).
 *
 * Elke manier om te winnen:
 * - k: vaste sleutel (wordt bewaard in G.opts.victories), n: naam, d: wat je moet doen, g: pictogram
 * - len: hoe lang een spel ongeveer duurt
 * - on: staat standaard aan bij een nieuwe wereld
 * - soon: komt later; nog niet te kiezen en nergens te zien
 * - needsRivals: alleen te kiezen als er minstens één rivaal meedoet
 * - full: een volledige overwinning; alleen die telt voor prestaties als "win een spel"
 * - frac(f): hoe ver je bent, van 0 tot 1 (1 = gewonnen); text(f): hetzelfde in een paar woorden
 * - end: teksten voor het eindscherm; story(f) krijgt ook f.place (naam van je stad) en f.ageName
 */
export const VICTORIES = [
  {
    k: 'stargate',
    n: 'Sterrenpoort',
    d: `Doorloop alle tijdperken, bouw de sterrenpoort en houd hem ${CHARGE_NIGHTS} nachten heel`,
    g: '✹',
    len: 'Lang spel',
    on: true,
    full: true,
    // De lading van de poort telt als het laatste stukje (maar pas als hij open is, is het 1)
    frac: f =>
      f.stargate ? 1 : Math.min(0.99, (Math.min(f.age, LAST_AGE) + (f.charge || 0)) / (LAST_AGE + 1)),
    text: f => {
      if (f.stargate) return 'klaar';
      if (f.age < LAST_AGE) return `tijdperk ${f.age + 1} van ${LAST_AGE + 1}`;
      if (f.charging) return `laadt op: ${chargePercent(f.charge)}%`;
      return f.stargateBusy ? 'in aanbouw' : 'nu bouwen';
    },
    end: {
      eyebrow: `Hoofdstuk ${AGES[LAST_AGE].r} voltooid`,
      title: 'Van vuursteen tot sterrenpoort.',
      story: f =>
        `${f.place} doorliep de hele geschiedenis in ${days(f.day)}. De sterrenpoort hield ${CHARGE_NIGHTS} nachten stand.`,
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
  {
    k: 'conquest',
    n: 'Verovering',
    d: 'Versla alle rivalen: verwoest hun stamhuis',
    g: '⚔',
    len: 'Middellang spel',
    needsRivals: true,
    frac: f => (f.rivals > 0 ? Math.min(1, (f.rivalsBeaten || 0) / f.rivals) : 0),
    text: f =>
      f.rivals > 0 ? `${Math.min(f.rivalsBeaten || 0, f.rivals)} van ${f.rivals} verslagen` : 'geen rivalen',
    end: {
      eyebrow: 'Alle rivalen verslagen',
      title: 'Het land is van jullie.',
      story: f => `${f.place} versloeg alle rivalen in ${days(f.day)}.`,
    },
  },
  {
    k: 'wonders',
    n: 'Wonderen',
    d: `Heb ${WONDER_GOAL} wereldwonderen tegelijk`,
    g: '★',
    len: 'Lang spel',
    frac: f => Math.min(1, (f.wonders || 0) / WONDER_GOAL),
    text: f => `${Math.min(f.wonders || 0, WONDER_GOAL)} van ${WONDER_GOAL} wonderen`,
    end: {
      eyebrow: `${WONDER_GOAL} wereldwonderen`,
      title: 'Een wonder van de wereld.',
      story: f => `${f.place} bezat ${WONDER_GOAL} wereldwonderen na ${days(f.day)}.`,
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

/** Kun je deze overwinning kiezen met zoveel rivalen? (Verovering vraagt minstens één rivaal.) */
export const victoryAllowed = (v, rivals = 0) => !v.soon && (!v.needsRivals || rivals > 0);

/**
 * Een nette lijst gekozen overwinningen: alleen bestaande en kiesbare, elk één keer, in vaste volgorde.
 * `rivals` is het aantal rivalen in het spel: zonder rivalen valt Verovering weg.
 * Een lege of kapotte lijst wordt de standaard: er is altijd minstens één manier om te winnen.
 */
export function cleanVictories(list, rivals = 0) {
  const chosen = Array.isArray(list) ? list : [];
  const keys = SELECTABLE_VICTORIES.filter(v => victoryAllowed(v, rivals) && chosen.includes(v.k)).map(
    v => v.k,
  );
  return keys.length ? keys : DEFAULT_VICTORIES.slice();
}

/** De eerste gekozen overwinning die je nu haalt, of null. */
export function reachedVictory(keys, f) {
  const v = cleanVictories(keys, f.rivals || 0)
    .map(k => VICTORY[k])
    .find(v => v.frac(f) >= 1);
  return v ? v.k : null;
}
