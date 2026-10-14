import * as THREE from 'three';
import { TAU } from '../core/constants';

// ---- materials & geometry kit ----
/** Material options: e = emissive colour, ei = emissive intensity, m = metalness, r = roughness, t = transparent, o = opacity, b = unlit. */
export interface MatOpts { e?: THREE.ColorRepresentation; ei?: number; m?: number; r?: number; t?: boolean | 1; o?: number; b?: boolean | 1 }
/** A colour (shared standard material) or a ready material. */
export type Paint = string | THREE.Material;
const MC: Record<string, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial> = {};
export function mat(c: THREE.ColorRepresentation, o: MatOpts = {}): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
    const k = c + '|' + (o.e || '') + (o.ei ?? '') + (o.m || '') + (o.r ?? '') + (o.t ? 't' + o.o : '') + (o.b ? 'b' : '');
    if (MC[k])
        return MC[k];
    const m = o.b ? new THREE.MeshBasicMaterial({ color: c, transparent: !!o.t, opacity: o.o ?? 1, depthWrite: !o.t }) : new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: o.r ?? .88, metalness: o.m || 0, emissive: o.e || 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.t, opacity: o.o ?? 1 });
    if (!o.b && !o.t && !o.e && !o.m && o.r == null)
        m.userData.vc = 1;
    return MC[k] = m;
}
const VCMAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .88 });
// merge static same-style parts of a model into one vertex-coloured mesh (far fewer draw calls)
export function mergeStatic(g: THREE.Group): THREE.Group {
    const parts = (g.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]).filter(o => o.isMesh && o.material.userData && o.material.userData.vc && !o.userData.flag && !o.userData.lamp);
    if (parts.length < 2)
        return g;
    let n = 0;
    const gs = parts.map((o): [THREE.BufferGeometry, THREE.Color] => {
        o.updateMatrix();
        const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        q.applyMatrix4(o.matrix);
        n += q.attributes.position.count;
        return [q, o.material.color];
    });
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
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
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    mg.computeVertexNormals();
    mg.computeBoundingSphere();
    for (const o of parts)
        g.remove(o);
    const m = new THREE.Mesh(mg, VCMAT);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return g;
}
export const M_ = (c: Paint): THREE.Material => typeof c === 'string' ? mat(c) : c;
export const WIN = new THREE.MeshStandardMaterial({ color: '#36424c', flatShading: true, roughness: .4, metalness: .2, emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0 });
export const GLOWM = new THREE.MeshStandardMaterial({ color: '#5a2a10', emissive: new THREE.Color('#ff8a2a'), emissiveIntensity: 1.4, flatShading: true });
export const CYANM = new THREE.MeshStandardMaterial({ color: '#123c40', emissive: new THREE.Color('#38e6e8'), emissiveIntensity: 1.2, flatShading: true });
const FIREM = new THREE.MeshBasicMaterial({ color: '#ff9d3a' }), FIREM2 = new THREE.MeshBasicMaterial({ color: '#ffe08a' });
export const TEAM = '#2f6fd6', TEAMD = '#204c96', FOE = '#b8352c';
export const GB = new THREE.BoxGeometry(1, 1, 1);
GB.translate(0, .5, 0);
const GC: Record<string, THREE.BufferGeometry> = {};
export function gCyl(rt: number, rb: number, s: number, th?: number): THREE.BufferGeometry {
    const k = rt + '_' + rb + '_' + s + '_' + (th || 0);
    if (GC[k])
        return GC[k];
    const g = new THREE.CylinderGeometry(rt, rb, 1, s, 1, false, 0, th || TAU);
    g.translate(0, .5, 0);
    return GC[k] = g;
}
export function gIco(d: number): THREE.BufferGeometry {
    const k = 'i' + d;
    if (GC[k])
        return GC[k];
    return GC[k] = new THREE.IcosahedronGeometry(1, d);
}
export function gDod() {
    return GC.dod || (GC.dod = new THREE.DodecahedronGeometry(1, 0));
}
export function gOct() {
    return GC.oct || (GC.oct = new THREE.OctahedronGeometry(1, 0));
}
const GPRISM = (() => {
    type V3 = THREE.Vector3Tuple;
    const g = new THREE.BufferGeometry(), v: number[] = [], P = (x: number, y: number, z: number) => v.push(x, y, z);
    const a: V3 = [-.5, 0, -.5], b: V3 = [-.5, 0, .5], c: V3 = [-.5, 1, 0], d: V3 = [.5, 0, -.5], e: V3 = [.5, 0, .5], f: V3 = [.5, 1, 0];
    const T = (p: V3, q: V3, r: V3) => {
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
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
})();
const GPYR = (() => {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4);
    g.rotateY(Math.PI / 4);
    g.translate(0, .5, 0);
    return g;
})();
export function mk(geo: THREE.BufferGeometry, m: THREE.Material, g: THREE.Object3D, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry?: number): THREE.Mesh {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    if (ry)
        o.rotation.y = ry;
    o.castShadow = true;
    o.receiveShadow = true;
    g.add(o);
    return o;
}
export const bx = (g: THREE.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) => mk(GB, M_(c), g, x, y, z, w, h, d, ry);
export const cy = (g: THREE.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, seg = 10, rt?: number) => mk(gCyl(rt ?? r, r, seg), M_(c), g, x, y, z, 1, h, 1);
export const cn = (g: THREE.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, seg = 10) => mk(gCyl(0, r, seg), M_(c), g, x, y, z, 1, h, 1);
export const sp = (g: THREE.Object3D, r: number, c: Paint, x = 0, y = 0, z = 0, d = 0, sy = 1) => mk(gIco(d), M_(c), g, x, y, z, r, r * sy, r);
export const gr = (g: THREE.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) => mk(GPRISM, M_(c), g, x, y, z, w, h, d, ry);
export const pr = (g: THREE.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) => mk(GPYR, M_(c), g, x, y, z, w, h, d, ry);
// windows on the two camera-facing sides (+z and +x)
export function wins(g: THREE.Object3D, w: number, d: number, y: number, h: number, n: number, cx = 0, cz = 0, wd = .12) {
    for (let i = 0; i < n; i++) {
        const u = -w / 2 + w * (i + .5) / n;
        bx(g, wd, h, .02, WIN, cx + u, y, cz + d / 2 + .005);
        const v = -d / 2 + d * (i + .5) / n;
        bx(g, .02, h, wd, WIN, cx + w / 2 + .005, y, cz + v);
    }
}
export function door(g: THREE.Object3D, _w: number, d: number, dw = .16, dh = .26, c: Paint = '#4a3523', x = 0) {
    bx(g, dw, dh, .03, c, x, 0, d / 2 + .01);
}
export function flagpole(g: THREE.Object3D, x: number, y: number, z: number, h = .7, c: Paint = TEAM) {
    cy(g, .015, h, '#5d5348', x, y, z, 5);
    const f = bx(g, .26, .15, .015, c, x + .13, y + h - .17, z);
    f.userData.flag = 1;
    return f;
}
export function crenel(g: THREE.Object3D, w: number, d: number, y: number, c: Paint, n = 4) {
    for (let i = 0; i < n; i++) {
        const u = -w / 2 + w * (i + .5) / n;
        bx(g, w / n * .5, .12, .08, c, u, y, d / 2 - .04);
        bx(g, w / n * .5, .12, .08, c, u, y, -d / 2 + .04);
        bx(g, .08, .12, w / n * .5, c, w / 2 - .04, y, u);
        bx(g, .08, .12, w / n * .5, c, -w / 2 + .04, y, u);
    }
}
export function chim(g: THREE.Object3D, x: number, y: number, z: number, h = .3, c: Paint = '#7b6a5a') {
    bx(g, .11, h, .11, c, x, y, z);
    bx(g, .14, .04, .14, '#4a403a', x, y + h, z);
}
export function flame(g: THREE.Object3D, x: number, y: number, z: number, s = 1) {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    const a = new THREE.Mesh(gCyl(0, .09 * s, 6), FIREM);
    a.scale.y = .26 * s;
    f.add(a);
    const b = new THREE.Mesh(gCyl(0, .05 * s, 6), FIREM2);
    b.scale.y = .16 * s;
    f.add(b);
    f.userData.fire = 1;
    g.add(f);
    return f;
}
export const C = { wood: '#8a6a44', woodd: '#5f4630', thatch: '#b8955a', stone: '#aaa69b', stoned: '#86837b', plaster: '#e5dbc5', slate: '#566170', tile: '#a5523e', brick: '#a3553f', metal: '#8e979f', dmetal: '#4c5359', concrete: '#b8b9b2', glass: '#6fa7c4', clay: '#c6a479', bronze: '#b9853a', white: '#e9ecee', soil: '#6e5236' };
export const GLASS = new THREE.MeshStandardMaterial({ color: '#7ab3cf', flatShading: true, roughness: .15, metalness: .4, emissive: new THREE.Color('#ffd79a'), emissiveIntensity: 0 });
