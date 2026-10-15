// Het water: ondiep turquoise bij de kust, diep blauw verder weg, schuim langs de oever,
// golfjes die naar het strand rollen en glinsteringen van de zon.
import * as T3 from 'three';
import { H, W, onMapSize } from '../config';
import { FAR_DIST, camDist } from './camera';
import { S3 } from './scene';
import { DETAIL } from './textures';
import { TER, ter } from '../world/world';

// Golfpatroon (normal map) dat langzaam verschuift, zodat het water glinstert in de zon.
// Het patroon is gemaakt van sinusgolven met hele getallen, zodat het naadloos herhaalt.
function waveNormals(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!,
    im = x.createImageData(size, size),
    T = (Math.PI * 2) / size;
  const h = (i: number, j: number) =>
    Math.sin(i * T * 3 + j * T * 2) * 0.5 +
    Math.sin(i * T * 7 - j * T * 5 + 1.3) * 0.3 +
    Math.sin(-i * T * 11 + j * T * 13 + 0.7) * 0.15;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const dx = h(i + 1, j) - h(i - 1, j),
        dy = h(i, j + 1) - h(i, j - 1),
        n = Math.hypot(dx, dy, 1),
        o = (j * size + i) * 4;
      im.data[o] = ((-dx / n) * 0.5 + 0.5) * 255;
      im.data[o + 1] = ((-dy / n) * 0.5 + 0.5) * 255;
      im.data[o + 2] = ((1 / n) * 0.5 + 0.5) * 255;
      im.data[o + 3] = 255;
    }
  x.putImageData(im, 0, 0);
  const t = new T3.CanvasTexture(c);
  t.wrapS = t.wrapT = T3.RepeatWrapping;
  return t;
}
const WNORM = waveNormals();
// Hoe ver de zee rondom de kaart doorloopt (in tegels). Ver genoeg dat je ook helemaal uitgezoomd geen rand ziet.
const MARGIN = 600;
// Het golfpatroon herhaalt elke 7 tegels, hoe groot de kaart ook is
const waveRepeat = () => WNORM.repeat.set((W + MARGIN * 2) / 7, (H + MARGIN * 2) / 7);
waveRepeat();

// Diepte per tegel: 0 = aan de kant, 1 = minstens 7 tegels van het land af
let depthData = new Uint8Array(W * H * 4);
function makeDepth(): T3.DataTexture {
  const t = new T3.DataTexture(depthData, W, H, T3.RGBAFormat);
  t.magFilter = t.minFilter = T3.LinearFilter;
  return t;
}
// De dieptekaart en de kaartmaat voor de shader: gedeeld, zodat een andere kaartgrootte meteen doorwerkt
const DEPTH = { value: makeDepth() },
  MAP_SIZE = { value: new T3.Vector2(W, H) };
onMapSize(() => {
  depthData = new Uint8Array(W * H * 4);
  DEPTH.value.dispose();
  DEPTH.value = makeDepth();
  MAP_SIZE.value.set(W, H);
  waveRepeat();
});

/** Reken uit hoe ver elk stukje water van het land ligt, en leg het water neer (bij elke nieuwe wereld). */
export function updateWaterDepth() {
  const far = 7,
    dist = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) dist[i] = ter[i] === TER.WATER ? far : 0;
  // Afstand tot het land in twee vegen (heen en terug), schuin telt als 1,4:
  // zo worden de dieptelijnen rond in plaats van ruitvormig
  const step = (x: number, y: number, dx: number, dy: number, cost: number) => {
    const xx = x + dx,
      yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return;
    const i = y * W + x,
      d = dist[yy * W + xx] + cost;
    if (d < dist[i]) dist[i] = d;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      step(x, y, -1, 0, 1);
      step(x, y, 0, -1, 1);
      step(x, y, -1, -1, 1.41);
      step(x, y, 1, -1, 1.41);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      step(x, y, 1, 0, 1);
      step(x, y, 0, 1, 1);
      step(x, y, 1, 1, 1.41);
      step(x, y, -1, 1, 1.41);
    }
  // Daarna twee keer zacht uitvlakken, voor vloeiende overgangen
  const tmp = new Float32Array(W * H);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let sum = 0,
          n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            sum += dist[yy * W + xx];
            n++;
          }
        // Land blijft 0, zodat de oever op dezelfde plek blijft
        tmp[y * W + x] = ter[y * W + x] === TER.WATER ? sum / n : 0;
      }
    dist.set(tmp);
  }
  for (let i = 0; i < W * H; i++) {
    depthData[i * 4] = Math.min(1, dist[i] / far) * 255;
    depthData[i * 4 + 3] = 255;
  }
  DEPTH.value.needsUpdate = true;
  buildWaterSurface();
}

const TIME = { value: 0 };
export const WMAT = new T3.MeshStandardMaterial({
  color: '#2f6578',
  roughness: 0.38,
  metalness: 0.2,
  transparent: true,
  opacity: 0.86,
  normalMap: WNORM,
  normalScale: new T3.Vector2(0.3, 0.3),
});
WMAT.onBeforeCompile = shader => {
  shader.uniforms.uDepth = DEPTH;
  shader.uniforms.uDetail = { value: DETAIL };
  shader.uniforms.uTime = TIME;
  shader.uniforms.uMapSize = MAP_SIZE;
  shader.vertexShader =
    'varying vec3 vWPos;\n' +
    shader.vertexShader.replace(
      '#include <fog_vertex>',
      `#include <fog_vertex>
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
  shader.fragmentShader =
    'uniform sampler2D uDepth;\nuniform sampler2D uDetail;\nuniform float uTime;\nuniform vec2 uMapSize;\n' +
    'varying vec3 vWPos;\n' +
    shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + WATER_COLOR)
      // Twee golfpatronen die elk een andere kant op drijven: minder herhaling, levendiger glinsteren
      .replace(
        'vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;',
        `vec3 mapN = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0;
        #ifdef FINE_DETAIL
          vec3 mapN2 = texture2D( normalMap, vUv * 2.3 + vec2(uTime * -0.02, uTime * 0.03) ).xyz * 2.0 - 1.0;
          mapN = normalize( vec3( mapN.xy + mapN2.xy, mapN.z * mapN2.z ) );
        #endif`,
      );
};
WMAT.customProgramCacheKey = () => 'water-shore';

// Kleur en doorzichtigheid van het water (GLSL)
const WATER_COLOR = `
  float depth = texture2D(uDepth, vWPos.xz / uMapSize).r;
  vec3 shallow = vec3(0.2, 0.5, 0.52),
    deep = vec3(0.12, 0.3, 0.42);
  vec3 waterCol = mix(shallow, deep, smoothstep(0.05, 0.75, depth));
  float n = texture2D(uDetail, vWPos.xz * 0.31 + vec2(uTime * 0.017, uTime * 0.011)).g;
  // Schuimrand langs de oever, die zacht heen en weer schuift
  float edge = depth + sin(uTime * 1.1 + vWPos.x * 0.7 + vWPos.z * 0.5) * 0.012;
  float foam = smoothstep(0.05, 0.012, edge) * smoothstep(0.4, 0.62, n + 0.1);
  // Klein plasje (ook een paar tegels verderop ondiep)? Dan geen schuim, anders wordt het een witte vlek
  vec2 dUv = vWPos.xz / uMapSize, o = vec2(2.5) / uMapSize;
  float around = max(
    max(texture2D(uDepth, dUv + vec2(o.x, 0.0)).r, texture2D(uDepth, dUv - vec2(o.x, 0.0)).r),
    max(texture2D(uDepth, dUv + vec2(0.0, o.y)).r, texture2D(uDepth, dUv - vec2(0.0, o.y)).r)
  );
  foam *= smoothstep(0.03, 0.12, around);
  // Golfjes die naar het strand rollen (in stukjes, zodat het geen strakke lijnen worden)
  #ifdef FINE_DETAIL
    float roll = smoothstep(0.88, 1.0, sin(depth * 30.0 + uTime * 1.6 + n * 3.0));
    foam = max(foam, roll * smoothstep(0.3, 0.08, depth) * smoothstep(0.45, 0.65, n) * 0.55);
  #endif
  diffuseColor.rgb = mix(waterCol, vec3(0.82, 0.88, 0.88), foam);
  diffuseColor.a = mix(0.68, 0.92, smoothstep(0.0, 0.5, depth)) * opacity / 0.86 + foam * 0.35;
`;

/** Laat de golfjes langzaam drijven (aangeroepen bij elk beeldje). */
export function animateWater(t: number) {
  WNORM.offset.set(t * 0.012, t * 0.007);
  TIME.value = t;
  // Verder uitgezoomd dan vroeger kon, vlakkere golfjes: losse golfjes zie je dan niet meer, en op volle
  // sterkte werden het strepen in het zonlicht
  const near = Math.min(1, FAR_DIST / camDist()),
    k = near * near * 0.3;
  WMAT.normalScale.set(k, k);
}

// Het wateroppervlak ligt alleen waar water is (plus een rand eromheen, en de zee buiten de kaart).
// Eén groot vlak onder het hele land zou de videokaart overal voor niets laten rekenen.
export const WATER = new T3.Mesh(new T3.BufferGeometry(), WMAT);
WATER.position.y = -0.16;
S3.add(WATER);
function buildWaterSurface() {
  const pos: number[] = [],
    uv: number[] = [],
    quad = (x0: number, z0: number, x1: number, z1: number) => {
      for (const [x, z] of [
        [x0, z0],
        [x0, z1],
        [x1, z0],
        [x1, z0],
        [x0, z1],
        [x1, z1],
      ]) {
        pos.push(x, 0, z);
        // Zelfde schaal als vroeger het grote vlak: dan blijven de golfjes even groot
        uv.push((x + MARGIN) / (W + MARGIN * 2), 1 - (z + MARGIN) / (H + MARGIN * 2));
      }
    };
  // Is er water op of naast deze tegel? (De oever loopt een stukje schuin het water in.)
  const wet = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || ter[yy * W + xx] === TER.WATER) return true;
      }
    return false;
  };
  // Per rij: aaneengesloten stukken water worden één lange strook
  for (let y = 0; y < H; y++) {
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const w = x < W && wet(x, y);
      if (w && start < 0) start = x;
      if (!w && start >= 0) {
        quad(start, y, x, y + 1);
        start = -1;
      }
    }
  }
  // De zee rondom de kaart
  quad(-MARGIN, -MARGIN, W + MARGIN, 0);
  quad(-MARGIN, H, W + MARGIN, H + MARGIN);
  quad(-MARGIN, 0, 0, H);
  quad(W, 0, W + MARGIN, H);
  const g = new T3.BufferGeometry();
  g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T3.Float32BufferAttribute(uv, 2));
  g.setAttribute(
    'normal',
    new T3.Float32BufferAttribute(
      pos.map((_v, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  g.computeBoundingSphere();
  WATER.geometry.dispose();
  WATER.geometry = g;
}
