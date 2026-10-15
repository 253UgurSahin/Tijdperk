// Projectielen, explosies en regen.
import * as T3 from 'three';
import { store } from '../core/store';
import { G } from '../game/state';
import { camDist } from './camera';
import { pool, ringAt } from './decals';
import { GB, gIco, mat } from './kit';
import { S3, cam } from './scene';
import { hash2 } from '../util/random';
import { meteorPosition } from '../game/meteors';
import { smoothPos } from './sync';

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

export function drawFx() {
  drawMeteor();
  for (const p of G.proj) {
    const m = pool(p.big ? 'shell' : 'arrow', () =>
      p.big
        ? new T3.Mesh(gIco(0), mat('#2a2a2a'))
        : new T3.Mesh(GB, new T3.MeshBasicMaterial({ color: '#fff3c4' })),
    );
    const [px, py] = smoothPos(p),
      dx = p.lx - px,
      dy = p.ly - py;
    m.position.set(px, 0.55, py);
    if (p.big) m.scale.setScalar(0.08);
    else {
      m.scale.set(0.03, 0.03, 0.38);
      m.rotation.set(0, Math.atan2(dx, dy), 0);
      m.material.color.set(p.col || '#fff3c4');
    }
  }
  for (const e of G.fx) {
    const k = e.life / e.max;
    if (e.type === 'smoke') {
      const m = pool('smoke', sphM);
      m.material.color.set(e.col || '#e9ebe4');
      m.material.opacity = k * 0.5;
      m.position.set(e.x, 0.2 + (e.z || 0) / 32, e.y);
      m.scale.setScalar(0.12 + (1 - k) * 0.35);
    } else if (e.type === 'chip') {
      const m = pool('chip', () => new T3.Mesh(GB, mat('#fff')));
      m.material = mat(e.col || '#bbb');
      m.position.set(e.x, (e.z || 0) / 32, e.y);
      m.scale.setScalar(0.06);
    } else if (e.type === 'ring') ringAt(e.x, e.y, 0.3 + (1 - k) * 1.2, e.col || '#fff', k * 0.9, 0.06);
    else if (e.type === 'boom') {
      const m = pool('boom', () => {
        const o = sphM();
        o.material.blending = T3.AdditiveBlending;
        return o;
      });
      m.material.color.set('#ffaa46');
      const kk = Math.max(0, e.life / 0.35);
      m.material.opacity = kk * 0.7;
      m.position.set(e.x, 0.3, e.y);
      m.scale.setScalar((e.r || 0.5) * (1.3 - kk * 0.6));
    } else if (e.type === 'beam') {
      const m = pool(
        'beam',
        () =>
          new T3.Mesh(GB, new T3.MeshBasicMaterial({ color: '#5ff', transparent: true, depthWrite: false })),
      );
      const dx = e.x2 - e.x,
        dy = e.y2 - e.y,
        l = Math.hypot(dx, dy) || 1;
      m.material.color.set(e.col || '#5ff');
      m.material.opacity = Math.max(0, e.life / 0.12);
      m.position.set(e.x, 0.9, e.y);
      m.scale.set(0.05, 0.05, l);
      m.rotation.set(0, Math.atan2(dx, dy), 0);
      m.geometry = GB;
      m.position.set((e.x + e.x2) / 2, 0.7, (e.y + e.y2) / 2);
      m.translateZ(-l / 2);
    }
  }
}
let RAIN = null;
export function drawRain() {
  if (!G.rain) {
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
  const p = RAIN.geometry.attributes.position.array,
    R = camDist() * 0.8;
  for (let i = 0; i < p.length / 6; i++) {
    const x = cam.x + (hash2(i, 1, 2) - 0.5) * R * 2,
      z = cam.y + (hash2(i, 3, 4) - 0.5) * R * 2,
      y = (((hash2(i, 5, 6) * 20 - store.TM * 14 * (1 + hash2(i, 7, 8) * 0.3)) % 20) + 20) % 20;
    p.set([x, y, z, x - 0.08, y + 0.5, z + 0.08], i * 6);
  }
  RAIN.geometry.attributes.position.needsUpdate = true;
}
