// Pictogrammen en portretten, gemaakt van de 3D-modellen.
import * as T3 from 'three';
import { TAU } from '../config';
import { B } from '../data/buildings';
import { G } from '../game/state';
import { roadTier } from '../game/upgrades';
import { bx } from './kit';
import { makeBuilding } from './models';
import { FOEK, makeUnit, makeVillager } from './people';
import { RC } from './terrain';

let IR = null,
  IS = null,
  ICAM = null;
function snap(obj: T3.Object3D, size = 128, zoom = 1): string {
  if (!IR) {
    IR = new T3.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    IR.setPixelRatio(1);
    IS = new T3.Scene();
    IS.add(new T3.HemisphereLight(0xffffff, 0x6a7a58, 0.95));
    const dl = new T3.DirectionalLight(0xfff2dd, 0.95);
    dl.position.set(-3, 6, 4);
    IS.add(dl);
    ICAM = new T3.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  }
  IR.setSize(size, size, false);
  IS.add(obj);
  const bb = new T3.Box3().setFromObject(obj),
    sp2 = bb.getBoundingSphere(new T3.Sphere()),
    r = (sp2.radius * 1.02) / zoom;
  ICAM.left = -r;
  ICAM.right = r;
  ICAM.top = r;
  ICAM.bottom = -r;
  ICAM.updateProjectionMatrix();
  const c = sp2.center;
  ICAM.position.set(c.x + r * 3, c.y + r * 2.6, c.z + r * 3);
  ICAM.lookAt(c);
  IR.setClearColor(0x000000, 0);
  IR.render(IS, ICAM);
  const url = IR.domElement.toDataURL();
  IS.remove(obj);
  return url;
}
const iconCache = {};
export function iconFor(type: string): string {
  const key = type + (type === 'townhall' || type === 'road' ? G.age : '');
  if (iconCache[key]) return iconCache[key];
  let g;
  if (B[type].road) {
    g = new T3.Group();
    const t = roadTier();
    bx(g, 1, 0.04, 1, `rgb(${RC[t].join(',')})`);
    bx(g, 1, 0.03, 0.08, '#5a7a3a', 0, 0, 0.55);
    bx(g, 1, 0.03, 0.08, '#5a7a3a', 0, 0, -0.55);
  } else g = makeBuilding(type, G.age, null);
  return (iconCache[key] = snap(g));
}
export function portrait(kind: string, key: string): string {
  const ck = 'p' + kind + key;
  if (iconCache[ck]) return iconCache[ck];
  const g =
    kind === 'v'
      ? makeVillager(key)
      : kind === 'u'
        ? makeUnit(key, false)
        : makeUnit(FOEK[key] || 'plunder', true);
  g.rotation.y = -0.5;
  return (iconCache[ck] = snap(g, 128, 1.25));
}
export function circ(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, Math.max(0.1, r), 0, TAU);
  c.fill();
}
