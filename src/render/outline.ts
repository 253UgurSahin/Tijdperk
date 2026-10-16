// Omlijning rond wat je selecteert (groen) of aanwijst (licht). Elk onderdeel krijgt een iets opgeblazen
// kopie die alleen van de binnenkant getekend wordt: daarvan zie je enkel de rand buiten de vorm. Dat kost
// alleen de onderdelen zelf nog eens, en niet de hele wereld (zoals een nabewerkingsstap zou doen).
import * as T3 from 'three';
import { hullGeometry, isMesh } from './kit';
import { camDist } from './camera';

// De schil: naar buiten geduwd langs de normaal, met één vaste kleur, van binnenuit gezien (BackSide)
function hullMaterial(colour: string): T3.ShaderMaterial {
  return new T3.ShaderMaterial({
    uniforms: { uColor: { value: new T3.Color(colour) }, uWidth: { value: 0.03 } },
    vertexShader: `uniform float uWidth;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += n * uWidth;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: T3.BackSide,
    fog: false,
    toneMapped: false,
  });
}
const SELECT = hullMaterial('#b8ff9a'),
  HOVER = hullMaterial('#fff4d6');

/** Per omlijnd object: de schillen die eraan hangen. */
const hulls = new Map<T3.Object3D, T3.Mesh[]>();
let enabled = true;

export const setOutlineEnabled = (on: boolean) => (enabled = on);

// Hang aan elk zichtbaar onderdeel een schil; die beweegt vanzelf mee (ook armen en benen)
function attach(o: T3.Object3D, m: T3.ShaderMaterial): T3.Mesh[] {
  const pairs: [T3.Mesh, T3.Mesh][] = [];
  o.traverse(part => {
    if (!isMesh(part) || part.userData.hull || !part.visible) return;
    if ((part as T3.InstancedMesh).isInstancedMesh) return;
    const hull = new T3.Mesh(hullGeometry(part.geometry), m);
    hull.userData.hull = 1;
    hull.castShadow = hull.receiveShadow = false;
    hull.raycast = () => {}; // niet aanklikbaar (de vorm eronder wel)
    pairs.push([part, hull]);
  });
  // (pas na het doorlopen toevoegen: dezelfde plek en maat als het onderdeel zelf)
  for (const [part, hull] of pairs) part.add(hull);
  return pairs.map(p => p[1]);
}
function detach(list: T3.Mesh[]) {
  for (const h of list) h.parent?.remove(h);
}

/** Welke 3D-objecten een omlijning krijgen: geselecteerd en aangewezen. Wat wegvalt, raakt zijn schil kwijt. */
export function setOutlined(selected: T3.Object3D[], hovered: T3.Object3D[]): void {
  const want = new Map<T3.Object3D, T3.ShaderMaterial>();
  if (enabled) {
    for (const o of hovered) want.set(o, HOVER);
    for (const o of selected) want.set(o, SELECT); // geselecteerd gaat voor aangewezen
  }
  for (const [o, list] of hulls) {
    const m = want.get(o);
    if (!m || list[0]?.material !== m || !list[0]?.parent) {
      detach(list);
      hulls.delete(o);
    }
  }
  for (const [o, m] of want) if (!hulls.has(o)) hulls.set(o, attach(o, m));
  // Even dik op het scherm, hoe ver je ook inzoomt
  SELECT.uniforms.uWidth.value = HOVER.uniforms.uWidth.value = 0.0014 * camDist();
}
