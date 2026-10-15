// Camera: kijkhoek, verschuiven en zoomen, en scherm ↔ kaart omrekenen.
import * as T3 from 'three';
import { store } from '../core/store';
import { H, W } from '../config';
import { CAM3, S3, VH, VW, cam, sun } from './scene';
import { clamp } from '../util/math';

export const camDist = () => 27 / cam.z;
const PITCH = () => (store.V2 ? 1.5 : 0.9),
  YAW = () => (store.V2 ? 0 : Math.PI / 4);
export function updateCamera() {
  const p = PITCH(),
    y = YAW(),
    d = camDist();
  let tx = cam.x,
    tz = cam.y;
  if (store.shake > 0) {
    tx += (Math.random() - 0.5) * store.shake * 0.6;
    tz += (Math.random() - 0.5) * store.shake * 0.6;
  }
  CAM3.position.set(tx + Math.cos(p) * Math.sin(y) * d, Math.sin(p) * d, tz + Math.cos(p) * Math.cos(y) * d);
  CAM3.lookAt(tx, 0, tz);
  CAM3.updateMatrixWorld();
  const sc = Math.max(14, d * 0.9 * Math.max(1, CAM3.aspect / 1.78)); // schaduw ook op brede schermen
  const sh = sun.shadow.camera;
  sh.left = -sc;
  sh.right = sc;
  sh.top = sc;
  sh.bottom = -sc;
  sh.near = 1;
  sh.far = 220;
  sh.updateProjectionMatrix();
  sun.position.set(cam.x - 28, 46, cam.y + 14);
  sun.target.position.set(cam.x, 0, cam.y);
  sun.target.updateMatrixWorld();
  S3.fog.near = d * 1.15;
  S3.fog.far = d * 2.9;
}
const RAY = new T3.Raycaster(),
  NDC = new T3.Vector2(),
  GP = new T3.Plane(new T3.Vector3(0, 1, 0), 0),
  TV = new T3.Vector3(),
  TV2 = new T3.Vector3();
export function rayAt(sx: number, sy: number) {
  NDC.set((sx / VW) * 2 - 1, -(sy / VH) * 2 + 1);
  RAY.setFromCamera(NDC, CAM3);
  return RAY;
}
export function s2t(sx: number, sy: number): [number, number] {
  const r = rayAt(sx, sy),
    p = r.ray.intersectPlane(GP, TV);
  if (!p) {
    const d = r.ray.direction;
    return [cam.x + d.x * 400, cam.y + d.z * 400];
  }
  return [p.x, p.z];
}
export function s2iso(sx: number, sy: number): [number, number] {
  return [sx, sy];
}
export function proj(x: number, h: number, y: number): [number, number, number] {
  TV2.set(x, h, y).project(CAM3);
  return [((TV2.x + 1) / 2) * VW, ((1 - TV2.y) / 2) * VH, TV2.z];
}
export function t2s(x: number, y: number): [number, number] {
  const p = proj(x, 0, y);
  return [p[0], p[1]];
}
export const pxu = () => VH / (2 * camDist() * Math.tan((CAM3.fov * Math.PI) / 360));
export function centerOn(x: number, y: number, instant?: boolean) {
  if (instant) {
    cam.x = x;
    cam.y = y;
    cam.tx = null;
    return;
  }
  cam.tx = x;
  cam.ty = y;
}
export function clampCam() {
  cam.x = clamp(cam.x, 2, W - 2);
  cam.y = clamp(cam.y, 2, H - 2);
  if (cam.tx != null) {
    cam.tx = clamp(cam.tx, 2, W - 2);
    cam.ty = clamp(cam.ty, 2, H - 2);
  }
}
export function panScreen(dx: number, dy: number) {
  const y = YAW(),
    f = 1 / pxu();
  const rx = Math.cos(y),
    rz = -Math.sin(y),
    fx = -Math.sin(y),
    fz = -Math.cos(y),
    k = store.V2 ? 1 : 1 / Math.sin(PITCH());
  cam.x += (-dx * rx + dy * fx * -k) * f;
  cam.y += (-dx * rz + dy * fz * -k) * f;
  cam.tx = null;
  clampCam();
}
