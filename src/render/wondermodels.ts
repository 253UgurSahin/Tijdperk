// De 3D-modellen van de wereldwonderen: herkenbare bouwwerken van drie bij drie tegels.
import * as T3 from 'three';
import { TAU } from '../config';
import {
  CYANM,
  GB,
  GLASS,
  M_,
  VIOLETM,
  WIN,
  bx,
  cn,
  cy,
  flagpole,
  flame,
  gCyl,
  gDod,
  gTorus,
  gr,
  mat,
  mergeStatic,
  mk,
  paint,
  pr,
  sp,
} from './kit';

/*
 * Elk model staat in het midden van zijn plek: x en z lopen van -1,5 tot 1,5 (één tegel = 1).
 * De camera kijkt vanaf de kant van +x en +z: daar staan de voorkanten en de details.
 */

// ---- Hulpjes ----

const UP = new T3.Vector3(0, 1, 0),
  DIR = new T3.Vector3();

/** Een balk van punt (x0, y0, z0) naar punt (x1, y1, z1), met een vierkante doorsnede van w. */
function beam(
  g: T3.Object3D,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  w: number,
  c: string,
) {
  DIR.set(x1 - x0, y1 - y0, z1 - z0);
  const length = DIR.length();
  const o = mk(GB, M_(c), g, x0, y0, z0, w, length, w);
  o.quaternion.setFromUnitVectors(UP, DIR.normalize());
  return o;
}

/** Een vast "toevalsgetal" tussen 0 en 1 per nummer: zo ziet elke kei er anders uit, maar altijd hetzelfde. */
const wobble = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Een ronde boog (halve ring) die rechtop staat, zoals onder de Eiffeltoren. */
const ARCH = new T3.TorusGeometry(1, 0.06, 4, 14, Math.PI);

// Water in een wonder (de haven, de zee bij de Deltawerken): iets glanzender dan de grond
const WATER = mat('#3d6d8a', { r: 0.3, m: 0.1 });
// Goud dat glimt (de punt van de piramide)
const GOLD = mat('#e2b13c', { m: 0.6, r: 0.35 });

/** Een palmboom: stam en vijf bladeren die naar buiten hangen. */
function palm(g: T3.Object3D, x: number, z: number, h = 0.55) {
  beam(g, x, 0.05, z, x + 0.05, 0.05 + h, z + 0.03, 0.045, '#7a5a3a');
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    beam(
      g,
      x + 0.05,
      0.05 + h,
      z + 0.03,
      x + 0.05 + Math.cos(a) * 0.28,
      h - 0.08,
      z + 0.03 + Math.sin(a) * 0.28,
      0.05,
      '#5f8a3a',
    );
  }
}

/** Een ronde boom met een kruin. */
function tree(g: T3.Object3D, x: number, z: number, s = 1) {
  cy(g, 0.035 * s, 0.3 * s, '#6a4e34', x, 0.04, z, 5);
  sp(g, 0.22 * s, '#5e8a40', x, 0.4 * s, z, 1, 1.1);
}

/** Een windmolen van nu: witte paal en een rotor die draait (zie sync.ts: spin). */
function windTurbine(g: T3.Object3D, x: number, y: number, z: number, h: number) {
  cy(g, 0.04, h, '#f1f1ee', x, y, z, 8, 0.022);
  bx(g, 0.09, 0.08, 0.18, '#e6e6e2', x, y + h - 0.02, z - 0.02);
  const rotor = new T3.Group();
  rotor.position.set(x, y + h + 0.02, z + 0.08);
  rotor.userData.spin = 1.4;
  rotor.userData.axis = 'z';
  for (let k = 0; k < 3; k++) {
    const blade = bx(rotor, 0.045, 0.5, 0.012, '#f6f6f3');
    blade.rotation.z = (k / 3) * TAU;
  }
  sp(rotor, 0.04, '#dcdcd8');
  g.add(mergeStatic(rotor));
}

// ---- De wonderen ----

/** Per wereldwonder een functie die zijn model bouwt in groep g. */
export const WONDER_MODELS: Record<string, (g: T3.Group) => void> = {
  dolmen(g) {
    // Hunebed: een lage grasheuvel met een krans van keien, en daarop een kamer van reuzenkeien
    mk(gCyl(0.78, 1, 18), M_('#7b8a4e'), g, 0, 0, 0, 1.38, 0.14, 1.08);
    const GRANITE = ['#8e8a83', '#a09a8e', '#7f7c77', '#97928a', '#8a857b'];
    const granite = (i: number) => GRANITE[Math.floor(wobble(i) * GRANITE.length)];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * TAU;
      mk(
        gDod(),
        M_(granite(k)),
        g,
        Math.cos(a) * 1.3,
        0.05,
        Math.sin(a) * 1.02,
        0.09,
        0.07 + wobble(k + 9) * 0.04,
        0.09,
      );
    }
    // Draagstenen in twee rijen, en een sluitsteen aan elke kant
    for (const z of [-0.36, 0.36])
      for (let i = 0; i < 4; i++) {
        const x = -0.78 + i * 0.52 + (wobble(i * 7 + z * 10) - 0.5) * 0.08;
        const s = mk(gDod(), M_(granite(i + z * 10)), g, x, 0.44, z, 0.21, 0.31, 0.19);
        s.rotation.y = wobble(i + 30) * TAU;
      }
    for (const x of [-1.05, 1.05]) mk(gDod(), M_(granite(x * 3)), g, x, 0.4, 0, 0.16, 0.26, 0.25);
    // Dekstenen: drie platte reuzenkeien, met wat mos erop
    for (let i = 0; i < 3; i++) {
      const x = -0.55 + i * 0.55;
      const s = mk(gDod(), M_(granite(i + 50)), g, x, 0.84, (wobble(i + 60) - 0.5) * 0.06, 0.4, 0.17, 0.52);
      s.rotation.y = (wobble(i + 70) - 0.5) * 0.5;
      sp(g, 0.12, '#6f8546', x + 0.08, 0.98, 0.1, 0, 0.35);
    }
    // Ingang aan de voorkant, met platte stapstenen ernaartoe
    for (const x of [-0.2, 0.2]) mk(gDod(), M_(granite(x * 20)), g, x, 0.3, 0.56, 0.1, 0.18, 0.09);
    for (let i = 0; i < 4; i++)
      mk(gDod(), M_('#9c968a'), g, (wobble(i + 80) - 0.5) * 0.1, 0.13, 0.65 + i * 0.2, 0.11, 0.025, 0.09);
    // Twee rechtopstaande stenen (menhirs) en een offervuur
    mk(gDod(), M_('#9d978b'), g, -1.18, 0.38, 0.95, 0.12, 0.4, 0.1);
    mk(gDod(), M_('#8f8a80'), g, 1.2, 0.33, -0.9, 0.1, 0.34, 0.09);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      sp(g, 0.05, '#6e6a64', 0.95 + Math.cos(a) * 0.15, 0.1, 0.85 + Math.sin(a) * 0.15);
    }
    flame(g, 0.95, 0.1, 0.85, 1.1);
    flagpole(g, -1.2, 0.05, -0.75, 1.0);
  },

  pyramid(g) {
    // Piramide: een berg van zandsteen met een gouden punt, twee obelisken en een sfinx
    const SAND = '#d6b77a';
    bx(g, 2.95, 0.05, 2.95, '#dcc597');
    pr(g, 2.5, 1.75, 2.5, SAND, 0, 0.05, 0);
    // Lagen stenen: dunne randjes op een paar hoogtes
    for (let i = 1; i < 9; i++) {
      const t = i / 10,
        w = 2.5 * (1 - t) + 0.014;
      bx(g, w, 0.014, w, '#bc9b5f', 0, 0.05 + 1.75 * t, 0);
    }
    mk(gCyl(0, Math.SQRT1_2, 4), GOLD, g, 0, 0.05 + 1.75 * 0.86, 0, 0.36, 0.25, 0.36, Math.PI / 4);
    // De ingang: een stenen poortje in de voorkant
    bx(g, 0.34, 0.36, 0.32, '#cfb072', 0, 0.05, 1.1);
    bx(g, 0.14, 0.22, 0.02, '#3a2e22', 0, 0.05, 1.265);
    gr(g, 0.32, 0.12, 0.38, '#c5a464', 0, 0.41, 1.1, Math.PI / 2);
    // Obelisken aan weerszijden van de ingang
    for (const x of [-0.5, 0.5]) {
      bx(g, 0.1, 0.62, 0.1, '#cdb27a', x, 0.05, 1.38);
      mk(gCyl(0, Math.SQRT1_2, 4), GOLD, g, x, 0.67, 1.38, 0.1, 0.1, 0.1, Math.PI / 4);
    }
    // De sfinx, op wacht aan de zijkant
    bx(g, 0.18, 0.12, 0.44, SAND, 1.35, 0.05, 0.18);
    bx(g, 0.16, 0.04, 0.14, SAND, 1.35, 0.05, 0.46);
    bx(g, 0.13, 0.16, 0.12, SAND, 1.35, 0.15, 0.36);
    bx(g, 0.15, 0.06, 0.1, '#3d5a8a', 1.35, 0.25, 0.35);
    palm(g, -1.32, 1.05);
    palm(g, 1.3, -1.15, 0.5);
    palm(g, -1.2, -1.32, 0.45);
  },

  colosseum(g) {
    // Colosseum: een ovale arena met drie rijen bogen; aan de voorkant is de bovenste rand ingestort
    const STONE = '#cbb58f',
      LIGHT = '#dccaa5',
      DARK = '#5e4e3c';
    mk(gCyl(1, 1, 28), M_('#b3a58a'), g, 0, 0, 0, 1.48, 0.04, 1.24);
    mk(gCyl(1, 1, 24), M_('#d8c497'), g, 0, 0.04, 0, 0.6, 0.02, 0.42);
    // Gangen onder de arena, waar de dieren wachtten
    for (const z of [-0.2, 0, 0.2]) bx(g, 0.9, 0.05, 0.03, '#9c8a6e', 0, 0.05, z);
    const RX = 1.3,
      RZ = 1.06,
      N = 28;
    // Een punt op de ovaal (f = hoe ver naar binnen), met de draaiing van de rand daar
    const onRing = (a: number, f: number) => {
      const tx = -Math.sin(a) * RX,
        tz = Math.cos(a) * RZ;
      return {
        x: Math.cos(a) * RX * f,
        z: Math.sin(a) * RZ * f,
        ry: Math.atan2(-tz, tx),
        len: Math.hypot(tx, tz) * f * (TAU / N),
      };
    };
    // Tribunes: ringen die naar binnen lager worden
    for (let i = 0; i < 4; i++) {
      const f = 0.52 + i * 0.12;
      for (let k = 0; k < N; k++) {
        const p = onRing((k / N) * TAU, f);
        bx(g, p.len * 1.04, 0.1 + i * 0.12, 0.15, i % 2 ? LIGHT : STONE, p.x, 0.04, p.z, p.ry);
      }
    }
    // De buitenmuur: pijlers met bogen ertussen, drie rijen hoog
    const TH = 0.32;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU;
      // Achterkant (van de camera af): heel; voorkant: de bovenste rij is ingestort
      const front = Math.cos(a) + Math.sin(a) > 0.4;
      const tiers = front ? 2 : 3;
      const pier = onRing(a, 1),
        mid = onRing(a + Math.PI / N, 1),
        inner = onRing(a + Math.PI / N, 0.975);
      for (let j = 0; j < tiers; j++) {
        const y = 0.04 + j * TH;
        bx(g, 0.07, TH, 0.17, STONE, pier.x, y, pier.z, pier.ry);
        bx(g, mid.len * 0.62, TH * 0.64, 0.1, DARK, inner.x, y + 0.03, inner.z, mid.ry);
        bx(
          g,
          mid.len * 1.02,
          TH * 0.3,
          0.16,
          j === tiers - 1 ? LIGHT : STONE,
          mid.x,
          y + TH * 0.67,
          mid.z,
          mid.ry,
        );
      }
      // Bovenop de achterkant: een dichte rand met kleine raampjes
      if (!front) {
        bx(g, mid.len * 1.02, 0.2, 0.16, LIGHT, mid.x, 0.04 + 3 * TH, mid.z, mid.ry);
        if (k % 2)
          bx(
            g,
            0.05,
            0.07,
            0.02,
            DARK,
            onRing(a + Math.PI / N, 1.06).x,
            0.04 + 3 * TH + 0.07,
            onRing(a + Math.PI / N, 1.06).z,
            mid.ry,
          );
      }
    }
    // Vaandels bovenop de achterkant
    flagpole(g, -0.9, 1.2, -0.75, 0.45);
    flagpole(g, -0.2, 1.2, -1.05, 0.45);
  },

  cathedral(g) {
    // Dom van Utrecht: de losse Domtoren (achter) en het koor van de kerk (voor), op het Domplein
    const STONE = '#a99d8a',
      TRIM = '#857a6a',
      DARK = '#3a342e',
      SLATE = '#56606b';
    bx(g, 2.95, 0.04, 2.95, '#b5a68a');
    // ---- De toren ----
    const tx = -0.68,
      tz = -0.68;
    const tall = (w: number, y: number, h: number) => {
      bx(g, w, h, w, STONE, tx, y, tz);
      // Steunberen op de hoeken
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) bx(g, 0.12, h, 0.12, TRIM, tx + (sx * w) / 2, y, tz + (sz * w) / 2);
      // Hoge spitse ramen op de twee kanten naar de camera
      for (const u of [-w / 4, w / 4])
        for (const wy of [y + h * 0.18, y + h * 0.56]) {
          bx(g, 0.1, h * 0.3, 0.02, DARK, tx + u, wy, tz + w / 2 + 0.005);
          bx(g, 0.02, h * 0.3, 0.1, DARK, tx + w / 2 + 0.005, wy, tz + u);
        }
      bx(g, w + 0.08, 0.06, w + 0.08, TRIM, tx, y + h, tz);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cn(g, 0.05, 0.2, TRIM, tx + (sx * w) / 2, y + h + 0.06, tz + (sz * w) / 2, 5);
    };
    tall(0.95, 0.04, 1.22);
    tall(0.78, 1.32, 0.9);
    // De doorgang onder de toren
    bx(g, 0.3, 0.4, 0.02, DARK, tx, 0.04, tz + 0.48);
    // Klok aan de voorkant
    const clock = cy(g, 0.13, 0.02, '#eee8d8', tx, 1.78, tz + 0.4, 16);
    clock.rotation.x = Math.PI / 2;
    bx(g, 0.012, 0.09, 0.012, DARK, tx, 1.78, tz + 0.415);
    // De achthoekige lantaarn met torentjes eromheen, en de kroon
    const ly = 2.28;
    cy(g, 0.35, 0.7, STONE, tx, ly, tz, 8);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + TAU / 16,
        dx = Math.sin(a),
        dz = Math.cos(a);
      bx(g, 0.08, 0.46, 0.02, DARK, tx + dx * 0.33, ly + 0.12, tz + dz * 0.33, Math.atan2(dx, dz));
      cn(g, 0.04, 0.28, TRIM, tx + dx * 0.42, ly, tz + dz * 0.42, 5);
    }
    cy(g, 0.39, 0.06, TRIM, tx, ly + 0.7, tz, 8);
    cn(g, 0.3, 0.34, SLATE, tx, ly + 0.76, tz, 8);
    cy(g, 0.012, 0.22, '#d9b860', tx, ly + 1.08, tz, 4);
    sp(g, 0.03, '#d9b860', tx, ly + 1.3, tz);
    // ---- Het koor van de kerk ----
    const cx = 0.38,
      cz = 0.5;
    bx(g, 1.45, 0.75, 0.88, STONE, cx, 0.04, cz);
    gr(g, 1.5, 0.55, 0.96, SLATE, cx, 0.79, cz);
    cy(g, 0.44, 0.75, STONE, cx + 0.72, 0.04, cz, 8);
    cn(g, 0.47, 0.5, SLATE, cx + 0.72, 0.79, cz, 8);
    // Steunbogen en hoge glas-in-loodramen aan de voorkant
    for (let i = 0; i < 4; i++) {
      const x = cx - 0.6 + i * 0.36;
      bx(g, 0.09, 0.56, 0.12, TRIM, x, 0.04, cz + 0.55);
      beam(g, x, 0.58, cz + 0.55, x, 0.74, cz + 0.44, 0.05, TRIM);
      if (i < 3) bx(g, 0.13, 0.46, 0.02, WIN, x + 0.18, 0.18, cz + 0.445);
    }
    // Een spits torentje op de nok
    cy(g, 0.06, 0.2, TRIM, cx - 0.2, 1.24, cz, 6);
    cn(g, 0.07, 0.38, SLATE, cx - 0.2, 1.44, cz, 6);
    // Een paar bomen op het plein
    tree(g, -1.2, 0.95);
    tree(g, 1.25, -1.0, 0.9);
    tree(g, 0.2, -1.2, 0.8);
  },

  eastindia(g) {
    // Oost-Indisch Huis: het kantoor van de handel aan de kade, met een groot schip in de haven
    const BRICK = '#9b4f39',
      WHITE = '#ede3cf',
      SLATE = '#4c5663',
      HULL = '#5b3b25',
      WOOD = '#8a6a44';
    bx(g, 2.95, 0.05, 1.7, '#b9ab8e', 0, 0, -0.62);
    bx(g, 2.95, 0.02, 1.25, WATER, 0, 0, 0.86);
    bx(g, 2.95, 0.08, 0.1, '#8d8679', 0, 0, 0.23);
    // Het kantoor: baksteen met witte banden, rijen ramen en een hoog dak
    bx(g, 2.3, 0.95, 0.85, BRICK, 0, 0.05, -0.85);
    for (const y of [0.37, 0.69]) bx(g, 2.32, 0.035, 0.87, WHITE, 0, y, -0.85);
    for (const y of [0.15, 0.47, 0.76])
      for (let i = 0; i < 7; i++) {
        const x = -0.98 + i * 0.327;
        if (Math.abs(x) < 0.25) continue; // daar zit de witte middenpartij
        bx(g, 0.13, 0.17, 0.02, WIN, x, y, -0.42);
      }
    for (const y of [0.15, 0.47, 0.76])
      for (const z of [-1.1, -0.85, -0.6]) bx(g, 0.02, 0.17, 0.13, WIN, 1.155, y, z);
    gr(g, 2.36, 0.52, 0.93, SLATE, 0, 1.0, -0.85);
    // De witte middenpartij met een fronton en de deur
    bx(g, 0.5, 1.05, 0.12, WHITE, 0, 0.05, -0.38);
    gr(g, 0.12, 0.2, 0.54, WHITE, 0, 1.1, -0.38, Math.PI / 2);
    bx(g, 0.18, 0.3, 0.02, '#3b2a1a', 0, 0.05, -0.315);
    for (const y of [0.47, 0.76]) bx(g, 0.14, 0.17, 0.02, WIN, 0, y, -0.315);
    // Torentje op het dak, met de vlag van de handelsvloot
    bx(g, 0.26, 0.2, 0.26, WHITE, 0, 1.36, -0.85);
    cy(g, 0.14, 0.16, SLATE, 0, 1.56, -0.85, 8);
    cn(g, 0.16, 0.26, '#3f7a5c', 0, 1.72, -0.85, 8);
    flagpole(g, 0, 1.98, -0.85, 0.45, '#e0712c');
    // Het schip: romp, achterkasteel, drie masten met zeilen
    const sz = 0.86;
    bx(g, 1.3, 0.22, 0.36, HULL, 0.02, -0.02, sz);
    bx(g, 0.26, 0.22, 0.26, HULL, 0.7, -0.02, sz, Math.PI / 4);
    bx(g, 0.32, 0.2, 0.38, HULL, -0.5, 0.2, sz);
    bx(g, 1.36, 0.025, 0.37, '#c9a24a', 0.02, 0.17, sz);
    bx(g, 0.34, 0.025, 0.39, '#c9a24a', -0.5, 0.38, sz);
    bx(g, 1.24, 0.02, 0.32, '#a8814f', 0.02, 0.18, sz);
    for (const [x, h] of [
      [-0.32, 0.92],
      [0.1, 1.06],
      [0.48, 0.86],
    ]) {
      cy(g, 0.018, h, '#4a3524', x, 0.18, sz, 5);
      bx(g, 0.03, 0.3, 0.36, '#efe6d2', x + 0.03, 0.38, sz);
      bx(g, 0.03, 0.2, 0.28, '#efe6d2', x + 0.03, 0.73, sz);
      bx(g, 0.012, 0.06, 0.1, '#e0712c', x, 0.18 + h - 0.07, sz + 0.05);
    }
    beam(g, 0.78, 0.18, sz, 1.16, 0.4, sz, 0.02, '#4a3524');
    // Op de kade: kisten, vaten en een houten kraan
    for (const [x, z] of [
      [-0.9, 0.0],
      [-0.75, 0.05],
      [0.8, -0.05],
    ])
      bx(g, 0.16, 0.16, 0.16, '#9a7446', x, 0.05, z);
    for (const x of [0.5, 0.62, 1.1]) cy(g, 0.06, 0.15, '#7a5531', x, 0.05, 0.05, 8);
    beam(g, -1.25, 0.05, 0.05, -1.25, 0.9, 0.05, 0.06, WOOD);
    beam(g, -1.25, 0.85, 0.05, -0.95, 0.82, 0.5, 0.04, WOOD);
    cy(g, 0.006, 0.4, '#3a2e22', -0.95, 0.42, 0.5, 3);
  },

  eiffel(g) {
    // Eiffeltoren: vier gebogen poten van staal die samenkomen in één spits, met twee platforms
    const IRON = '#7d5d45',
      DARK = '#5e4433';
    bx(g, 2.95, 0.04, 2.95, '#cbbd96');
    for (const x of [-0.75, 0.75]) bx(g, 0.9, 0.08, 0.22, '#5d8a3e', x, 0.04, 1.3);
    // Hoe breed de toren is op hoogte y: onderaan breed, naar boven steeds smaller (een mooie bocht)
    const half = (y: number) => 0.07 + 0.95 * Math.exp(-y * 1.35);
    const LEVELS = [0, 0.32, 0.62, 0.95, 1.3, 1.75, 2.25, 2.8, 3.3];
    const thick = (y: number) => 0.03 + 0.17 * Math.exp(-y * 1.1);
    const CORNERS = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const y0 = LEVELS[i] + 0.04,
        y1 = LEVELS[i + 1] + 0.04,
        r0 = half(LEVELS[i]),
        r1 = half(LEVELS[i + 1]);
      for (const [sx, sz] of CORNERS)
        beam(g, sx * r0, y0, sz * r0, sx * r1, y1, sz * r1, thick(LEVELS[i]), IRON);
      if (i === 0) continue; // onderaan zitten de bogen
      // Kruisverbanden op alle vier de zijden: het bekende vakwerk
      const w = 0.022;
      for (const s of [1, -1]) {
        beam(g, s * r0, y0, -r0, s * r1, y1, r1, w, IRON);
        beam(g, s * r0, y0, r0, s * r1, y1, -r1, w, IRON);
        beam(g, -r0, y0, s * r0, r1, y1, s * r1, w, IRON);
        beam(g, r0, y0, s * r0, -r1, y1, s * r1, w, IRON);
      }
    }
    // Bogen tussen de poten, op elke zijde
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      const arch = mk(ARCH, M_(IRON), g, Math.sin(a) * 0.74, 0.04, Math.cos(a) * 0.74, 0.6, 0.6, 0.6);
      arch.rotation.y = a;
    }
    // Eerste en tweede platform, met een reling
    const p1 = half(0.62) + 0.14,
      p2 = half(1.3) + 0.08;
    bx(g, p1 * 2, 0.08, p1 * 2, DARK, 0, 0.64, 0);
    bx(g, p1 * 2 + 0.02, 0.05, p1 * 2 + 0.02, IRON, 0, 0.74, 0);
    bx(g, p2 * 2, 0.06, p2 * 2, DARK, 0, 1.32, 0);
    bx(g, p2 * 2 + 0.02, 0.04, p2 * 2 + 0.02, IRON, 0, 1.4, 0);
    // De top: een huisje, een antenne en een rood lampje
    bx(g, 0.2, 0.14, 0.2, DARK, 0, 3.34, 0);
    cy(g, 0.012, 0.4, '#8a8f94', 0, 3.48, 0, 4);
    mk(gCyl(1, 1, 6), mat('#ff4a3a', { e: '#ff4a3a' }), g, 0, 3.86, 0, 0.025, 0.04, 0.025);
  },

  deltaworks(g) {
    // Deltawerken: een stormvloedkering in zee, met pijlers, schuiven en een weg erover; windmolens op de dijk
    const CONCRETE = '#b8b9b2',
      STEEL = '#55606b',
      GREEN = '#6f8f4a';
    bx(g, 2.95, 0.03, 2.95, WATER, 0, 0, 0);
    // Dijken aan beide kanten, met basalt langs het water
    for (const s of [-1, 1]) {
      bx(g, 0.56, 0.22, 2.95, GREEN, s * 1.2, 0, 0);
      bx(g, 0.06, 0.24, 2.95, '#4a4a48', s * 0.92, 0, 0);
    }
    const PIERS = [-0.68, -0.34, 0, 0.34, 0.68];
    for (const x of PIERS) {
      bx(g, 0.2, 0.08, 0.56, '#a5a69f', x, 0, 0);
      bx(g, 0.12, 0.85, 0.42, CONCRETE, x, 0, 0);
      bx(g, 0.16, 0.06, 0.46, '#c9cac3', x, 0.85, 0);
      // Machinehuisje met een rode streep
      bx(g, 0.12, 0.12, 0.18, '#ecebe5', x, 0.91, -0.06);
      bx(g, 0.124, 0.025, 0.184, '#c0392b', x, 0.98, -0.06);
    }
    // Tussen de pijlers: een drempel onder water, een stalen schuif (half open) en schuim aan de zeekant
    for (let i = 0; i < PIERS.length - 1; i++) {
      const x = (PIERS[i] + PIERS[i + 1]) / 2;
      bx(g, 0.24, 0.05, 0.3, '#9a9b95', x, 0, 0);
      bx(g, 0.22, 0.3, 0.05, STEEL, x, 0.16, -0.12);
      bx(g, 0.22, 0.04, 0.06, '#c0392b', x, 0.46, -0.12);
      bx(g, 0.16, 0.012, 0.06, '#e8f1f4', x, 0.03, -0.34);
      bx(g, 0.1, 0.012, 0.05, '#e8f1f4', x + 0.05, 0.03, -0.5);
    }
    // De weg bovenop, met witte strepen
    bx(g, 1.62, 0.07, 0.3, '#8f9297', 0, 0.62, 0.12);
    bx(g, 1.62, 0.012, 0.2, '#3d4045', 0, 0.69, 0.12);
    for (let i = 0; i < 6; i++) bx(g, 0.1, 0.014, 0.015, '#f2f2ee', -0.7 + i * 0.28, 0.692, 0.12);
    // Golven aan de zeekant
    for (let i = 0; i < 7; i++)
      bx(g, 0.26, 0.012, 0.03, '#5d8aa6', -0.75 + wobble(i) * 1.5, 0.03, -0.75 - wobble(i + 5) * 0.6);
    // Een wachtpost met de Nederlandse vlag, en windmolens op de dijken
    bx(g, 0.36, 0.3, 0.36, '#e3e1da', 1.2, 0.22, 0.95);
    bx(g, 0.37, 0.06, 0.37, GLASS, 1.2, 0.4, 0.95);
    flagpole(g, 1.32, 0.52, 0.78, 0.5, '#c8102e');
    windTurbine(g, -1.2, 0.22, 0.95, 1.5);
    windTurbine(g, 1.2, 0.22, -0.95, 1.3);
  },

  spacestation(g) {
    // Ruimtestation: een lanceerplaats met raket, een grote schotel, en hoog erboven een draaiend station
    const WHITE = '#f0f1f3',
      RED = '#b5452f';
    bx(g, 2.95, 0.04, 2.95, '#a9aca8');
    // Lanceerplatform met de raket en een rode toren ernaast (voorin, zodat het station achterin vrij hangt)
    const rx = 0.6,
      rz = 0.6;
    bx(g, 1.05, 0.1, 1.05, '#8e918e', rx, 0.04, rz);
    cy(g, 0.12, 1.1, WHITE, rx, 0.14, rz, 12);
    for (const y of [0.5, 0.95]) cy(g, 0.123, 0.06, '#2a2c30', rx, 0.14 + y, rz, 12);
    cy(g, 0.1, 0.35, WHITE, rx, 1.24, rz, 12);
    cn(g, 0.1, 0.3, WHITE, rx, 1.59, rz, 12);
    cn(g, 0.03, 0.08, RED, rx, 1.86, rz, 8);
    for (const s of [-1, 1]) {
      cy(g, 0.05, 0.6, '#e4e5e7', rx + s * 0.17, 0.14, rz, 8);
      cn(g, 0.05, 0.12, '#e4e5e7', rx + s * 0.17, 0.74, rz, 8);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + TAU / 8;
      bx(g, 0.02, 0.18, 0.12, RED, rx + Math.cos(a) * 0.12, 0.14, rz + Math.sin(a) * 0.12, -a);
    }
    const gx = rx - 0.4;
    for (const [dx, dz] of [
      [-0.08, -0.08],
      [0.08, -0.08],
      [-0.08, 0.08],
      [0.08, 0.08],
    ])
      bx(g, 0.03, 1.6, 0.03, RED, gx + dx, 0.14, rz + dz);
    for (let i = 0; i < 7; i++) {
      const y = 0.3 + i * 0.22;
      bx(g, 0.19, 0.025, 0.19, RED, gx, y, rz);
      beam(g, gx + 0.08, y, rz + 0.08, gx + 0.08, y + 0.22, rz - 0.08, 0.015, RED);
    }
    bx(g, 0.22, 0.04, 0.05, RED, (gx + rx) / 2, 1.2, rz);
    // Grote schotel die langzaam rondkijkt
    cy(g, 0.08, 0.35, '#c7cacd', -0.75, 0.04, 0.75, 8);
    const dish = new T3.Group();
    dish.position.set(-0.75, 0.4, 0.75);
    dish.userData.spin = 0.2;
    bx(dish, 0.1, 0.12, 0.1, '#b0b4b8');
    const bowl = mk(gCyl(0.46, 0.08, 18), M_('#e6e8ea'), dish, 0, 0.1, 0, 1, 0.18, 1);
    bowl.rotation.x = 0.55;
    beam(dish, 0, 0.14, 0, 0, 0.5, 0.22, 0.02, '#9aa0a6');
    sp(dish, 0.04, '#d0d4d8', 0, 0.5, 0.22);
    g.add(mergeStatic(dish));
    // Het gebouw van de vluchtleiding, met zonnepanelen op het dak
    bx(g, 0.9, 0.32, 0.6, '#dfe2e4', 0.72, 0.04, -0.78);
    bx(g, 0.92, 0.08, 0.62, GLASS, 0.72, 0.2, -0.78);
    for (const x of [0.5, 0.94]) {
      const panel = bx(g, 0.3, 0.02, 0.4, '#28457a', x, 0.4, -0.78);
      panel.rotation.x = 0.3;
    }
    // Bolvormige brandstoftanks achteraan
    for (const [x, z] of [
      [-0.95, -0.6],
      [-0.55, -0.95],
    ]) {
      for (const [dx, dz] of [
        [-0.1, 0],
        [0.1, 0],
        [0, 0.1],
      ])
        bx(g, 0.03, 0.2, 0.03, '#8e939a', x + dx, 0.04, z + dz);
      sp(g, 0.19, '#e9eaec', x, 0.36, z, 1);
    }
    // Een straal naar het station boven
    bx(g, 0.12, 0.08, 0.12, '#c7cacd', -0.45, 0.04, -0.45);
    mk(gCyl(0.012, 0.012, 6), CYANM, g, -0.45, 0.12, -0.45, 1, 2.5, 1).castShadow = false;
    // Het station zelf: een draaiende ring met spaken, een kern en zonnevleugels
    const st = new T3.Group();
    st.position.set(-0.45, 2.7, -0.45);
    st.userData.spin = 0.25;
    const ring = mk(gTorus(0.72, 0.07, 6, 32), M_('#d9dde3'), st, 0, 0, 0, 1, 1, 1);
    ring.rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) {
      const spoke = bx(st, 1.44, 0.03, 0.03, '#b8bec6', 0, -0.015, 0);
      spoke.rotation.y = (k / 4) * Math.PI;
    }
    cy(st, 0.16, 0.34, '#e3e6ea', 0, -0.17, 0, 10);
    bx(st, 0.03, 0.03, 2.4, '#9aa0a6', 0, -0.015, 0);
    for (const s of [-1, 1]) bx(st, 0.42, 0.012, 0.5, '#28457a', 0, -0.006, s * 1.0);
    mergeStatic(st);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      mk(GB, CYANM, st, Math.cos(a) * 0.72, -0.03, Math.sin(a) * 0.72, 0.06, 0.06, 0.06);
    }
    g.add(st);
  },

  spacelift(g) {
    // Ruimtelift: een zeshoekig anker met een gloeiende kabel tot in de ruimte, liften en een station bovenaan
    const METAL = '#bfc5cf';
    cy(g, 1.42, 0.1, METAL, 0, 0, 0, 6);
    cy(g, 1.05, 0.1, '#d9dde5', 0, 0.1, 0, 6);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      mk(GB, VIOLETM, g, Math.cos(a) * 1.28, 0.1, Math.sin(a) * 1.28, 0.08, 0.02, 0.08);
    }
    // Het anker in het midden, met drie spankabels naar de hoofdkabel
    cy(g, 0.42, 0.55, '#aeb6c2', 0, 0.2, 0, 6);
    cy(g, 0.3, 0.2, '#d4d9e1', 0, 0.75, 0, 6);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      beam(g, Math.cos(a) * 0.95, 0.2, Math.sin(a) * 0.95, 0, 1.4, 0, 0.03, '#9aa3b0');
      bx(g, 0.16, 0.1, 0.16, '#8a93a0', Math.cos(a) * 0.95, 0.2, Math.sin(a) * 0.95);
    }
    mk(gCyl(0.03, 0.03, 6), VIOLETM, g, 0, 0.95, 0, 1, 3.6, 1);
    // Twee liften onderweg langs de kabel
    for (const [y, s] of [
      [1.8, 1],
      [3.0, 0.8],
    ]) {
      cy(g, 0.12 * s, 0.24 * s, '#e7eaf0', 0, y, 0, 8);
      mk(gCyl(0.124 * s, 0.124 * s, 8), CYANM, g, 0, y + 0.1 * s, 0, 1, 0.04 * s, 1);
      cn(g, 0.12 * s, 0.08 * s, '#c9ced8', 0, y + 0.24 * s, 0, 8);
    }
    // Het station bovenaan draait langzaam rond
    const top = new T3.Group();
    top.position.set(0, 4.5, 0);
    top.userData.spin = 0.3;
    const ring = mk(gTorus(0.5, 0.06, 6, 28), M_('#d9dde5'), top, 0, 0, 0, 1, 1, 1);
    ring.rotation.x = Math.PI / 2;
    cy(top, 0.14, 0.24, '#e7eaf0', 0, -0.12, 0, 8);
    for (let k = 0; k < 3; k++) {
      const arm = bx(top, 1.0, 0.03, 0.03, '#b8bec6', 0, -0.015, 0);
      arm.rotation.y = (k / 3) * Math.PI;
    }
    mergeStatic(top);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      mk(GB, VIOLETM, top, Math.cos(a) * 0.5, -0.03, Math.sin(a) * 0.5, 0.05, 0.05, 0.05);
    }
    g.add(top);
    // Containers en een kraantje op het platform
    for (const [x, z, c] of [
      [0.75, 0.55, '#c0392b'],
      [0.75, 0.75, '#2f6fd6'],
      [-0.85, 0.45, '#e0a823'],
      [0.3, 0.95, paint.team],
    ] as [number, number, string][])
      bx(g, 0.3, 0.14, 0.16, c, x, 0.2, z);
    beam(g, -0.6, 0.2, 0.8, -0.6, 0.85, 0.8, 0.04, '#e0b240');
    beam(g, -0.6, 0.85, 0.8, -0.3, 0.82, 0.55, 0.03, '#e0b240');
  },
};
