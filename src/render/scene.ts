import * as THREE from 'three';
import { $ } from '../core/dom';
import { LIGHT } from './setup';

export const cv = $<HTMLCanvasElement>('#cv');
const ov = $<HTMLCanvasElement>('#ov');
export const octx = ov.getContext('2d')!, worldEl = $('#world');
export let DPR = 1, VW = 1, VH = 1, TM = 0;
const LOWQ = matchMedia('(pointer:coarse)').matches;
export const R3 = new THREE.WebGLRenderer({ canvas: cv, antialias: !LOWQ, powerPreference: 'high-performance' });
R3.outputColorSpace = THREE.LinearSRGBColorSpace;
R3.shadowMap.enabled = true;
R3.shadowMap.type = THREE.PCFShadowMap;
export const S3 = new THREE.Scene();
export const CAM3 = new THREE.PerspectiveCamera(30, 1, .5, 900);
const FOGC = new THREE.Color('#22302c');
S3.background = FOGC.clone();
S3.fog = new THREE.Fog(FOGC.clone(), 60, 160);
export const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x3a4628, .55 * LIGHT);
S3.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff0d8, .95 * LIGHT);
sun.castShadow = true;
sun.shadow.mapSize.set(LOWQ ? 1024 : 2048, LOWQ ? 1024 : 2048);
sun.shadow.bias = -.0006;
sun.shadow.normalBias = .02;
S3.add(sun);
S3.add(sun.target);
export const PL: THREE.PointLight[] = [];
for (let i = 0; i < 6; i++) {
    const p = new THREE.PointLight(0xffa95a, 0, 8, 1);
    S3.add(p);
    PL.push(p);
}
/** Dynamic resolution: the 3D view drops to a lower pixel ratio while frames are slow (phones, weak GPUs). */
let glScale = 1, slowT = 0, fastT = 0;
export function adaptResolution(rdt: number) {
    if (rdt > 1 / 36) {
        slowT += rdt;
        fastT = 0;
    }
    else if (rdt < 1 / 52) {
        fastT += rdt;
        slowT = 0;
    }
    else
        slowT = fastT = 0;
    const min = Math.min(1, .75 / DPR);
    const next = slowT > 2 ? Math.max(min, glScale - .125) : fastT > 8 ? Math.min(1, glScale + .125) : glScale;
    if (next !== glScale) {
        glScale = next;
        slowT = fastT = 0;
        R3.setPixelRatio(DPR * glScale);
        R3.setSize(VW, VH, false);
    }
}
export function resize() {
    const r = worldEl.getBoundingClientRect();
    DPR = Math.min(LOWQ ? 1.5 : 2, window.devicePixelRatio || 1);
    VW = Math.max(1, r.width);
    VH = Math.max(1, r.height);
    R3.setPixelRatio(DPR * glScale);
    R3.setSize(VW, VH, false);
    ov.width = Math.round(VW * DPR);
    ov.height = Math.round(VH * DPR);
    CAM3.aspect = VW / VH;
    CAM3.updateProjectionMatrix();
}
addEventListener('resize', resize);
export function setTM(v: number) {
    TM = v;
    return v;
}
