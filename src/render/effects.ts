// Projectielen, explosies en regen.
import type { Fx, Projectile } from '../types';
import * as T3 from 'three';
import { store } from '../core/store';
import { G } from '../game/state';
import { camDist, pxu } from './camera';
import { pool, ringAt } from './decals';
import { GB, gIco, mat } from './kit';
import { S3, cam } from './scene';
import { hash2 } from '../util/random';
import { meteorPosition } from '../game/meteors';
import { smoothPos } from './sync';
import { LAYER, emit, puff } from './particles';
import { season } from '../game/time';

/** Een projectiel zoals het hier getekend wordt: sx, sy = waar het voor het eerst te zien was. */
type DrawnProjectile = Projectile & { sx?: number; sy?: number };
/** Een effect; seen3 = 1 zodra het voor het eerst getekend is (zie firstSight). */
type DrawnFx = Fx & { seen3?: number };

const sphM = () =>
  new T3.Mesh(gIco(0), new T3.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false }));
// Meteoriet: een rode cirkel op de inslagplek en een vuurbal met staart die naar beneden komt
function drawMeteor() {
  const m = G.meteor;
  if (!m) return;
  const pulse = 0.5 + Math.sin(store.TM * 8) * 0.5;
  ringAt(m.x, m.y, 2.6 + pulse * 0.4, '#ff5a3a', 0.5 + pulse * 0.4, 0.07);
  ringAt(m.x, m.y, 1.2, '#ffb27a', 0.6, 0.07);
  const p = meteorPosition();
  if (!p) return;
  const ball = pool('meteor', () => {
    const o = sphM();
    o.material.blending = T3.AdditiveBlending;
    return o;
  });
  ball.material.color.set('#ffd08a');
  ball.material.opacity = 1;
  ball.position.set(p.x, p.h + 0.5, p.y);
  ball.scale.setScalar(0.9);
  // Staart: een rij steeds kleinere, rodere bolletjes langs de baan omhoog
  for (let k = 1; k <= 10; k++) {
    const t = pool('meteortrail', () => {
      const o = sphM();
      o.material.blending = T3.AdditiveBlending;
      return o;
    });
    t.material.color.set(k < 4 ? '#ff9a3a' : '#c8452a');
    t.material.opacity = 0.75 * (1 - k / 11);
    t.position.set(p.x + k * 0.5, p.h + 0.5 + k * 1, p.y - k * 0.5);
    t.scale.setScalar(0.85 - k * 0.06);
  }
}

// Looporder-markeringen: een pijltje dat op de bestemming neerploft, met een uitdijende ring
/** Een markering: plek, wanneer gezet, hoeveel eenheden samen, en of het een aanval is. */
interface Mark {
  x: number;
  y: number;
  t: number;
  n: number;
  foe: boolean;
}
const MARKS: Mark[] = [];
for (let i = 0; i < 6; i++) MARKS.push({ x: 0, y: 0, t: -9, n: 0, foe: false });
const PING = new T3.ConeGeometry(0.12, 0.3, 4).rotateX(Math.PI).translate(0, 0.15, 0);
/** Markering zetten. Meerdere eenheden met hetzelfde bevel krijgen samen één markering (in het midden). */
export function markOrder(x: number, y: number, attack: boolean) {
  const now = store.TM;
  for (const m of MARKS)
    if (now - m.t < 0.15 && Math.hypot(m.x - x, m.y - y) < 3) {
      m.n++;
      m.x += (x - m.x) / m.n;
      m.y += (y - m.y) / m.n;
      return;
    }
  let old = MARKS[0];
  for (const m of MARKS) if (m.t < old.t) old = m;
  old.x = x;
  old.y = y;
  old.t = now;
  old.n = 1;
  old.foe = attack;
}
function drawMarks() {
  for (const m of MARKS) {
    const a = store.TM - m.t;
    if (a > 1.1) continue;
    const col = m.foe ? '#ff6a4a' : '#9fe28a';
    // Twee ringen die uitdijen en vervagen
    ringAt(m.x, m.y, 0.2 + a * 0.9, col, Math.max(0, 0.9 - a * 0.85), 0.05);
    if (a > 0.15) ringAt(m.x, m.y, 0.15 + (a - 0.15) * 0.6, col, Math.max(0, 0.7 - a * 0.7), 0.05);
    const pin = pool('pin', () => {
      const o = new T3.Mesh(
        PING,
        new T3.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false }),
      );
      o.renderOrder = 4;
      return o;
    });
    // Valt naar beneden en stuitert even, daarna krimpt hij weg
    const drop = a < 0.25 ? 1 - a / 0.25 : 0,
      bounce = a >= 0.25 && a < 0.5 ? Math.sin(((a - 0.25) / 0.25) * Math.PI) * 0.12 : 0;
    pin.position.set(m.x, 0.06 + drop * drop * 1.4 + bounce, m.y);
    pin.rotation.y = a * 4;
    pin.scale.setScalar(a > 0.8 ? Math.max(0.01, 1 - (a - 0.8) / 0.3) : 1);
    pin.material.color.set(col);
    pin.material.opacity = 0.95;
  }
}

// Eenmalig als een effect voor het eerst getekend wordt: stof, vonken en lichtflitsen
function firstSight(e: Fx) {
  if (e.type === 'boom') {
    const big = (e.r || 0.5) >= 2;
    // Inslag: een gloeiende flits, rondvliegend puin en een stofwolk die blijft hangen
    emit(LAYER.glow, e.x, 0.3, e.y, 0, 0.3, 0, 0.25, 0.2, big ? 1.8 : 0.5, 0xffd08a, 0.8);
    puff(
      LAYER.glow,
      big ? 18 : 7,
      e.x,
      0.25,
      e.y,
      big ? 5 : 2.5,
      big ? 4 : 2.5,
      0.5,
      0.05,
      0.015,
      0xffb050,
      1,
      -9,
    );
    puff(
      LAYER.soft,
      big ? 26 : 8,
      e.x,
      0.15,
      e.y,
      big ? 3 : 1.2,
      big ? 1.4 : 0.6,
      big ? 3.2 : 1.6,
      big ? 0.25 : 0.1,
      big ? 1.1 : 0.42,
      0x8a7a66,
      0.7,
    );
    puff(
      LAYER.soft,
      big ? 10 : 4,
      e.x,
      0.2,
      e.y,
      big ? 4 : 1.8,
      big ? 3 : 1.8,
      0.7,
      0.04,
      0.03,
      0x4a3e32,
      1,
      -7,
    );
  } else if (e.type === 'beam') {
    emit(LAYER.glow, e.x2, 0.45, e.y2, 0, 0, 0, 0.18, 0.12, 0.3, 0xffffff, 1);
    puff(LAYER.glow, 4, e.x2, 0.45, e.y2, 1.6, 1.4, 0.3, 0.03, 0.01, 0x7ff7ff, 1, -5);
  }
}

const beamM = () => {
  const o = new T3.Mesh(
    GB,
    new T3.MeshBasicMaterial({
      color: '#5ff',
      transparent: true,
      depthWrite: false,
      blending: T3.AdditiveBlending,
    }),
  );
  o.geometry = BEAMG;
  return o;
};
// Balk zonder verschuiving: het midden ligt in het midden (voor lasers)
const BEAMG = new T3.BoxGeometry(1, 1, 1);
const tmpTarget = new T3.Vector3();

/**
 * Splinters (hout, steen, voedsel) die van een dorpeling aan het werk afspringen. Het zijn er vaak honderd of
 * meer tegelijk: daarom allemaal in één keer getekend (één vorm, elk met een eigen plek en kleur). Ver
 * uitgezoomd zijn ze kleiner dan een pixel: dan slaan we ze over.
 */
let chips: T3.InstancedMesh<T3.BufferGeometry, T3.MeshStandardMaterial> | null = null;
const chipM = new T3.Matrix4(),
  chipC = new T3.Color(),
  chipP = new T3.Vector3(),
  chipQ = new T3.Quaternion(),
  chipS = new T3.Vector3(0.06, 0.06, 0.06);
let chipShow = true;
function addChip(x: number, y: number, z: number, col: string) {
  if (!chipShow) return;
  if (!chips || chips.count >= chips.instanceMatrix.count) {
    // Eerste keer, of te weinig plek: een grotere laag (de oude geven we vrij)
    const size = chips ? chips.instanceMatrix.count * 2 : 128;
    if (chips) {
      S3.remove(chips);
      chips.dispose();
    }
    chips = new T3.InstancedMesh(
      GB,
      new T3.MeshStandardMaterial({ flatShading: true, roughness: 0.88 }),
      size,
    );
    // Overal in de wereld: niet als één geheel wegsnijden buiten beeld
    chips.frustumCulled = false;
    chips.count = 0;
    S3.add(chips);
  }
  const i = chips.count++;
  chipM.compose(chipP.set(x, y, z), chipQ, chipS);
  chips.setMatrixAt(i, chipM);
  chips.setColorAt(i, chipC.set(col));
}

export function drawFx() {
  chipShow = pxu() > 20;
  if (chips) chips.count = 0;
  drawMeteor();
  drawMarks();
  for (const p of G.proj as DrawnProjectile[]) {
    const m = pool(p.big ? 'shell' : 'arrow', () =>
      p.big
        ? new T3.Mesh(gIco(0), mat('#2a2a2a'))
        : new T3.Mesh(GB, new T3.MeshBasicMaterial({ color: '#fff3c4' })),
    );
    const [px, py] = smoothPos(p);
    if (p.sx == null) {
      p.sx = px;
      p.sy = py;
    }
    // Hoe ver het projectiel al is (0..1): daarmee tekenen we een boog
    // (sx en sy worden altijd samen gezet, hierboven)
    const total = Math.hypot(p.lx - p.sx, p.ly - p.sy!) || 1,
      f = Math.min(1, Math.max(0, 1 - Math.hypot(p.lx - px, p.ly - py) / total)),
      arc = p.big ? Math.min(2.4, total * 0.28) : G.age < 4 ? Math.min(1.1, total * 0.14) : 0,
      y = 0.6 - f * 0.2 + arc * 4 * f * (1 - f),
      slope = (arc * 4 * (1 - 2 * f) - 0.2) / total;
    m.position.set(px, y, py);
    if (p.big) {
      m.scale.setScalar(0.08);
      // Kanonskogels laten een sliertje rook achter
      emit(LAYER.soft, px, y, py, 0, 0.1, 0, 0.6, 0.04, 0.12, 0xbab4aa, 0.45);
    } else {
      // Pijlen en kogels wijzen in de richting van hun baan
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.atan(slope), Math.atan2(p.lx - px, p.ly - py), 0);
      m.scale.set(0.03, 0.03, arc ? 0.38 : 0.5);
      m.material.color.set(p.col || '#fff3c4');
    }
  }
  for (const e of G.fx as DrawnFx[]) {
    if (!e.seen3) {
      e.seen3 = 1;
      firstSight(e);
    }
    // Hoeveel er nog over is (1 = net begonnen, 0 = voorbij); alleen gebruikt bij effecten met een max
    const k = e.life / (e as { max: number }).max;
    if (e.type === 'smoke') {
      const m = pool('smoke', sphM);
      m.material.color.set(e.col || '#e9ebe4');
      m.material.opacity = k * 0.5;
      m.position.set(e.x, 0.2 + (e.z || 0) / 32, e.y);
      m.scale.setScalar(0.12 + (1 - k) * 0.35);
    } else if (e.type === 'chip') addChip(e.x, (e.z || 0) / 32, e.y, e.col || '#bbb');
    else if (e.type === 'ring') ringAt(e.x, e.y, 0.3 + (1 - k) * 1.2, e.col || '#fff', k * 0.9, 0.06);
    else if (e.type === 'boom') {
      // Vuurbal: groeit snel, kleurt van wit-geel naar oranje en dooft uit
      const m = pool('boom', () => {
        const o = new T3.Mesh(
          gIco(2),
          new T3.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false }),
        );
        o.material.blending = T3.AdditiveBlending;
        return o;
      });
      const kk = Math.min(1, Math.max(0, e.life / (e.max || 0.35))),
        r = (e.r || 0.5) * 0.75;
      m.material.color.setRGB(1, 0.55 + kk * 0.4, 0.2 + kk * 0.5);
      m.material.opacity = kk * kk * 0.85;
      m.position.set(e.x, 0.15, e.y);
      m.scale.set(r * (1 - kk * 0.6), r * (1 - kk * 0.6) * 0.7, r * (1 - kk * 0.6));
    } else if (e.type === 'beam') {
      // Laser: een gekleurde gloed met een witte kern, van de toren naar het doel
      const fade = Math.max(0, e.life / 0.12),
        l = Math.hypot(e.x2 - e.x, e.y2 - e.y) || 1;
      tmpTarget.set(e.x2, 0.45, e.y2);
      for (const [name, w, col, op] of BEAM_LAYERS) {
        const m = pool(name, beamM);
        m.material.color.set(col === 0 ? e.col || '#5ff' : col);
        m.material.opacity = fade * op;
        m.position.set((e.x + e.x2) / 2, (1.1 + 0.45) / 2, (e.y + e.y2) / 2);
        m.lookAt(tmpTarget);
        m.scale.set(w, w, Math.hypot(l, 0.65));
      }
    }
  }
  if (chips) {
    chips.instanceMatrix.needsUpdate = true;
    if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
  }
}
// Twee lagen voor een laserstraal: brede gekleurde gloed en een smalle witte kern.
// Per laag: naam, breedte, kleur (0 = de kleur van de laser zelf) en dekking.
const BEAM_LAYERS: [string, number, string | 0, number][] = [
  ['beam', 0.09, 0, 0.55],
  ['beamcore', 0.03, '#ffffff', 1],
];
let RAIN: T3.LineSegments<T3.BufferGeometry, T3.LineBasicMaterial> | null = null,
  SNOW: T3.Points<T3.BufferGeometry, T3.PointsMaterial> | null = null;
// Sneeuw: in de winter valt er sneeuw in plaats van regen. Losse puntjes die langzaam dwarrelen.
function drawSnow(on: boolean) {
  if (!on) {
    if (SNOW) SNOW.visible = false;
    return;
  }
  if (!SNOW) {
    const n = 1400,
      g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.BufferAttribute(new Float32Array(n * 3), 3));
    SNOW = new T3.Points(
      g,
      new T3.PointsMaterial({
        color: '#ffffff',
        size: 0.09,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    SNOW.frustumCulled = false;
    S3.add(SNOW);
  }
  SNOW.visible = true;
  const p = (SNOW.geometry.attributes.position as T3.BufferAttribute).array as Float32Array,
    R = camDist() * 0.8,
    t = store.TM;
  for (let i = 0; i < p.length / 3; i++) {
    const y = (((hash2(i, 5, 6) * 12 - t * (0.7 + hash2(i, 7, 8) * 0.5)) % 12) + 12) % 12;
    p[i * 3] = cam.x + (hash2(i, 1, 2) - 0.5) * R * 2 + Math.sin(t * 0.8 + i) * 0.3;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = cam.y + (hash2(i, 3, 4) - 0.5) * R * 2 + Math.cos(t * 0.6 + i * 1.3) * 0.3;
  }
  SNOW.geometry.attributes.position.needsUpdate = true;
}

export function drawRain() {
  const snow = !!G.rain && season().n === 'Winter';
  drawSnow(snow);
  if (!G.rain || snow) {
    if (RAIN) RAIN.visible = false;
    return;
  }
  if (!RAIN) {
    const n = 900,
      g = new T3.BufferGeometry(),
      p = new Float32Array(n * 6);
    g.setAttribute('position', new T3.BufferAttribute(p, 3));
    RAIN = new T3.LineSegments(
      g,
      new T3.LineBasicMaterial({ color: '#cfe0ee', transparent: true, opacity: 0.45 }),
    );
    RAIN.frustumCulled = false;
    S3.add(RAIN);
  }
  RAIN.visible = true;
  const p = (RAIN.geometry.attributes.position as T3.BufferAttribute).array as Float32Array,
    R = camDist() * 0.8;
  for (let i = 0; i < p.length / 6; i++) {
    const x = cam.x + (hash2(i, 1, 2) - 0.5) * R * 2,
      z = cam.y + (hash2(i, 3, 4) - 0.5) * R * 2,
      y = (((hash2(i, 5, 6) * 20 - store.TM * 14 * (1 + hash2(i, 7, 8) * 0.3)) % 20) + 20) % 20;
    p[i * 6] = x;
    p[i * 6 + 1] = y;
    p[i * 6 + 2] = z;
    p[i * 6 + 3] = x - 0.08;
    p[i * 6 + 4] = y + 0.5;
    p[i * 6 + 5] = z + 0.08;
  }
  RAIN.geometry.attributes.position.needsUpdate = true;
}
