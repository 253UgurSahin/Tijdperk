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

// Kleurcorrectie: iets meer contrast en kleur, en zacht donkere hoeken (vignet) voor diepte.
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = (c - 0.5) * 1.07 + 0.5;                       // contrast
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.12);                         // verzadiging
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot(d, d) * 0.38;                       // vignet
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// Worden pas gemaakt als de nabewerking voor het eerst aan gaat (zie build), en dan alle vier tegelijk
let composer: EffectComposer | null = null,
  bloom: UnrealBloomPass | null = null,
  selectOutline: OutlinePass | null = null,
  hoverOutline: OutlinePass | null = null;
const on = { post: false, bloom: false, outline: false };

function build() {
  // Eigen render-doel met 4× multisampling, zodat randen ook met nabewerking glad blijven
  const target = new T3.WebGLRenderTarget(4, 4, { samples: R3.capabilities.isWebGL2 ? 4 : 0 });
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
  bloom = new UnrealBloomPass(new T3.Vector2(256, 256), 0.55, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(GradeShader));
}

/** Welke onderdelen van de nabewerking aan staan: alles, de gloed en de omlijning. */
export interface PostSettings {
  post: boolean;
  bloom: boolean;
  outline: boolean;
}
/** Zet onderdelen van de nabewerking aan of uit. */
export function configurePost({ post, bloom: useBloom, outline }: PostSettings) {
  on.post = post;
  on.bloom = useBloom;
  on.outline = outline;
  if (post && !composer) build();
  if (composer) {
    bloom!.enabled = useBloom;
    selectOutline!.enabled = hoverOutline!.enabled = outline;
  }
}

export function resizePost(w: number, h: number, dpr: number) {
  if (!composer) return;
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
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
