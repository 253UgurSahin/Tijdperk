// Beeldkwaliteit. Vast (laag / middel / hoog) of automatisch: automatisch begint hoog en zet
// zelf de resolutie en zware effecten lager als het spel hapert, en weer hoger als er ruimte is.
// Zo blijft het op elk apparaat vloeiend.
import type * as T3 from 'three';
import { store } from '../core/store';
import { SET, saveSet } from '../core/settings';
import { configurePost, type PostSettings } from './post';
import { requestResize, resize, sun } from './scene';
import { setScatterDensity } from './scatter';
import { setFineDetail } from './terrainlook';
import { setNodeDetail } from './nodes';

/** Eén kwaliteitsstand: naam, resolutie-factor, maximum aantal pixels, schaduwen en nabewerking. */
interface QualityLevel extends PostSettings {
  name: string;
  scale: number;
  pixels: number;
  shadows: boolean;
  shadowMap: number;
  /** false: geen deeltjes (rook, stof, vonken). */
  particles?: boolean;
  /** Hoeveel grassprieten en steentjes (0-1), en of grond, water, bomen en bergen fijn getekend worden. */
  scatter: number;
  fine: boolean;
}
export const LEVELS: Record<string, QualityLevel> = {
  low: {
    name: 'Laag',
    scale: 0.7,
    pixels: 3e6,
    shadows: false,
    shadowMap: 1024,
    post: false,
    bloom: false,
    outline: true, // de omlijning kost bijna niets (zie outline.ts)
    particles: false,
    scatter: 0, // geen grassprieten en steentjes
    fine: false, // eenvoudiger grond, water, bomen en bergen
  },
  mid: {
    name: 'Middel',
    scale: 0.85,
    pixels: 6e6,
    shadows: true,
    shadowMap: 1024,
    post: true,
    bloom: false,
    outline: true,
    scatter: 0.5,
    fine: true,
  },
  high: {
    name: 'Hoog',
    scale: 1,
    pixels: 9e6, // genoeg voor een 4K-scherm; daarboven ziet niemand het verschil, de videokaart wel
    shadows: true,
    shadowMap: 2048,
    post: true,
    bloom: true,
    outline: true,
    sharpen: 0.22,
    hdr: true, // felle kleuren: alleen echte lichten gloeien
    scatter: 1,
    fine: true,
  },
};
const ORDER = ['low', 'mid', 'high'];
const COARSE = matchMedia('(pointer:coarse)').matches; // telefoon/tablet: start een stapje lager

let level: string = 'high',
  frames: number = 0,
  time: number = 0,
  slow: number = 0,
  fast: number = 0;

/** Eigen keuze uit de instellingen: schaduwen, gloed, omlijning en resolutie los aan of uit. */
function customLevel(): QualityLevel {
  const g = SET.gfx || {};
  return {
    name: 'Aangepast',
    scale: g.scale || 1,
    pixels: 14e6,
    shadows: !!g.shadows,
    shadowMap: 2048,
    post: !!(g.bloom || g.outline),
    bloom: !!g.bloom,
    outline: !!g.outline,
    particles: g.particles !== false,
    sharpen: g.bloom ? 0.22 : 0,
    hdr: !!g.bloom,
    scatter: g.shadows ? 1 : 0.5,
    fine: (g.scale || 1) >= 0.8,
  };
}

// later = true: de nieuwe resolutie pas vlak vóór het volgende beeldje instellen. Een canvas
// van grootte veranderen maakt het leeg; midden in een beeldje gaf dat een kort zwart beeld.
function apply(name: string, later?: boolean) {
  level = name;
  const L = name === 'custom' ? customLevel() : LEVELS[name];
  store.resScale = L.scale;
  store.pixelBudget = L.pixels; // maximaal aantal pixels voor de 3D-wereld
  store.quality = name;
  store.noParticles = L.particles === false;
  sun.castShadow = L.shadows;
  if (sun.shadow.mapSize.x !== L.shadowMap) {
    sun.shadow.mapSize.set(L.shadowMap, L.shadowMap);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      // Leeg maken: three.js maakt dan een nieuwe in het juiste formaat (de types kennen deze lege stand niet)
      (sun.shadow as { map: T3.WebGLRenderTarget | null }).map = null;
    }
  }
  configurePost(L);
  setScatterDensity(L.scatter);
  setFineDetail(L.fine);
  setNodeDetail(L.fine);
  if (later) requestResize();
  else resize();
}

/** Kies de kwaliteit uit de instelling (bij opstarten en als de speler hem verandert). */
export function initQuality() {
  if (!SET.quality) SET.quality = 'auto';
  apply(SET.quality === 'auto' ? (COARSE ? 'mid' : 'high') : SET.quality);
}

export function setQuality(q: string) {
  SET.quality = q;
  saveSet();
  initQuality();
}

/**
 * Elk beeldje: bij "automatisch" meten we per seconde hoe vloeiend het loopt.
 * Twee seconden onder ~45 beeldjes/s: een stap omlaag. Vijf seconden ruim boven ~57: een stap omhoog.
 * Tussen de stappen schuift ook de resolutie mee, zodat het niet ineens veel lelijker wordt.
 */
export function tickQuality(rdt: number) {
  if (SET.quality !== 'auto' || document.hidden) return;
  frames++;
  time += rdt;
  if (time < 1) return;
  const fps = frames / time;
  frames = 0;
  time = 0;
  if (fps < 45) {
    slow++;
    fast = 0;
  } else if (fps > 57) {
    fast++;
    slow = 0;
  } else slow = fast = 0;
  const L = LEVELS[level];
  // store.resScale is gezet door apply() (via initQuality bij het opstarten)
  if (slow >= 2) {
    slow = 0;
    if (store.resScale! > L.scale - 0.2 + 0.01) {
      store.resScale = Math.max(0.5, store.resScale! - 0.1);
      requestResize();
    } else if (ORDER.indexOf(level) > 0) apply(ORDER[ORDER.indexOf(level) - 1], true);
    else if (store.resScale! > 0.5) {
      store.resScale = Math.max(0.5, store.resScale! - 0.1);
      requestResize();
    }
  } else if (fast >= 5) {
    fast = 0;
    if (store.resScale! < L.scale - 0.01) {
      store.resScale = Math.min(L.scale, store.resScale! + 0.1);
      requestResize();
    } else if (ORDER.indexOf(level) < ORDER.length - 1) apply(ORDER[ORDER.indexOf(level) + 1], true);
  }
}
