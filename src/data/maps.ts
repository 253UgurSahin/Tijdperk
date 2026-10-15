// De kaartsoorten waaruit je kiest bij een nieuwe wereld, met de knoppen voor de wereldgenerator. Puur.

/*
 * Elke kaartsoort:
 * - k: vaste sleutel (wordt opgeslagen), n: naam, d: korte uitleg, g: pictogram (zie ui/glyphs.js)
 * - gen: instellingen voor src/world/generate.js
 *   - levels: welk deel van de kaart lager ligt dan zee, kust, heuvels en bergtoppen (0 tot 1)
 *   - landSize: hoe groot de landmassa's zijn (in tegels; kleiner = meer losse stukken)
 *   - edgeDrop: hoe sterk het land naar de rand van de kaart in zee zakt
 *   - ridges: hoeveel bergkammen er extra bij komen (0 = geen)
 *   - straits: hoe diep de zeestraten tussen eilanden zijn (0 = geen)
 */
export const MAPS = [
  {
    k: 'continent',
    n: 'Continent',
    d: 'Eén groot land, zee langs de rand',
    g: '⬟',
    gen: {
      levels: { sea: 0.24, shore: 0.28, hill: 0.74, peak: 0.92 },
      landSize: 34,
      edgeDrop: 0.22,
      ridges: 0,
    },
  },
  {
    k: 'islands',
    n: 'Eilanden',
    d: 'Veel zee, eilanden met zandbanken ertussen',
    g: '≈',
    gen: {
      levels: { sea: 0.45, shore: 0.5, hill: 0.82, peak: 0.95 },
      landSize: 26,
      edgeDrop: 0.3,
      ridges: 0,
      straits: 0.3,
    },
  },
  {
    k: 'highlands',
    n: 'Bergland',
    d: 'Hoge bergkammen en smalle passen',
    g: '⛰',
    gen: {
      levels: { sea: 0.1, shore: 0.13, hill: 0.48, peak: 0.8 },
      landSize: 34,
      edgeDrop: 0.18,
      ridges: 0.35,
    },
  },
];

/** Kaartsoort op sleutel, zoals MAP.islands. */
export const MAP = Object.fromEntries(MAPS.map(m => [m.k, m]));

/** De kaart van oude opslag en het standaardspel. */
export const DEFAULT_MAP = 'continent';

/** Een bestaande kaartsleutel, of de standaardkaart als de sleutel niet (meer) bestaat. */
export const cleanMap = k => (MAP[k] ? k : DEFAULT_MAP);
