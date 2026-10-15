// Bomen, rotsen en ertsen tekenen (veel tegelijk, dus "instanced").
import * as T3 from 'three';
import { H, TAU, W } from '../config';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { G } from '../game/state';
import { C, GB, M_, gCyl, gDod, gIco, gOct, mat, type Paint } from './kit';
import { S3, VH, VW } from './scene';
import { hash2 } from '../util/random';
import { TER, bmap, ground, node, ter } from '../world/world';
import { settled } from '../game/rivals';
import { groundHeight } from './terrain';
import { camDist, isFar, s2t } from './camera';

/** Eén onderdeel van een boom of rots: een vorm (al op zijn plek gezet) en het materiaal. */
interface NodePart {
  geo: T3.BufferGeometry;
  mat: T3.Material;
}
function bakePart(
  geo: T3.BufferGeometry,
  m: Paint,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): NodePart {
  const g = geo.clone();
  g.applyMatrix4(
    new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion(), new T3.Vector3(sx, sy, sz)),
  );
  return { geo: g, mat: M_(m) };
}
// Een vorm met kleine willekeurige deuken, zodat niet elke boomkruin of steen een perfecte bol is.
// Punten op dezelfde plek schuiven precies even ver, dus er ontstaan geen gaten.
function lumpy(geo: T3.BufferGeometry, seed: number, amount = 0.3) {
  const g = geo.clone(),
    p = g.attributes.position as T3.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      k = 1 + (hash2(Math.round(x * 97), Math.round(y * 89) + Math.round(z * 83) * 7, seed) - 0.5) * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
// Bladeren wiegen zacht in de wind. Elke boom krijgt een eigen ritme (op basis van zijn plek),
// en hoe hoger een stukje blad, hoe meer het beweegt. Onderin is het bladerdek donkerder
// (daar komt minder licht), bovenin lichter: dat geeft de kruinen diepte.
export const WIND = { value: 0 };
function foliage(color: string, low = 0.25, high = 1.1): T3.MeshStandardMaterial {
  const m = new T3.MeshStandardMaterial({ color, flatShading: true, roughness: 0.88 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uWind = WIND;
    shader.uniforms.uShadeRange = { value: new T3.Vector2(low, high) };
    shader.vertexShader =
      'uniform float uWind;\nvarying float vLeafY;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLeafY = position.y;
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uWind * 1.7 + ip.x * 0.7 + ip.z * 0.9) * 0.035 + sin(uWind * 3.3 + ip.x * 1.3) * 0.01;
        transformed.x += sway * position.y * 1.4;
        transformed.z += sway * position.y * 0.6;`,
      );
    shader.fragmentShader =
      'uniform vec2 uShadeRange;\nvarying float vLeafY;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(0.66, 1.08, smoothstep(uShadeRange.x, uShadeRange.y, vLeafY));`,
      );
  };
  m.customProgramCacheKey = () => 'wind-leaf';
  return m;
}
export const FOL: Record<string, T3.MeshStandardMaterial> = {
  pine: foliage('#3f6b3f'),
  pine2: foliage('#4a7a45'),
  birch: foliage('#8fbf5a', 0.5, 1.3),
  oak: foliage('#4f8a3c', 0.35, 1.15),
  bush: foliage('#4d7d38', 0.0, 0.32),
};
const STARGLOW = mat('#b49cff', { e: '#8a5cff', ei: 0.9 });
// Kruinen en stenen met deuken (een paar varianten, steeds hergebruikt)
const BLOB = [lumpy(gIco(0), 1, 0.28), lumpy(gIco(0), 2, 0.28), lumpy(gIco(0), 3, 0.32)];
const STONE = [lumpy(gDod(), 4, 0.35), lumpy(gDod(), 5, 0.4), lumpy(gIco(0), 6, 0.35)];
const NVAR: Record<string, NodePart[]> = {
  pine: [
    bakePart(gCyl(0.06, 0.07, 6), C.woodd, 0, 0, 0, 1, 0.4, 1),
    bakePart(gCyl(0, 0.42, 7), FOL.pine, 0, 0.28, 0, 1, 0.62, 1),
    bakePart(gCyl(0, 0.32, 7), FOL.pine2, 0, 0.62, 0, 1, 0.55, 1),
  ],
  // Hoge spar met drie lagen takken
  pineTall: [
    bakePart(gCyl(0.05, 0.07, 6), C.woodd, 0, 0, 0, 1, 0.45, 1),
    bakePart(gCyl(0, 0.44, 8), FOL.pine, 0, 0.2, 0, 1, 0.5, 1),
    bakePart(gCyl(0, 0.35, 8), FOL.pine2, 0, 0.48, 0, 1, 0.46, 1),
    bakePart(gCyl(0, 0.25, 7), FOL.pine, 0, 0.76, 0, 1, 0.44, 1),
  ],
  birch: [
    bakePart(gCyl(0.045, 0.055, 6), '#e8e4d8', 0, 0, 0, 1, 0.7, 1),
    bakePart(BLOB[0], FOL.birch, 0, 0.9, 0, 0.3, 0.42, 0.3),
  ],
  // Berk met twee kruinen boven elkaar en een donkere vlek op de stam
  birchPair: [
    bakePart(gCyl(0.04, 0.055, 6), '#e8e4d8', 0, 0, 0, 1, 0.82, 1),
    bakePart(GB, '#3a3630', 0, 0.3, 0, 0.085, 0.05, 0.085),
    bakePart(BLOB[1], FOL.birch, 0.03, 0.78, 0, 0.27, 0.3, 0.27),
    bakePart(BLOB[2], FOL.birch, -0.02, 1.08, 0.02, 0.2, 0.26, 0.2),
  ],
  oak: [
    bakePart(gCyl(0.06, 0.08, 6), '#6e5537', 0, 0, 0, 1, 0.45, 1),
    bakePart(BLOB[0], FOL.oak, 0, 0.78, 0, 0.44, 0.38, 0.44),
    bakePart(BLOB[1], FOL.oak, 0.18, 0.62, 0.1, 0.26, 0.24, 0.26),
  ],
  // Brede eik: een ronde kruin uit vier klompen blad
  oakWide: [
    bakePart(gCyl(0.07, 0.1, 6), '#6e5537', 0, 0, 0, 1, 0.5, 1),
    bakePart(BLOB[2], FOL.oak, 0, 0.82, 0, 0.42, 0.34, 0.42),
    bakePart(BLOB[0], FOL.oak, 0.24, 0.66, 0.06, 0.26, 0.24, 0.26),
    bakePart(BLOB[1], FOL.oak, -0.2, 0.68, 0.14, 0.24, 0.22, 0.24),
    bakePart(BLOB[0], FOL.oak, 0.02, 0.64, -0.24, 0.24, 0.22, 0.24),
  ],
  bush: [
    bakePart(BLOB[0], FOL.bush, 0, 0.14, 0, 0.24, 0.18, 0.24),
    bakePart(BLOB[2], FOL.bush, 0.14, 0.1, 0.08, 0.15, 0.12, 0.15),
    bakePart(gIco(0), '#c43c3c', 0.08, 0.28, 0.06, 0.05, 0.05, 0.05),
    bakePart(gIco(0), '#c43c3c', -0.1, 0.24, 0.02, 0.05, 0.05, 0.05),
    bakePart(gIco(0), '#d4483e', 0.2, 0.2, 0.12, 0.04, 0.04, 0.04),
  ],
  // Rotsblok: een grote steen met twee kleinere ernaast
  rock: [
    bakePart(STONE[0], '#9a9c92', 0, 0.1, 0, 0.3, 0.22, 0.28),
    bakePart(STONE[1], '#8c8e85', 0.24, 0.04, 0.12, 0.13, 0.1, 0.12),
    bakePart(STONE[2], '#a5a69c', -0.18, 0.03, 0.2, 0.09, 0.07, 0.09),
  ],
  coal: [
    bakePart(STONE[0], '#3e4146', 0, 0.1, 0, 0.32, 0.24, 0.3),
    bakePart(STONE[1], '#2a2c30', 0.18, 0.06, 0.12, 0.14, 0.12, 0.14),
    bakePart(STONE[2], '#33363b', -0.2, 0.04, 0.1, 0.1, 0.08, 0.1),
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
    bakePart(STONE[0], k === 'lithium' ? '#d9dcd6' : '#7b7d78', 0, 0.1, 0, 0.3, 0.22, 0.28),
    bakePart(STONE[1], k === 'lithium' ? '#c9ccc6' : '#6c6e69', 0.22, 0.04, 0.14, 0.12, 0.1, 0.12),
    bakePart(gOct(), RES[k].c, 0.05, 0.3, 0, 0.1, 0.18, 0.1),
    bakePart(gOct(), RES[k].c, -0.12, 0.22, 0.08, 0.07, 0.12, 0.07),
    bakePart(gOct(), RES[k].c, 0.16, 0.14, -0.1, 0.05, 0.09, 0.05),
  ];
const NGROUP = new T3.Group();
S3.add(NGROUP);
// Onderdelen die je ver uitgezoomd niet ziet, en die we dan niet tekenen (nummers in NVAR): kleine dingen (bessen,
// steentjes, kleine kristallen) en de stammen van bomen (die vallen weg onder de kruin). Dat scheelt veel driehoekjes.
const HIDDEN_FAR: Record<string, number[]> = {
  bush: [2, 3, 4],
  rock: [1, 2],
  coal: [1, 2],
  pine: [0],
  pineTall: [0],
  birch: [0],
  birchPair: [0, 1],
  oak: [0],
  oakWide: [0],
};
for (const k of ['copper', 'tin', 'iron', 'gold', 'lithium']) HIDDEN_FAR[k] = [1, 3, 4];

// Losse rotsblokken op de bergen: zo zijn de bergen niet glad maar ruw en rotsig.
// Ze staan half in de grond en krijgen bovenop de berg een laagje sneeuw (lichtere kleur).
// (Eenvoudige vormen en geen eigen schaduw: het zijn er veel, en ze moeten licht blijven)
const CRAG_MAX = 4000;
const CRAG_SHAPES = [lumpy(gIco(0), 7, 0.4), lumpy(gIco(0), 8, 0.45), lumpy(gIco(0), 9, 0.35)];
const CRAGS = CRAG_SHAPES.map(geo => {
  const m = new T3.InstancedMesh(geo, mat('#ffffff'), CRAG_MAX);
  m.count = 0;
  m.receiveShadow = true;
  m.castShadow = false;
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(T3.DynamicDrawUsage);
  NGROUP.add(m);
  return m;
});
const SNOWC = new T3.Color('#e6ecf2');
function placeCrags(x0: number, x1: number, y0: number, y1: number, area: Quad) {
  const n = [0, 0, 0],
    // Ver uitgezoomd zie je losse rotsen nauwelijks: dan minder
    few = Math.min(1, 32 / camDist()) * (richTrees ? 1 : 0.5);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (ter[i] !== TER.ROCK || !inQuad(area, x + 0.5, y + 0.5)) continue;
      // Aan de rand van een berg (bij de wand) vaker een uitstekende rots dan bovenop
      const edge =
        ter[i - 1] !== TER.ROCK ||
        ter[i + 1] !== TER.ROCK ||
        ter[i - W] !== TER.ROCK ||
        ter[i + W] !== TER.ROCK;
      if (hash2(x, y, 60) > (edge ? 0.65 : 0.25) * few) continue;
      const kind = (hash2(x, y, 61) * 3) | 0;
      if (n[kind] >= CRAG_MAX) continue;
      const h1 = hash2(x, y, 63),
        h2 = hash2(x, y, 65),
        px = x + 0.2 + h1 * 0.6,
        pz = y + 0.2 + h2 * 0.6,
        gy = groundHeight(px, pz),
        sc = 0.3 + hash2(x, y, 67) * 0.3;
      // Platte, hoekige rotsplaten die half in de berg steken
      _v.set(px, gy - sc * 0.35, pz);
      _q.setFromEuler(_e.set((h2 - 0.5) * 0.7, h1 * TAU, (h1 - 0.5) * 0.6));
      _s.set(sc * 1.4, sc * (0.55 + h2 * 0.35), sc);
      _m4.compose(_v, _q, _s);
      CRAGS[kind].setMatrixAt(n[kind], _m4);
      // Kleur van de berg op die plek, iets donkerder; hoog op de berg met sneeuw
      const g = i * 3,
        tone = 0.78 + h1 * 0.2;
      _c.setRGB((ground[g] / 255) * tone, (ground[g + 1] / 255) * tone, (ground[g + 2] / 255) * tone);
      _c.lerp(SNOWC, Math.min(0.55, Math.max(0, (gy - 3.8) / 1.2)));
      if (!settled(x, y)) _c.multiply(LOCKED);
      CRAGS[kind].setColorAt(n[kind], _c);
      n[kind]++;
    }
  CRAGS.forEach((m, k) => {
    m.count = n[k];
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
}
let NI3: Record<string, T3.InstancedMesh[]> = {};
// Op "laag" alleen de eenvoudige boomvormen en minder rotsblokken: dat scheelt veel driehoekjes
let richTrees = true;
/** Rijke bomen en bergen aan (middel/hoog) of uit (laag); bouwt de bronnen opnieuw op. */
export function setNodeDetail(rich: boolean) {
  if (rich === richTrees) return;
  richTrees = rich;
  drawnArea = null; // bij de volgende controle alles opnieuw neerzetten
}
const nodeVar = (i: number) => {
  const k = NODES[node[i]].k;
  if (k !== 'tree') return k;
  const x = i % W,
    y = (i / W) | 0,
    h = hash2(x, y, 21),
    other = richTrees && hash2(x, y, 22) < 0.45; // ongeveer de helft krijgt de tweede vorm
  if (h < 0.45) return other ? 'pineTall' : 'pine';
  if (h < 0.72) return other ? 'birchPair' : 'birch';
  return other ? 'oakWide' : 'oak';
};
const _m4 = new T3.Matrix4(),
  _q = new T3.Quaternion(),
  _v = new T3.Vector3(),
  _s = new T3.Vector3(),
  _e = new T3.Euler(),
  _c = new T3.Color(),
  LOCKED = new T3.Color(0.5, 0.52, 0.56);
// Alleen bronnen in en rond het beeld worden getekend: op een grote kaart scheelt dat veel.
// Het getekende stuk is het beeld op de grond (de vier hoeken), ruim naar buiten opgerekt. Pas als het beeld
// daar buiten komt (schuiven, zoomen, draaien), zetten we alles opnieuw neer (zie nodesNeedUpdate).
/** Een vierhoek op de kaart: vier hoekpunten [x, y] in tegels, op volgorde rondom. */
type Quad = [number, number][];
let drawnArea: Quad | null = null,
  drawnSize = 0;
// Ver uitgezoomd (zie isFar in camera.ts): geen schaduw van bomen en rotsen, en geen kleine onderdelen
let farLook = false;

/** De vier hoeken van het beeld op de grond, het midden ertussen en de afstand tot de verste hoek. */
function viewOnGround() {
  const quad: Quad = [s2t(0, 0), s2t(VW, 0), s2t(VW, VH), s2t(0, VH)];
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4,
    cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4,
    size = Math.max(...quad.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  return { quad, cx, cy, size };
}
/** Rek een vierhoek op vanuit (cx, cy): elke hoek k keer zo ver weg, plus nog m tegels. */
function stretch(quad: Quad, cx: number, cy: number, k: number, m: number): Quad {
  return quad.map(([x, y]) => {
    const f = k + m / (Math.hypot(x - cx, y - cy) || 1);
    return [cx + (x - cx) * f, cy + (y - cy) * f];
  });
}
/** Ligt punt (x, y) in de vierhoek? Dan ligt het voor elke rand aan dezelfde kant. */
function inQuad(q: Quad, x: number, y: number): boolean {
  let left = false,
    right = false;
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = q[k],
      [bx, by] = q[(k + 1) % 4],
      side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (side > 0) left = true;
    else if (side < 0) right = true;
  }
  return !(left && right);
}
/** Opnieuw neerzetten? Als het beeld buiten het getekende stuk komt, flink kleiner is of ver/dichtbij wisselt. */
export function nodesNeedUpdate(): boolean {
  const area = drawnArea;
  if (!area || isFar() !== farLook) return true;
  const view = viewOnGround();
  if (view.size < drawnSize * 0.5) return true;
  return stretch(view.quad, view.cx, view.cy, 1, 2).some(([x, y]) => !inQuad(area, x, y));
}
function applyNodeLook() {
  for (const v in NI3)
    NI3[v].forEach((m, k) => {
      m.castShadow = !farLook && v !== 'oil' && v !== 'sand';
      m.visible = !(farLook && HIDDEN_FAR[v]?.includes(k));
    });
}

export function rebuildNodes(full?: boolean): void {
  const view = viewOnGround(),
    area = stretch(view.quad, view.cx, view.cy, 1.3, 8),
    xs = area.map(p => p[0]),
    ys = area.map(p => p[1]);
  drawnArea = area;
  drawnSize = view.size;
  const x0 = Math.max(0, Math.floor(Math.min(...xs))),
    x1 = Math.min(W - 1, Math.ceil(Math.max(...xs))),
    y0 = Math.max(0, Math.floor(Math.min(...ys))),
    y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  if (full) {
    for (const k in NI3) for (const m of NI3[k]) NGROUP.remove(m);
    NI3 = {};
    const cnt: Record<string, number> = {};
    for (let i = 0; i < W * H; i++)
      if (node[i]) {
        const v = nodeVar(i);
        cnt[v] = (cnt[v] || 0) + 1;
      }
    for (const v in NVAR) {
      const cap = (cnt[v] || 0) + 200; // ruimte voor nieuwe bronnen (teruggroei, meteorieten)
      NI3[v] = NVAR[v].map(p => {
        const m = new T3.InstancedMesh(p.geo, p.mat, cap);
        m.receiveShadow = true;
        m.count = 0;
        m.instanceMatrix.setUsage(T3.DynamicDrawUsage);
        m.frustumCulled = false;
        NGROUP.add(m);
        return m;
      });
    }
  }
  const n: Record<string, number> = {};
  for (const v in NI3) n[v] = 0;
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * W + xx,
        t = node[i];
      if (!t || bmap[i] || NODES[t].age > G.age) continue;
      if (!inQuad(area, xx + 0.5, yy + 0.5)) continue;
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
      _s.set(sc, sc * (v.startsWith('pine') ? 0.9 + h2 * 0.4 : 1), sc);
      _m4.compose(_v, _q, _s);
      // Elke boom of steen een net iets andere tint, zodat een bos niet uit klonen bestaat
      const lk = !settled(x, y), // wildernis (niet van jou of een rivaal) is donkerder
        tint = 0.86 + h3 * 0.24;
      _c.setRGB(tint * (0.96 + h1 * 0.08), tint * (0.97 + h2 * 0.05), tint * 0.96);
      if (lk) _c.multiply(LOCKED);
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
  farLook = isFar();
  applyNodeLook();
  placeCrags(x0, x1, y0, y1, area);
}
