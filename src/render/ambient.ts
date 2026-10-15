// Leven in de wereld: vogels die rondcirkelen, vuurvliegjes 's nachts en vallende bladeren in de herfst.
import * as T3 from 'three';
import { store } from '../core/store';
import { W, H } from '../config';
import { G } from '../game/state';
import { season } from '../game/time';
import { BIOME, biome, node } from '../world/world';
import { camDist } from './camera';
import { LAYER, emit } from './particles';
import { S3, cam } from './scene';

// Vogel: twee vleugels in een V. Door de hoogte steeds om te klappen (schaal y) lijkt hij te fladderen.
const BIRDG = (() => {
  const g = new T3.BufferGeometry();
  const v = [0, 0, 0.12, 0, 0, -0.1, -0.36, 0.1, -0.1, 0, 0, 0.12, 0.36, 0.1, -0.1, 0, 0, -0.1];
  g.setAttribute('position', new T3.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const BIRDM = new T3.MeshBasicMaterial({ color: '#3c3a40', side: T3.DoubleSide });
const FLOCKS = 2,
  PER = 5,
  birds = [];
for (let i = 0; i < FLOCKS * PER; i++) {
  const m = new T3.Mesh(BIRDG, BIRDM);
  m.castShadow = true; // hun schaduw glijdt over de grond
  m.visible = false;
  S3.add(m);
  birds.push(m);
}

function drawBirds(show) {
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    b.visible = show;
    if (!show) continue;
    const f = (i / PER) | 0,
      k = i % PER,
      t = store.TM;
    // Elke zwerm draait langzaam rondjes rond een punt dat zelf ook rondzwerft
    const cx = cam.x + Math.sin(t * 0.031 + f * 3) * 12,
      cz = cam.y + Math.cos(t * 0.023 + f * 2) * 12,
      R = 7 + f * 3 + k * 0.5,
      dir = f ? -1 : 1,
      a = t * (0.22 - f * 0.05) * dir + k * 0.16,
      x = cx + Math.cos(a) * R,
      z = cz + Math.sin(a) * R;
    b.position.set(x, 9 + f * 0.8 + Math.sin(t * 0.7 + k) * 0.3, z);
    // Vliegrichting = raaklijn van de cirkel
    b.rotation.y = Math.atan2(-Math.sin(a) * dir, Math.cos(a) * dir);
    // Klapperen, af en toe even zweven
    const glide = Math.sin(t * 0.5 + i) > 0.4;
    const flap = glide ? 0.4 : Math.sin(t * 13 + i * 1.7);
    b.scale.set(0.55, 0.55 * flap, 0.55);
  }
}

let flyAcc = 0,
  leafAcc = 0,
  lastT = 0;
const SPOT = [0, 0];
// Zoek een willekeurige tegel dicht bij de camera die aan de voorwaarde voldoet
function spotNear(R, ok) {
  for (let k = 0; k < 6; k++) {
    const x = cam.x + (Math.random() - 0.5) * R * 2,
      y = cam.y + (Math.random() - 0.5) * R * 2;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (y | 0) * W + (x | 0);
    if (ok(i)) {
      SPOT[0] = x;
      SPOT[1] = y;
      return SPOT;
    }
  }
  return null;
}
const isGreen = i => biome[i] === BIOME.GRASS || biome[i] === BIOME.FOREST;
const isTree = i => biome[i] === BIOME.FOREST && node[i];

/** Elk beeldje: vogels bijwerken en af en toe een vuurvliegje of blaadje loslaten. */
export function drawAmbient(dk) {
  const dt = lastT ? Math.min(0.1, store.TM - lastT) : 0;
  lastT = store.TM;
  const sn = season().n,
    R = camDist() * 0.7;
  // Vogels alleen als je wat verder uitgezoomd bent; van dichtbij zouden ze voor de camera fladderen
  drawBirds(dk < 0.4 && !G.rain && sn !== 'Winter' && !!biome && camDist() > 16);
  if (!biome) return;
  // Vuurvliegjes: warme nachten, boven gras en bos
  if (dk > 0.45 && sn !== 'Winter' && !G.rain) {
    flyAcc += dt * 30;
    while (flyAcc >= 1) {
      flyAcc--;
      const p = spotNear(R, isGreen);
      if (p)
        emit(
          LAYER.glow,
          p[0],
          0.25 + Math.random() * 0.6,
          p[1],
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.4,
          2.5 + Math.random() * 2,
          0.05,
          0.04,
          Math.random() < 0.5 ? 0xd8ff6a : 0xfff08a,
          0.95,
        );
    }
  }
  // Herfstblaadjes dwarrelen uit de bomen
  if (sn === 'Herfst' && dk < 0.6) {
    leafAcc += dt * 14;
    while (leafAcc >= 1) {
      leafAcc--;
      const p = spotNear(R, isTree);
      if (p)
        emit(
          LAYER.soft,
          p[0],
          1.2 + Math.random() * 0.6,
          p[1],
          0.25 + Math.random() * 0.2,
          -0.25,
          (Math.random() - 0.5) * 0.3,
          5,
          0.05,
          0.045,
          [0xd9822f, 0xe3a63a, 0xb5532a][(Math.random() * 3) | 0],
          0.95,
          -0.08,
        );
    }
  }
}
