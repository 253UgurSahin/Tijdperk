// Alle grondstoffen (voedsel, hout, ...) en hoe snel je ze verzamelt.
export const RES = {
  food: { n: 'Voedsel', c: '#d9a640', age: 0 },
  wood: { n: 'Hout', c: '#9c6b3c', age: 0 },
  stone: { n: 'Steen', c: '#9a9c92', age: 0 },
  copper: { n: 'Koper', c: '#c9723f', age: 1 },
  tin: { n: 'Tin', c: '#a9b6bd', age: 1 },
  bronze: { n: 'Brons', c: '#b9853a', age: 1, cr: 1 },
  iron: { n: 'IJzer', c: '#7d7b88', age: 2 },
  gold: { n: 'Goud', c: '#e2b92c', age: 3 },
  powder: { n: 'Buskruit', c: '#4a4038', age: 4, cr: 1 },
  coal: { n: 'Kolen', c: '#4d5058', age: 5 },
  steel: { n: 'Staal', c: '#7f9ab0', age: 5, cr: 1 },
  oil: { n: 'Olie', c: '#5b4a68', age: 6 },
  sand: { n: 'Zand', c: '#d8c184', age: 6 },
  fuel: { n: 'Brandstof', c: '#d0612f', age: 6, cr: 1 },
  silicon: { n: 'Silicium', c: '#6f84b8', age: 6, cr: 1 },
  lithium: { n: 'Lithium', c: '#7fcdb5', age: 7 },
  chips: { n: 'Chips', c: '#2fae80', age: 7, cr: 1 },
  battery: { n: "Accu's", c: '#77bf40', age: 7, cr: 1 },
  starmetal: { n: 'Sterrenmetaal', c: '#b49cff', age: 8 },
  fusion: { n: 'Fusiecellen', c: '#ff6fd0', age: 8, cr: 1 },
};
export const RKEYS = Object.keys(RES);
export const GATHER = [
  'food',
  'wood',
  'stone',
  'copper',
  'tin',
  'iron',
  'gold',
  'coal',
  'sand',
  'lithium',
  'starmetal',
];
export const HARD = {
  food: 1,
  wood: 0.9,
  stone: 0.75,
  copper: 0.7,
  tin: 0.7,
  iron: 0.65,
  gold: 0.6,
  coal: 0.7,
  sand: 1,
  lithium: 0.65,
  starmetal: 0.55,
};
export const BASEW = {
  food: 1.5,
  wood: 1.3,
  stone: 1,
  copper: 0.9,
  tin: 0.9,
  iron: 0.95,
  gold: 0.6,
  coal: 0.95,
  sand: 0.8,
  lithium: 0.8,
  starmetal: 0.6,
};

/**
 * Marktprijzen in goud voor 100 stuks van grondstof r. `level` is het niveau van de markt,
 * `marketMul` de marktbonus (1 = geen bonus, 1.2 = 20% betere prijzen).
 */
export function tradePrices(r, level, marketMul) {
  const base = 1 + RES[r].age * 0.5;
  const buy = Math.round((20 * base * (1 - 0.1 * level)) / marketMul);
  const sell = Math.round(8 * base * (1 + 0.15 * level) * marketMul);
  // Verkopen levert altijd minder op dan kopen kost: anders verdien je eindeloos goud
  // door steeds hetzelfde te kopen en te verkopen (veel marktbonussen samen).
  return { buy, sell: Math.max(0, Math.min(sell, buy - 1)) };
}
