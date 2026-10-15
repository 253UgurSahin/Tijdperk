// Opvolging: welk gebouw of welke eenheid door welke wordt vervangen. Zodra het
// tijdperk van de opvolger begint, kun je het oude niet meer maken (wat er al staat blijft werken).
import { B } from './buildings';
import { PEOPLE } from './peoples';
import { UNITS } from './units';

export const SUCCESSOR: Record<string, string> = {
  // woningen
  hut: 'house',
  house: 'stonehouse',
  stonehouse: 'canalhouse',
  canalhouse: 'rowhouse',
  rowhouse: 'apartment',
  apartment: 'towerblock',
  towerblock: 'arcology',
  // licht
  campfire: 'lantern',
  lantern: 'streetlamp',
  // verdediging
  watchtower: 'bronzetower',
  bronzetower: 'hillfort',
  hillfort: 'castletower',
  castletower: 'bastion',
  bastion: 'cannon',
  cannon: 'laser',
  aa: 'laser',
  laser: 'railgun',
  palisade: 'stonewall',
  stonewall: 'concrete',
  // stroom
  powerplant: 'oilplant',
  oilplant: 'fusionplant',
  // leger: voetvolk
  spear: 'warrior',
  warrior: 'swordsman',
  swordsman: 'pikeman',
  berserker: 'pikeman', // de zwaardvechter van de Noormannen
  pikeman: 'rifle',
  // leger: op afstand
  slinger: 'javelin',
  javelin: 'archer',
  archer: 'musketeer',
  musketeer: 'rifle',
  rifle: 'soldier',
  soldier: 'exo',
  exo: 'plasma',
  // leger: ruiters, daarna pantser
  chariot: 'knight',
  knight: 'cuirassier',
  cuirassier: 'tank',
  tank: 'mech',
  // leger: geschut
  trebuchet: 'bombard',
  bombard: 'fieldgun',
  fieldgun: 'rocket',
};

/** Wat we van een gebouw of eenheid nodig hebben: het tijdperk, en (bij een eigen soldaat) het volk. */
const def = (k: string): { age: number; people?: string } => B[k] || UNITS[k];

/** Tijdperk waarin `k` wordt vervangen (Infinity = nooit). */
export const retiredAt = (k: string): number => (SUCCESSOR[k] ? def(SUCCESSOR[k]).age : Infinity);

/**
 * Hoort `k` bij jouw volk? Een eigen soldaat (zoals de Berserker) alleen bij zijn eigen volk,
 * en de soldaat die hij vervangt (de zwaardvechter) juist niet bij dat volk.
 * Zonder volk ('') hoort alles erbij behalve de eigen soldaten van een volk.
 */
export function fitsPeople(k: string, people = ''): boolean {
  const own = def(k).people;
  if (own) return own === people;
  const unique = PEOPLE[people] && PEOPLE[people].unique;
  return !(unique && unique.replaces === k);
}

/** Kun je `k` maken in dit tijdperk, met dit volk? (al ontdekt, nog niet vervangen, en van jouw volk) */
export const canMake = (k: string, age: number, people?: string): boolean =>
  def(k).age <= age && age < retiredAt(k) && fitsPeople(k, people);

/** Alles wat verouderd raakt bij de stap naar dit tijdperk (met dit volk). */
export const retiredIn = (age: number, people?: string): string[] =>
  Object.keys(SUCCESSOR).filter(k => retiredAt(k) === age && def(k).age < age && fitsPeople(k, people));
