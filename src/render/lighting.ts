// Zon, maan, seizoenen en lampen bij nacht.
import * as T3 from 'three';
import { store } from '../core/store';
import { lights } from '../game/caches';
import { G } from '../game/state';
import { chargeFrac } from '../data/finale';
import { isCharging } from '../game/finale';
import { season } from '../game/time';
import { FAR_DIST, camDist, isFar } from './camera';
import { GLOWS, glow } from './decals';
import { GLASS, WIN } from './kit';
import { FOL } from './nodes';
import { CAM3, PL, R3, S3, cam, hemi, sun } from './scene';
import { TMAT } from './terrain';
import { SNOW_COVER } from './terrainlook';
import { setBloomDarkness } from './post';
import { setScatterSeason } from './scatter';
import { dist } from '../util/math';

const COLD = new T3.Color('#6f86c8'),
  WARM = new T3.Color('#ffb070'),
  DAY = new T3.Color('#fff0d8'),
  SKYD = new T3.Color('#e8f0ff'),
  SKYN = new T3.Color('#38466e'),
  FOGD = new T3.Color('#9fb3a6'),
  FOGN = new T3.Color('#0c1220'),
  FOGDUSK = new T3.Color('#d9a07a');
// Sfeer per tijdperk, heel subtiel: Gouden Eeuw warm, industrie wat heiiger, sterrentijd koeler.
// [zonkleur, mistkleur, hoe sterk (0..1)]
const AGE_MOOD = (
  [
    null,
    null,
    null,
    null,
    ['#ffe0a8', '#b9b394', 0.35],
    ['#f2e8d8', '#a9a69c', 0.5],
    null,
    ['#eef4ff', '#9fb2bc', 0.3],
    ['#e2e4ff', '#9ea4c8', 0.4],
  ] as ([string, string, number] | null)[]
).map((m): [T3.Color, T3.Color, number] | null => m && [new T3.Color(m[0]), new T3.Color(m[1]), m[2]]);
// Zoveel lichtvlekken van lampen op de grond hooguit (de dichtstbijzijnde)
const MAX_GLOWS = 96;
// Hangen de lampen (PL) nu in de scène, en zijn we "ver" voor de lampen? (zie lighting)
let lampsIn = true,
  lampsFar = false;
/**
 * Lampen in of uit de scène halen betekent andere shaders (met of zonder puntlichten). Die van de nacht
 * maken we één keer vooraf klaar, bij het eerste beeldje: anders hapert het spel bij de eerste schemering.
 */
export function precompileNightShaders(): void {
  const hadLamps = lampsIn;
  if (!hadLamps) for (const p of PL) S3.add(p);
  try {
    R3.compile(S3, CAM3);
  } finally {
    if (!hadLamps) for (const p of PL) S3.remove(p);
  }
}
const moodSun = new T3.Color('#ffffff'),
  moodFog = new T3.Color('#9fb3a6'),
  wantSun = new T3.Color(),
  wantFog = new T3.Color(),
  fogNow = new T3.Color();
// Langzaam naar de sfeer van het huidige tijdperk schuiven, zodat een nieuw tijdperk zacht invalt
function updateMood() {
  const m = AGE_MOOD[G.age];
  wantSun.setRGB(1, 1, 1);
  wantFog.copy(FOGD);
  if (m) {
    wantSun.lerp(m[0], m[2]);
    wantFog.lerp(m[1], m[2]);
  }
  moodSun.lerp(wantSun, 0.02);
  moodFog.lerp(wantFog, 0.02);
}
const AUT: Record<string, string> = { oak: '#c9772f', birch: '#d9a83a' },
  SUMMER: Record<string, string> = {
    oak: '#4f8a3c',
    birch: '#8fbf5a',
    pine: '#3f6b3f',
    pine2: '#4a7a45',
    bush: '#4d7d38',
  },
  WINTER: Record<string, string> = {
    oak: '#8a8f86',
    birch: '#b5b9ad',
    pine: '#4d6a5a',
    pine2: '#5b7868',
    bush: '#6b7a62',
  };
export function applySeason() {
  const sn = season().n;
  // Sneeuw op de grond: langzaam erbij in de winter, langzaam weg in de lente
  SNOW_COVER.value += ((sn === 'Winter' ? 1 : 0) - SNOW_COVER.value) * 0.004;
  if (sn === store.seasonSig) return;
  store.seasonSig = sn;
  setScatterSeason(sn);
  for (const k in SUMMER)
    FOL[k].color.set(sn === 'Herfst' && AUT[k] ? AUT[k] : sn === 'Winter' ? WINTER[k] : SUMMER[k]);
  TMAT.color.set(
    sn === 'Winter' ? '#e4ecf0' : sn === 'Herfst' ? '#f2e6cc' : sn === 'Zomer' ? '#fff6dc' : '#ffffff',
  );
}
// Tijdens de finale kleurt de lucht paars, sterker naarmate de sterrenpoort voller is.
// Bij het begin en bij het opengaan is er even een felle lichtflits (store.finaleFlash).
const VIOLET = new T3.Color('#a98bff'),
  VIOLET_FOG = new T3.Color('#4a3a7a');
function finaleSky() {
  if (isCharging()) {
    const k = 0.1 + chargeFrac(G.finale) * 0.3 + Math.sin(store.TM * 1.6) * 0.04;
    hemi.color.lerp(VIOLET, k);
    fogNow.lerp(VIOLET_FOG, k * 0.7);
  }
  const flash = store.finaleFlash ? 1 - (performance.now() - store.finaleFlash) / 1600 : 0;
  if (flash > 0) {
    hemi.intensity += flash * 1.2;
    sun.intensity += flash * 0.6;
  }
}
export function lighting(dk: number) {
  const dusk =
    G.clock >= 16.5 && G.clock < 20.5
      ? Math.sin(((G.clock - 16.5) / 4) * Math.PI)
      : G.clock >= 4.5 && G.clock < 7.5
        ? Math.sin(((G.clock - 4.5) / 3) * Math.PI) * 0.8
        : 0;
  updateMood();
  sun.color
    .copy(DAY)
    .multiply(moodSun)
    .lerp(WARM, dusk * 0.7)
    .lerp(COLD, dk);
  sun.intensity = 0.95 * (1 - dk) + 0.14 * dk;
  hemi.color
    .copy(SKYD)
    .lerp(WARM, dusk * 0.25)
    .lerp(SKYN, dk);
  hemi.intensity = 0.55 * (1 - dk * 0.6) * (G.rain ? 0.85 : 1);
  // Bij zonsopkomst en -ondergang kleurt de nevel aan de horizon warm
  fogNow
    .copy(moodFog)
    .lerp(FOGDUSK, dusk * 0.45)
    .lerp(FOGN, dk);
  finaleSky();
  // (mist en achtergrondkleur zijn gezet in scene.ts)
  S3.fog!.color.copy(fogNow);
  (S3.background as T3.Color).copy(fogNow);
  WIN.emissiveIntensity = GLASS.emissiveIntensity = dk * 1.3;
  setBloomDarkness(dk);
  // Lampen rond het beeld, de dichtstbijzijnde eerst. Elk krijgt een lichtvlek op de grond (hooguit MAX_GLOWS:
  // ver uitgezoomd zijn het er soms heel veel) en de dichtstbijzijnde zes ook echt licht.
  const all = lights.filter(L => dist(L.x, L.y, cam.x, cam.y) < camDist() * 1.2);
  all.sort((a, b) => dist(a.x, a.y, cam.x, cam.y) - dist(b.x, b.y, cam.x, cam.y));
  let gi = 0;
  for (const L of all) {
    if (dk < 0.05 || gi >= MAX_GLOWS) break;
    const m = glow(gi++, L.warm);
    m.position.set(L.x, 0.04, L.y);
    m.scale.setScalar(L.r);
    m.material.color.setScalar(dk * (L.warm ? 0.42 : 0.32));
  }
  for (let i = gi; i < GLOWS.length; i++) GLOWS[i].visible = false;
  // Ver uitgezoomd geen echte lampen: die zouden maar een paar plekjes midden in beeld verlichten,
  // en alle andere lampen niet. De lichtvlekken op de grond zijn dan genoeg.
  const far = isFar();
  // Overdag (en van ver) halen we de lampen helemaal uit de scène: anders rekent de videokaart voor elk
  // pixel zes lampen door die toch uit staan
  // (met wat marge rond de grens van "ver", anders wisselen de lampen steeds heen en weer bij het zoomen)
  if (camDist() > FAR_DIST * 1.15) lampsFar = true;
  else if (camDist() < FAR_DIST * 0.95) lampsFar = false;
  const wantLamps = dk >= 0.05 && !lampsFar;
  if (wantLamps !== lampsIn) {
    lampsIn = wantLamps;
    for (const p of PL)
      if (wantLamps) S3.add(p);
      else S3.remove(p);
  }
  PL.forEach((p, i) => {
    const L = all[i];
    if (!L || dk < 0.05 || far) {
      p.intensity = 0;
      return;
    }
    p.position.set(L.x, 1.3, L.y);
    p.distance = L.r * 1.9;
    p.color.set(L.warm ? '#ffa95a' : '#dfe8ff');
    p.intensity = dk * (L.warm ? 0.95 : 1) * (1 + Math.sin(store.TM * 9 + i) * 0.05);
  });
}
