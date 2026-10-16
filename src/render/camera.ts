// Camera: kijkhoek, verschuiven en zoomen, en scherm ↔ kaart omrekenen.
import * as T3 from 'three';
import { store } from '../core/store';
import { DEFAULT_YAW, viewYaw } from '../core/view';
import { H, TAU, W } from '../config';
import { CAM3, S3, VH, VW, cam, sun } from './scene';
import { clamp } from '../util/math';

export const camDist = () => 27 / cam.z;
/**
 * Hoe ver de camera tot hier altijd hoogstens uitzoomde (zoom 0,35). Nog verder uitgezoomd tekenen we minder
 * details (zie isFar): schaduwen van bomen, kleine dingen en figuurtjes kosten dan veel en zie je nauwelijks.
 */
export const FAR_DIST = 27 / 0.35;
/** Zijn we verder uitgezoomd dan vroeger kon? Dan tekenen we eenvoudiger (minder schaduw, stippen voor figuren). */
export const isFar = () => camDist() > FAR_DIST * 1.05;
// Hoe schuin de camera kijkt (bovenaanzicht bijna recht omlaag) en hoe hij gedraaid staat (zie core/view.ts)
const PITCH = () => (store.V2 ? 1.5 : 0.9),
  YAW = viewYaw;
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
  // Ver uitgezoomd begint het beeld pas een eind voor de camera (near). Anders is de dieptebuffer daar te grof
  // en schemert het water door de oever heen (witte randen om elk meer). Dichtbij blijft het 0,5.
  const near = Math.max(0.5, d * 0.55 - 25);
  // En het beeld houdt op waar de mist alles verbergt: wat daarachter ligt, hoeft niet getekend te worden
  const far = d * 2.9 + 2;
  if (CAM3.near !== near || CAM3.far !== far) {
    CAM3.near = near;
    CAM3.far = far;
    CAM3.updateProjectionMatrix();
  }
  // Schaduw in een vierkant rond het midden van het beeld (ook op brede schermen). Verder uitgezoomd dan
  // vroeger kon, groeit het niet verder mee: zo blijft de schaduw scherp en kost hij niet meer werk.
  const sc = Math.max(14, Math.min(d, FAR_DIST) * 0.9 * Math.max(1, CAM3.aspect / 1.78));
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
  snapShadow(sc);
  const fog = S3.fog as T3.Fog;
  fog.near = d * 1.15;
  fog.far = d * 2.9;
}
/**
 * De schaduwkaart schuift mee met de camera. Schuift hij een halve pixel (van de kaart) op, dan verspringen
 * alle schaduwranden een beetje: dat flikkert bij het verschuiven van het beeld. Daarom zetten we de zon zo
 * dat de kaart altijd met hele pixels opschuift; dan staan de schaduwen stil.
 */
const inLight = new T3.Vector3(),
  shift = new T3.Vector3();
function snapShadow(sc: number) {
  const sh = sun.shadow;
  sun.updateMatrixWorld();
  sh.updateMatrices(sun); // zet de schaduwcamera op zijn plek
  const texel = (2 * sc) / sh.mapSize.x;
  inLight.copy(sun.target.position).applyMatrix4(sh.camera.matrixWorldInverse);
  shift.set(
    Math.round(inLight.x / texel) * texel - inLight.x,
    Math.round(inLight.y / texel) * texel - inLight.y,
    0,
  );
  if (shift.x === 0 && shift.y === 0) return;
  // Terug naar de wereld: de verschuiving ligt in het vlak van de schaduwcamera
  shift.applyQuaternion(sh.camera.quaternion);
  sun.position.add(shift);
  sun.target.position.add(shift);
  sun.target.updateMatrixWorld();
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
    cam.ty = clamp(cam.ty!, 2, H - 2); // ty is altijd samen met tx gezet (zie centerOn)
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

// ---- Draaien (alleen in het 3D-aanzicht) ----

/** Zo snel draait het beeld als je een draaitoets ingedrukt houdt (radialen per seconde). */
export const TURN_SPEED = 1.6;
/** Zo ver draait het beeld per klik op een draaiknop: een achtste rondje. */
export const TURN_STEP = Math.PI / 4;
// Een draaiing tussen 0 en een heel rondje, zodat het getal niet blijft groeien
const wrapYaw = (a: number) => ((a % TAU) + TAU) % TAU;

/**
 * Draai het 3D-beeld meteen om het midden van het scherm. Positief: de wereld draait met de klok mee.
 * In het bovenaanzicht (2D) gebeurt er niets.
 */
export function turnCamera(delta: number) {
  if (store.V2) return;
  store.tyaw = null;
  store.yaw = wrapYaw(store.yaw + delta);
}
/** Draai vloeiend een stuk verder (de draaiknoppen). Telt op bij een draai die nog bezig is. */
export function turnCameraSmooth(delta: number) {
  if (store.V2) return;
  store.tyaw = (store.tyaw ?? store.yaw) + delta;
}
/** Vloeiend terug naar de standaard draaiing, langs de kortste weg. */
export function resetTurn() {
  const now = store.tyaw ?? store.yaw;
  // Het verschil tussen -180° en +180°: zo draait het nooit meer dan een half rondje terug
  const diff = wrapYaw(DEFAULT_YAW - now + Math.PI) - Math.PI;
  store.tyaw = now + diff;
}
/** Elk beeldje: een vloeiende draai een stukje verder. */
export function updateTurn(rdt: number) {
  if (store.tyaw == null) return;
  store.yaw += (store.tyaw - store.yaw) * (1 - Math.pow(0.0005, rdt));
  if (Math.abs(store.tyaw - store.yaw) < 0.001) {
    store.yaw = wrapYaw(store.tyaw);
    store.tyaw = null;
  }
}
