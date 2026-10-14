// Alleen tijdens ontwikkelen (npm run dev): handige hulpjes in de browserconsole
// en voor automatische tests, bijv. window.__tp.G of __tp.place('hut', x, y).
import { store } from './core/store.js';
import { B } from './data/buildings.js';
import { G, newGame } from './game/state.js';
import { placeBuilding } from './game/entities.js';
import { cam } from './render/scene.js';
import { centerOn } from './render/camera.js';
import * as world from './world/world.js';

window.__tp = {
  get G() {
    return G;
  },
  store,
  B,
  cam,
  world,
  newGame,
  centerOn,
  place: (type, x, y) => placeBuilding(type, x, y, true),
};
import { GLOWS } from './render/decals.js';
window.__tp.GLOWS = GLOWS;
import * as caches from './game/caches.js';
window.__tp.caches = caches;
import * as config from './config.js';
window.__tp.config = config;
// Laat binnen een tel een meteoriet aankondigen
window.__tp.meteor = () => {
  window.__tp.G.nextMeteor = window.__tp.G.t;
};
import * as nodes3d from './render/nodes.js';
import * as terrain3d from './render/terrain.js';
window.__tp.nodes3d = nodes3d;
window.__tp.terrain3d = terrain3d;
import { sel } from './game/state.js';
import { proj } from './render/camera.js';
window.__tp.sel = sel;
window.__tp.proj = proj;
