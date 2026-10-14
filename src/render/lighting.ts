import * as THREE from 'three';
import { dist } from '../core/util';
import { cam, camDist } from './camera';
import { GLOWS, glow } from './decals';
import { GLASS, WIN } from './kit';
import { FOL } from './nodes';
import { PL, S3, TM, hemi, sun } from './scene';
import { LIGHT } from './setup';
import { seasonSig, setSeasonSig } from './sync';
import { TMAT } from './terrain';
import { lights } from '../sim/caches';
import { G } from '../sim/state';
import { season } from '../sim/time';

// ---- lighting / time of day ----
const COLD = new THREE.Color('#6f86c8'), WARM = new THREE.Color('#ffb070'), DAY = new THREE.Color('#fff0d8'), SKYD = new THREE.Color('#e8f0ff'), SKYN = new THREE.Color('#38466e'), FOGD = new THREE.Color('#9fb3a6'), FOGN = new THREE.Color('#0c1220');
const AUT: Record<string, string> = { oak: '#c9772f', birch: '#d9a83a' }, SUMMER: Record<string, string> = { oak: '#4f8a3c', birch: '#8fbf5a', pine: '#3f6b3f', pine2: '#4a7a45', bush: '#4d7d38' }, WINTER: Record<string, string> = { oak: '#8a8f86', birch: '#b5b9ad', pine: '#4d6a5a', pine2: '#5b7868', bush: '#6b7a62' };
export function applySeason() {
    const sn = season().n;
    if (sn === seasonSig)
        return;
    setSeasonSig(sn);
    for (const k in SUMMER)
        FOL[k].color.set(sn === 'Herfst' && AUT[k] ? AUT[k] : sn === 'Winter' ? WINTER[k] : SUMMER[k]);
    TMAT.color.set(sn === 'Winter' ? '#e4ecf0' : sn === 'Herfst' ? '#f2e6cc' : sn === 'Zomer' ? '#fff6dc' : '#ffffff');
}
export function lighting(dk: number) {
    const dusk = G.clock >= 16.5 && G.clock < 20.5 ? Math.sin((G.clock - 16.5) / 4 * Math.PI) : G.clock >= 4.5 && G.clock < 7.5 ? Math.sin((G.clock - 4.5) / 3 * Math.PI) * .8 : 0;
    sun.color.copy(DAY).lerp(WARM, dusk * .7).lerp(COLD, dk);
    sun.intensity = (.95 * (1 - dk) + .14 * dk) * LIGHT;
    hemi.color.copy(SKYD).lerp(SKYN, dk);
    hemi.intensity = .55 * (1 - dk * .6) * (G.rain ? .85 : 1) * LIGHT;
    const fc = FOGD.clone().lerp(FOGN, dk);
    S3.fog!.color.copy(fc);
    (S3.background as THREE.Color).copy(fc);
    WIN.emissiveIntensity = GLASS.emissiveIntensity = dk * 1.3;
    const all = lights.filter(L => dist(L.x, L.y, cam.x, cam.y) < camDist() * 1.2);
    let gi = 0;
    for (const L of all) {
        if (dk < .05)
            break;
        const m = glow(gi++, L.warm);
        m.position.set(L.x, .04, L.y);
        m.scale.setScalar(L.r * 1.05);
        m.material.opacity = dk * (L.warm ? .5 : .35);
    }
    for (let i = gi; i < GLOWS.length; i++)
        GLOWS[i].visible = false;
    all.sort((a, b) => dist(a.x, a.y, cam.x, cam.y) - dist(b.x, b.y, cam.x, cam.y));
    PL.forEach((p, i) => {
        const L = all[i];
        if (!L || dk < .05) {
            p.intensity = 0;
            return;
        }
        p.position.set(L.x, 1.3, L.y);
        p.distance = L.r * 1.9;
        p.color.set(L.warm ? '#ffa95a' : '#dfe8ff');
        p.intensity = dk * (L.warm ? 1.6 : 1.2) * (1 + Math.sin(TM * 9 + i) * .05) * LIGHT;
    });
}
