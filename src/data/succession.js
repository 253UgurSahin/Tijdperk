// Which building or unit takes over from which. Once the successor's age is reached,
// the older one can no longer be built or trained (existing ones keep working).
import { B } from './buildings.js';
import { UNITS } from './units.js';

export const SUCCESSOR = {
  // homes
  hut: 'house', house: 'stonehouse', stonehouse: 'rowhouse', rowhouse: 'apartment', apartment: 'towerblock',
  // light
  campfire: 'lantern', lantern: 'streetlamp',
  // defence
  watchtower: 'bronzetower', bronzetower: 'castletower', castletower: 'cannon', cannon: 'laser', aa: 'laser',
  palisade: 'stonewall', stonewall: 'concrete',
  // power
  powerplant: 'oilplant',
  // army
  spear: 'warrior', warrior: 'knight', knight: 'rifle',
  slinger: 'archer', archer: 'rifle', rifle: 'soldier', soldier: 'exo',
  fieldgun: 'tank',
};

const def = k => B[k] || UNITS[k];

/** Age from which `k` is replaced by its successor (Infinity if never). */
export const retiredAt = k => (SUCCESSOR[k] ? def(SUCCESSOR[k]).age : Infinity);

/** True when `k` is discovered and not yet replaced in the given age. */
export const canMake = (k, age) => def(k).age <= age && age < retiredAt(k);

/** Everything that the step into `age` makes obsolete. */
export const retiredIn = age => Object.keys(SUCCESSOR).filter(k => retiredAt(k) === age && def(k).age < age);
