import type { Building, Foe, GameState, Unit } from './types';
// Alleen tijdens ontwikkelen (npm run dev): handige hulpjes in de browserconsole
// en voor automatische tests, bijv. window.__tp.G of __tp.place('hut', x, y).
import { store } from './core/store';
import { B } from './data/buildings';
import { G, newGame } from './game/state';
import { placeBuilding } from './game/entities';
import { cam } from './render/scene';
import { centerOn } from './render/camera';
import * as world from './world/world';

/** De hulpjes op window.__tp (alleen in dev-modus); de velden met ? komen er hieronder bij. */
interface DevTools {
  readonly G: GameState;
  store: typeof store;
  B: typeof B;
  cam: typeof cam;
  world: typeof world;
  newGame: typeof newGame;
  centerOn: typeof centerOn;
  place: (type: string, x: number, y: number) => Building;
  GLOWS?: typeof GLOWS;
  caches?: typeof caches;
  config?: typeof config;
  meteor?: () => void;
  nodes3d?: typeof nodes3d;
  terrain3d?: typeof terrain3d;
  sel?: typeof sel;
  proj?: typeof proj;
  setAge?: (n: number) => void;
  rich?: (n?: number) => void;
  unit?: (k: string, x: number, y: number) => Unit;
  foe?: (type: number, x: number, y: number) => Foe;
}
declare global {
  interface Window {
    __tp?: DevTools;
  }
}

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
import { GLOWS } from './render/decals';
window.__tp.GLOWS = GLOWS;
import * as caches from './game/caches';
window.__tp.caches = caches;
import * as config from './config';
window.__tp.config = config;
// Laat binnen een tel een meteoriet aankondigen
window.__tp.meteor = () => {
  window.__tp!.G.nextMeteor = window.__tp!.G.t;
};
import * as nodes3d from './render/nodes';
import * as terrain3d from './render/terrain';
window.__tp.nodes3d = nodes3d;
window.__tp.terrain3d = terrain3d;
import { sel } from './game/state';
import { proj } from './render/camera';
window.__tp.sel = sel;
window.__tp.proj = proj;
// Spring naar een tijdperk, krijg veel grondstoffen, of zet een eenheid neer
import { onAgeChange } from './ui/age';
import { RKEYS } from './data/resources';
import { spawnUnit, spawnFoe } from './game/entities';
import { computeAvail } from './game/caches';
window.__tp.setAge = n => {
  G.age = n;
  computeAvail();
  onAgeChange();
};
window.__tp.rich = (n = 5000) => RKEYS.forEach(k => (G.res[k] = n));
window.__tp.unit = (k, x, y) => spawnUnit(k, x, y);
window.__tp.foe = (type, x, y) => spawnFoe(type, x, y, 1);
