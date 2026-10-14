// Beeldkwaliteit. Vast (laag / middel / hoog) of automatisch: automatisch begint hoog en zet
// zelf de resolutie en zware effecten lager als het spel hapert, en weer hoger als er ruimte is.
// Zo blijft het op elk apparaat vloeiend.
import { store } from '../core/store.js';
import { SET, saveSet } from '../core/settings.js';
import { configurePost } from './post.js';
import { resize, sun } from './scene.js';

export const LEVELS = {
  low: {
    name: 'Laag',
    scale: 0.7,
    pixels: 3e6,
    shadows: false,
    shadowMap: 1024,
    post: false,
    bloom: false,
    outline: false,
    particles: false,
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
  },
  high: {
    name: 'Hoog',
    scale: 1,
    pixels: 12e6,
    shadows: true,
    shadowMap: 2048,
    post: true,
    bloom: true,
    outline: true,
  },
};
const ORDER = ['low', 'mid', 'high'];
const COARSE = matchMedia('(pointer:coarse)').matches; // telefoon/tablet: start een stapje lager

let level = 'high',
  frames = 0,
  time = 0,
  slow = 0,
  fast = 0;

/** Eigen keuze uit de instellingen: schaduwen, gloed, omlijning en resolutie los aan of uit. */
function customLevel() {
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
  };
}

function apply(name) {
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
      sun.shadow.map = null;
    }
  }
  configurePost(L);
  resize();
}

/** Kies de kwaliteit uit de instelling (bij opstarten en als de speler hem verandert). */
export function initQuality() {
  if (!SET.quality) SET.quality = 'auto';
  apply(SET.quality === 'auto' ? (COARSE ? 'mid' : 'high') : SET.quality);
}

export function setQuality(q) {
  SET.quality = q;
  saveSet();
  initQuality();
}

/**
 * Elk beeldje: bij "automatisch" meten we per seconde hoe vloeiend het loopt.
 * Twee seconden onder ~45 beeldjes/s: een stap omlaag. Vijf seconden ruim boven ~57: een stap omhoog.
 * Tussen de stappen schuift ook de resolutie mee, zodat het niet ineens veel lelijker wordt.
 */
export function tickQuality(rdt) {
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
  if (slow >= 2) {
    slow = 0;
    if (store.resScale > L.scale - 0.2 + 0.01) {
      store.resScale = Math.max(0.5, store.resScale - 0.1);
      resize();
    } else if (ORDER.indexOf(level) > 0) apply(ORDER[ORDER.indexOf(level) - 1]);
    else if (store.resScale > 0.5) {
      store.resScale = Math.max(0.5, store.resScale - 0.1);
      resize();
    }
  } else if (fast >= 5) {
    fast = 0;
    if (store.resScale < L.scale - 0.01) {
      store.resScale = Math.min(L.scale, store.resScale + 0.1);
      resize();
    } else if (ORDER.indexOf(level) < ORDER.length - 1) apply(ORDER[ORDER.indexOf(level) + 1]);
  }
}
