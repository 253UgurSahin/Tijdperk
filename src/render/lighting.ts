// Zon, maan, seizoenen en lampen bij nacht.
import * as T3 from 'three';
import { store } from '../core/store';
import { lights } from '../game/caches';
import { G } from '../game/state';
import { season } from '../game/time';
import { camDist } from './camera';
import { GLOWS, glow } from './decals';
import { GLASS, WIN } from './kit';
import { FOL } from './nodes';
import { PL, S3, cam, hemi, sun } from './scene';
import { TMAT } from './terrain';
import { dist } from '../util/math';

const COLD = new T3.Color('#6f86c8'),
  WARM = new T3.Color('#ffb070'),
  DAY = new T3.Color('#fff0d8'),
  SKYD = new T3.Color('#e8f0ff'),
  SKYN = new T3.Color('#38466e'),
  FOGD = new T3.Color('#9fb3a6'),
  FOGN = new T3.Color('#0c1220');
const AUT = { oak: '#c9772f', birch: '#d9a83a' },
  SUMMER = { oak: '#4f8a3c', birch: '#8fbf5a', pine: '#3f6b3f', pine2: '#4a7a45', bush: '#4d7d38' },
  WINTER = { oak: '#8a8f86', birch: '#b5b9ad', pine: '#4d6a5a', pine2: '#5b7868', bush: '#6b7a62' };
export function applySeason() {
  const sn = season().n;
  if (sn === store.seasonSig) return;
  store.seasonSig = sn;
  for (const k in SUMMER)
    FOL[k].color.set(sn === 'Herfst' && AUT[k] ? AUT[k] : sn === 'Winter' ? WINTER[k] : SUMMER[k]);
  TMAT.color.set(
    sn === 'Winter' ? '#e4ecf0' : sn === 'Herfst' ? '#f2e6cc' : sn === 'Zomer' ? '#fff6dc' : '#ffffff',
  );
}
export function lighting(dk: number) {
  const dusk =
    G.clock >= 16.5 && G.clock < 20.5
      ? Math.sin(((G.clock - 16.5) / 4) * Math.PI)
      : G.clock >= 4.5 && G.clock < 7.5
        ? Math.sin(((G.clock - 4.5) / 3) * Math.PI) * 0.8
        : 0;
  sun.color
    .copy(DAY)
    .lerp(WARM, dusk * 0.7)
    .lerp(COLD, dk);
  sun.intensity = 0.95 * (1 - dk) + 0.14 * dk;
  hemi.color.copy(SKYD).lerp(SKYN, dk);
  hemi.intensity = 0.55 * (1 - dk * 0.6) * (G.rain ? 0.85 : 1);
  const fc = FOGD.clone().lerp(FOGN, dk);
  S3.fog.color.copy(fc);
  S3.background.copy(fc);
  WIN.emissiveIntensity = GLASS.emissiveIntensity = dk * 1.3;
  const all = lights.filter(L => dist(L.x, L.y, cam.x, cam.y) < camDist() * 1.2);
  let gi = 0;
  for (const L of all) {
    if (dk < 0.05) break;
    const m = glow(gi++, L.warm);
    m.position.set(L.x, 0.04, L.y);
    m.scale.setScalar(L.r);
    m.material.color.setScalar(dk * (L.warm ? 0.42 : 0.32));
  }
  for (let i = gi; i < GLOWS.length; i++) GLOWS[i].visible = false;
  all.sort((a, b) => dist(a.x, a.y, cam.x, cam.y) - dist(b.x, b.y, cam.x, cam.y));
  PL.forEach((p, i) => {
    const L = all[i];
    if (!L || dk < 0.05) {
      p.intensity = 0;
      return;
    }
    p.position.set(L.x, 1.3, L.y);
    p.distance = L.r * 1.9;
    p.color.set(L.warm ? '#ffa95a' : '#dfe8ff');
    p.intensity = dk * (L.warm ? 0.95 : 1) * (1 + Math.sin(store.TM * 9 + i) * 0.05);
  });
}
