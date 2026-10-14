// Development-only hooks (loaded by main.js under `vite dev`), handy in the browser console
// and for automated smoke tests: window.__tp.G, __tp.place('hut', x, y), ...
import { store } from './core/store.js';
import { B } from './data/buildings.js';
import { G, newGame } from './game/state.js';
import { placeBuilding } from './game/entities.js';
import { cam } from './render/scene.js';
import { centerOn } from './render/camera.js';
import * as world from './world/world.js';

window.__tp = {
  get G() { return G; }, store, B, cam, world, newGame, centerOn,
  place: (type, x, y) => placeBuilding(type, x, y, true),
};
import { GLOWS } from './render/decals.js';
window.__tp.GLOWS = GLOWS;
import * as caches from './game/caches.js';
window.__tp.caches = caches;
import * as config from './config.js';
window.__tp.config = config;
