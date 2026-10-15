import type { BuildingDef, UnitDef } from '../types';
// Opvolging: welk gebouw of welke eenheid door welke wordt vervangen. Zodra het
// tijdperk van de opvolger begint, kun je het oude niet meer maken (wat er al staat blijft werken).
import { B } from './buildings';
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

const def = (k: string): BuildingDef | UnitDef => B[k] || UNITS[k];

/** Tijdperk waarin `k` wordt vervangen (Infinity = nooit). */
export const retiredAt = (k: string): number => (SUCCESSOR[k] ? def(SUCCESSOR[k]).age : Infinity);

/** Kun je `k` maken in dit tijdperk? (al ontdekt én nog niet vervangen) */
export const canMake = (k: string, age: number): boolean => def(k).age <= age && age < retiredAt(k);

/** Alles wat verouderd raakt bij de stap naar dit tijdperk. */
export const retiredIn = (age: number): string[] => Object.keys(SUCCESSOR).filter(k => retiredAt(k) === age && def(k).age < age);
