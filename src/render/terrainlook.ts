// Hoe de grond eruitziet: fijne details (gras, korrels, steentjes), rotswanden en sneeuw op de
// bergen, natte oevers en zachte schaduw rond gebouwen en onder bomen. Dit gebeurt in de
// videokaart, bovenop de kleur per tegel uit terrain.ts.
import type { Building } from '../types';
import * as T3 from 'three';
import { H, W, onMapSize } from '../config';
import { NODES } from '../data/nodes';
import { B } from '../data/buildings';
import { G } from '../game/state';
import { DETAIL } from './textures';
import { R3 } from './scene';
import { WMAT } from './water';
import { bmap, node } from '../world/world';

// Schaduwkaart rond gebouwen en bomen: 2 vakjes per tegel, zodat de rand zacht maar smal blijft.
// Eén byte per vakje (grijswaarde): klein om naar de videokaart te sturen.
const SH = 2;
let SW = W * SH,
  SHH = H * SH,
  shadeData = new Uint8Array(SW * SHH);
function makeShade(): T3.DataTexture {
  const t = new T3.DataTexture(
    shadeData,
    SW,
    SHH,
    R3.capabilities.isWebGL2 ? T3.RedFormat : T3.LuminanceFormat, // (oudere browsers kennen geen 'rood')
  );
  t.magFilter = T3.LinearFilter;
  t.minFilter = T3.LinearFilter;
  t.needsUpdate = true;
  return t;
}
// De schaduwkaart en de kaartmaat voor de shader. Eén gedeeld object: bij een andere kaartgrootte
// krijgt de shader zo meteen de nieuwe schaduwkaart en maat.
const SHADE = { value: makeShade() },
  MAP_SIZE = { value: new T3.Vector2(W, H) };

// Hoe donker het rond een bron wordt (bomen het meest, olie en zand niet)
const NODE_SHADE: Record<string, number> = {
  tree: 0.42,
  bush: 0.25,
  rock: 0.3,
  starmetal: 0.3,
  oil: 0,
  sand: 0,
};
// Werkgeheugen met een rand van één vakje rondom: dan hoeven we bij de buren niet te controleren
// of we buiten de kaart vallen (dat maakt het een stuk sneller). Het blijft bewaard: na een gekapte boom
// hoeft zo alleen dat stukje opnieuw (zie shadeChanged).
let RW = SW + 2,
  raw = new Float32Array(RW * (SHH + 2));
let shadeTime = -9;
// Welk stuk van de schaduwkaart opnieuw moet, in tegels: van (x0, y0) tot en met (x1, y1). Leeg als x1 < x0.
const todo = { x0: 0, y0: 0, x1: -1, y1: -1 };
// Een andere kaartgrootte: schaduwkaart en werkgeheugen opnieuw op maat
onMapSize(() => {
  SW = W * SH;
  SHH = H * SH;
  shadeData = new Uint8Array(SW * SHH);
  SHADE.value.dispose();
  SHADE.value = makeShade();
  MAP_SIZE.value.set(W, H);
  RW = SW + 2;
  raw = new Float32Array(RW * (SHH + 2));
  shadeTime = -9;
  shadeAll(); // bij het volgende beeldje alles opnieuw uitrekenen
});
// Telt op als er gebouwd, gekapt, een weg gelegd of gebied gekocht is (zie sync.ts).
// Dan moet het strooisel (scatter.ts) opnieuw; bij alleen de camera verschuiven niet.
// (De schaduwkaart houdt zelf bij welk stuk opnieuw moet: zie shadeChanged.)
export let groundVersion = 0;
export function groundChanged() {
  groundVersion++;
}
/** Reken de schaduw van de tegels (x0, y0) tot en met (x1, y1) opnieuw uit: daar is gebouwd, gekapt of gesloopt. */
export function shadeChanged(x0: number, y0: number, x1 = x0, y1 = y0): void {
  const empty = todo.x1 < todo.x0;
  todo.x0 = empty ? x0 : Math.min(todo.x0, x0);
  todo.y0 = empty ? y0 : Math.min(todo.y0, y0);
  todo.x1 = empty ? x1 : Math.max(todo.x1, x1);
  todo.y1 = empty ? y1 : Math.max(todo.y1, y1);
}
/** De hele schaduwkaart opnieuw: een nieuwe wereld of een nieuw tijdperk. */
export const shadeAll = (): void => shadeChanged(0, 0, W - 1, H - 1);

// Zet een tegel (x, y) in de schaduwkaart op minstens v
function putTile(x: number, y: number, v: number) {
  for (let sy = 0; sy < SH; sy++)
    for (let sx = 0; sx < SH; sx++) {
      const k = (y * SH + sy + 1) * RW + x * SH + sx + 1;
      if (v > raw[k]) raw[k] = v;
    }
}

/**
 * Werk de schaduwkaart bij waar iets gebouwd, gekapt of gesloopt is (hooguit ~3× per seconde).
 * Alleen dat stuk (zie shadeChanged): de hele kaart nalopen zou op een grote kaart haperen.
 * heightOf(b) geeft de hoogte van het 3D-model van gebouw b (lage velden geven weinig schaduw).
 */
export function updateGroundShade(now: number, heightOf: (b: Building) => number | undefined) {
  if (todo.x1 < todo.x0 || now - shadeTime < 0.3) return;
  shadeTime = now;
  const x0 = Math.max(0, todo.x0),
    y0 = Math.max(0, todo.y0),
    x1 = Math.min(W - 1, todo.x1),
    y1 = Math.min(H - 1, todo.y1);
  todo.x1 = -1; // weer leeg
  if (x1 < x0 || y1 < y0) return;
  // 1. De schaduw op die tegels zelf: eerst leeg, dan bomen, rotsen en gebouwen erin
  for (let sy = y0 * SH; sy < (y1 + 1) * SH; sy++)
    raw.fill(0, (sy + 1) * RW + x0 * SH + 1, (sy + 1) * RW + (x1 + 1) * SH + 1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x,
        t = node[i];
      if (!t || bmap[i] || NODES[t].age > G.age) continue;
      const v = NODE_SHADE[NODES[t].k] ?? 0.3;
      if (v) putTile(x, y, v);
    }
  for (const b of G.bs) {
    const d = B[b.type],
      bx1 = b.x + d.size - 1,
      by1 = b.y + d.size - 1;
    if (d.wall && b.type !== 'stonewall' && b.type !== 'concrete') continue;
    if (b.x > x1 || b.y > y1 || bx1 < x0 || by1 < y0) continue; // staat er niet in
    const v = Math.min(1, Math.max(0.15, (heightOf(b) || 0.3) * 0.85));
    for (let y = Math.max(b.y, y0); y <= Math.min(by1, y1); y++)
      for (let x = Math.max(b.x, x0); x <= Math.min(bx1, x1); x++) putTile(x, y, v);
  }
  // 2. Uitvloeien naar de buren: recht ernaast iets meer dan schuin. Dat reikt één vakje buiten het stuk.
  const sx0 = Math.max(0, x0 * SH - 1),
    sx1 = Math.min(SW - 1, (x1 + 1) * SH),
    sy0 = Math.max(0, y0 * SH - 1),
    sy1 = Math.min(SHH - 1, (y1 + 1) * SH);
  for (let y = sy0; y <= sy1; y++) {
    let k = (y + 1) * RW + sx0 + 1,
      o = y * SW + sx0;
    for (let x = sx0; x <= sx1; x++, k++, o++) {
      const side = Math.max(raw[k - 1], raw[k + 1], raw[k - RW], raw[k + RW]),
        corner = Math.max(raw[k - RW - 1], raw[k - RW + 1], raw[k + RW - 1], raw[k + RW + 1]);
      shadeData[o] = Math.max(raw[k], side * 0.5, corner * 0.32) * 255;
    }
  }
  SHADE.value.needsUpdate = true;
}

// Hoeveel sneeuw er op de grond ligt (0..1); schuift langzaam mee met het seizoen (lighting.ts)
export const SNOW_COVER = { value: 0 };

// Materialen met een eenvoudige en een fijne versie: het water, en de grond (via dressTerrain)
const FINE = [WMAT];
/** Fijne details aan (middel/hoog) of uit (laag). */
export function setFineDetail(on: boolean) {
  for (const m of FINE) {
    if (!!m.defines.FINE_DETAIL === on) continue;
    if (on) m.defines.FINE_DETAIL = '';
    else delete m.defines.FINE_DETAIL;
    m.needsUpdate = true;
  }
}

/** Voeg de extra details toe aan het grondmateriaal (MeshStandardMaterial). */
export function dressTerrain(mat: T3.MeshStandardMaterial) {
  mat.defines = mat.defines || {};
  FINE.push(mat);
  mat.onBeforeCompile = shader => {
    shader.uniforms.uDetail = { value: DETAIL };
    shader.uniforms.uShade = SHADE;
    shader.uniforms.uMapSize = MAP_SIZE;
    shader.uniforms.uSnowCover = SNOW_COVER;
    shader.vertexShader =
      'varying vec3 vWPos;\nvarying vec3 vWNrm;\n' +
      shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader =
      'uniform sampler2D uDetail;\nuniform sampler2D uShade;\nuniform vec2 uMapSize;\nuniform float uSnowCover;\n' +
      'varying vec3 vWPos;\nvarying vec3 vWNrm;\n' +
      shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + GROUND_COLOR)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.4, wet);`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          // Rotswanden met hoekige vlakken (zoals de rest van de modellen), de rest blijft glad
          `#include <normal_fragment_begin>
          vec3 facetN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          normal = normalize(mix(normal, facetN, max(steep * 0.5, smoothstep(0.6, 1.4, vWPos.y) * 0.4)));`,
        );
  };
  mat.customProgramCacheKey = () => 'terrain-detail';
}

// De kleur van de grond, stap voor stap (GLSL)
const GROUND_COLOR = `
  vec2 wp = vWPos.xz;
  vec4 dA = texture2D(uDetail, wp * 0.25);
  // Tweede, fijnere laag details (niet op "laag": dat scheelt werk voor de videokaart)
  #ifdef FINE_DETAIL
    vec4 dB = texture2D(uDetail, wp * 0.71 + vec2(0.37, 0.61));
  #else
    vec4 dB = dA;
  #endif
  float macro = texture2D(uDetail, wp * 0.029).a;
  vec3 base = diffuseColor.rgb;
  // Wat voor grond is het? Groen = gras, warm = aarde of zand, wit = sneeuw, de rest = steen
  float grassW = smoothstep(0.0, 0.07, base.g - max(base.r, base.b));
  float soilW = (1.0 - grassW) * smoothstep(0.02, 0.12, base.r - base.b);
  float snowW = smoothstep(0.7, 0.8, min(base.r, min(base.g, base.b)));
  float stoneW = max(0.0, 1.0 - grassW - soilW) * (1.0 - snowW);
  float detail = ((dA.r * 0.65 + dB.r * 0.35) - 0.5) * grassW * 0.8
    + ((dA.g * 0.6 + dB.g * 0.4) - 0.5) * (soilW * 0.55 + snowW * 0.12)
    + (dA.b * 0.6 + dB.b * 0.4 - 0.5) * stoneW * 0.55;
  // Onder water geen details: daar kijk je door het water heen
  detail *= smoothstep(-0.3, -0.08, vWPos.y);
  vec3 col = base * (1.0 + detail);
  // Grote vlekken: gras hier wat geler, daar wat frisser; zo oogt een veld minder egaal
  col *= 0.93 + macro * 0.14;
  col.r += (macro - 0.5) * 0.06 * grassW;
  // Steil en boven het maaiveld: kale rotswand met lagen. Op een steile wand wordt de
  // textuur van opzij geprojecteerd, anders zou hij uitgerekt worden tot strepen.
  float steep = (1.0 - smoothstep(0.5, 0.8, vWNrm.y)) * smoothstep(0.25, 0.8, vWPos.y);
  vec2 sideUV = vec2(abs(vWNrm.x) > abs(vWNrm.z) ? vWPos.z : vWPos.x, vWPos.y) * 0.45;
  #ifdef FINE_DETAIL
    float rockTex = texture2D(uDetail, sideUV).b * 0.7 + dB.b * 0.3;
  #else
    float rockTex = 0.4 + macro * 0.3; // (zonder zij-projectie: effen, anders strepen)
  #endif
  float strata = 0.9 + 0.1 * sin(vWPos.y * 8.0 + rockTex * 4.0);
  vec3 rockCol = mix(vec3(0.46, 0.43, 0.4), vec3(0.72, 0.68, 0.62), rockTex) * strata * diffuse;
  col = mix(col, rockCol, steep);
  // Sneeuw op hoge, vlakke stukken
  float snow = smoothstep(3.4, 4.4, vWPos.y + dA.b * 0.8) * smoothstep(0.6, 0.78, vWNrm.y);
  col = mix(col, vec3(0.88, 0.91, 0.95) * (0.95 + dA.g * 0.08), snow);
  // In de winter: plekken sneeuw op het land (hoe meer sneeuw, hoe groter de plekken)
  float cover = smoothstep(0.5 - uSnowCover * 0.1, 0.54 - uSnowCover * 0.1, macro * 0.6 + dA.g * 0.4)
    * uSnowCover * smoothstep(0.55, 0.8, vWNrm.y) * smoothstep(-0.05, 0.05, vWPos.y);
  col = mix(col, vec3(0.95, 0.97, 1.0) * (0.95 + dA.g * 0.08), cover);
  // Natte oever: vlak bij het water is de grond donkerder (en glanst een beetje)
  float wet = smoothstep(0.0, -0.14, vWPos.y);
  col *= 1.0 - wet * 0.3;
  // Zachte schaduw rond gebouwen en onder bomen
  float shade = texture2D(uShade, wp / uMapSize).r;
  col *= 1.0 - shade * 0.55;
  diffuseColor.rgb = col;
`;
