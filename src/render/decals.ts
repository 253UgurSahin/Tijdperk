import * as THREE from 'three';
import { S3 } from './scene';

// ---- overlays in the world (decals) ----
function radialTex(c0: string, c1: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, c0);
    g.addColorStop(.6, c0.replace(/[\d.]+\)$/, '0.45)'));
    g.addColorStop(1, c1);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}
const GLOWTEX = radialTex('rgba(255,190,110,1)', 'rgba(255,190,110,0)'), GLOWTEXC = radialTex('rgba(200,225,255,1)', 'rgba(200,225,255,0)');
export const GLOWS: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
export function glow(i: number, warm: boolean) {
    let m = GLOWS[i];
    if (!m) {
        m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: GLOWTEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 2;
        S3.add(m);
        GLOWS[i] = m;
    }
    m.material.map = warm ? GLOWTEX : GLOWTEXC;
    m.visible = true;
    return m;
}
export const RINGG = new THREE.RingGeometry(.86, 1, 40);
RINGG.rotateX(-Math.PI / 2);
/** Objects reused frame to frame; each pool name always holds objects of one kind. */
interface Pool { list: THREE.Object3D[]; n: number; make: () => THREE.Object3D }
const POOLS: Record<string, Pool> = {};
export function pool<T extends THREE.Object3D>(name: string, make: () => T): T {
    const P = POOLS[name] || (POOLS[name] = { list: [], n: 0, make });
    if (P.n >= P.list.length) {
        const o = make();
        S3.add(o);
        P.list.push(o);
    }
    const o = P.list[P.n++] as T;
    o.visible = true;
    return o;
}
export function poolsBegin() {
    for (const k in POOLS)
        POOLS[k].n = 0;
}
export function poolsEnd() {
    for (const k in POOLS) {
        const P = POOLS[k];
        for (let i = P.n; i < P.list.length; i++)
            P.list[i].visible = false;
    }
}
const ringMesh = () => {
    const m = new THREE.Mesh(RINGG, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .9, depthWrite: false }));
    m.renderOrder = 3;
    return m;
};
export const quadG = new THREE.PlaneGeometry(1, 1);
quadG.rotateX(-Math.PI / 2);
const quadMesh = () => {
    const m = new THREE.Mesh(quadG, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .4, depthWrite: false }));
    m.renderOrder = 2;
    return m;
};
export function ringAt(x: number, y: number, r: number, col: string, op = .9, h = .04) {
    const m = pool('ring', ringMesh);
    m.position.set(x, h, y);
    m.scale.set(r, 1, r);
    m.material.color.set(col);
    m.material.opacity = op;
    return m;
}
export function quadAt(x: number, y: number, w: number, d: number, col: string, op = .4, h = .03) {
    const m = pool('quad', quadMesh);
    m.position.set(x, h, y);
    m.scale.set(w, 1, d);
    m.material.color.set(col);
    m.material.opacity = op;
    return m;
}
// thin range circle
const RANGEG = new THREE.RingGeometry(.985, 1, 72);
RANGEG.rotateX(-Math.PI / 2);
export function rangeAt(x: number, y: number, r: number, col: string) {
    const m = pool('range', () => {
        const o = new THREE.Mesh(RANGEG, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: .6, depthWrite: false }));
        o.renderOrder = 3;
        return o;
    });
    m.position.set(x, .05, y);
    m.scale.set(r, 1, r);
    m.material.color.set(col);
    return m;
}
