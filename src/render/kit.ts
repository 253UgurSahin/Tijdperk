// Bouwdoos voor 3D-modellen: materialen, kleuren en basisvormen.
import * as T3 from 'three';
import { TAU } from '../config';
import { hash2 } from '../util/random';

/** Materiaal-opties: e = gloeikleur, ei = gloeisterkte, m = metaalachtig, r = ruwheid, t = doorzichtig, o = dekking, b = zonder licht. */
export interface MatOpts {
  e?: T3.ColorRepresentation;
  ei?: number;
  m?: number;
  r?: number;
  t?: boolean | 1;
  o?: number;
  b?: boolean | 1;
}
/** Een kleur (gedeeld standaardmateriaal) of een kant-en-klaar materiaal. */
export type Paint = string | T3.Material;
const MC: Record<string, T3.MeshStandardMaterial | T3.MeshBasicMaterial> = {};
export function mat(
  c: T3.ColorRepresentation,
  o: MatOpts = {},
): T3.MeshStandardMaterial | T3.MeshBasicMaterial {
  const k =
    c +
    '|' +
    (o.e || '') +
    (o.ei ?? '') +
    (o.m || '') +
    (o.r ?? '') +
    (o.t ? 't' + o.o : '') +
    (o.b ? 'b' : '');
  if (MC[k]) return MC[k];
  const m = o.b
    ? new T3.MeshBasicMaterial({ color: c, transparent: !!o.t, opacity: o.o ?? 1, depthWrite: !o.t })
    : new T3.MeshStandardMaterial({
        color: c,
        flatShading: true,
        roughness: o.r ?? 0.88,
        metalness: o.m || 0,
        emissive: o.e || 0,
        emissiveIntensity: o.ei ?? 1,
        transparent: !!o.t,
        opacity: o.o ?? 1,
      });
  if (!o.b && !o.t && !o.e && !o.m && o.r == null) m.userData.vc = 1;
  return (MC[k] = m);
}
/** Is dit 3D-object een mesh (een vorm met een materiaal)? */
export const isMesh = (o: T3.Object3D): o is T3.Mesh => (o as T3.Mesh).isMesh;

/**
 * Hoeveel detail de bouwdoos maakt. Aan (normaal): plinten, hoekstenen, luiken, nokbalken, stoepstenen en
 * zo meer. Uit: alleen de hoofdvormen, voor de grove versie van een gebouw die je ver uitgezoomd ziet (zie
 * makeBuilding in models.ts). Zo kost een stad van ver maar een fractie van dichtbij.
 */
export let detail = true;
export const setDetail = (on: boolean) => (detail = on);
/** Een onderdeel van een model met een gewoon materiaal (gemaakt met mat()). */
type SolidMesh = T3.Mesh<T3.BufferGeometry, T3.MeshStandardMaterial>;
// Zachte overgang van 0 naar 1 (zoals smoothstep in een shader)
const smooth01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const VCMAT = new T3.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88 });

// Een klein plaatje met korrel (toevallig grijs), voor de structuur op muren en daken
const GRAIN = (() => {
  const n = 64,
    data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = 110 + Math.floor(hash2(i % n, (i / n) | 0, 3) * 90);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const t = new T3.DataTexture(data, n, n);
  t.wrapS = t.wrapT = T3.RepeatWrapping;
  t.magFilter = t.minFilter = T3.LinearFilter;
  t.needsUpdate = true;
  return t;
})();
/**
 * Hetzelfde materiaal voor gebouwen, met structuur op het oppervlak: op staande vlakken dunne voegen (lagen
 * steen, planken) en overal een lichte korrel. Dat zit in de shader zelf, per pixel in wereldcoördinaten:
 * geen extra vormen en maar één extra plaatje. Van ver vervagen de voegen vanzelf (anders flikkeren ze).
 */
const VCMAT_B = VCMAT.clone();
VCMAT_B.onBeforeCompile = shader => {
  shader.uniforms.uGrain = { value: GRAIN };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
    .replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform sampler2D uGrain;')
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        // De richting van dit vlak, uit de helling van de wereldpositie over het scherm
        vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
        float standing = 1.0 - smoothstep(0.35, 0.65, abs(fn.y));
        // Korrel: het plaatje over het vlak heen, langs de as waar het vlak naar kijkt
        vec2 uv = abs(fn.y) > 0.5 ? vWp.xz : (abs(fn.x) > abs(fn.z) ? vWp.zy : vWp.xy);
        float grain = texture2D(uGrain, uv * 0.5).r;
        float fade = clamp(1.0 - fwidth(uv.x * 0.5) * 12.0, 0.0, 1.0);
        // Voegen: liggende om de 9 cm en staande om de 18 cm, elke rij een halve steen verschoven
        // (metselverband). Zacht van rand, en weg zodra ze kleiner dan een pixel worden.
        float row = vWp.y * 11.1;
        float fw = fwidth(row);
        float visible = clamp(1.0 - fw * 5.0, 0.0, 1.0);
        float across = uv.x * 5.55 + 0.5 * mod(floor(row), 2.0);
        float seamY = 1.0 - smoothstep(0.06, 0.06 + fw, abs(fract(row) - 0.5));
        float seamX = 1.0 - smoothstep(0.04, 0.04 + fwidth(across), abs(fract(across) - 0.5));
        float seam = max(seamY, seamX * 0.8) * visible * standing;
        diffuseColor.rgb *= (1.0 - 0.3 * seam) * (1.0 + (grain - 0.6) * 0.5 * fade);
      }`,
    );
};
// (zelfde shader-opbouw: three.js herkent dit materiaal zo als een eigen variant)
VCMAT_B.customProgramCacheKey = () => 'tp-building';
// Voeg vaste delen met hetzelfde materiaal samen tot één mesh: veel sneller tekenen.
export function mergeStatic(g: T3.Group): T3.Group {
  const parts = (g.children as SolidMesh[]).filter(
    o => o.isMesh && o.material.userData && o.material.userData.vc && !o.userData.flag && !o.userData.lamp,
  );
  mergeParts(g, parts, true);
  // Ook de andere vaste delen (ramen, glas, gloeiende stukken) per materiaal samen: één mesh per materiaal
  const rest = (g.children as T3.Mesh[]).filter(
    o =>
      o.isMesh &&
      !o.name &&
      Object.keys(o.userData).length === 0 &&
      !(o.geometry.userData && o.geometry.userData.merged) &&
      !Array.isArray(o.material) &&
      !(o.material as T3.MeshStandardMaterial).map &&
      !(o.material as T3.Material).transparent,
  );
  const byMat = new Map<T3.Material, T3.Mesh[]>();
  for (const o of rest) {
    const m = o.material as T3.Material;
    byMat.set(m, [...(byMat.get(m) || []), o]);
  }
  for (const [m, list] of byMat) if (list.length > 1) mergeSameMaterial(g, list, m);
  return g;
}

// Delen met hetzelfde (bijzondere) materiaal tot één mesh, zonder kleuren per hoekpunt
function mergeSameMaterial(g: T3.Object3D, parts: T3.Mesh[], material: T3.Material): void {
  let n = 0;
  const gs = parts.map(o => {
    o.updateMatrix();
    const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    q.applyMatrix4(o.matrix);
    n += q.attributes.position.count;
    return q;
  });
  const pos = new Float32Array(n * 3);
  let k = 0;
  for (const q of gs) {
    pos.set((q.attributes.position as T3.BufferAttribute).array, k * 3);
    k += q.attributes.position.count;
    q.dispose();
  }
  const mg = new T3.BufferGeometry();
  mg.setAttribute('position', new T3.BufferAttribute(pos, 3));
  mg.computeVertexNormals();
  mg.computeBoundingSphere();
  mg.userData.merged = true; // hoort bij precies één model (zie disposeMerged)
  for (const o of parts) g.remove(o);
  const m = new T3.Mesh(mg, material);
  m.castShadow = parts.some(o => o.castShadow);
  m.receiveShadow = parts.some(o => o.receiveShadow);
  g.add(m);
}

/**
 * Hetzelfde voor een figuurtje (dorpeling, soldaat, vijand): per bewegend deel (romp, arm, been, gereedschap)
 * worden de vaste stukjes één mesh. Een poppetje van een stuk of twaalf losse blokjes wordt zo vijf of zes
 * stukken: veel minder werk voor de grafische kaart als er honderden figuren rondlopen.
 * Delen die apart moeten blijven (met een naam, met userData zoals een rotor, of onzichtbaar zoals de vracht
 * die een dorpeling draagt) blijven los.
 */
export function mergeFigure(root: T3.Object3D): void {
  flattenLooseGroups(root);
  const groups: T3.Object3D[] = [];
  root.traverse(o => {
    if (!isMesh(o)) groups.push(o);
  });
  for (const g of groups) {
    const parts = (g.children as SolidMesh[]).filter(
      o =>
        o.isMesh &&
        o.visible &&
        !o.name &&
        !!o.material.userData &&
        !!o.material.userData.vc &&
        Object.keys(o.userData).length === 0,
    );
    mergeParts(g, parts, false);
  }
}

/*
 * Een groepje dat alleen vaste blokjes bij elkaar houdt (zoals het gereedschap in een hand) en waar verder
 * niets naar verwijst, lossen we op in zijn ouder: de blokjes krijgen meteen de goede plek. Zo kan
 * mergeFigure ze samenvoegen met de arm die ze vasthoudt. Groepjes waar wel iets naar verwijst (armen, benen,
 * de rotor van een drone: via userData) of met een naam blijven bestaan, want die bewegen.
 */
function flattenLooseGroups(root: T3.Object3D): void {
  const used = new Set<unknown>();
  root.traverse(o => {
    for (const v of Object.values(o.userData)) {
      used.add(v);
      // (bijv. userData.limbs = { lL, lR, aL, aR })
      if (v && typeof v === 'object' && !(v as T3.Object3D).isObject3D)
        for (const w of Object.values(v)) used.add(w);
    }
  });
  const loose: T3.Object3D[] = [];
  root.traverse(o => {
    if (
      o !== root &&
      !isMesh(o) &&
      o.type === 'Group' &&
      !o.name &&
      !used.has(o) &&
      Object.keys(o.userData).length === 0 &&
      o.children.length > 0 &&
      o.children.every(c => isMesh(c) && c.children.length === 0) &&
      o.parent
    )
      loose.push(o);
  });
  for (const g of loose) {
    const parent = g.parent!; // (zo gevonden: elk los groepje heeft een ouder)
    g.updateMatrix();
    for (const c of [...g.children]) {
      c.updateMatrix();
      c.matrix.premultiply(g.matrix);
      c.matrix.decompose(c.position, c.quaternion, c.scale);
      parent.add(c);
    }
    parent.remove(g);
  }
}

/**
 * Plak deze delen van groep g samen tot één mesh met kleuren per hoekpunt. Met `shade` worden muren onderaan
 * wat donkerder (voor gebouwen); figuurtjes houden hun eigen kleuren.
 */
function mergeParts(g: T3.Object3D, parts: SolidMesh[], shade: boolean): void {
  if (parts.length < 2) return;
  const mg = bakeColours(
    parts.map(o => {
      o.updateMatrix();
      return [o, o.matrix];
    }),
    shade,
    // Elk gebouw een eigen, net iets andere tint (zie makeBuilding in models.ts)
    typeof g.userData.seed === 'number' ? g.userData.seed : undefined,
  );
  for (const o of parts) g.remove(o);
  const m = new T3.Mesh(mg, shade ? VCMAT_B : VCMAT);
  m.castShadow = shade || parts.some(o => o.castShadow);
  m.receiveShadow = shade || parts.some(o => o.receiveShadow);
  g.add(m);
}

/**
 * Het hele figuur als één vast beeldje, in de houding waarin het nu staat (armen en benen bewegen dan niet
 * meer). Voor ver uitgezoomd: dan is een figuur maar een paar pixels hoog. Alleen de zichtbare stukken met
 * een gewoon materiaal doen mee. Geeft null als er niets samen te voegen valt.
 */
export function mergeWhole(root: T3.Object3D): T3.Mesh | null {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert(),
    items: [SolidMesh, T3.Matrix4][] = [];
  const walk = (o: T3.Object3D) => {
    if (!o.visible) return;
    const m = o as SolidMesh;
    if (m.isMesh && m.material.userData && m.material.userData.vc)
      items.push([m, toRoot.clone().multiply(m.matrixWorld)]);
    for (const c of o.children) walk(c);
  };
  for (const c of root.children) walk(c);
  if (items.length < 2) return null;
  const mesh = new T3.Mesh(bakeColours(items, false), VCMAT);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Een stuk is een "blok" voor de contactschaduw als het niet flinterdun is (geen dakpan, kozijn of latje)
const SOLID_VOLUME = 0.003,
  TOUCH = 0.03; // zo dicht bij een ander blok telt een hoekpunt als "in de hoek"
const tmpBox = new T3.Box3(),
  tmpV3 = new T3.Vector3();
// Een vast toevalsgetal (0..1) bij een gebouw (seed) en een nummer, altijd hetzelfde
const hash01 = (seed: number, n: number) => hash2(seed, n, 7);
/**
 * Eén vorm met kleuren per hoekpunt uit losse delen, elk met zijn eigen plaatsing (matrix). Met `shade`
 * (gebouwen) worden muren onderaan wat donkerder en krijgen hoekpunten die tegen een ander blok aan liggen
 * (de voet van een muur op de vloer, de muur onder een dak) een zacht schaduwtje: zo komen de onderdelen
 * los van elkaar, zonder dat het de grafische kaart iets kost. `seed` geeft het gebouw een eigen tint.
 */
function bakeColours(items: [SolidMesh, T3.Matrix4][], shade: boolean, seed?: number): T3.BufferGeometry {
  let n = 0;
  const gs = items.map(([o, matrix]): [T3.BufferGeometry, T3.Color] => {
    const q = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    q.applyMatrix4(matrix);
    n += q.attributes.position.count;
    return [q, o.material.color];
  });
  // De blokken waar andere delen tegenaan kunnen liggen, iets ruimer genomen
  const blocks: T3.Box3[] = [];
  if (shade)
    for (const [q] of gs) {
      q.computeBoundingBox();
      const b = q.boundingBox!; // (net uitgerekend)
      const s = b.getSize(tmpV3);
      blocks.push(
        s.x * s.y * s.z >= SOLID_VOLUME ? b.clone().expandByScalar(TOUCH) : tmpBox.makeEmpty().clone(),
      );
    }
  // De eigen tint: rood, groen en blauw elk een paar procent anders
  let tr = 1,
    tg = 1,
    tb = 1;
  if (seed != null) {
    tr = 1 + (hash01(seed, 1) - 0.5) * 0.09;
    tg = 1 + (hash01(seed, 2) - 0.5) * 0.07;
    tb = 1 + (hash01(seed, 3) - 0.5) * 0.09;
  }
  const pos = new Float32Array(n * 3),
    col = new Float32Array(n * 3);
  let k = 0;
  gs.forEach(([q, c], part) => {
    const cnt = q.attributes.position.count,
      p = (q.attributes.position as T3.BufferAttribute).array;
    pos.set(p, k * 3);
    for (let i = 0; i < cnt; i += 3) {
      // Per driehoek: liggende vlakken (vloeren, platen, daken) houden hun volle kleur
      const flat =
        !shade ||
        (Math.abs(p[i * 3 + 1] - p[i * 3 + 4]) < 1e-4 && Math.abs(p[i * 3 + 1] - p[i * 3 + 7]) < 1e-4);
      for (let j = i; j < i + 3 && j < cnt; j++) {
        // Muren worden onderaan wat donkerder, zoals in het echt (minder licht bij de grond)
        const y = p[j * 3 + 1];
        let f = flat ? 1 : 0.76 + 0.24 * smooth01(y / 0.5);
        if (shade) {
          tmpV3.set(p[j * 3], y, p[j * 3 + 2]);
          let touching = 0;
          for (let b = 0; b < blocks.length && touching < 2; b++)
            if (b !== part && blocks[b].containsPoint(tmpV3)) touching++;
          f *= touching === 0 ? 1 : touching === 1 ? 0.84 : 0.74;
        }
        col[(k + j) * 3] = c.r * f * tr;
        col[(k + j) * 3 + 1] = c.g * f * tg;
        col[(k + j) * 3 + 2] = c.b * f * tb;
      }
    }
    k += cnt;
    q.dispose();
  });
  const mg = new T3.BufferGeometry();
  mg.setAttribute('position', new T3.BufferAttribute(pos, 3));
  mg.setAttribute('color', new T3.BufferAttribute(col, 3));
  mg.computeVertexNormals();
  mg.computeBoundingSphere();
  // Deze vorm hoort bij precies één model: weg ermee als het model weggaat (zie disposeMerged)
  mg.userData.merged = true;
  return mg;
}

/**
 * Een model gaat voorgoed uit beeld: geef de samengevoegde vormen vrij op de grafische kaart. (Gedeelde
 * vormen, zoals het blokje GB, blijven staan: die gebruikt de rest van de wereld ook.)
 */
export function disposeMerged(root: T3.Object3D): void {
  root.traverse(o => {
    if (isMesh(o) && o.geometry.userData.merged) {
      o.geometry.dispose();
      const hull = o.geometry.userData.hull as T3.BufferGeometry | undefined;
      if (hull) hull.dispose();
    }
  });
}

/**
 * De "schil" van een vorm voor de omlijning (zie render/outline.ts): dezelfde vorm, maar met afgeronde
 * normalen (het gemiddelde op elke hoek). Langs die normalen iets naar buiten duwen blaast de vorm netjes op,
 * ook op de hoeken van een blok. Wordt per vorm één keer gemaakt en bewaard.
 */
export function hullGeometry(geo: T3.BufferGeometry): T3.BufferGeometry {
  const cached = geo.userData.hull as T3.BufferGeometry | undefined;
  if (cached) return cached;
  const src = geo.index ? geo.toNonIndexed() : geo;
  const p = (src.attributes.position as T3.BufferAttribute).array,
    cnt = src.attributes.position.count;
  // Hoekpunten op (vrijwel) dezelfde plek krijgen één gedeelde normaal
  const key = (i: number) =>
    Math.round(p[i * 3] * 2000) +
    ',' +
    Math.round(p[i * 3 + 1] * 2000) +
    ',' +
    Math.round(p[i * 3 + 2] * 2000);
  const sum = new Map<string, [number, number, number]>(),
    keys: string[] = new Array(cnt);
  const a = new T3.Vector3(),
    b = new T3.Vector3(),
    c = new T3.Vector3();
  for (let i = 0; i < cnt; i += 3) {
    a.fromArray(p, i * 3);
    b.fromArray(p, i * 3 + 3);
    c.fromArray(p, i * 3 + 6);
    c.sub(b).cross(a.sub(b)).normalize(); // de normaal van deze driehoek
    for (let j = i; j < i + 3; j++) {
      const k = (keys[j] = key(j));
      const s = sum.get(k) || [0, 0, 0];
      s[0] += c.x;
      s[1] += c.y;
      s[2] += c.z;
      sum.set(k, s);
    }
  }
  const nrm = new Float32Array(cnt * 3);
  for (let j = 0; j < cnt; j++) {
    const s = sum.get(keys[j])!; // (zojuist voor elk hoekpunt gezet)
    a.set(s[0], s[1], s[2]).normalize();
    nrm[j * 3] = a.x;
    nrm[j * 3 + 1] = a.y;
    nrm[j * 3 + 2] = a.z;
  }
  const hull = new T3.BufferGeometry();
  hull.setAttribute(
    'position',
    new T3.BufferAttribute(p instanceof Float32Array ? p : new Float32Array(p), 3),
  );
  hull.setAttribute('normal', new T3.BufferAttribute(nrm, 3));
  hull.boundingSphere = geo.boundingSphere ? geo.boundingSphere.clone() : null;
  if (!hull.boundingSphere) hull.computeBoundingSphere();
  if (src !== geo) src.dispose();
  geo.userData.hull = hull;
  return hull;
}
export const M_ = (c: Paint): T3.Material => (typeof c === 'string' ? mat(c) : c);
export const WIN = new T3.MeshStandardMaterial({
  color: '#36424c',
  flatShading: true,
  roughness: 0.4,
  metalness: 0.2,
  emissive: new T3.Color('#ffc46b'),
  emissiveIntensity: 0,
});
export const GLOWM = new T3.MeshStandardMaterial({
  color: '#5a2a10',
  emissive: new T3.Color('#ff8a2a'),
  emissiveIntensity: 1.4,
  flatShading: true,
});
export const CYANM = new T3.MeshStandardMaterial({
  color: '#123c40',
  emissive: new T3.Color('#38e6e8'),
  emissiveIntensity: 1.2,
  flatShading: true,
});
const FIREM = new T3.MeshBasicMaterial({ color: '#ff9d3a' }),
  FIREM2 = new T3.MeshBasicMaterial({ color: '#ffe08a' });
export const TEAM = '#2f6fd6',
  TEAMD = '#204c96',
  FOE = '#b8352c';
/**
 * De kleur van vlaggen en banieren op gebouwen (team; voor een rivaal zet render/rivals3d.ts hem even op zijn
 * kleur) en van vijanden (foe). Met de kleurenblindvriendelijke stand worden vijanden oranje in plaats van
 * rood: rood en groen (bos, gras) zijn voor veel mensen lastig uit elkaar te houden, oranje en blauw niet.
 * `version` telt mee in de sleutel van elk figuur, zodat ze bij het omzetten opnieuw gemaakt worden.
 */
export const paint = { team: TEAM, foe: FOE, foeBright: '#ff4a3a', version: 0 };
export function setColorBlind(on: boolean): void {
  paint.foe = on ? '#d8821e' : FOE;
  paint.foeBright = on ? '#ffb13a' : '#ff4a3a';
  paint.version++;
}
export const GB = new T3.BoxGeometry(1, 1, 1);
GB.translate(0, 0.5, 0);
const GC: Record<string, T3.BufferGeometry> = {};
export function gCyl(rt: number, rb: number, s: number, th?: number): T3.BufferGeometry {
  const k = rt + '_' + rb + '_' + s + '_' + (th || 0);
  if (GC[k]) return GC[k];
  const g = new T3.CylinderGeometry(rt, rb, 1, s, 1, false, 0, th || TAU);
  g.translate(0, 0.5, 0);
  return (GC[k] = g);
}
export function gIco(d: number): T3.BufferGeometry {
  const k = 'i' + d;
  if (GC[k]) return GC[k];
  return (GC[k] = new T3.IcosahedronGeometry(1, d));
}
export function gDod(): T3.BufferGeometry {
  return GC.dod || (GC.dod = new T3.DodecahedronGeometry(1, 0));
}
export function gOct(): T3.BufferGeometry {
  return GC.oct || (GC.oct = new T3.OctahedronGeometry(1, 0));
}
/** Een hoekpunt in 3D: [x, y, z]. */
type Vec3 = [number, number, number];
const GPRISM = (() => {
  const g = new T3.BufferGeometry(),
    v: number[] = [],
    P = (x: number, y: number, z: number) => v.push(x, y, z);
  const a: Vec3 = [-0.5, 0, -0.5],
    b: Vec3 = [-0.5, 0, 0.5],
    c: Vec3 = [-0.5, 1, 0],
    d: Vec3 = [0.5, 0, -0.5],
    e: Vec3 = [0.5, 0, 0.5],
    f: Vec3 = [0.5, 1, 0];
  const T = (p: Vec3, q: Vec3, r: Vec3) => {
    P(...p);
    P(...q);
    P(...r);
  };
  T(a, b, c);
  T(d, f, e);
  T(b, e, f);
  T(b, f, c);
  T(a, c, f);
  T(a, f, d);
  T(a, d, e);
  T(a, e, b);
  g.setAttribute('position', new T3.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
const GPYR = (() => {
  const g = new T3.ConeGeometry(Math.SQRT1_2, 1, 4);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  return g;
})();
export function mk(
  geo: T3.BufferGeometry,
  m: T3.Material,
  g: T3.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  ry?: number,
): T3.Mesh {
  const o = new T3.Mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  if (ry) o.rotation.y = ry;
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
export function bx(g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) {
  const o = mk(GB, M_(c), g, x, y, z, w, h, d, ry);
  // Een echte muur (groot genoeg, in een muurkleur) krijgt een plint en hoekstenen
  if (detail && typeof c === 'string' && WALLS.has(c) && h >= 0.3 && w >= 0.35 && d >= 0.35)
    wallTrim(g, w, h, d, c, x, y, z, ry);
  return o;
}
// Muurkleuren: alleen deze blokken zijn muren (en geen tonnen, kisten of schoorstenen)
const WALLS = new Set([
  '#e5dbc5',
  '#a3553f',
  '#aaa69b',
  '#86837b',
  '#b8b9b2',
  '#c6a479',
  '#e9ecee',
  '#8a6a44',
]);
const STONEY = new Set(['#e5dbc5', '#a3553f', '#aaa69b', '#86837b', '#c6a479', '#e9ecee']);
// Plint (donker, iets breder) onderaan, en op steen en pleister lichte hoekstenen op de vier hoeken
function wallTrim(
  g: T3.Object3D,
  w: number,
  h: number,
  d: number,
  c: string,
  x: number,
  y: number,
  z: number,
  ry: number,
) {
  mk(GB, mat(darker(c)), g, x, y, z, w + 0.03, 0.05, d + 0.03, ry);
  if (!STONEY.has(c)) return;
  const light = mat(lighter(c)),
    cs = Math.cos(ry),
    sn = Math.sin(ry);
  for (const [ox, oz] of [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ])
    mk(GB, light, g, x + ox * cs + oz * sn, y + 0.05, z - ox * sn + oz * cs, 0.045, h - 0.05, 0.045, ry);
}
/**
 * Wat spullen op de vrije hoeken van het erf: bij huizen een struik of bloembak, bij werkplaatsen kisten en
 * tonnen, bij het leger een wapenrek of een stapel kogels. Alleen waar nog niets staat, hoogstens twee.
 */
export function props(g: T3.Object3D, size: number, cat: string, seed: number) {
  if (!detail || size < 2) return;
  const taken = g.children.filter(isMesh).map(o => new T3.Box3().setFromObject(o));
  const half = size * 0.5 - 0.24;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  let placed = 0;
  for (let i = 0; i < 4 && placed < 2; i++) {
    const [x, z] = corners[(i + seed) % 4];
    tmpBox.min.set(x - 0.16, 0.05, z - 0.16);
    tmpBox.max.set(x + 0.16, 0.6, z + 0.16);
    if (taken.some(b => b.intersectsBox(tmpBox))) continue;
    const pick = hash01(seed, 10 + i);
    if (cat === 'home') {
      if (pick < 0.5) {
        cy(g, 0.07, 0.1, C.clay, x, 0.03, z, 8, 0.09); // bloempot met een struikje
        sp(g, 0.13, '#4d7d38', x, 0.2, z, 0);
      } else {
        bx(g, 0.34, 0.03, 0.12, C.wood, x, 0.14, z, 0.4); // bankje
        for (const e of [-0.13, 0.13])
          bx(g, 0.03, 0.14, 0.1, C.woodd, x + e * Math.cos(0.4), 0, z - e * Math.sin(0.4), 0.4);
      }
    } else if (cat === 'eco') {
      if (pick < 0.5) {
        bx(g, 0.22, 0.2, 0.22, C.wood, x, 0.03, z, 0.3); // kist
        bx(g, 0.24, 0.03, 0.24, C.woodd, x, 0.2, z, 0.3);
      } else {
        cy(g, 0.11, 0.26, C.woodd, x, 0.03, z, 8); // ton met twee hoepels
        for (const y of [0.08, 0.22]) cy(g, 0.115, 0.02, C.dmetal, x, y, z, 8);
      }
    } else if (pick < 0.5) {
      // Stapel kogels (of keien)
      for (const [ox, oz] of [
        [-0.06, -0.04],
        [0.06, -0.04],
        [0, 0.06],
      ])
        sp(g, 0.06, C.dmetal, x + ox, 0.09, z + oz, 0);
      sp(g, 0.06, C.dmetal, x, 0.19, z, 0);
    } else {
      // Wapenrek: twee palen, een dwarsbalk en speren
      for (const e of [-0.12, 0.12]) bx(g, 0.03, 0.34, 0.03, C.woodd, x + e, 0.03, z);
      bx(g, 0.3, 0.03, 0.03, C.woodd, x, 0.32, z);
      for (const e of [-0.07, 0, 0.07]) cy(g, 0.01, 0.5, C.wood, x + e, 0.03, z + 0.02, 4);
    }
    placed++;
  }
}
/** Stoepstenen (twee kleuren om en om) langs de rand van een ondergrond van `size` bij `size`. */
export function curb(g: T3.Object3D, size: number, c: string) {
  if (!detail) return;
  const a = mat(darker(c)),
    b = mat(lighter(c)),
    half = size * 0.485,
    n = Math.max(4, Math.round(size / 0.13));
  for (let i = 0; i < n; i++) {
    const t = -half + ((i + 0.5) / n) * size * 0.97,
      m = i % 2 ? a : b;
    mk(GB, m, g, t, 0, half, 0.09, 0.045, 0.06);
    mk(GB, m, g, t, 0, -half, 0.09, 0.045, 0.06);
    mk(GB, m, g, half, 0, t, 0.06, 0.045, 0.09);
    mk(GB, m, g, -half, 0, t, 0.06, 0.045, 0.09);
  }
}
export const cy = (
  g: T3.Object3D,
  r: number,
  h: number,
  c: Paint,
  x = 0,
  y = 0,
  z = 0,
  seg = 10,
  rt?: number,
) => mk(gCyl(rt ?? r, r, seg), M_(c), g, x, y, z, 1, h, 1);
export function cn(g: T3.Object3D, r: number, h: number, c: Paint, x = 0, y = 0, z = 0, seg = 10) {
  const cone = mk(gCyl(0, r, seg), M_(c), g, x, y, z, 1, h, 1);
  // Grote kegels zijn daken (hutten, tenten): een paar ringen geven lagen riet of huid
  if (detail && typeof c === 'string' && r >= 0.3 && h >= 0.3) {
    const dark = darker(c);
    for (const t of [0.16, 0.38, 0.6]) {
      const rb = r * (1 - t) * 1.04,
        rt = r * (1 - t - 0.06) * 1.04;
      mk(gCyl(rt, rb, seg), mat(dark), g, x, y + t * h, z, 1, h * 0.06, 1);
    }
  }
  return cone;
}
export const sp = (g: T3.Object3D, r: number, c: Paint, x = 0, y = 0, z = 0, d = 0, sy = 1) =>
  mk(gIco(d), M_(c), g, x, y, z, r, r * sy, r);
export function gr(g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) {
  const roof = mk(GPRISM, M_(c), g, x, y, z, w, h, d, ry);
  if (detail && typeof c === 'string' && h > 0.15 && w * d > 0.15) {
    roofCourses(g, w, h, d, c, x, y, z, ry);
    // Nokbalk bovenop en een daklijst langs de twee onderranden
    const dark = mat(darker(c)),
      cs = Math.cos(ry),
      sn = Math.sin(ry);
    mk(GB, dark, g, x, y + h - 0.01, z, w * 1.03, 0.035, 0.06, ry);
    for (const side of [1, -1])
      mk(GB, dark, g, x + sn * side * d * 0.5, y - 0.02, z + cs * side * d * 0.5, w * 1.03, 0.03, 0.035, ry);
  }
  return roof;
}
// Rijen dakpannen (of lagen riet): dunne latjes evenwijdig aan de nok, op beide dakvlakken.
// Het dak is zo geen glad vlak meer maar heeft reliëf, bij elk gebouw met een zadeldak.
const DARKER: Record<string, string> = {};
const darker = (c: string) => (DARKER[c] ||= '#' + new T3.Color(c).multiplyScalar(0.8).getHexString());
const LIGHTER: Record<string, string> = {};
const lighter = (c: string) =>
  (LIGHTER[c] ||= '#' + new T3.Color(c).lerp(new T3.Color('#ffffff'), 0.22).getHexString());
const courseTilt = new T3.Euler(0, 0, 0, 'YXZ');
function roofCourses(
  g: T3.Object3D,
  w: number,
  h: number,
  d: number,
  c: string,
  x: number,
  y: number,
  z: number,
  ry: number,
) {
  const dark = darker(c),
    tilt = Math.atan2(h, d / 2),
    rows = Math.max(2, Math.round(Math.hypot(h, d / 2) / 0.11)),
    cosY = Math.cos(ry),
    sinY = Math.sin(ry);
  for (const side of [1, -1])
    for (let r = 0; r < rows; r++) {
      const t = (r + 0.35) / rows, // van de dakrand (0) naar de nok (1)
        lz = side * (0.5 - t * 0.5) * d,
        ly = t * h,
        o = mk(GB, mat(dark), g, x + sinY * lz, y + ly, z + cosY * lz, w * 1.01, 0.014, 0.035);
      courseTilt.set(side * tilt, ry, 0);
      o.rotation.copy(courseTilt);
    }
}
export const pr = (g: T3.Object3D, w: number, h: number, d: number, c: Paint, x = 0, y = 0, z = 0, ry = 0) =>
  mk(GPYR, M_(c), g, x, y, z, w, h, d, ry);
// Ramen op de twee kanten die naar de camera wijzen, met een licht kozijn en een vensterbank
const FRAME = '#e3dccb';
export function wins(
  g: T3.Object3D,
  w: number,
  d: number,
  y: number,
  h: number,
  n: number,
  cx = 0,
  cz = 0,
  wd = 0.12,
) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, wd + 0.035, h + 0.035, 0.012, FRAME, cx + u, y - 0.0175, cz + d / 2 + 0.002);
    bx(g, wd + 0.05, 0.022, 0.035, FRAME, cx + u, y - 0.03, cz + d / 2 + 0.012);
    bx(g, wd, h, 0.02, WIN, cx + u, y, cz + d / 2 + 0.005);
    const v = -d / 2 + (d * (i + 0.5)) / n;
    bx(g, 0.012, h + 0.035, wd + 0.035, FRAME, cx + w / 2 + 0.002, y - 0.0175, cz + v);
    bx(g, 0.035, 0.022, wd + 0.05, FRAME, cx + w / 2 + 0.012, y - 0.03, cz + v);
    bx(g, 0.02, h, wd, WIN, cx + w / 2 + 0.005, y, cz + v);
    // Luiken naast elk raam, als daar ruimte voor is, en een kruisje van roeden in het glas
    if (detail && w / n - wd > 0.09 && d / n - wd > 0.09) {
      for (const sgn of [-1, 1]) {
        bx(g, 0.035, h + 0.01, 0.014, SHUTTER, cx + u + sgn * (wd / 2 + 0.03), y, cz + d / 2 + 0.004);
        bx(g, 0.014, h + 0.01, 0.035, SHUTTER, cx + w / 2 + 0.004, y, cz + v + sgn * (wd / 2 + 0.03));
      }
      bx(g, 0.008, h, 0.006, FRAME, cx + u, y, cz + d / 2 + 0.018);
      bx(g, wd, 0.008, 0.006, FRAME, cx + u, y + h / 2, cz + d / 2 + 0.018);
      bx(g, 0.006, h, 0.008, FRAME, cx + w / 2 + 0.018, y, cz + v);
      bx(g, 0.006, 0.008, wd, FRAME, cx + w / 2 + 0.018, y + h / 2, cz + v);
    }
  }
}
const SHUTTER = '#4b5a3e';
export function door(
  g: T3.Object3D,
  _w: number,
  d: number,
  dw = 0.16,
  dh = 0.26,
  c: Paint = '#4a3523',
  x = 0,
) {
  bx(g, dw, dh, 0.03, c, x, 0, d / 2 + 0.01);
  if (!detail) return;
  // Kozijn eromheen, een stoepje ervoor en een klink
  bx(g, dw + 0.04, dh + 0.02, 0.02, FRAME, x, 0, d / 2 + 0.004);
  bx(g, dw + 0.08, 0.025, 0.1, C.stoned, x, 0, d / 2 + 0.06);
  bx(g, 0.02, 0.02, 0.02, C.bronze, x + dw * 0.32, dh * 0.45, d / 2 + 0.03);
}
export function flagpole(g: T3.Object3D, x: number, y: number, z: number, h = 0.7, c: Paint = paint.team) {
  cy(g, 0.015, h, '#5d5348', x, y, z, 5);
  const f = bx(g, 0.26, 0.15, 0.015, c, x + 0.13, y + h - 0.17, z);
  f.userData.flag = 1;
  if (detail) sp(g, 0.025, C.bronze, x, y + h + 0.01, z);
  return f;
}
export function crenel(g: T3.Object3D, w: number, d: number, y: number, c: Paint, n = 4) {
  for (let i = 0; i < n; i++) {
    const u = -w / 2 + (w * (i + 0.5)) / n;
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, d / 2 - 0.04);
    bx(g, (w / n) * 0.5, 0.12, 0.08, c, u, y, -d / 2 + 0.04);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, w / 2 - 0.04, y, u);
    bx(g, 0.08, 0.12, (w / n) * 0.5, c, -w / 2 + 0.04, y, u);
  }
}
export function chim(g: T3.Object3D, x: number, y: number, z: number, h = 0.3, c: Paint = '#7b6a5a') {
  bx(g, 0.11, h, 0.11, c, x, y, z);
  bx(g, 0.14, 0.04, 0.14, '#4a403a', x, y + h, z);
  // Een rand net onder de kap en een pijpje erbovenop
  if (detail) {
    bx(g, 0.125, 0.03, 0.125, typeof c === 'string' ? darker(c) : c, x, y + h - 0.08, z);
    cy(g, 0.035, 0.05, '#3a332e', x, y + h + 0.04, z, 6);
  }
  // Onzichtbaar puntje bovenop: hier komt de rook uit (zie sync.ts)
  const top = new T3.Object3D();
  top.position.set(x, y + h + 0.06, z);
  top.userData.chim = 1;
  g.add(top);
}
export function flame(g: T3.Object3D, x: number, y: number, z: number, s = 1) {
  const f = new T3.Group();
  f.position.set(x, y, z);
  const a = new T3.Mesh(gCyl(0, 0.09 * s, 6), FIREM);
  a.scale.y = 0.26 * s;
  f.add(a);
  const b = new T3.Mesh(gCyl(0, 0.05 * s, 6), FIREM2);
  b.scale.y = 0.16 * s;
  f.add(b);
  f.userData.fire = 1;
  g.add(f);
  return f;
}
export const C = {
  wood: '#8a6a44',
  woodd: '#5f4630',
  thatch: '#b8955a',
  stone: '#aaa69b',
  stoned: '#86837b',
  plaster: '#e5dbc5',
  slate: '#566170',
  tile: '#a5523e',
  brick: '#a3553f',
  metal: '#8e979f',
  dmetal: '#4c5359',
  concrete: '#b8b9b2',
  glass: '#6fa7c4',
  clay: '#c6a479',
  bronze: '#b9853a',
  white: '#e9ecee',
  soil: '#6e5236',
};
export const GLASS = new T3.MeshStandardMaterial({
  color: '#7ab3cf',
  flatShading: true,
  roughness: 0.15,
  metalness: 0.4,
  emissive: new T3.Color('#ffd79a'),
  emissiveIntensity: 0,
});
// Gloeiende materialen voor het Sterrentijdperk: paars sterrenmetaal en roze fusie
export const VIOLETM = new T3.MeshStandardMaterial({
  color: '#2a1f4a',
  emissive: new T3.Color('#8a5cff'),
  emissiveIntensity: 0.9,
  flatShading: true,
});
export const PINKM = new T3.MeshStandardMaterial({
  color: '#4a1238',
  emissive: new T3.Color('#ff4fc0'),
  emissiveIntensity: 1.0,
  flatShading: true,
});
// Torus (ring) met cache, voor poorten, reactoren en koepels
export function gTorus(r: number, t: number, rs = 8, ts = 24) {
  const k = 't' + r + '_' + t + '_' + rs + '_' + ts;
  return GC[k] || (GC[k] = new T3.TorusGeometry(r, t, rs, ts));
}
