// Opslagplekken: één automatische en drie eigen plekken, en wat je per plek ziet. Puur, zodat het te testen is.
import { AGES } from './ages';
import { cleanMap, cleanMapSize } from './maps';
import { PLACES } from './names';
import { DEFAULT_PEOPLE, PEOPLE } from './peoples';
import { scenarioDef } from './scenarios';
import type { ScenarioRef } from './scenarios';

/** De automatische plek: het spel slaat hier elke minuut vanzelf op. */
export const AUTO_SLOT = 'auto';
/** De drie plekken die je zelf kiest. */
export const MANUAL_SLOTS: string[] = ['1', '2', '3'];
export const SLOTS: string[] = [AUTO_SLOT, ...MANUAL_SLOTS];

/** Waar de opslag van een plek in de browser staat. */
export const slotKey = (id: string): string => `tijdperken-slot-${id}`;
/** Eén kleine lijst met per plek de kaartgegevens, zodat het laadscherm de grote opslagen niet hoeft te lezen. */
export const SLOT_INDEX_KEY = 'tijdperken-slots';
/** De ene opslag van vóór de plekken. Die verhuist naar een plek (zie game/save.ts). */
export const OLD_SAVE_KEY = 'tijdperken-save-v4';

/** Oude tijdperknummers (zes tijdperken) naar de nieuwe (negen tijdperken). */
export const OLD_AGE: number[] = [0, 1, 3, 5, 6, 7];

/**
 * Het kaartje van één opslag (zie cleanSlotMeta).
 * place: naam van je stad · challenge: naam van de uitdaging (of leeg) · people: sleutel van je volk ·
 * age: tijdperk (0 tot 8) · day: dag · at: wanneer opgeslagen (milliseconden, 0 = onbekend) · won: al gewonnen ·
 * seed: de wereld (om hetzelfde spel te herkennen; null bij een kaartje van vóór dit veld) ·
 * map en size: kaartsoort en kaartgrootte (zelfde zaadcode, kaartsoort en grootte = dezelfde wereld)
 */
export interface SlotMeta {
  place: string;
  challenge: string;
  people: string;
  age: number;
  day: number;
  at: number;
  won: boolean;
  seed: number | null;
  map: string;
  size: number;
}

/** Alle plekken: per plek (AUTO_SLOT, '1', '2', '3') een kaartje, of null als de plek leeg is. */
export type SlotIndex = Record<string, SlotMeta | null>;

// Een kaartje zoals het in de opslag staat: er kan van alles in staan (zie cleanSlotMeta)
type RawSlotMeta = Partial<Record<keyof SlotMeta, unknown>>;

/** De naam van een plek in een zin, zoals "Plek 2 wissen?" of "Automatische opslag is gewist." */
export const slotName = (id: string): string => (id === AUTO_SLOT ? 'Automatische opslag' : `Plek ${id}`);
/** Korte naam voor het kleine regeltje onder de tijd. */
export const slotLabel = (id: string): string => (id === AUTO_SLOT ? 'automatisch' : `Plek ${id}`);

/**
 * Het kaartje van één opslag, met alleen nette waarden (of null als het onbruikbaar is).
 * Kaartjes van vóór de kaartgroottes hebben geen size of map: dat was altijd een gewone wereld.
 */
export function cleanSlotMeta(raw: unknown): SlotMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as RawSlotMeta;
  // Na Number.isInteger of Number.isFinite is de waarde zeker een getal
  return {
    place: typeof r.place === 'string' ? r.place : '',
    challenge: typeof r.challenge === 'string' ? r.challenge : '',
    people: typeof r.people === 'string' && PEOPLE[r.people] ? r.people : DEFAULT_PEOPLE,
    age: Number.isInteger(r.age) && AGES[r.age as number] ? (r.age as number) : 0,
    day: Number.isInteger(r.day) && (r.day as number) > 0 ? (r.day as number) : 1,
    at: Number.isFinite(r.at) && (r.at as number) > 0 ? (r.at as number) : 0,
    won: !!r.won,
    seed: Number.isInteger(r.seed) && (r.seed as number) >= 0 ? (r.seed as number) : null,
    map: cleanMap(typeof r.map === 'string' ? r.map : ''),
    size: cleanMapSize(r.size),
  };
}

/**
 * Zijn twee kaartjes hetzelfde spel (zelfde wereld en zelfde uitdaging), misschien op een ander moment?
 * Zonder bekende wereld weten we het niet, dan zeggen we nee.
 */
export const sameGame = (a: SlotMeta | null | undefined, b: SlotMeta | null | undefined): boolean =>
  !!a &&
  !!b &&
  a.seed !== null &&
  a.seed === b.seed &&
  a.challenge === b.challenge &&
  a.map === b.map &&
  a.size === b.size;

/** De hele lijst: voor elke plek een kaartje, of null als de plek leeg is. */
export function cleanSlotIndex(raw: unknown): SlotIndex {
  const index: SlotIndex = {};
  // raw komt uit de opslag: een object met kaartjes per plek, of rommel (dan zijn alle plekken leeg)
  const list = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const id of SLOTS) index[id] = cleanSlotMeta(list[id]);
  return index;
}

/** De plek met de nieuwste opslag (voor "Verder spelen"), of null als alles leeg is. */
export function latestSlot(index: SlotIndex): string | null {
  let best: string | null = null;
  for (const id of SLOTS) {
    const meta = index[id];
    // best is altijd een plek met een kaartje
    if (meta && (!best || meta.at > index[best]!.at)) best = id;
  }
  return best;
}

/** Hoeveel plekken er gevuld zijn. */
export const filledCount = (index: SlotIndex): number => SLOTS.filter(id => index[id]).length;

/** De naam bovenaan het kaartje: de uitdaging, anders je stad. */
export const slotTitle = (meta: SlotMeta): string => meta.challenge || meta.place || 'Je stad';

/** De regel eronder, zoals "Friezen · Bronstijd · dag 12". */
export const slotSummary = (meta: SlotMeta): string =>
  `${(PEOPLE[meta.people] || PEOPLE[DEFAULT_PEOPLE]).n} · ${AGES[meta.age].n} · dag ${meta.day}`;

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const clockText = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Wanneer er opgeslagen is, in gewone taal: "zojuist", "5 min geleden", "vandaag 14:32",
 * "gisteren 09:05", "3 okt 18:04" of (een ander jaar) "3 okt 2025".
 */
export function savedAtText(at: number, now = Date.now()): string {
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
 * Het deel van een hele opslag (het object uit JSON, zie game/save.ts) dat een kaartje nodig heeft.
 * Er kan van alles in staan: cleanSlotMeta maakt het netjes.
 */
export interface SaveSummary {
  seed?: unknown;
  ages?: unknown;
  size?: unknown;
  g?: {
    scenario?: unknown;
    people?: unknown;
    age?: unknown;
    day?: unknown;
    won?: unknown;
    opts?: { map?: unknown } | null;
  } | null;
}

/**
 * Het kaartje uit een hele opslag. Voor de oude opslag die naar een plek verhuist: daarvan weten we niet
 * wanneer hij gemaakt is, tenzij je `at` meegeeft.
 */
export function metaFromSave(save: SaveSummary | null | undefined, at = 0): SlotMeta | null {
  const g = (save && save.g) || {};
  // Na Number.isInteger is de zaadcode zeker een getal
  const seed = save && Number.isInteger(save.seed) ? (save.seed as number) : 0;
  // scenarioDef kan met elke waarde overweg: zonder bekende uitdaging geeft hij null
  const challenge = scenarioDef(g.scenario as ScenarioRef | null | undefined);
  // Opslag van vóór de negen tijdperken telde nog zes tijdperken
  const age = save && save.ages === 9 ? g.age : (OLD_AGE[g.age as number] ?? g.age);
  return cleanSlotMeta({
    place: PLACES[seed % PLACES.length],
    challenge: challenge ? challenge.n : '',
    people: g.people,
    age,
    day: g.day,
    at,
    won: g.won,
    seed: save && save.seed,
    // Opslag van vóór de kaartsoorten of de kaartgroottes: een continent van gewone grootte
    map: g.opts && g.opts.map,
    size: save && save.size,
  });
}

/**
 * Wat de speler leest als opslaan niet lukt. kind: 'quota' (de opslag is vol) of iets anders.
 * inSaveScreen: de speler staat al in het opslaanscherm, waar elke plek een knop ✕ heeft om te wissen.
 */
export function saveErrorText(kind: string, inSaveScreen = false): string {
  if (kind === 'quota' && inSaveScreen)
    return 'Opslaan mislukt: de opslag van je browser is vol. Wis een plek met ✕ en probeer het opnieuw.';
  if (kind === 'quota')
    return 'Opslaan mislukt: de opslag van je browser is vol. Wis een oude opslag (Menu → Laden) en probeer het opnieuw.';
  return 'Opslaan lukt niet in deze browser. Misschien staat opslaan uit, of speel je in een privévenster.';
}

/** Het spel van een kaartje in een paar woorden, zoals "Varenhorst, dag 12". */
export const gameText = (meta: SlotMeta): string => `${slotTitle(meta)}, dag ${meta.day}`;

/**
 * Waarschuwing bij een nieuwe wereld of uitdaging, als je spel nu nergens anders bewaard staat: de nieuwe
 * wereld komt op de automatische plek, en daar staat het nu alleen.
 */
export const replaceWarningText = (meta: SlotMeta): string =>
  `Let op: je spel nu (${gameText(meta)}) wordt vervangen. Wil je het houden? Bewaar het dan eerst op een eigen plek: Verder spelen → Menu → Opslaan.`;
