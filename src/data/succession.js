// Opvolging: welk gebouw of welke eenheid door welke wordt vervangen. Zodra het
// tijdperk van de opvolger begint, kun je het oude niet meer maken (wat er al staat blijft werken).
import { B } from './buildings.js';
import { UNITS } from './units.js';

export const SUCCESSOR = {
  // woningen
  hut: 'house',
  house: 'stonehouse',
  stonehouse: 'rowhouse',
  rowhouse: 'apartment',
  apartment: 'towerblock',
  // licht
  campfire: 'lantern',
  lantern: 'streetlamp',
  // verdediging
  watchtower: 'bronzetower',
  bronzetower: 'castletower',
  castletower: 'cannon',
  cannon: 'laser',
  aa: 'laser',
  palisade: 'stonewall',
  stonewall: 'concrete',
  // stroom
  powerplant: 'oilplant',
  // leger
  spear: 'warrior',
  warrior: 'knight',
  knight: 'rifle',
  slinger: 'archer',
  archer: 'rifle',
  rifle: 'soldier',
  soldier: 'exo',
  fieldgun: 'tank',
};

const def = k => B[k] || UNITS[k];

/** Tijdperk waarin `k` wordt vervangen (Infinity = nooit). */
export const retiredAt = k => (SUCCESSOR[k] ? def(SUCCESSOR[k]).age : Infinity);

/** Kun je `k` maken in dit tijdperk? (al ontdekt én nog niet vervangen) */
export const canMake = (k, age) => def(k).age <= age && age < retiredAt(k);

/** Alles wat verouderd raakt bij de stap naar dit tijdperk. */
export const retiredIn = age => Object.keys(SUCCESSOR).filter(k => retiredAt(k) === age && def(k).age < age);
