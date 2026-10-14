// Bouwdoos voor 3D-modellen: materialen, kleuren en basisvormen.
import * as T3 from 'three';
import { TAU } from '../config.js';

const MC = {};
export function mat(c, o = {}) {
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
const VCMAT = new T3.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88 });
// Voeg vaste delen met hetzelfde materiaal samen tot één mesh: veel sneller tekenen.
export function mergeStatic(g) {
  const parts = g.children.filter(
    o => o.isMesh && o.material.userData && o.material.userData.vc && !o.userData.flag && !o.userData.lamp,
  );
  if (parts.length < 2) return g;
  let n = 0;
  const gs = parts.map(o => {
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
    const cnt = q.attributes.position.count;
    pos.set(q.attributes.position.array, k * 3);
    for (let i = 0; i < cnt; i++) {
      col[(k + i) * 3] = c.r;
      col[(k + i) * 3 + 1] = c.g;
      col[(k + i) * 3 + 2] = c.b;
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
export const M_ = c => (typeof c === 'string' ? mat(c) : c);
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
export const GB = new T3.BoxGeometry(1, 1, 1);
GB.translate(0, 0.5, 0);
const GC = {};
export function gCyl(rt, rb, s, th) {
  const k = rt + '_' + rb + '_' + s + '_' + (th || 0);
  if (GC[k]) return GC[k];
  const g = new T3.CylinderGeometry(rt, rb, 1, s, 1, false, 0, th || TAU);
  g.translate(0, 0.5, 0);
  return (GC[k] = g);
}
export function gIco(d) {
  const k = 'i' + d;
  if (GC[k]) return GC[k];
  return (GC[k] = new T3.IcosahedronGeometry(1, d));
}
export function gDod() {
  return GC.dod || (GC.dod = new T3.DodecahedronGeometry(1, 0));
}
export function gOct() {
  return GC.oct || (GC.oct = new T3.OctahedronGeometry(1, 0));
}
const GPRISM = (() => {
  const g = new T3.BufferGeometry(),
    v = [],
    P = (x, y, z) => v.push(x, y, z);
  const a = [-0.5, 0, -0.5],
    b = [-0.5, 0, 0.5],
    c = [-0.5, 1, 0],
    d = [0.5, 0, -0.5],
    e = [0.5, 0, 0.5],
    f = [0.5, 1, 0];
  const T = (p, q, r) => {
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
export function mk(geo, m, g, x, y, z, sx, sy, sz, ry) {
  const o = new T3.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  if (ry) o.rotation.y = ry;
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
export const bx = (g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) => mk(GB, M_(c), g, x, y, z, w, h, d, ry);
export const cy = (g, r, h, c, x = 0, y = 0, z = 0, seg = 10, rt) =>
  mk(gCyl(rt ?? r, r, seg), M_(c), g, x, y, z, 1, h, 1);
export const cn = (g, r, h, c, x = 0, y = 0, z = 0, seg = 10) =>
  mk(gCyl(0, r, seg), M_(c), g, x, y, z, 1, h, 1);
export const sp = (g, r, c, x = 0, y = 0, z = 0, d = 0, sy = 1) =>
  mk(gIco(d), M_(c), g, x, y, z, r, r * sy, r);
export const gr = (g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) => mk(GPRISM, M_(c), g, x, y, z, w, h, d, ry);
export const pr = (g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) => mk(GPYR, M_(c), g, x, y, z, w, h, d, ry);
// Ramen op de twee kanten die naar de camera wijzen
export function wins(g, w, d, y, h, n, cx = 0, cz = 0, wd = 0.12) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, wd, h, 0.02, WIN, cx + u, y, cz + d / 2 + 0.005);
    const v = -d / 2 + (d * (i + 0.5)) / n;
    bx(g, 0.02, h, wd, WIN, cx + w / 2 + 0.005, y, cz + v);
  }
}
export function door(g, w, d, dw = 0.16, dh = 0.26, c = '#4a3523', x = 0) {
  bx(g, dw, dh, 0.03, c, x, 0, d / 2 + 0.01);
}
export function flagpole(g, x, y, z, h = 0.7, c = TEAM) {
  cy(g, 0.015, h, '#5d5348', x, y, z, 5);
  const f = bx(g, 0.26, 0.15, 0.015, c, x + 0.13, y + h - 0.17, z);
  f.userData.flag = 1;
  return f;
}
export function crenel(g, w, d, y, c, n = 4) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, d / 2 - 0.04);
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, -d / 2 + 0.04);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, w / 2 - 0.04, y, u);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, -w / 2 + 0.04, y, u);
  }
}
export function chim(g, x, y, z, h = 0.3, c = '#7b6a5a') {
  bx(g, 0.11, h, 0.11, c, x, y, z);
  bx(g, 0.14, 0.04, 0.14, '#4a403a', x, y + h, z);
  // Onzichtbaar puntje bovenop: hier komt de rook uit (zie sync.js)
  const top = new T3.Object3D();
  top.position.set(x, y + h + 0.06, z);
  top.userData.chim = 1;
  g.add(top);
}
export function flame(g, x, y, z, s = 1) {
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
export function gTorus(r, t, rs = 8, ts = 24) {
  const k = 't' + r + '_' + t + '_' + rs + '_' + ts;
  return GC[k] || (GC[k] = new T3.TorusGeometry(r, t, rs, ts));
}
