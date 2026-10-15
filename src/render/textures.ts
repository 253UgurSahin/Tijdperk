// Zelfgemaakte textuur met fijne details (grassprieten, korrels, steentjes, rotsbarsten),
// die over de grond en het water herhaald wordt. Zo is er van dichtbij meer te zien dan
// de kleur per tegel.
import * as T3 from 'three';
import { hash2 } from '../util/random';

const SIZE = 256;

// Ruis die naadloos herhaalt: het rooster loopt rond na 'period' cellen
function tileNoise(x, y, period, seed) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const at = (i, j) => hash2(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const a = at(xi, yi),
    b = at(xi + 1, yi),
    c = at(xi, yi + 1),
    d = at(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Een paar lagen ruis op elkaar (grof + fijn), ook naadloos
function tileFbm(px, py, period, seed, octaves = 3) {
  let total = 0,
    amp = 0.5,
    sum = 0;
  for (let o = 0; o < octaves; o++) {
    const p = period << o;
    total += tileNoise((px / SIZE) * p, (py / SIZE) * p, p, seed + o * 17) * amp;
    sum += amp;
    amp *= 0.5;
  }
  return total / sum;
}

// Puntje zetten met omloop aan de randen, zodat de textuur naadloos blijft
const wrap = v => ((v % SIZE) + SIZE) % SIZE;
function blend(ch, x, y, value, k) {
  const i = wrap(Math.round(y)) * SIZE + wrap(Math.round(x));
  ch[i] += (value - ch[i]) * k;
}

function grassChannel(rand) {
  const ch = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) ch[y * SIZE + x] = 0.38 + tileFbm(x, y, 8, 11) * 0.24;
  // Korte sprietjes in alle richtingen: van bovenaf lijkt gras op lichte en donkere streepjes
  for (let k = 0; k < 3400; k++) {
    const x = rand() * SIZE,
      y = rand() * SIZE,
      a = rand() * Math.PI * 2,
      len = 2 + rand() * 5,
      light = rand() < 0.55,
      value = light ? 0.7 + rand() * 0.25 : 0.12 + rand() * 0.18;
    for (let s = 0; s <= len; s++) blend(ch, x + Math.cos(a) * s, y + Math.sin(a) * s, value, 0.55);
  }
  return ch;
}

function soilChannel(rand) {
  const ch = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      ch[y * SIZE + x] = 0.4 + tileFbm(x, y, 16, 23) * 0.2 + (hash2(x, y, 29) - 0.5) * 0.14;
  // Steentjes: donkere rand, lichte bovenkant (de zon staat linksboven)
  for (let k = 0; k < 260; k++) {
    const cx = rand() * SIZE,
      cy = rand() * SIZE,
      r = 0.8 + rand() * 1.8;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1.25) continue;
        const value = d > 0.85 ? 0.2 : 0.62 + (-dx - dy) * 0.05;
        blend(ch, cx + dx, cy + dy, value, 0.8);
      }
  }
  return ch;
}

// Rots: "geribbelde" ruis geeft onregelmatige aders en barsten, zoals in echte steen
function rockChannel() {
  const ch = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let ridges = 0,
        amp = 0.5,
        sum = 0;
      for (let o = 0; o < 4; o++) {
        const p = 4 << o,
          n = tileNoise((x / SIZE) * p, (y / SIZE) * p, p, 41 + o * 13);
        ridges += (1 - Math.abs(n * 2 - 1)) * amp;
        sum += amp;
        amp *= 0.5;
      }
      const r = ridges / sum;
      ch[y * SIZE + x] = 0.3 + (1 - Math.pow(r, 3)) * 0.4 + tileFbm(x, y, 8, 47) * 0.15;
    }
  return ch;
}

/** RGBA-textuur: r = gras, g = aarde/zand, b = rots, a = grove vlekken (voor kleurverschil). */
export function makeDetailTexture() {
  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const r = grassChannel(rand),
    g = soilChannel(rand),
    b = rockChannel(),
    data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE,
      y = (i / SIZE) | 0;
    data[i * 4] = Math.max(0, Math.min(255, r[i] * 255));
    data[i * 4 + 1] = Math.max(0, Math.min(255, g[i] * 255));
    data[i * 4 + 2] = Math.max(0, Math.min(255, b[i] * 255));
    data[i * 4 + 3] = tileFbm(x, y, 3, 57, 3) * 255;
  }
  const tex = new T3.DataTexture(data, SIZE, SIZE, T3.RGBAFormat);
  tex.wrapS = tex.wrapT = T3.RepeatWrapping;
  tex.magFilter = T3.LinearFilter;
  tex.minFilter = T3.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export const DETAIL = makeDetailTexture();
