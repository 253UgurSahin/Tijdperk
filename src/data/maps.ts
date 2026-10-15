// De kaartsoorten en kaartgroottes waaruit je kiest bij een nieuwe wereld, met de knoppen voor de
// wereldgenerator. Puur.

/*
 * Elke kaartsoort:
 * - k: vaste sleutel (wordt opgeslagen), n: naam, d: korte uitleg, g: pictogram (zie ui/glyphs.ts)
 * - gen: instellingen voor src/world/generate.ts
 *   - levels: welk deel van de kaart lager ligt dan zee, kust, heuvels en bergtoppen (0 tot 1)
 *   - landSize: hoe groot de landmassa's zijn (in tegels; kleiner = meer losse stukken)
 *   - edgeDrop: hoe sterk het land naar de rand van de kaart in zee zakt
 *   - ridges: hoeveel bergkammen er extra bij komen (0 = geen)
 *   - straits: hoe diep de zeestraten tussen eilanden zijn (0 = geen)
 */
/** Een kaartsoort waaruit je kiest (zie de uitleg hierboven). */
export interface MapDef {
  k: string;
  n: string;
  d: string;
  g: string;
  gen: MapGen;
}

/** Instellingen voor de wereldgenerator (src/world/generate.ts), zie de uitleg hierboven. */
export interface MapGen {
  levels: { sea: number; shore: number; hill: number; peak: number };
  landSize: number;
  edgeDrop: number;
  ridges: number;
  straits?: number;
}

export const MAPS: MapDef[] = [
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
export const MAP: Record<string, MapDef> = Object.fromEntries(MAPS.map(m => [m.k, m]));

/** De kaart van oude opslag en het standaardspel. */
export const DEFAULT_MAP = 'continent';

/** Een bestaande kaartsleutel, of de standaardkaart als de sleutel niet (meer) bestaat of ontbreekt (''). */
export const cleanMap = (k = ''): string => (MAP[k] ? k : DEFAULT_MAP);

/** Een kaartgrootte waaruit je kiest: n bij n tegels, met een naam en een korte uitleg. */
export interface MapSizeDef {
  n: number;
  name: string;
  d: string;
}

// De grootte wordt opgeslagen (als getal). Zelfde zaadcode, kaartsoort en grootte = dezelfde wereld.
export const MAP_SIZES: MapSizeDef[] = [
  { n: 256, name: 'Normaal', d: 'De gewone wereld' },
  { n: 384, name: 'Groot', d: 'Meer ruimte, meer kampen en grondstoffen' },
  { n: 512, name: 'Enorm', d: 'Heel veel ruimte, voor een lang spel' },
];

/** De gewone grootte: oude opslag, uitdagingen en de wereld van de dag (hun tijden zijn daarop afgesteld). */
export const NORMAL_SIZE = 256;

/** Waarmee een nieuwe vrije wereld begint op het nieuw-spelscherm. */
export const DEFAULT_SIZE = 384;

/** Een bestaande kaartgrootte, of de gewone grootte als die ontbreekt of niet (meer) bestaat. */
export const cleanMapSize = (n: unknown): number =>
  typeof n === 'number' && MAP_SIZES.some(s => s.n === n) ? n : NORMAL_SIZE;

/** De naam van een kaartgrootte, zoals "Groot". */
export const mapSizeName = (n: number): string => (MAP_SIZES.find(s => s.n === n) || MAP_SIZES[0]).name;
