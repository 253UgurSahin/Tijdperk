// Grondstofbronnen op de kaart: bomen, struiken, rotsen, ertsaders.
// Plek 0 betekent "geen grondstof" en wordt nooit opgezocht.
import type { NodeDef } from '../types';
export const NODES: NodeDef[] = [
  null!,
  { k: 'tree', res: 'wood', amt: [60, 110], age: 0, n: 'Boom' },
  { k: 'bush', res: 'food', amt: [40, 70], age: 0, n: 'Bessenstruik' },
  { k: 'rock', res: 'stone', amt: [120, 200], age: 0, n: 'Rotsblok' },
  { k: 'copper', res: 'copper', amt: [150, 260], age: 1, n: 'Koperader' },
  { k: 'tin', res: 'tin', amt: [130, 220], age: 1, n: 'Tinader' },
  { k: 'iron', res: 'iron', amt: [180, 300], age: 2, n: 'IJzererts' },
  { k: 'gold', res: 'gold', amt: [100, 180], age: 3, n: 'Goudader' },
  { k: 'coal', res: 'coal', amt: [200, 320], age: 5, n: 'Steenkoollaag' },
  { k: 'oil', res: 'oil', amt: [1500, 2500], age: 6, n: 'Oliebron', pump: 1 },
  { k: 'sand', res: 'sand', amt: [150, 250], age: 6, n: 'Zandduin' },
  { k: 'lithium', res: 'lithium', amt: [150, 250], age: 7, n: 'Lithiumzout' },
  { k: 'starmetal', res: 'starmetal', amt: [160, 260], age: 8, n: 'Meteorietbrok' },
];
export const NI: Record<string, number> = {};
NODES.forEach((n, i) => {
  if (n) NI[n.k] = i;
});
export const RES_NODES: Record<string, number[]> = {};
NODES.forEach((n, i) => {
  if (n && !n.pump) (RES_NODES[n.res] = RES_NODES[n.res] || []).push(i);
});
