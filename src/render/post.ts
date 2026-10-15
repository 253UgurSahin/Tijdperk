// Nabewerking van het beeld: een zachte gloed rond lichten en vuur (bloom), een omlijning rond
// wat je selecteert of aanwijst, en kleurcorrectie. Hoeveel hiervan aan staat, hangt af van de
// kwaliteitsinstelling (zie quality.js); op "laag" wordt het beeld direct getekend.
import * as T3 from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { CAM3, R3, S3 } from './scene';

// Zachte "schouder" voor felle kleuren: tot 0.8 blijft alles gelijk, daarboven loopt het
// geleidelijk naar wit in plaats van hard af te kappen. Zo houden zonnig zand, sneeuw en
// witte randen hun tekening. Dezelfde formule zit in de nabewerking en (op laag/middel) in de
// materialen; daarom staat hij hier één keer, met een eigen naam per plek.
const shoulder = name => `vec3 ${name}(vec3 c) {
    vec3 over = max(c - 0.8, 0.0);
    return min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  }`;
T3.ShaderChunk.tonemapping_pars_fragment = T3.ShaderChunk.tonemapping_pars_fragment.replace(
  'vec3 CustomToneMapping( vec3 color ) { return color; }',
  shoulder('tpShoulder') +
    '\nvec3 CustomToneMapping( vec3 color ) { return tpShoulder( color * toneMappingExposure ); }',
);

// Kleurcorrectie: zachte schouder, iets meer contrast en kleur, een klein beetje verscherpen
// (fijne details komen beter uit) en zacht donkere hoeken (vignet) voor diepte.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new T3.Vector2() },
    uSharpen: { value: 0 },
    uShoulder: { value: 1 },
  },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uSharpen; uniform float uShoulder;
    varying vec2 vUv;
    ${shoulder('softShoulder')}
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (uSharpen > 0.0) {
        vec3 around = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb
          + texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb
          + texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb
          + texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
        c = max(c + (c - around * 0.25) * uSharpen, 0.0);
      }
      if (uShoulder > 0.5) c = softShoulder(c);
      c = (c - 0.5) * 1.07 + 0.5;                       // contrast
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.12);                         // verzadiging
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.38;                       // vignet
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

let composer = null,
  bloom = null,
  grade = null,
  selectOutline = null,
  hoverOutline = null;
const on = { post: false, bloom: false, outline: false, sharpen: 0, hdr: false };
let size = [4, 4, 1];

function build(hdr) {
  // Eigen render-doel met 4× multisampling, zodat randen ook met nabewerking glad blijven.
  // Op "hoog" met "half float": dan mogen kleuren feller dan wit zijn, en gloeien alleen echte
  // lichten (in plaats van alles wat in de zon wit wordt). Op "middel" gewone kleuren: lichter.
  const gl2 = R3.capabilities.isWebGL2;
  const target = new T3.WebGLRenderTarget(4, 4, {
    samples: gl2 ? 4 : 0,
    type: hdr ? T3.HalfFloatType : T3.UnsignedByteType,
  });
  composer = new EffectComposer(R3, target);
  composer.addPass(new RenderPass(S3, CAM3));
  selectOutline = new OutlinePass(new T3.Vector2(256, 256), S3, CAM3);
  selectOutline.visibleEdgeColor.set('#b8ff9a');
  selectOutline.hiddenEdgeColor.set('#3c6a32');
  selectOutline.edgeStrength = 4;
  selectOutline.edgeThickness = 1.2;
  selectOutline.edgeGlow = 0.4;
  composer.addPass(selectOutline);
  hoverOutline = new OutlinePass(new T3.Vector2(256, 256), S3, CAM3);
  hoverOutline.visibleEdgeColor.set('#fff4d6');
  hoverOutline.hiddenEdgeColor.set('#000000');
  hoverOutline.edgeStrength = 2.2;
  hoverOutline.edgeThickness = 1;
  composer.addPass(hoverOutline);
  // Alleen echt felle dingen (vuur, lampen, lasers) gloeien: de drempel ligt hoog
  bloom = new UnrealBloomPass(new T3.Vector2(256, 256), 0.55, 0.5, hdr ? 1.35 : 0.82);
  composer.addPass(bloom);
  grade = new ShaderPass(GradeShader);
  grade.uniforms.uShoulder.value = hdr ? 1 : 0;
  // De laatste stap tekent direct op het scherm; niet wisselen betekent dat het tweede
  // (grote) render-doel van de composer nooit nodig is. Dat scheelt videogeheugen.
  grade.needsSwap = false;
  composer.addPass(grade);
  on.hdr = hdr;
  resizePost(...size);
}

function dispose() {
  for (const pass of composer.passes) pass.dispose && pass.dispose();
  composer.dispose();
  composer = null;
}

/** Welke onderdelen van de nabewerking aan staan: alles, de gloed en de omlijning. */
export interface PostSettings {
  post: boolean;
  bloom: boolean;
  outline: boolean;
}
/** Zet onderdelen van de nabewerking aan of uit. */
export function configurePost({ post, bloom: useBloom, outline, sharpen = 0, hdr = false }) {
  // Felle kleuren alleen als de videokaart dat kan
  hdr = hdr && R3.capabilities.isWebGL2 && R3.extensions.has('EXT_color_buffer_float');
  on.post = post;
  on.bloom = useBloom;
  on.outline = outline;
  on.sharpen = sharpen;
  if (composer && (!post || on.hdr !== hdr)) dispose();
  if (post && !composer) build(hdr);
  if (composer) {
    bloom.enabled = useBloom;
    selectOutline.enabled = hoverOutline.enabled = outline;
    grade.uniforms.uSharpen.value = sharpen;
  }
  // De zachte schouder voor felle kleuren zit in de laatste stap als die felle kleuren kent
  // (hoog); anders in de materialen zelf. Zo gebeurt het altijd precies één keer.
  R3.toneMapping = composer && on.hdr ? T3.NoToneMapping : T3.CustomToneMapping;
}

export function resizePost(w, h, dpr) {
  size = [w, h, dpr];
  if (!composer) return;
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  grade.uniforms.uTexel.value.set(1 / Math.max(1, w * dpr), 1 / Math.max(1, h * dpr));
}

/**
 * De gloed hangt af van het uur: overdag gloeit alleen wat feller is dan zonnig wit,
 * 's nachts ook verlichte ramen en lampen. dk = hoe donker het is (0 = dag, 1 = nacht).
 */
export function setBloomDarkness(dk) {
  if (!bloom) return;
  bloom.threshold = on.hdr ? 1.35 - dk * 0.6 : 0.82;
}

/** Welke 3D-objecten een omlijning krijgen: geselecteerd en aangewezen. */
export function setOutlined(selected: T3.Object3D[], hovered: T3.Object3D[]) {
  if (!composer) return;
  selectOutline!.selectedObjects = selected;
  hoverOutline!.selectedObjects = hovered;
  // Lege lijst: de pas overslaan scheelt werk
  selectOutline!.enabled = on.outline && selected.length > 0;
  hoverOutline!.enabled = on.outline && hovered.length > 0;
}

export const outlinesOn = () => on.post && on.outline;

export function renderFrame() {
  // Staat on.post aan, dan is build() al gedaan en bestaat composer
  if (on.post) composer!.render();
  else R3.render(S3, CAM3);
}
