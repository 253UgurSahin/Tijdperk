import * as THREE from 'three';
import { bus } from '../core/bus';
import { H, W } from '../core/constants';
import { clamp } from '../core/util';
import { CAM3, S3, VH, VW, sun } from './scene';
import { toast } from '../ui/hud';

/** Camera focus in tile coordinates, zoom, and an optional target it glides to. */
export const cam = { x: 64, y: 64, z: 1, tx: null as number | null, ty: null as number | null };
export let V2 = false;
// ---- camera ----
export const camDist = () => 27 / cam.z;
const PITCH = () => V2 ? 1.5 : .9, YAW = () => V2 ? 0 : Math.PI / 4;
export function updateCamera() {
    const p = PITCH(), y = YAW(), d = camDist();
    let tx = cam.x, tz = cam.y;
    if (bus.shake > 0) {
        tx += (Math.random() - .5) * bus.shake * .6;
        tz += (Math.random() - .5) * bus.shake * .6;
    }
    CAM3.position.set(tx + Math.cos(p) * Math.sin(y) * d, Math.sin(p) * d, tz + Math.cos(p) * Math.cos(y) * d);
    CAM3.lookAt(tx, 0, tz);
    CAM3.updateMatrixWorld();
    const sc = Math.max(14, d * .9);
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
    (S3.fog as THREE.Fog).near = d * 1.15;
    (S3.fog as THREE.Fog).far = d * 2.9;
}
const RAY = new THREE.Raycaster(), NDC = new THREE.Vector2(), GP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), TV = new THREE.Vector3(), TV2 = new THREE.Vector3();
export function rayAt(sx: number, sy: number) {
    NDC.set(sx / VW * 2 - 1, -(sy / VH) * 2 + 1);
    RAY.setFromCamera(NDC, CAM3);
    return RAY;
}
export function s2t(sx: number, sy: number): [number, number] {
    const r = rayAt(sx, sy), p = r.ray.intersectPlane(GP, TV);
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
    return [(TV2.x + 1) / 2 * VW, (1 - TV2.y) / 2 * VH, TV2.z];
}
export function t2s(x: number, y: number): [number, number] {
    const p = proj(x, 0, y);
    return [p[0], p[1]];
}
export const pxu = () => VH / (2 * camDist() * Math.tan(CAM3.fov * Math.PI / 360));
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
        cam.ty = clamp(cam.ty!, 2, H - 2);
    }
}
export function panScreen(dx: number, dy: number) {
    const y = YAW(), f = 1 / pxu();
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y), k = V2 ? 1 : 1 / Math.sin(PITCH());
    cam.x += (-dx * rx + dy * fx * k) * f;
    cam.y += (-dx * rz + dy * fz * k) * f;
    cam.tx = null;
    clampCam();
}
export function setZoom(z: number) {
    cam.z = clamp(z, .35, 2.4);
}
export function setView(v2: boolean, quiet?: boolean) {
    V2 = !!v2;
    document.body.classList.toggle('v2', V2);
    try {
        localStorage.setItem('tijdperken-view', V2 ? '2d' : '3d');
    }
    catch (e) {
    }
    if (!quiet)
        toast(V2 ? 'Bovenaanzicht aan.' : 'Schuin aanzicht aan.');
    bus.uiDirty = true;
}
export function setV2(v: boolean) {
    V2 = v;
    return v;
}
