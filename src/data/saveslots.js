// Opslagplekken: één automatische en drie eigen plekken, en wat je per plek ziet. Puur, zodat het te testen is.
import { AGES } from './ages.js';
import { PLACES } from './names.js';
import { DEFAULT_PEOPLE, PEOPLE } from './peoples.js';
import { scenarioDef } from './scenarios.js';

/** De automatische plek: het spel slaat hier elke minuut vanzelf op. */
export const AUTO_SLOT = 'auto';
/** De drie plekken die je zelf kiest. */
export const MANUAL_SLOTS = ['1', '2', '3'];
export const SLOTS = [AUTO_SLOT, ...MANUAL_SLOTS];

/** Waar de opslag van een plek in de browser staat. */
export const slotKey = id => `tijdperken-slot-${id}`;
/** Eén kleine lijst met per plek de kaartgegevens, zodat het laadscherm de grote opslagen niet hoeft te lezen. */
export const SLOT_INDEX_KEY = 'tijdperken-slots';
/** De ene opslag van vóór de plekken. Die verhuist naar de automatische plek. */
export const OLD_SAVE_KEY = 'tijdperken-save-v4';

/** Oude tijdperknummers (zes tijdperken) naar de nieuwe (negen tijdperken). */
export const OLD_AGE = [0, 1, 3, 5, 6, 7];

/** De naam van een plek in een zin, zoals "Plek 2 wissen?" of "Automatische opslag is gewist." */
export const slotName = id => (id === AUTO_SLOT ? 'Automatische opslag' : `Plek ${id}`);
/** Korte naam voor het kleine regeltje onder de tijd. */
export const slotLabel = id => (id === AUTO_SLOT ? 'automatisch' : `Plek ${id}`);

/**
 * Het kaartje van één opslag, met alleen nette waarden (of null als het onbruikbaar is).
 * place: naam van je stad · challenge: naam van de uitdaging (of leeg) · people: sleutel van je volk ·
 * age: tijdperk (0 tot 8) · day: dag · at: wanneer opgeslagen (milliseconden, 0 = onbekend) · won: al gewonnen ·
 * seed: de wereld (om hetzelfde spel te herkennen; null bij een kaartje van vóór dit veld)
 */
export function cleanSlotMeta(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    place: typeof raw.place === 'string' ? raw.place : '',
    challenge: typeof raw.challenge === 'string' ? raw.challenge : '',
    people: PEOPLE[raw.people] ? raw.people : DEFAULT_PEOPLE,
    age: Number.isInteger(raw.age) && AGES[raw.age] ? raw.age : 0,
    day: Number.isInteger(raw.day) && raw.day > 0 ? raw.day : 1,
    at: Number.isFinite(raw.at) && raw.at > 0 ? raw.at : 0,
    won: !!raw.won,
    seed: Number.isInteger(raw.seed) && raw.seed >= 0 ? raw.seed : null,
  };
}

/**
 * Zijn twee kaartjes hetzelfde spel (zelfde wereld en zelfde uitdaging), misschien op een ander moment?
 * Zonder bekende wereld weten we het niet, dan zeggen we nee.
 */
export const sameGame = (a, b) =>
  !!a && !!b && a.seed !== null && a.seed === b.seed && a.challenge === b.challenge;

/** De hele lijst: voor elke plek een kaartje, of null als de plek leeg is. */
export function cleanSlotIndex(raw) {
  const index = {};
  for (const id of SLOTS) index[id] = cleanSlotMeta(raw && raw[id]);
  return index;
}

/** De plek met de nieuwste opslag (voor "Verder spelen"), of null als alles leeg is. */
export function latestSlot(index) {
  let best = null;
  for (const id of SLOTS) {
    const meta = index[id];
    if (meta && (!best || meta.at > index[best].at)) best = id;
  }
  return best;
}

/** Hoeveel plekken er gevuld zijn. */
export const filledCount = index => SLOTS.filter(id => index[id]).length;

/** De naam bovenaan het kaartje: de uitdaging, anders je stad. */
export const slotTitle = meta => meta.challenge || meta.place || 'Je stad';

/** De regel eronder, zoals "Friezen · Bronstijd · dag 12". */
export const slotSummary = meta =>
  `${(PEOPLE[meta.people] || PEOPLE[DEFAULT_PEOPLE]).n} · ${AGES[meta.age].n} · dag ${meta.day}`;

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const clockText = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Wanneer er opgeslagen is, in gewone taal: "zojuist", "5 min geleden", "vandaag 14:32",
 * "gisteren 09:05", "3 okt 18:04" of (een ander jaar) "3 okt 2025".
 */
export function savedAtText(at, now = Date.now()) {
  if (!at) return 'eerder opgeslagen';
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1 && now >= at) return 'zojuist';
  if (minutes < 60 && now >= at) return `${minutes} min geleden`;
  const when = new Date(at),
    today = new Date(now),
    yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(when, today)) return `vandaag ${clockText(when)}`;
  if (sameDay(when, yesterday)) return `gisteren ${clockText(when)}`;
  const date = `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return when.getFullYear() === today.getFullYear()
    ? `${date} ${clockText(when)}`
    : `${date} ${when.getFullYear()}`;
}

/**
 * Het kaartje uit een hele opslag (het object uit JSON). Voor de oude opslag die naar de automatische plek
 * verhuist: daarvan weten we niet wanneer hij gemaakt is, tenzij je `at` meegeeft.
 */
export function metaFromSave(save, at = 0) {
  const g = (save && save.g) || {};
  const seed = save && Number.isInteger(save.seed) ? save.seed : 0;
  const challenge = scenarioDef(g.scenario);
  // Opslag van vóór de negen tijdperken telde nog zes tijdperken
  const age = save && save.ages === 9 ? g.age : (OLD_AGE[g.age] ?? g.age);
  return cleanSlotMeta({
    place: PLACES[seed % PLACES.length],
    challenge: challenge ? challenge.n : '',
    people: g.people,
    age,
    day: g.day,
    at,
    won: g.won,
    seed: save && save.seed,
  });
}

/**
 * Wat de speler leest als opslaan niet lukt. kind: 'quota' (de opslag is vol) of iets anders.
 * inSaveScreen: de speler staat al in het opslaanscherm, waar elke plek een knop ✕ heeft om te wissen.
 */
export function saveErrorText(kind, inSaveScreen = false) {
  if (kind === 'quota' && inSaveScreen)
    return 'Opslaan mislukt: de opslag van je browser is vol. Wis een plek met ✕ en probeer het opnieuw.';
  if (kind === 'quota')
    return 'Opslaan mislukt: de opslag van je browser is vol. Wis een oude opslag (Menu → Laden) en probeer het opnieuw.';
  return 'Opslaan lukt niet in deze browser. Misschien staat opslaan uit, of speel je in een privévenster.';
}

/** Het spel van een kaartje in een paar woorden, zoals "Varenhorst, dag 12". */
export const gameText = meta => `${slotTitle(meta)}, dag ${meta.day}`;

/**
 * Waarschuwing bij een nieuwe wereld of uitdaging, als je spel nu nergens anders bewaard staat: de nieuwe
 * wereld komt op de automatische plek, en daar staat het nu alleen.
 */
export const replaceWarningText = meta =>
  `Let op: je spel nu (${gameText(meta)}) wordt vervangen. Wil je het houden? Bewaar het dan eerst op een eigen plek: Verder spelen → Menu → Opslaan.`;
