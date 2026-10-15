// Bouwdoos voor 3D-modellen: materialen, kleuren en basisvormen.
import * as T3 from 'three';
import { TAU } from '../config';

/** Materiaal-opties: e = gloeikleur, ei = gloeisterkte, m = metaalachtig, r = ruwheid, t = doorzichtig, o = dekking, b = zonder licht. */
export interface MatOpts {
  e?: T3.ColorRepresentation;
  ei?: number;
  m?: number;
  r?: number;
  t?: boolean | 1;
  o?: number;
  b?: boolean | 1;
}
/** Een kleur (gedeeld standaardmateriaal) of een kant-en-klaar materiaal. */
export type Paint = string | T3.Material;
const MC: Record<string, T3.MeshStandardMaterial | T3.MeshBasicMaterial> = {};
export function mat(
  c: T3.ColorRepresentation,
  o: MatOpts = {},
): T3.MeshStandardMaterial | T3.MeshBasicMaterial {
  const k =
    c +
    '|' +
    (o.e || '') +
    (o.ei ?? '') +
    (o.m || '') +
    (o.r ?? '') +
    (o.t ? 't' + o.o : '') +
    (o.b ? 'b' : '');
  if (MC[k]) return MC[k];
  const m = o.b
    ? new T3.MeshBasicMaterial({ color: c, transparent: !!o.t, opacity: o.o ?? 1, depthWrite: !o.t })
    : new T3.MeshStandardMaterial({
        color: c,
        flatShading: true,
        roughness: o.r ?? 0.88,
        metalness: o.m || 0,
        emissive: o.e || 0,
        emissiveIntensity: o.ei ?? 1,
        transparent: !!o.t,
        opacity: o.o ?? 1,
      });
  if (!o.b && !o.t && !o.e && !o.m && o.r == null) m.userData.vc = 1;
  return (MC[k] = m);
}
/** Is dit 3D-object een mesh (een vorm met een materiaal)? */
export const isMesh = (o: T3.Object3D): o is T3.Mesh => (o as T3.Mesh).isMesh;
/** Een onderdeel van een model met een gewoon materiaal (gemaakt met mat()). */
type SolidMesh = T3.Mesh<T3.BufferGeometry, T3.MeshStandardMaterial>;
// Zachte overgang van 0 naar 1 (zoals smoothstep in een shader)
const smooth01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const VCMAT = new T3.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88 });
// Voeg vaste delen met hetzelfde materiaal samen tot één mesh: veel sneller tekenen.
export function mergeStatic(g: T3.Group): T3.Group {
  const parts = (g.children as SolidMesh[]).filter(
    o => o.isMesh && o.material.userData && o.material.userData.vc && !o.userData.flag && !o.userData.lamp,
  );
  if (parts.length < 2) return g;
  let n = 0;
  const gs = parts.map((o): [T3.BufferGeometry, T3.Color] => {
    o.updateMatrix();
    const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    q.applyMatrix4(o.matrix);
    n += q.attributes.position.count;
    return [q, o.material.color];
  });
  const pos = new Float32Array(n * 3),
    col = new Float32Array(n * 3);
  let k = 0;
  for (const [q, c] of gs) {
    const cnt = q.attributes.position.count,
      p = (q.attributes.position as T3.BufferAttribute).array;
    pos.set(p, k * 3);
    for (let i = 0; i < cnt; i += 3) {
      // Per driehoek: liggende vlakken (vloeren, platen, daken) blijven zoals ze zijn
      const flat =
        Math.abs(p[i * 3 + 1] - p[i * 3 + 4]) < 1e-4 && Math.abs(p[i * 3 + 1] - p[i * 3 + 7]) < 1e-4;
      for (let j = i; j < i + 3 && j < cnt; j++) {
        // Muren worden onderaan wat donkerder, zoals in het echt (minder licht bij de grond)
        const y = p[j * 3 + 1],
          shade = flat ? 1 : 0.7 + 0.3 * smooth01(y / 0.55);
        col[(k + j) * 3] = c.r * shade;
        col[(k + j) * 3 + 1] = c.g * shade;
        col[(k + j) * 3 + 2] = c.b * shade;
      }
    }
    k += cnt;
    q.dispose();
  }
  const mg = new T3.BufferGeometry();
  mg.setAttribute('position', new T3.BufferAttribute(pos, 3));
  mg.setAttribute('color', new T3.BufferAttribute(col, 3));
  mg.computeVertexNormals();
  mg.computeBoundingSphere();
  for (const o of parts) g.remove(o);
  const m = new T3.Mesh(mg, VCMAT);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
  return g;
}
export const M_ = (c: Paint): T3.Material => (typeof c === 'string' ? mat(c) : c);
export const WIN = new T3.MeshStandardMaterial({
  color: '#36424c',
  flatShading: true,
  roughness: 0.4,
  metalness: 0.2,
  emissive: new T3.Color('#ffc46b'),
  emissiveIntensity: 0,
});
export const GLOWM = new T3.MeshStandardMaterial({
  color: '#5a2a10',
  emissive: new T3.Color('#ff8a2a'),
  emissiveIntensity: 1.4,
  flatShading: true,
});
export const CYANM = new T3.MeshStandardMaterial({
  color: '#123c40',
  emissive: new T3.Color('#38e6e8'),
  emissiveIntensity: 1.2,
  flatShading: true,
});
const FIREM = new T3.MeshBasicMaterial({ color: '#ff9d3a' }),
  FIREM2 = new T3.MeshBasicMaterial({ color: '#ffe08a' });
export const TEAM = '#2f6fd6',
  TEAMD = '#204c96',
  FOE = '#b8352c';
// De kleur van vlaggen en banieren op gebouwen. Voor een rivaal zet render/rivals3d.ts hem even op zijn kleur.
export const paint = { team: TEAM };
export const GB = new T3.BoxGeometry(1, 1, 1);
GB.translate(0, 0.5, 0);
const GC: Record<string, T3.BufferGeometry> = {};
export function gCyl(rt: number, rb: number, s: number, th?: number): T3.BufferGeometry {
  const k = rt + '_' + rb + '_' + s + '_' + (th || 0);
  if (GC[k]) return GC[k];
  const g = new T3.CylinderGeometry(rt, rb, 1, s, 1, false, 0, th || TAU);
  g.translate(0, 0.5, 0);
  return (GC[k] = g);
}
export function gIco(d: number): T3.BufferGeometry {
  const k = 'i' + d;
  if (GC[k]) return GC[k];
  return (GC[k] = new T3.IcosahedronGeometry(1, d));
}
export function gDod(): T3.BufferGeometry {
  return GC.dod || (GC.dod = new T3.DodecahedronGeometry(1, 0));
}
export function gOct(): T3.BufferGeometry {
  return GC.oct || (GC.oct = new T3.OctahedronGeometry(1, 0));
}
/** Een hoekpunt in 3D: [x, y, z]. */
type Vec3 = [number, number, number];
const GPRISM = (() => {
  const g = new T3.BufferGeometry(),
    v: number[] = [],
    P = (x: number, y: number, z: number) => v.push(x, y, z);
  const a: Vec3 = [-0.5, 0, -0.5],
    b: Vec3 = [-0.5, 0, 0.5],
    c: Vec3 = [-0.5, 1, 0],
    d: Vec3 = [0.5, 0, -0.5],
    e: Vec3 = [0.5, 0, 0.5],
    f: Vec3 = [0.5, 1, 0];
  const T = (p: Vec3, q: Vec3, r: Vec3) => {
    P(...p);
    P(...q);
    P(...r);
  };
  T(a, b, c);
  T(d, f, e);
  T(b, e, f);
  T(b, f, c);
  T(a, c, f);
  T(a, f, d);
  T(a, d, e);
  T(a, e, b);
  g.setAttribute('position', new T3.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const GPYR = (() => {
  const g = new T3.ConeGeometry(Math.SQRT1_2, 1, 4);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  return g;
})();
export function mk(
  geo: T3.BufferGeometry,
  m: T3.Material,
  g: T3.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  ry?: number,
): T3.Mesh {
  const o = new T3.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  if (ry) o.rotation.y = ry;
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
export const bx = (g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) =>
  mk(GB, M_(c), g, x, y, z, w, h, d, ry);
export const cy = (
  g: T3.Object3D,
  r: number,
  h: number,
  c: Paint,
  x = 0,
  y = 0,
  z = 0,
  seg = 10,
  rt?: number,
) => mk(gCyl(rt ?? r, r, seg), M_(c), g, x, y, z, 1, h, 1);
export function cn(g: T3.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, seg = 10) {
  const cone = mk(gCyl(0, r, seg), M_(c), g, x, y, z, 1, h, 1);
  // Grote kegels zijn daken (hutten, tenten): een paar ringen geven lagen riet of huid
  if (typeof c === 'string' && r >= 0.3 && h >= 0.3) {
    const dark = darker(c);
    for (const t of [0.16, 0.38, 0.6]) {
      const rb = r * (1 - t) * 1.04,
        rt = r * (1 - t - 0.06) * 1.04;
      mk(gCyl(rt, rb, seg), mat(dark), g, x, y + t * h, z, 1, h * 0.06, 1);
    }
  }
  return cone;
}
export const sp = (g: T3.Object3D, r: number, c: Paint, x = 0, y = 0, z = 0, d = 0, sy = 1) =>
  mk(gIco(d), M_(c), g, x, y, z, r, r * sy, r);
export function gr(g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) {
  const roof = mk(GPRISM, M_(c), g, x, y, z, w, h, d, ry);
  if (typeof c === 'string' && h > 0.15 && w * d > 0.15) roofCourses(g, w, h, d, c, x, y, z, ry);
  return roof;
}
// Rijen dakpannen (of lagen riet): dunne latjes evenwijdig aan de nok, op beide dakvlakken.
// Het dak is zo geen glad vlak meer maar heeft reliëf, bij elk gebouw met een zadeldak.
const DARKER: Record<string, string> = {};
const darker = (c: string) => (DARKER[c] ||= '#' + new T3.Color(c).multiplyScalar(0.8).getHexString());
const courseTilt = new T3.Euler(0, 0, 0, 'YXZ');
function roofCourses(
  g: T3.Object3D,
  w: number,
  h: number,
  d: number,
  c: string,
  x: number,
  y: number,
  z: number,
  ry: number,
) {
  const dark = darker(c),
    tilt = Math.atan2(h, d / 2),
    rows = Math.max(2, Math.round(Math.hypot(h, d / 2) / 0.11)),
    cosY = Math.cos(ry),
    sinY = Math.sin(ry);
  for (const side of [1, -1])
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.35) / rows, // van de dakrand (0) naar de nok (1)
        lz = side * (0.5 - t * 0.5) * d,
        ly = t * h,
        o = mk(GB, mat(dark), g, x + sinY * lz, y + ly, z + cosY * lz, w * 1.01, 0.014, 0.035);
      courseTilt.set(side * tilt, ry, 0);
      o.rotation.copy(courseTilt);
    }
}
export const pr = (g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) =>
  mk(GPYR, M_(c), g, x, y, z, w, h, d, ry);
// Ramen op de twee kanten die naar de camera wijzen, met een licht kozijn en een vensterbank
const FRAME = '#e3dccb';
export function wins(
  g: T3.Object3D,
  w: number,
  d: number,
  y: number,
  h: number,
  n: number,
  cx = 0,
  cz = 0,
  wd = 0.12,
) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, wd + 0.035, h + 0.035, 0.012, FRAME, cx + u, y - 0.0175, cz + d / 2 + 0.002);
    bx(g, wd + 0.05, 0.022, 0.035, FRAME, cx + u, y - 0.03, cz + d / 2 + 0.012);
    bx(g, wd, h, 0.02, WIN, cx + u, y, cz + d / 2 + 0.005);
    const v = -d / 2 + (d * (i + 0.5)) / n;
    bx(g, 0.012, h + 0.035, wd + 0.035, FRAME, cx + w / 2 + 0.002, y - 0.0175, cz + v);
    bx(g, 0.035, 0.022, wd + 0.05, FRAME, cx + w / 2 + 0.012, y - 0.03, cz + v);
    bx(g, 0.02, h, wd, WIN, cx + w / 2 + 0.005, y, cz + v);
  }
}
export function door(
  g: T3.Object3D,
  _w: number,
  d: number,
  dw = 0.16,
  dh = 0.26,
  c: Paint = '#4a3523',
  x = 0,
) {
  bx(g, dw, dh, 0.03, c, x, 0, d / 2 + 0.01);
}
export function flagpole(g: T3.Object3D, x: number, y: number, z: number, h = 0.7, c: Paint = paint.team) {
  cy(g, 0.015, h, '#5d5348', x, y, z, 5);
  const f = bx(g, 0.26, 0.15, 0.015, c, x + 0.13, y + h - 0.17, z);
  f.userData.flag = 1;
  return f;
}
export function crenel(g: T3.Object3D, w: number, d: number, y: number, c: Paint, n = 4) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, d / 2 - 0.04);
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, -d / 2 + 0.04);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, w / 2 - 0.04, y, u);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, -w / 2 + 0.04, y, u);
  }
}
export function chim(g: T3.Object3D, x: number, y: number, z: number, h = 0.3, c: Paint = '#7b6a5a') {
  bx(g, 0.11, h, 0.11, c, x, y, z);
  bx(g, 0.14, 0.04, 0.14, '#4a403a', x, y + h, z);
  // Onzichtbaar puntje bovenop: hier komt de rook uit (zie sync.ts)
  const top = new T3.Object3D();
  top.position.set(x, y + h + 0.06, z);
  top.userData.chim = 1;
  g.add(top);
}
export function flame(g: T3.Object3D, x: number, y: number, z: number, s = 1) {
  const f = new T3.Group();
  f.position.set(x, y, z);
  const a = new T3.Mesh(gCyl(0, 0.09 * s, 6), FIREM);
  a.scale.y = 0.26 * s;
  f.add(a);
  const b = new T3.Mesh(gCyl(0, 0.05 * s, 6), FIREM2);
  b.scale.y = 0.16 * s;
  f.add(b);
  f.userData.fire = 1;
  g.add(f);
  return f;
}
export const C = {
  wood: '#8a6a44',
  woodd: '#5f4630',
  thatch: '#b8955a',
  stone: '#aaa69b',
  stoned: '#86837b',
  plaster: '#e5dbc5',
  slate: '#566170',
  tile: '#a5523e',
  brick: '#a3553f',
  metal: '#8e979f',
  dmetal: '#4c5359',
  concrete: '#b8b9b2',
  glass: '#6fa7c4',
  clay: '#c6a479',
  bronze: '#b9853a',
  white: '#e9ecee',
  soil: '#6e5236',
};
export const GLASS = new T3.MeshStandardMaterial({
  color: '#7ab3cf',
  flatShading: true,
  roughness: 0.15,
  metalness: 0.4,
  emissive: new T3.Color('#ffd79a'),
  emissiveIntensity: 0,
});
// Gloeiende materialen voor het Sterrentijdperk: paars sterrenmetaal en roze fusie
export const VIOLETM = new T3.MeshStandardMaterial({
  color: '#2a1f4a',
  emissive: new T3.Color('#8a5cff'),
  emissiveIntensity: 0.9,
  flatShading: true,
});
export const PINKM = new T3.MeshStandardMaterial({
  color: '#4a1238',
  emissive: new T3.Color('#ff4fc0'),
  emissiveIntensity: 1.0,
  flatShading: true,
});
// Torus (ring) met cache, voor poorten, reactoren en koepels
export function gTorus(r: number, t: number, rs = 8, ts = 24) {
  const k = 't' + r + '_' + t + '_' + rs + '_' + ts;
  return GC[k] || (GC[k] = new T3.TorusGeometry(r, t, rs, ts));
}
