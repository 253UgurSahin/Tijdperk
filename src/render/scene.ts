// De 3D-scène (three.js): renderer, licht en camera-instellingen.
import * as T3 from 'three';
import { store } from '../core/store';
import { $ } from '../util/dom';
import { CX, CY } from '../config';
import { resizePost } from './post';

export const cv = $('#cv'),
  ov = $('#ov'),
  octx = ov.getContext('2d'),
  worldEl = $('#world');
export let DPR = 1,
  VW = 1,
  VH = 1;
export const cam = { x: CX, y: CY, z: 1, tx: null, ty: null };
export const scrX = (x: number, y: number): number => (store.V2 ? x : x - y);
const LOWQ = matchMedia('(pointer:coarse)').matches;
export const R3 = new T3.WebGLRenderer({ canvas: cv, antialias: !LOWQ, powerPreference: 'high-performance' });
R3.shadowMap.enabled = true;
R3.shadowMap.type = T3.PCFSoftShadowMap;
export const S3 = new T3.Scene();
export const CAM3 = new T3.PerspectiveCamera(30, 1, 0.5, 900);
const FOGC = new T3.Color('#22302c');
S3.background = FOGC.clone();
S3.fog = new T3.Fog(FOGC.clone(), 60, 160);
export const hemi = new T3.HemisphereLight(0xdfe8f5, 0x3a4628, 0.55);
S3.add(hemi);
export const sun = new T3.DirectionalLight(0xfff0d8, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(LOWQ ? 1024 : 2048, LOWQ ? 1024 : 2048);
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
S3.add(sun);
S3.add(sun.target);
export const PL = [];
for (let i = 0; i < 6; i++) {
  const p = new T3.PointLight(0xffa95a, 0, 8, 2);
  S3.add(p);
  PL.push(p);
}
export function resize() {
  const r = worldEl.getBoundingClientRect();
  DPR = Math.min(LOWQ ? 1.5 : 2, window.devicePixelRatio || 1);
  VW = Math.max(1, r.width);
  VH = Math.max(1, r.height);
  // De 3D-wereld mag op een lagere resolutie draaien (store.resScale, zie quality.js); de HUD blijft scherp
  // Plus een maximum aantal pixels per kwaliteitsstand: op een 5K2K- of 4K-scherm wordt de wereld
  // zo nooit zwaarder dan de videokaart aankan (de HUD blijft altijd scherp)
  const budget = store.pixelBudget || 12e6,
    gl = Math.min(DPR * (store.resScale || 1), Math.sqrt(budget / (VW * VH)));
  R3.setPixelRatio(gl);
  R3.setSize(VW, VH, false);
  resizePost(VW, VH, gl);
  ov.width = Math.round(VW * DPR);
  ov.height = Math.round(VH * DPR);
  CAM3.aspect = VW / VH;
  CAM3.updateProjectionMatrix();
}
addEventListener('resize', resize);
