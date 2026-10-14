// Goedkope deeltjes (rook, stof, vonken, vuurvliegjes): alles in twee getekende "stapels" (instancing).
import * as T3 from 'three';
import { gIco } from './kit.js';
import { S3 } from './scene.js';

// Vaste ruimte per laag; als hij vol is, wordt het oudste deeltje overschreven.
const MAX = 700;

// Een basismateriaal met per deeltje een eigen doorzichtigheid (instAlpha).
function fadeMaterial(additive) {
  const m = new T3.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    depthWrite: false,
    blending: additive ? T3.AdditiveBlending : T3.NormalBlending,
  });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float instAlpha;\nvarying float vInstAlpha;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstAlpha = instAlpha;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstAlpha;')
      .replace('vec4( diffuse, opacity )', 'vec4( diffuse, opacity * vInstAlpha )');
  };
  return m;
}

function makeLayer(additive, detail) {
  const mesh = new T3.InstancedMesh(gIco(detail), fadeMaterial(additive), MAX);
  mesh.instanceMatrix.setUsage(T3.DynamicDrawUsage);
  mesh.instanceColor = new T3.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.instanceColor.setUsage(T3.DynamicDrawUsage);
  const alpha = new T3.InstancedBufferAttribute(new Float32Array(MAX), 1);
  alpha.setUsage(T3.DynamicDrawUsage);
  mesh.geometry = mesh.geometry.clone();
  mesh.geometry.setAttribute('instAlpha', alpha);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = additive ? 5 : 4;
  S3.add(mesh);
  // Toestand per deeltje in vaste rijen getallen: zo maken we per beeldje niets nieuws aan
  return {
    mesh,
    alpha,
    next: 0,
    pos: new Float32Array(MAX * 3),
    vel: new Float32Array(MAX * 3),
    col: new Float32Array(MAX * 3),
    life: new Float32Array(MAX),
    max: new Float32Array(MAX),
    size: new Float32Array(MAX * 2),
    a0: new Float32Array(MAX),
    grav: new Float32Array(MAX),
  };
}
const SOFT = makeLayer(false, 1),
  GLOW = makeLayer(true, 0);

/** Laag kiezen: 'soft' (rook, stof) of 'glow' (vuur, vonken, lichtjes). */
export const LAYER = { soft: SOFT, glow: GLOW };

/**
 * Eén deeltje loslaten. Kleur als getal (0xffaa33), grootte groeit van s0 naar s1,
 * doorzichtigheid zakt van a naar 0. grav < 0 laat het vallen, > 0 laat het opstijgen.
 */
export function emit(L, x, y, z, vx, vy, vz, life, s0, s1, color, a = 1, grav = 0) {
  const i = L.next;
  L.next = (i + 1) % MAX;
  L.pos[i * 3] = x;
  L.pos[i * 3 + 1] = y;
  L.pos[i * 3 + 2] = z;
  L.vel[i * 3] = vx;
  L.vel[i * 3 + 1] = vy;
  L.vel[i * 3 + 2] = vz;
  L.col[i * 3] = ((color >> 16) & 255) / 255;
  L.col[i * 3 + 1] = ((color >> 8) & 255) / 255;
  L.col[i * 3 + 2] = (color & 255) / 255;
  L.life[i] = life;
  L.max[i] = life;
  L.size[i * 2] = s0;
  L.size[i * 2 + 1] = s1;
  L.a0[i] = a;
  L.grav[i] = grav;
}

/** Een wolkje van n deeltjes in alle richtingen (stof bij een inslag, vonken bij een treffer). */
export function puff(L, n, x, y, z, speed, up, life, s0, s1, color, a = 1, grav = 0) {
  for (let k = 0; k < n; k++) {
    const ang = Math.random() * 6.283,
      sp = speed * (0.4 + Math.random() * 0.6);
    emit(
      L,
      x,
      y,
      z,
      Math.sin(ang) * sp,
      up * (0.5 + Math.random() * 0.5),
      Math.cos(ang) * sp,
      life * (0.7 + Math.random() * 0.5),
      s0,
      s1,
      color,
      a,
      grav,
    );
  }
}

function stepLayer(L, dt) {
  const m = L.mesh.instanceMatrix.array,
    c = L.mesh.instanceColor.array,
    al = L.alpha.array;
  let n = 0;
  for (let i = 0; i < MAX; i++) {
    if (L.life[i] <= 0) continue;
    L.life[i] -= dt;
    if (L.life[i] <= 0) continue;
    const k = 1 - L.life[i] / L.max[i]; // 0 bij de start, 1 aan het eind
    L.vel[i * 3 + 1] += L.grav[i] * dt;
    // Langzaam afremmen, zodat rook blijft hangen in plaats van weg te schieten
    const drag = 1 - Math.min(1, dt * 1.6);
    L.vel[i * 3] *= drag;
    L.vel[i * 3 + 2] *= drag;
    let y = L.pos[i * 3 + 1] + L.vel[i * 3 + 1] * dt;
    if (y < 0.02 && L.grav[i] < 0) {
      // Vallende deeltjes blijven op de grond liggen
      y = 0.02;
      L.vel[i * 3] = L.vel[i * 3 + 1] = L.vel[i * 3 + 2] = 0;
    }
    L.pos[i * 3] += L.vel[i * 3] * dt;
    L.pos[i * 3 + 1] = y;
    L.pos[i * 3 + 2] += L.vel[i * 3 + 2] * dt;
    const s = L.size[i * 2] + (L.size[i * 2 + 1] - L.size[i * 2]) * k;
    // Matrix zonder draaiing: alleen schaal en plek
    const o = n * 16;
    m[o] = s;
    m[o + 1] = m[o + 2] = m[o + 3] = m[o + 4] = 0;
    m[o + 5] = s;
    m[o + 6] = m[o + 7] = m[o + 8] = m[o + 9] = 0;
    m[o + 10] = s;
    m[o + 11] = 0;
    m[o + 12] = L.pos[i * 3];
    m[o + 13] = y;
    m[o + 14] = L.pos[i * 3 + 2];
    m[o + 15] = 1;
    c[n * 3] = L.col[i * 3];
    c[n * 3 + 1] = L.col[i * 3 + 1];
    c[n * 3 + 2] = L.col[i * 3 + 2];
    // Zacht invloeien en uitdoven
    al[n] = L.a0[i] * Math.min(1, k * 8) * (1 - k);
    n++;
  }
  L.mesh.count = n;
  L.mesh.visible = n > 0;
  if (n) {
    L.mesh.instanceMatrix.needsUpdate = true;
    L.mesh.instanceColor.needsUpdate = true;
    L.alpha.needsUpdate = true;
  }
}

let lastT = 0;
/** Elk beeldje: alle deeltjes een stapje verder. */
export function stepParticles(now) {
  const dt = lastT ? Math.min(0.1, now - lastT) : 0;
  lastT = now;
  stepLayer(SOFT, dt);
  stepLayer(GLOW, dt);
}

/** Alles weg (nieuw spel). */
export function clearParticles() {
  SOFT.life.fill(0);
  GLOW.life.fill(0);
}
