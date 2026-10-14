// Bomen, rotsen en ertsen tekenen (veel tegelijk, dus "instanced").
import * as T3 from 'three';
import { H, TAU, W } from '../config.js';
import { NODES } from '../data/nodes.js';
import { RES } from '../data/resources.js';
import { G } from '../game/state.js';
import { C, M_, gCyl, gDod, gIco, gOct, mat } from './kit.js';
import { CAM3, S3, cam } from './scene.js';
import { hash2 } from '../util/random.js';
import { bmap, isUnl, node } from '../world/world.js';
import { camDist } from './camera.js';

function bakePart(geo, m, x, y, z, sx, sy, sz) {
  const g = geo.clone();
  g.applyMatrix4(
    new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion(), new T3.Vector3(sx, sy, sz)),
  );
  return { geo: g, mat: M_(m) };
}
// Bladeren wiegen zacht in de wind. Elke boom krijgt een eigen ritme (op basis van zijn plek),
// en hoe hoger een stukje blad, hoe meer het beweegt.
export const WIND = { value: 0 };
function foliage(color) {
  const m = new T3.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uWind = WIND;
    shader.vertexShader =
      'uniform float uWind;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uWind * 1.7 + ip.x * 0.7 + ip.z * 0.9) * 0.035 + sin(uWind * 3.3 + ip.x * 1.3) * 0.01;
        transformed.x += sway * position.y * 1.4;
        transformed.z += sway * position.y * 0.6;`,
      );
  };
  m.customProgramCacheKey = () => 'wind';
  return m;
}
export const FOL = {
  pine: foliage('#3f6b3f'),
  pine2: foliage('#4a7a45'),
  birch: foliage('#8fbf5a'),
  oak: foliage('#4f8a3c'),
  bush: foliage('#4d7d38'),
};
const STARGLOW = mat('#b49cff', { e: '#8a5cff', ei: 0.9 });
const NVAR = {
  pine: [
    bakePart(gCyl(0.06, 0.07, 6), C.woodd, 0, 0, 0, 1, 0.4, 1),
    bakePart(gCyl(0, 0.42, 7), FOL.pine, 0, 0.28, 0, 1, 0.62, 1),
    bakePart(gCyl(0, 0.32, 7), FOL.pine2, 0, 0.62, 0, 1, 0.55, 1),
  ],
  birch: [
    bakePart(gCyl(0.045, 0.055, 6), '#e8e4d8', 0, 0, 0, 1, 0.7, 1),
    bakePart(gIco(0), FOL.birch, 0, 0.9, 0, 0.3, 0.42, 0.3),
  ],
  oak: [
    bakePart(gCyl(0.06, 0.08, 6), '#6e5537', 0, 0, 0, 1, 0.45, 1),
    bakePart(gIco(0), FOL.oak, 0, 0.78, 0, 0.44, 0.38, 0.44),
    bakePart(gIco(0), FOL.oak, 0.18, 0.62, 0.1, 0.26, 0.24, 0.26),
  ],
  bush: [
    bakePart(gIco(0), FOL.bush, 0, 0.14, 0, 0.24, 0.18, 0.24),
    bakePart(gIco(0), '#c43c3c', 0.08, 0.28, 0.06, 0.05, 0.05, 0.05),
    bakePart(gIco(0), '#c43c3c', -0.1, 0.24, 0.02, 0.05, 0.05, 0.05),
  ],
  rock: [bakePart(gDod(), '#9a9c92', 0, 0.1, 0, 0.3, 0.22, 0.28)],
  coal: [
    bakePart(gDod(), '#3e4146', 0, 0.1, 0, 0.32, 0.24, 0.3),
    bakePart(gDod(), '#2a2c30', 0.18, 0.06, 0.12, 0.14, 0.12, 0.14),
  ],
  oil: [
    bakePart(gCyl(0.4, 0.4, 10), '#1c1820', 0, 0, 0, 1, 0.025, 1),
    bakePart(gCyl(0.12, 0.12, 8), '#4d3d5c', 0.1, 0.02, 0.05, 1, 0.01, 1),
  ],
  sand: [bakePart(gIco(0), '#c9b07c', 0, -0.02, 0, 0.42, 0.1, 0.38)],
  // Meteorietbrok: zwartgeblakerde steen in een kuiltje, met paars gloeiende kristallen
  starmetal: [
    bakePart(gCyl(0.42, 0.42, 10), '#3a3430', 0, 0, 0, 1, 0.02, 1),
    bakePart(gDod(), '#2b2830', 0, 0.12, 0, 0.3, 0.24, 0.27),
    bakePart(gOct(), STARGLOW, 0.06, 0.32, 0.02, 0.08, 0.17, 0.08),
    bakePart(gOct(), STARGLOW, -0.13, 0.24, 0.1, 0.06, 0.12, 0.06),
    bakePart(gOct(), STARGLOW, 0.14, 0.18, -0.12, 0.05, 0.1, 0.05),
  ],
};
for (const k of ['copper', 'tin', 'iron', 'gold', 'lithium'])
  NVAR[k] = [
    bakePart(gDod(), k === 'lithium' ? '#d9dcd6' : '#7b7d78', 0, 0.1, 0, 0.3, 0.22, 0.28),
    bakePart(gOct(), RES[k].c, 0.05, 0.3, 0, 0.1, 0.18, 0.1),
    bakePart(gOct(), RES[k].c, -0.12, 0.22, 0.08, 0.07, 0.12, 0.07),
  ];
const NGROUP = new T3.Group();
S3.add(NGROUP);
let NI3 = {},
  unlSnap = '';
const nodeVar = i => {
  const k = NODES[node[i]].k;
  if (k !== 'tree') return k;
  const h = hash2(i % W, (i / W) | 0, 21);
  return h < 0.45 ? 'pine' : h < 0.72 ? 'birch' : 'oak';
};
const _m4 = new T3.Matrix4(),
  _q = new T3.Quaternion(),
  _v = new T3.Vector3(),
  _s = new T3.Vector3(),
  _e = new T3.Euler(),
  _c = new T3.Color();
// Alleen bronnen in een cirkel rond de camera worden getekend: op een grote kaart scheelt dat veel.
// De cirkel schuift mee als de camera verder dan een stukje beweegt (zie nodesNeedUpdate).
const drawn = { x: -999, y: -999, r: 0 };
// Op een breed scherm zie je meer opzij, dus dan reikt de cirkel verder
const drawRadius = () => camDist() * 2.4 * Math.max(1, CAM3.aspect / 1.78) + 10;
export const nodesNeedUpdate = () =>
  Math.hypot(cam.x - drawn.x, cam.y - drawn.y) > drawn.r * 0.3 ||
  Math.abs(drawRadius() - drawn.r) > drawn.r * 0.25;

export function rebuildNodes(full) {
  drawn.x = cam.x;
  drawn.y = cam.y;
  drawn.r = drawRadius();
  const x0 = Math.max(0, Math.floor(cam.x - drawn.r)),
    x1 = Math.min(W - 1, Math.ceil(cam.x + drawn.r)),
    y0 = Math.max(0, Math.floor(cam.y - drawn.r)),
    y1 = Math.min(H - 1, Math.ceil(cam.y + drawn.r));
  if (full) {
    for (const k in NI3) for (const m of NI3[k]) NGROUP.remove(m);
    NI3 = {};
    const cnt = {};
    for (let i = 0; i < W * H; i++)
      if (node[i]) {
        const v = nodeVar(i);
        cnt[v] = (cnt[v] || 0) + 1;
      }
    for (const v in NVAR) {
      const cap = (cnt[v] || 0) + 200; // ruimte voor nieuwe bronnen (teruggroei, meteorieten)
      NI3[v] = NVAR[v].map(p => {
        const m = new T3.InstancedMesh(p.geo, p.mat, cap);
        m.castShadow = v !== 'oil' && v !== 'sand';
        m.receiveShadow = true;
        m.count = 0;
        m.instanceMatrix.setUsage(T3.DynamicDrawUsage);
        m.frustumCulled = false;
        NGROUP.add(m);
        return m;
      });
    }
  }
  const n = {};
  for (const v in NI3) n[v] = 0;
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * W + xx,
        t = node[i];
      if (!t || bmap[i] || NODES[t].age > G.age) continue;
      if (Math.hypot(xx - cam.x, yy - cam.y) > drawn.r) continue;
      const v = nodeVar(i),
        arr = NI3[v];
      if (!arr) continue;
      const k = n[v];
      if (k >= arr[0].instanceMatrix.count) {
        // Vol: alles opnieuw opbouwen met meer ruimte
        if (!full) return rebuildNodes(true);
        continue;
      }
      const x = i % W,
        y = (i / W) | 0,
        h1 = hash2(x, y, 31),
        h2 = hash2(x, y, 32),
        h3 = hash2(x, y, 33),
        sc = v === 'oil' || v === 'sand' ? 1 : 0.82 + h3 * 0.38;
      _v.set(x + 0.5 + (h1 - 0.5) * 0.3, 0, y + 0.5 + (h2 - 0.5) * 0.3);
      _q.setFromEuler(_e.set(0, h1 * TAU, 0));
      _s.set(sc, sc * (v === 'pine' ? 0.9 + h2 * 0.4 : 1), sc);
      _m4.compose(_v, _q, _s);
      const lk = !isUnl(x, y);
      _c.setRGB(lk ? 0.5 : 1, lk ? 0.52 : 1, lk ? 0.56 : 1);
      for (const m of arr) {
        m.setMatrixAt(k, _m4);
        m.setColorAt(k, _c);
      }
      n[v] = k + 1;
    }
  for (const v in NI3)
    for (const m of NI3[v]) {
      m.count = n[v];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
}
