// De 3D-modellen van alle gebouwen.
import * as T3 from 'three';
import { TAU, W } from '../config.js';
import { B } from '../data/buildings.js';
import { bById } from '../game/state.js';
import {
  C,
  CYANM,
  FOE,
  GLASS,
  GLOWM,
  PINKM,
  TEAM,
  VIOLETM,
  WIN,
  bx,
  chim,
  cn,
  crenel,
  cy,
  door,
  flagpole,
  flame,
  gCyl,
  gDod,
  gIco,
  gOct,
  gTorus,
  gr,
  mat,
  mergeStatic,
  mk,
  pr,
  sp,
  wins,
} from './kit.js';
import { bmap } from '../world/world.js';
import { makeUnit } from './people.js';

// Het gloeiende vlak in de Sterrenpoort (van twee kanten zichtbaar)
const GATE_DISC = new T3.CircleGeometry(0.68, 32);
const GATE_MAT = new T3.MeshBasicMaterial({
  color: '#9b6cff',
  transparent: true,
  opacity: 0.7,
  side: T3.DoubleSide,
  depthWrite: false,
});
const GATE_MAT2 = new T3.MeshBasicMaterial({
  color: '#e9dcff',
  transparent: true,
  opacity: 0.55,
  side: T3.DoubleSide,
  depthWrite: false,
});

const MODELS = {
  townhall(g, a) {
    // Elk tijdperk krijgt een eigen stamhuis (a = nummer van het tijdperk)
    if (a === 0) {
      cy(g, 0.92, 0.18, '#7d6a4c', 0, 0, 0, 10);
      cn(g, 0.98, 1.25, '#b08758', 0, 0.15, 0, 10);
      cn(g, 0.42, 0.35, '#8f6c44', 0, 1.2, 0, 10);
      door(g, 0, 0.9, 0.3, 0.38, '#3b2a1a');
      for (let k = 0; k < 3; k++) {
        const a2 = k * 2.1;
        cy(g, 0.03, 0.5, '#5f4630', Math.cos(a2) * 0.1, 1.3, Math.sin(a2) * 0.1, 5);
      }
      for (const [x, z] of [
        [0.6, 0.7],
        [-0.7, 0.55],
      ])
        bx(g, 0.08, 0.5, 0.08, C.woodd, x, 0, z);
      bx(g, 0.12, 0.12, 0.25, '#c9b48a', 0.62, 0.5, 0.7);
      // Vellen te drogen, een stapel stenen en een kookplaats
      bx(g, 0.04, 0.04, 1.0, C.woodd, 0.6, 0.48, 0.2);
      bx(g, 0.02, 0.26, 0.3, '#c9a77a', 0.6, 0.22, 0.25);
      for (const [x, z] of [
        [-0.75, -0.3],
        [-0.82, -0.12],
        [-0.68, -0.18],
      ])
        sp(g, 0.08, '#8a8a82', x, 0.04, z);
      cy(g, 0.14, 0.06, '#5d5348', 0.25, 0, 0.85, 8);
      flagpole(g, -0.6, 0, 0.6, 1.2);
    } else if (a === 1) {
      bx(g, 1.6, 0.6, 0.8, C.clay, 0, 0, -0.1);
      gr(g, 1.75, 0.55, 1, C.thatch, 0, 0.6, -0.1);
      bx(g, 1.8, 0.04, 0.05, C.woodd, 0, 1.13, -0.1);
      bx(g, 0.6, 0.5, 0.6, C.wood, 0.55, 0, 0.5);
      gr(g, 0.7, 0.35, 0.75, C.thatch, 0.55, 0.5, 0.5, Math.PI / 2);
      door(g, 1.6, 0.6, 0.24, 0.34, '#3b2a1a', -0.3);
      wins(g, 1.6, 0.8, 0.3, 0.14, 3, 0, -0.1, 0.1);
      // Kruiken en een lage leemmuur voor het erf
      for (const x of [-0.75, -0.6]) cy(g, 0.07, 0.18, C.clay, x, 0, 0.55, 8, 0.05);
      bx(g, 0.9, 0.18, 0.08, C.clay, -0.45, 0, 0.9);
      flagpole(g, -0.75, 0.6, 0.35, 0.9);
    } else if (a === 2) {
      // IJzertijd: een houten langhuis op een stenen voet, met een palissade eromheen
      cy(g, 0.95, 0.14, C.stoned, 0, 0, 0, 12);
      for (let k = 0; k < 20; k++) {
        const an = (k / 20) * TAU;
        if (Math.sin(an) > 0.85) continue; // opening voor de poort
        const x = Math.cos(an) * 0.88,
          z = Math.sin(an) * 0.88;
        cy(g, 0.045, 0.38, C.wood, x, 0.1, z, 5);
        cn(g, 0.045, 0.08, C.woodd, x, 0.48, z, 5);
      }
      bx(g, 1.3, 0.5, 0.66, C.wood, 0, 0.14, -0.08);
      for (const x of [-0.64, -0.2, 0.2, 0.64]) bx(g, 0.05, 0.5, 0.05, C.woodd, x, 0.14, 0.26);
      gr(g, 1.48, 0.62, 0.92, C.thatch, 0, 0.64, -0.08);
      bx(g, 1.52, 0.05, 0.06, C.woodd, 0, 1.24, -0.08);
      // Rookgat bovenin het dak
      bx(g, 0.2, 0.08, 0.2, '#3a2f25', 0, 1.2, -0.08);
      bx(g, 0.26, 0.04, 0.26, C.woodd, 0, 1.3, -0.08);
      bx(g, 0.24, 0.32, 0.03, '#3b2a1a', 0, 0.14, 0.26);
      bx(g, 0.4, 0.06, 0.18, C.stone, 0, 0.1, 0.38);
      // Ronde schilden aan de voorgevel in de legerkleur
      for (const x of [-0.45, 0.42]) {
        const s = cy(g, 0.09, 0.02, TEAM, x, 0.38, 0.27, 10);
        s.rotation.x = Math.PI / 2;
      }
      flagpole(g, 0.62, 0.14, -0.55, 1.1);
    } else if (a === 3) {
      bx(g, 1.9, 0.12, 1.9, C.stoned);
      bx(g, 0.95, 1.2, 0.95, C.stone, -0.3, 0, -0.3);
      crenel(g, 0.95, 0.95, 1.2, C.stone, 3);
      bx(g, 1.0, 0.06, 1.0, C.stoned, -0.3, 0.5, -0.3);
      for (const y of [0.35, 0.8]) bx(g, 0.06, 0.18, 0.02, '#26231f', -0.3, y, 0.18);
      bx(g, 1.1, 0.6, 0.7, C.plaster, 0.3, 0, 0.45);
      for (const x of [-0.24, 0.3, 0.84]) bx(g, 0.05, 0.6, 0.05, C.woodd, x, 0, 0.8);
      bx(g, 1.12, 0.05, 0.05, C.woodd, 0.3, 0.3, 0.8);
      gr(g, 1.2, 0.45, 0.85, C.slate, 0.3, 0.6, 0.45);
      wins(g, 1.1, 0.7, 0.3, 0.14, 3, 0.3, 0.45, 0.1);
      door(g, 1.1, 1.6, 0.26, 0.36, '#3b2a1a', 0.3);
      chim(g, 0.7, 0.75, 0.3, 0.35, C.stoned);
      flagpole(g, -0.3, 1.32, -0.3, 0.8);
    } else if (a === 4) {
      // Gouden Eeuw: stadhuis van baksteen met witte randen, trapgevel en een klokkentorentje
      const wit = '#efe9dc';
      bx(g, 1.9, 0.1, 1.5, C.stoned, 0, 0, -0.05);
      bx(g, 1.6, 0.9, 0.9, C.brick, 0, 0.1, -0.15);
      for (const y of [0.1, 0.52, 0.98]) bx(g, 1.62, 0.05, 0.92, wit, 0, y, -0.15);
      gr(g, 1.62, 0.45, 0.95, C.slate, 0, 1.0, -0.15);
      // Voorbouw met de trapgevel
      bx(g, 0.62, 1.0, 0.45, C.brick, 0, 0.1, 0.35);
      for (let i = 0; i < 4; i++) {
        const w = 0.62 - i * 0.15;
        bx(g, w, 0.15, 0.08, C.brick, 0, 1.1 + i * 0.15, 0.54);
        bx(g, w + 0.04, 0.03, 0.1, wit, 0, 1.25 + i * 0.15, 0.54);
      }
      gr(g, 0.45, 0.55, 0.6, C.slate, 0, 1.1, 0.32, Math.PI / 2);
      // Ramen met witte kozijnen
      for (const y of [0.22, 0.62]) {
        for (const x of [-0.6, -0.4, 0.4, 0.6]) {
          bx(g, 0.14, 0.26, 0.02, wit, x, y, 0.305);
          bx(g, 0.09, 0.2, 0.02, WIN, x, y + 0.03, 0.315);
        }
        for (const z of [-0.45, -0.15, 0.15]) {
          bx(g, 0.02, 0.26, 0.14, wit, 0.805, y, z);
          bx(g, 0.02, 0.2, 0.09, WIN, 0.815, y + 0.03, z);
        }
        bx(g, 0.14, 0.26, 0.02, wit, 0, y + 0.18, 0.58);
        bx(g, 0.09, 0.2, 0.02, WIN, 0, y + 0.21, 0.59);
      }
      bx(g, 0.22, 0.32, 0.03, '#3b2a1a', 0, 0.1, 0.58);
      bx(g, 0.28, 0.04, 0.04, wit, 0, 0.42, 0.59);
      bx(g, 0.4, 0.05, 0.2, C.stone, 0, 0.05, 0.66);
      // Klokkentorentje met vergulde top
      bx(g, 0.3, 0.3, 0.3, C.brick, 0, 1.25, -0.2);
      cy(g, 0.15, 0.25, wit, 0, 1.55, -0.2, 8);
      cn(g, 0.18, 0.32, '#4f7a6a', 0, 1.8, -0.2, 8);
      sp(g, 0.05, mat('#e8c048', { m: 0.6, r: 0.3 }), 0, 2.14, -0.2);
      flagpole(g, 0.75, 0.1, 0.55, 1.0);
    } else if (a === 5) {
      bx(g, 1.8, 0.8, 1, C.brick, 0, 0, 0);
      bx(g, 1.82, 0.05, 1.02, '#d8cfbe', 0, 0.8, 0);
      gr(g, 1.9, 0.5, 1.15, C.slate, 0, 0.8, 0);
      bx(g, 0.45, 1.5, 0.45, C.brick, 0, 0, 0.35);
      pr(g, 0.55, 0.5, 0.55, C.slate, 0, 1.5, 0.35);
      bx(g, 0.26, 0.26, 0.02, '#f1ecdc', 0, 1.15, 0.585);
      wins(g, 1.8, 1, 0.4, 0.22, 5, 0, 0, 0.11);
      door(g, 0, 1.6, 0.3, 0.4, '#3b2a1a');
      bx(g, 0.5, 0.06, 0.2, C.stone, 0, 0, 0.85);
      for (const x of [-0.6, 0.6]) chim(g, x, 1.0, -0.2, 0.35, C.brick);
      flagpole(g, 0.7, 0.8, 0.3, 0.8);
    } else if (a === 6) {
      bx(g, 1.8, 0.15, 1.8, C.concrete);
      bx(g, 1.4, 1.6, 1.1, C.concrete, 0, 0.15, -0.15);
      for (let i = 0; i < 5; i++) bx(g, 1.42, 0.12, 1.12, GLASS, 0, 0.35 + i * 0.27, -0.15);
      bx(g, 1.44, 0.06, 1.14, '#9a9d97', 0, 1.75, -0.15);
      bx(g, 0.6, 0.4, 0.5, '#9a9d97', 0.45, 0.15, 0.55);
      bx(g, 0.7, 0.04, 0.6, C.dmetal, 0.45, 0.55, 0.55);
      for (const [x, z] of [
        [0.3, -0.4],
        [-0.3, -0.3],
      ])
        bx(g, 0.22, 0.14, 0.22, '#7d8287', x, 1.81, z);
      bx(g, 0.05, 0.6, 0.05, C.dmetal, -0.4, 1.75, -0.4);
      flagpole(g, 0.75, 0.15, 0.75, 1);
    } else if (a === 7) {
      cy(g, 0.95, 0.15, C.white, 0, 0, 0, 16);
      cy(g, 0.55, 1.9, C.white, 0, 0.15, 0, 12, 0.42);
      mk(gCyl(0.62, 0.62, 24), CYANM, g, 0, 1.2, 0, 1, 0.06, 1);
      sp(g, 0.45, '#d9e6ea', 0, 2.05, 0, 1, 0.7);
      cy(g, 0.025, 0.6, C.metal, 0, 2.3, 0, 5);
      mk(gTorus(0.95, 0.025, 4, 32), CYANM, g, 0, 0.15, 0, 1, 1, 1).rotation.x = Math.PI / 2;
      bx(g, 0.5, 0.02, 0.5, '#e8c84a', 0.55, 0.15, 0.5); // landingsplek voor drones
    } else {
      // Sterrentijdperk: een slanke witte naald met een zwevende paarse ring
      cy(g, 0.97, 0.12, '#c9cfdc', 0, 0, 0, 20);
      mk(gTorus(0.97, 0.025, 4, 32), VIOLETM, g, 0, 0.12, 0, 1, 1, 1).rotation.x = Math.PI / 2;
      cy(g, 0.55, 0.3, '#d3d8e4', 0, 0.12, 0, 10, 0.45);
      cy(g, 0.42, 2.3, C.white, 0, 0.42, 0, 8, 0.06);
      for (let k = 0; k < 3; k++) {
        const an = (k / 3) * TAU;
        bx(g, 0.06, 1.1, 0.4, '#c9cfdc', Math.sin(an) * 0.42, 0.12, Math.cos(an) * 0.42, an);
      }
      mk(gIco(0), VIOLETM, g, 0, 2.85, 0, 0.1, 0.18, 0.1);
      // Ring en losse stukken zweven om de toren en draaien langzaam rond
      const f = new T3.Group();
      f.position.y = 1.45;
      f.userData.spin = 0.35;
      const ring = mk(gTorus(0.62, 0.035, 6, 32), VIOLETM, f, 0, 0, 0, 1, 1, 1);
      ring.rotation.x = Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const an = (k / 4) * TAU;
        mk(
          gIco(0),
          mat('#e6e9f2', { m: 0.3, r: 0.4 }),
          f,
          Math.cos(an) * 0.8,
          0.25 * (k % 2),
          Math.sin(an) * 0.8,
          0.08,
          0.14,
          0.08,
        );
      }
      g.add(f);
    }
  },
  hut(g) {
    cy(g, 0.36, 0.42, '#a9845a', 0, 0, 0, 8);
    cn(g, 0.47, 0.55, C.thatch, 0, 0.4, 0, 8);
    cy(g, 0.48, 0.04, '#9a7a48', 0, 0.4, 0, 8); // rand van het rieten dak
    door(g, 0, 0.7, 0.15, 0.24, '#3b2a1a');
    for (let k = 0; k < 3; k++)
      cy(g, 0.03, 0.18, C.woodd, 0.3, 0.03 + k * 0.05, -0.15 + k * 0.02, 5).rotation.x = Math.PI / 2;
    cy(g, 0.02, 0.12, C.woodd, 0, 0.92, 0, 4);
  },
  campfire(g) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      sp(g, 0.065, '#8a8a82', Math.cos(a) * 0.22, 0.03, Math.sin(a) * 0.22);
    }
    bx(g, 0.36, 0.05, 0.06, C.woodd, 0, 0, 0, 0.6);
    bx(g, 0.36, 0.05, 0.06, C.woodd, 0, 0, 0, -0.6);
    flame(g, 0, 0.02, 0, 1);
  },
  storage(g) {
    bx(g, 0.86, 0.06, 0.86, C.woodd);
    for (const [x, z] of [
      [-0.36, -0.36],
      [0.36, -0.36],
      [-0.36, 0.36],
      [0.36, 0.36],
    ])
      bx(g, 0.06, 0.5, 0.06, C.wood, x, 0, z);
    gr(g, 0.95, 0.28, 0.95, '#6e4429', 0, 0.5, 0); // donker planken dak: anders dan de hutten
    sp(g, 0.1, '#d8c79a', -0.28, 0.1, -0.25, 0, 0.8); // zakken graan
    sp(g, 0.09, '#cbb98a', -0.12, 0.09, -0.3, 0, 0.8);
    bx(g, 0.22, 0.2, 0.22, '#a07a4c', -0.18, 0.06, 0.12);
    bx(g, 0.18, 0.16, 0.18, '#8b6a40', 0.15, 0.06, -0.12);
    for (let k = 0; k < 3; k++)
      cy(g, 0.05, 0.5, '#7a5a36', 0.2, 0.08 + k * 0.09, 0.18).rotation.z = Math.PI / 2;
    cy(g, 0.08, 0.2, '#8a6a44', 0.32, 0.06, -0.3, 8, 0.07); // ton
    bx(g, 0.96, 0.03, 0.06, '#4e3a2c', 0, 0.76, 0); // nok van het dak
  },
  farm(g) {
    bx(g, 1.92, 0.05, 1.92, C.soil);
    for (let r = 0; r < 7; r++) bx(g, 1.7, 0.1, 0.09, '#86aa48', 0, 0.05, -0.78 + r * 0.26);
    for (const [x, z] of [
      [-0.95, -0.95],
      [0.95, -0.95],
      [-0.95, 0.95],
      [0.95, 0.95],
    ])
      bx(g, 0.05, 0.22, 0.05, C.woodd, x, 0, z);
    bx(g, 0.05, 0.04, 1.9, C.wood, -0.95, 0.16, 0);
    bx(g, 1.9, 0.04, 0.05, C.wood, 0, 0.16, 0.95);
    // Vogelverschrikker en een paar schoven graan
    bx(g, 0.03, 0.55, 0.03, C.woodd, 0.55, 0, -0.05);
    bx(g, 0.3, 0.03, 0.03, C.woodd, 0.55, 0.4, -0.05);
    bx(g, 0.12, 0.16, 0.06, '#b8452e', 0.55, 0.28, -0.05);
    sp(g, 0.05, '#d9c27a', 0.55, 0.5, -0.05);
    cn(g, 0.08, 0.06, '#c9a14a', 0.55, 0.53, -0.05, 6);
    for (const [x, z] of [
      [-0.7, 0.75],
      [-0.5, 0.78],
    ])
      cn(g, 0.07, 0.2, '#d9b860', x, 0, z, 6);
  },
  barracks(g) {
    bx(g, 1.92, 0.04, 1.92, '#8d7856');
    bx(g, 1.2, 0.62, 0.7, C.wood, -0.25, 0, -0.45);
    gr(g, 1.3, 0.42, 0.85, '#8f3d32', -0.25, 0.62, -0.45); // rood dak: legergebouw
    banner(g, -0.6, 0.18, -0.08);
    banner(g, 0.1, 0.18, -0.08);
    door(g, 1.2, -0.2, 0.24, 0.34, '#3b2a1a', -0.25);
    for (let i = 0; i < 8; i++) {
      const u = -0.9 + i * 0.257;
      bx(g, 0.05, 0.3, 0.05, C.woodd, u, 0, 0.9);
      bx(g, 0.05, 0.3, 0.05, C.woodd, 0.9, 0, u);
    }
    bx(g, 1.85, 0.04, 0.04, C.wood, 0, 0.24, 0.9);
    bx(g, 0.04, 0.04, 1.85, C.wood, 0.9, 0.24, 0);
    for (let k = 0; k < 4; k++) cy(g, 0.012, 0.55, '#7d6a52', 0.45 + k * 0.08, 0, 0.25, 4);
    bx(g, 0.4, 0.04, 0.04, C.woodd, 0.57, 0.4, 0.25); // wapenrek
    bx(g, 1.34, 0.04, 0.05, '#6a2e26', -0.25, 1.03, -0.45);
    // Oefenpop van stro
    bx(g, 0.04, 0.4, 0.04, C.woodd, 0.35, 0, 0.55);
    cy(g, 0.08, 0.2, '#c9a77a', 0.35, 0.22, 0.55, 8);
    sp(g, 0.06, '#c9a77a', 0.35, 0.48, 0.55);
    flagpole(g, 0.65, 0, -0.6, 1);
  },
  watchtower(g) {
    for (const [x, z] of [
      [-0.25, -0.25],
      [0.25, -0.25],
      [-0.25, 0.25],
      [0.25, 0.25],
    ])
      bx(g, 0.07, 1.15, 0.07, C.wood, x, 0, z);
    bx(g, 0.7, 0.07, 0.7, C.woodd, 0, 1.1, 0);
    bx(g, 0.7, 0.18, 0.04, C.wood, 0, 1.17, 0.33);
    bx(g, 0.04, 0.18, 0.7, C.wood, 0.33, 1.17, 0);
    pr(g, 0.85, 0.4, 0.85, '#4e3a2c', 0, 1.45, 0); // donker dak
    for (const x of [-0.08, 0.08]) bx(g, 0.03, 1.1, 0.03, C.woodd, x, 0, 0.3);
    for (let k = 0; k < 6; k++) bx(g, 0.16, 0.025, 0.025, C.woodd, 0, 0.12 + k * 0.17, 0.3); // ladder
    for (const [x, z] of [
      [-0.25, -0.25],
      [0.25, 0.25],
    ])
      bx(g, 0.5, 0.04, 0.04, C.woodd, 0, 0.5, z).rotation.z = x > 0 ? 0.9 : -0.9;
    banner(g, 0, 0.62, 0.37); // blauw doek: verdediging
    for (const [x, z] of [
      [-0.3, -0.3],
      [0.3, 0.3],
      [-0.3, 0.3],
      [0.3, -0.3],
    ])
      bx(g, 0.04, 0.3, 0.04, C.woodd, x, 1.17, z);
    flagpole(g, 0, 1.8, 0, 0.4);
  },
  house(g) {
    bx(g, 0.74, 0.48, 0.62, C.clay);
    gr(g, 0.84, 0.38, 0.78, C.thatch, 0, 0.48, 0);
    door(g, 0, 0.62, 0.15, 0.26, '#3b2a1a', -0.15);
    bx(g, 0.16, 0.16, 0.02, C.woodd, 0.18, 0.2, 0.31);
    bx(g, 0.12, 0.12, 0.02, WIN, 0.18, 0.22, 0.315);
    bx(g, 0.22, 0.04, 0.1, C.stone, -0.15, 0, 0.36);
    bx(g, 0.88, 0.03, 0.05, '#9a7a48', 0, 0.85, 0);
    chim(g, 0.24, 0.6, -0.12);
    cy(g, 0.06, 0.12, C.clay, 0.32, 0, 0.36, 6, 0.04); // pot bij de deur
  },
  foundry(g) {
    bx(g, 1.2, 0.6, 0.9, C.stone, -0.25, 0, -0.3);
    gr(g, 1.3, 0.4, 1.05, C.slate, -0.25, 0.6, -0.3);
    cy(g, 0.32, 0.7, C.stoned, 0.5, 0, 0.45, 10, 0.22);
    bx(g, 0.2, 0.16, 0.04, GLOWM, 0.5, 0.08, 0.77);
    cy(g, 0.09, 1.5, C.stoned, 0.5, 0.6, 0.45, 8);
    for (let k = 0; k < 3; k++) bx(g, 0.18, 0.05, 0.08, C.bronze, -0.4 + k * 0.2, 0, 0.55);
    bx(g, 1.34, 0.04, 0.05, '#4a5260', -0.25, 1.0, -0.3);
    sp(g, 0.14, '#b87333', -0.5, 0.03, 0.8, 0, 0.6); // koper
    sp(g, 0.12, '#a9aca6', -0.2, 0.03, 0.82, 0, 0.6); // tin
    bx(g, 0.18, 0.16, 0.18, C.wood, 0.85, 0, -0.2);
    flagpole(g, -0.8, 0.6, 0.1, 0.6);
  },
  bronzetower(g) {
    cy(g, 0.36, 1.1, C.stone, 0, 0, 0, 10, 0.3);
    cy(g, 0.36, 0.12, C.stoned, 0, 1.1, 0, 10);
    cn(g, 0.4, 0.5, C.bronze, 0, 1.22, 0, 10);
    bx(g, 0.06, 0.16, 0.02, '#26231f', 0, 0.6, 0.31);
    cy(g, 0.35, 0.05, C.bronze, 0, 0.45, 0, 10);
    bx(g, 0.14, 0.2, 0.03, '#3b2a1a', 0, 0, 0.33);
    flagpole(g, 0, 1.7, 0, 0.3);
  },
  stonehouse(g) {
    bx(g, 0.8, 0.62, 0.7, C.stone);
    gr(g, 0.9, 0.4, 0.84, C.slate, 0, 0.62, 0);
    door(g, 0, 0.7, 0.16, 0.28, '#3b2a1a', -0.16);
    wins(g, 0.8, 0.7, 0.32, 0.13, 2, 0, 0, 0.1);
    for (const x of [-0.2, 0.2]) bx(g, 0.14, 0.025, 0.05, C.stoned, x, 0.3, 0.35);
    bx(g, 0.24, 0.04, 0.1, C.stoned, -0.16, 0, 0.39);
    bx(g, 0.94, 0.03, 0.05, '#3e4652', 0, 1.01, 0);
    chim(g, -0.25, 0.75, -0.1, 0.32, C.stoned);
  },
  smithy(g) {
    bx(g, 1.1, 0.62, 0.8, C.plaster, -0.3, 0, -0.35);
    for (const u of [-0.82, 0.22]) bx(g, 0.06, 0.62, 0.06, C.woodd, u, 0, 0.06);
    gr(g, 1.2, 0.45, 0.95, C.slate, -0.3, 0.62, -0.35);
    bx(g, 0.7, 0.06, 0.7, C.woodd, 0.5, 0.75, 0.45);
    for (const [x, z] of [
      [0.2, 0.15],
      [0.8, 0.15],
      [0.2, 0.75],
      [0.8, 0.75],
    ])
      bx(g, 0.05, 0.75, 0.05, C.wood, x, 0, z);
    bx(g, 0.36, 0.3, 0.3, C.stoned, 0.55, 0, 0.4);
    bx(g, 0.24, 0.04, 0.18, GLOWM, 0.55, 0.3, 0.4);
    bx(g, 0.16, 0.12, 0.08, '#3d4045', 0.2, 0, 0.75);
    bx(g, 0.1, 0.1, 0.1, C.woodd, 0.85, 0, -0.3); // blok onder het aambeeld
    bx(g, 0.16, 0.06, 0.08, '#3d4045', 0.85, 0.1, -0.3);
    cy(g, 0.08, 0.12, C.wood, 0.62, 0, -0.1, 8); // wateremmer
    bx(g, 1.24, 0.04, 0.05, '#3e4652', -0.3, 1.06, -0.35);
    chim(g, 0.55, 0.8, 0.32, 0.5, C.stoned);
  },
  market(g) {
    bx(g, 1.92, 0.03, 1.92, '#b7a27c');
    [
      ['#c0453a', -0.5, -0.45],
      ['#2f6fd6', 0.45, -0.45],
      ['#e0b240', -0.05, 0.45],
    ].forEach(([c, x, z]) => {
      for (const [dx, dz] of [
        [-0.3, -0.22],
        [0.3, -0.22],
        [-0.3, 0.22],
        [0.3, 0.22],
      ])
        bx(g, 0.04, 0.5, 0.04, C.woodd, x + dx, 0, z + dz);
      gr(g, 0.72, 0.18, 0.55, c, x, 0.5, z);
      bx(g, 0.6, 0.2, 0.3, C.wood, x, 0, z + 0.05);
      sp(g, 0.06, '#d98a3a', x - 0.12, 0.24, z + 0.05);
      sp(g, 0.06, '#8bb24a', x + 0.1, 0.24, z + 0.05);
    });
    cy(g, 0.12, 0.26, '#7a5a36', 0.75, 0, 0.6, 8);
    cy(g, 0.12, 0.26, '#7a5a36', 0.75, 0, 0.85, 8);
    for (const [x, z, c] of [
      [-0.8, 0.7, '#a07a4c'],
      [-0.62, 0.78, '#8b6a40'],
      [-0.72, 0.72, '#c9b48a'],
    ])
      bx(g, 0.16, 0.14, 0.16, c, x, x === -0.72 ? 0.14 : 0, z);
    bx(g, 0.03, 0.4, 0.03, C.woodd, 0.85, 0, -0.85); // uithangbord
    bx(g, 0.2, 0.14, 0.02, '#e0b240', 0.85, 0.24, -0.84);
  },
  lantern(g) {
    cy(g, 0.04, 1.05, C.woodd, 0, 0, 0, 6);
    bx(g, 0.16, 0.18, 0.16, '#3a2f25', 0, 1.02, 0);
    flame(g, 0, 1.05, 0, 0.7);
  },
  castletower(g) {
    bx(g, 0.82, 1.55, 0.82, C.stone);
    bx(g, 0.9, 0.1, 0.9, C.stoned, 0, 1.5, 0);
    crenel(g, 0.9, 0.9, 1.6, C.stone, 3);
    for (const y of [0.5, 1.05]) bx(g, 0.06, 0.2, 0.02, '#26231f', 0, y, 0.415);
    bx(g, 0.02, 0.2, 0.06, '#26231f', 0.415, 0.8, 0);
    bx(g, 0.86, 0.06, 0.86, C.stoned, 0, 0.75, 0);
    bx(g, 0.2, 0.32, 0.03, '#3b2a1a', 0.2, 0, 0.415);
    banner(g, -0.22, 0.85, 0.42);
    flagpole(g, 0, 1.72, 0, 0.5);
  },
  blastfurnace(g) {
    bx(g, 1.92, 0.08, 1.92, '#7d7568');
    cy(g, 0.5, 1.7, C.brick, -0.25, 0, -0.25, 10, 0.32);
    cy(g, 0.36, 0.15, C.dmetal, -0.25, 1.7, -0.25, 10);
    bx(g, 0.7, 0.6, 0.6, C.brick, 0.45, 0, 0.4);
    gr(g, 0.8, 0.3, 0.72, C.slate, 0.45, 0.6, 0.4);
    bx(g, 0.3, 0.2, 0.04, GLOWM, -0.25, 0.12, 0.24);
    bx(g, 0.08, 0.08, 0.9, C.metal, 0.1, 1.2, 0.05, 0.7);
    cy(g, 0.1, 1.3, C.dmetal, 0.6, 0, -0.55, 8);
    cy(g, 0.13, 0.04, '#2e3236', 0.6, 1.3, -0.55, 8);
    sp(g, 0.2, '#6e4a3a', -0.75, 0.04, 0.7, 0, 0.5); // ijzererts
    sp(g, 0.16, '#2e2e30', -0.4, 0.04, 0.8, 0, 0.5); // kolen
    bx(g, 0.3, 0.12, 0.2, C.dmetal, 0.75, 0, 0.85);
    for (const y of [0.5, 1.0]) cy(g, 0.36, 0.05, C.dmetal, -0.25, y, -0.25, 10);
  },
  powerplant(g) {
    bx(g, 1.3, 0.85, 1, C.brick, -0.2, 0, 0.2);
    gr(g, 1.4, 0.35, 1.1, C.slate, -0.2, 0.85, 0.2);
    wins(g, 1.3, 1, 0.45, 0.24, 4, -0.2, 0.2, 0.12);
    for (const [x, z] of [
      [0.5, -0.55],
      [0.75, -0.2],
    ]) {
      cy(g, 0.13, 2.1, C.brick, x, 0, z, 10, 0.11);
      bx(g, 0.24, 0.06, 0.24, '#f1ece0', x, 1.7, z);
    }
    cy(g, 0.3, 0.4, C.metal, -0.6, 0, -0.6, 10);
    bx(g, 1.42, 0.05, 1.12, '#d8cfbe', -0.2, 0.85, 0.2);
    bx(g, 0.3, 0.4, 0.03, '#3d4247', -0.2, 0, 0.715);
    sp(g, 0.25, '#2e2e30', 0.6, 0.02, 0.65, 0, 0.5); // kolen
  },
  rowhouse(g) {
    bx(g, 0.9, 0.82, 0.62, C.brick);
    gr(g, 0.98, 0.32, 0.74, C.slate, 0, 0.82, 0);
    door(g, 0, 0.62, 0.13, 0.26, '#2b2f35', -0.22);
    door(g, 0, 0.62, 0.13, 0.26, '#2b2f35', 0.22);
    wins(g, 0.9, 0.62, 0.48, 0.14, 3, 0, 0, 0.1);
    for (const x of [-0.3, 0, 0.3]) chim(g, x, 1, -0.05, 0.2, C.brick);
    bx(g, 0.94, 0.05, 0.66, '#d8cfbe', 0, 0.8, 0); // kroonlijst
    for (const x of [-0.22, 0.22]) bx(g, 0.2, 0.05, 0.1, C.stone, x, 0, 0.36);
    bx(g, 0.92, 0.03, 0.03, '#d8cfbe', 0, 0.4, 0.315);
  },
  streetlamp(g) {
    cy(g, 0.03, 1.25, '#2e3236', 0, 0, 0, 6);
    bx(g, 0.3, 0.03, 0.03, '#2e3236', 0.12, 1.22, 0);
    const l = bx(g, 0.12, 0.08, 0.12, '#fff2c4', 0.25, 1.13, 0);
    l.material = mat('#fff2c4', { e: '#fff2c4', ei: 0.2 });
    l.userData.lamp = 1;
  },
  workshop(g) {
    bx(g, 1.7, 0.75, 1.2, C.brick, 0, 0, 0);
    for (let k = 0; k < 3; k++) gr(g, 0.5, 0.3, 1.25, C.metal, -0.55 + k * 0.55, 0.75, 0, 0);
    bx(g, 0.6, 0.5, 0.03, '#3d4247', 0, 0, 0.61);
    wins(g, 1.7, 1.2, 0.4, 0.2, 4, 0, 0, 0.11);
    for (let k = 0; k < 4; k++) bx(g, 0.6, 0.02, 0.01, '#5a6066', 0, 0.1 + k * 0.11, 0.625);
    bx(g, 1.72, 0.05, 1.22, '#7d6a5a', 0, 0.75, 0);
    for (const [x, z] of [
      [-0.7, 0.75],
      [-0.5, 0.8],
    ])
      bx(g, 0.18, 0.18, 0.18, C.wood, x, 0, z);
    cy(g, 0.08, 0.2, '#3d6a3a', 0.6, 0, 0.8, 8); // olievat
    flagpole(g, 0.75, 0.75, 0.5, 0.6);
  },
  cannon(g) {
    cy(g, 0.46, 0.22, '#9a8e74', 0, 0, 0, 10);
    cy(g, 0.34, 0.06, '#6e6656', 0, 0.22, 0, 10);
    const c = cy(g, 0.07, 0.7, '#2e3236', 0, 0.38, 0.05, 8);
    c.rotation.x = 1.2;
    c.position.z = -0.1;
    for (const x of [-0.16, 0.16]) {
      const w = cy(g, 0.14, 0.04, C.woodd, x, 0.3, 0, 10);
      w.rotation.z = Math.PI / 2;
    }
  },
  oilpump(g) {
    bx(g, 0.82, 0.08, 0.82, C.concrete);
    bx(g, 0.08, 0.55, 0.08, C.dmetal, -0.08, 0.08, 0);
    bx(g, 0.08, 0.55, 0.08, C.dmetal, 0.08, 0.08, 0);
    const p = new T3.Group();
    p.position.set(0, 0.66, 0);
    bx(p, 0.85, 0.08, 0.08, '#d8a33a', 0, -0.04, 0);
    bx(p, 0.12, 0.22, 0.1, '#d8a33a', 0.42, -0.15, 0);
    g.add(p);
    p.userData.pump = 1;
    bx(g, 0.18, 0.25, 0.18, C.dmetal, -0.3, 0.08, 0.25);
  },
  refinery(g) {
    bx(g, 1.92, 0.06, 1.92, C.concrete);
    for (const [x, z, r] of [
      [-0.5, -0.5, 0.32],
      [0.1, -0.6, 0.26],
      [-0.55, 0.2, 0.28],
    ]) {
      cy(g, r, 0.55, C.white, x, 0, z, 14);
      cy(g, r * 1.02, 0.04, C.metal, x, 0.55, z, 14);
    }
    cy(g, 0.1, 1.9, C.metal, 0.5, 0, 0.1, 8);
    cy(g, 0.08, 1.5, C.metal, 0.75, 0, 0.45, 8);
    for (const y of [0.6, 1.1, 1.5]) bx(g, 0.22, 0.04, 0.22, C.dmetal, 0.5, y, 0.1);
    bx(g, 1, 0.06, 0.06, C.dmetal, 0, 0.5, 0.3);
    bx(g, 0.06, 0.06, 0.8, C.dmetal, -0.3, 0.3, -0.1);
    for (const x of [-0.5, 0.1]) cy(g, 0.04, 0.5, '#d8a33a', x, 0, 0.3, 6);
    bx(g, 0.3, 0.3, 0.3, '#9a9d97', 0.1, 0, 0.65);
    flame(g, 0.5, 1.9, 0.1, 0.6);
  },
  silicaworks(g) {
    bx(g, 1.6, 0.6, 1.2, C.white, 0, 0, -0.2);
    sp(g, 0.32, '#c9d4da', -0.4, 0.6, -0.2, 1, 0.6);
    sp(g, 0.32, '#c9d4da', 0.35, 0.6, -0.2, 1, 0.6);
    bx(g, 1.62, 0.1, 1.22, mat('#3a6f8e'), 0, 0.42, -0.2);
    bx(g, 0.4, 0.3, 0.5, C.concrete, 0.6, 0, 0.6);
    door(g, 1.6, 1.2 - 0.4, 0.3, 0.3, '#3d4247', 0);
    sp(g, 0.28, '#d8c184', -0.55, 0.0, 0.65, 0, 0.55); // zandhoop
    bx(g, 0.7, 0.04, 0.12, C.dmetal, -0.15, 0.25, 0.6, -0.3); // lopende band
    for (const x of [-0.4, 0.1]) bx(g, 0.04, 0.25, 0.04, C.dmetal, x, 0, 0.6);
  },
  oilplant(g) {
    bx(g, 1.3, 0.8, 1, C.concrete, -0.2, 0, 0.2);
    wins(g, 1.3, 1, 0.4, 0.18, 4, -0.2, 0.2, 0.14);
    cy(g, 0.15, 2, '#a9a99f', 0.6, 0, -0.55, 10, 0.11);
    for (const [x, z] of [
      [0.6, 0.4],
      [0.6, 0.75],
    ])
      cy(g, 0.18, 0.4, C.white, x, 0, z, 10);
    bx(g, 0.4, 0.2, 0.4, '#d8a33a', -0.6, 0.8, -0.1);
    bx(g, 0.06, 0.06, 0.4, C.dmetal, 0.6, 0.3, 0.2);
    bx(g, 1.32, 0.05, 1.02, '#9a9d97', -0.2, 0.8, 0.2);
    bx(g, 0.3, 0.38, 0.03, '#3d4247', -0.2, 0, 0.715);
  },
  apartment(g) {
    bx(g, 0.86, 1.85, 0.86, '#cfc5b2');
    for (let i = 0; i < 6; i++) bx(g, 0.88, 0.11, 0.88, GLASS, 0, 0.2 + i * 0.28, 0);
    bx(g, 0.3, 0.2, 0.3, '#9a9d97', 0.1, 1.85, -0.1);
    door(g, 0, 0.86, 0.18, 0.22, '#2b2f35');
    for (let i = 1; i < 6; i += 2) {
      bx(g, 0.3, 0.03, 0.12, C.concrete, 0.2, 0.14 + i * 0.28, 0.48); // balkon
      bx(g, 0.3, 0.08, 0.02, C.dmetal, 0.2, 0.17 + i * 0.28, 0.535);
    }
    bx(g, 0.9, 0.04, 0.9, '#9a9d97', 0, 1.85, 0);
  },
  aa(g) {
    bx(g, 0.84, 0.16, 0.84, C.concrete);
    cy(g, 0.3, 0.2, C.dmetal, 0, 0.16, 0, 10);
    bx(g, 0.36, 0.24, 0.3, '#5b6644', 0, 0.36, 0);
    for (const x of [-0.08, 0.08]) {
      const b = cy(g, 0.035, 0.6, C.dmetal, x, 0.5, 0, 6);
      b.rotation.x = -0.7;
      b.position.z = -0.05;
    }
  },
  chipfab(g) {
    bx(g, 1.75, 0.62, 1.35, '#f2f4f5');
    bx(g, 1.77, 0.14, 1.37, mat('#2f6fd6', { r: 0.3, m: 0.2 }), 0, 0.3, 0);
    for (let k = 0; k < 4; k++) bx(g, 0.16, 0.18, 0.16, C.metal, -0.6 + k * 0.4, 0.62, -0.3);
    door(g, 1.75, 1.35, 0.36, 0.3, '#3d4247');
    for (let k = 0; k < 4; k++) cy(g, 0.06, 0.04, '#5a6066', -0.6 + k * 0.4, 0.8, -0.3, 8);
    bx(g, 1.4, 0.05, 0.05, C.metal, 0, 0.66, 0.3);
    bx(g, 0.3, 0.3, 0.2, '#d9dde0', 0.7, 0, 0.78);
  },
  batteryfab(g) {
    bx(g, 1.2, 0.6, 1.1, '#dfe3e4', -0.3, 0, -0.3);
    bx(g, 1.22, 0.08, 1.12, mat('#77bf40'), -0.3, 0.42, -0.3);
    for (let k = 0; k < 4; k++) {
      cy(g, 0.13, 0.5, '#77bf40', 0.75, 0, -0.7 + k * 0.38, 10);
      cy(g, 0.05, 0.06, C.metal, 0.75, 0.5, -0.7 + k * 0.38, 6);
    }
    bx(g, 0.04, 0.04, 1.2, C.dmetal, 0.55, 0.45, -0.13);
    bx(g, 0.4, 0.4, 0.03, '#3d4247', -0.3, 0, 0.255);
    for (const x of [-0.6, -0.1]) bx(g, 0.16, 0.12, 0.16, '#77bf40', x, 0, 0.6);
  },
  solar(g) {
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 2; c++) {
        const x = -0.45 + c * 0.9,
          z = -0.6 + r * 0.6;
        bx(g, 0.05, 0.2, 0.05, C.metal, x, 0, z);
        const p = bx(g, 0.8, 0.03, 0.45, mat('#1f3f6e', { r: 0.2, m: 0.5 }), x, 0.2, z);
        p.rotation.x = -0.45;
      }
  },
  hangar(g) {
    bx(g, 1.92, 0.05, 1.92, '#7d8287');
    const a = mk(gCyl(0.85, 0.85, 16, Math.PI), mat('#9aa2a8', { m: 0.3 }), g, 0, 0, -0.2, 1, 1.5, 1);
    a.rotation.z = Math.PI / 2;
    a.rotation.y = Math.PI / 2;
    a.position.set(-0.75, 0, -0.2);
    a.scale.set(1, 1.5, 1);
    bx(g, 1.5, 0.02, 0.5, '#e8c84a', 0, 0.05, 0.7);
    bx(g, 1.3, 0.02, 0.4, '#7d8287', 0, 0.06, 0.7);
    cy(g, 0.02, 0.6, C.metal, 0.75, 0.05, -0.75, 5);
    sp(g, 0.08, '#dfe6ea', 0.75, 0.65, -0.75, 0, 0.5);
    for (const x of [-0.7, 0.7]) mk(gIco(0), CYANM, g, x, 0.08, 0.95, 0.04, 0.04, 0.04);
  },
  laser(g) {
    cy(g, 0.42, 0.25, C.concrete, 0, 0, 0, 12);
    sp(g, 0.36, '#dfe6ea', 0, 0.25, 0, 1, 0.7);
    cy(g, 0.06, 0.45, C.metal, 0, 0.45, 0, 8);
    mk(gIco(0), CYANM, g, 0, 0.92, 0, 0.09, 0.09, 0.09);
    mk(gCyl(0.43, 0.43, 12), CYANM, g, 0, 0.2, 0, 1, 0.03, 1);
    for (let k = 0; k < 3; k++) {
      const an = (k / 3) * TAU;
      bx(g, 0.04, 0.3, 0.04, C.metal, Math.cos(an) * 0.12, 0.6, Math.sin(an) * 0.12);
    }
  },
  towerblock(g) {
    bx(g, 1.2, 3, 1.2, '#e8edf0');
    for (let i = 0; i < 10; i++) bx(g, 1.22, 0.18, 1.22, GLASS, 0, 0.25 + i * 0.27, 0);
    bx(g, 1.3, 0.1, 1.3, C.white, 0, 3, 0);
    sp(g, 0.25, '#6fae58', 0.2, 3.05, 0.2, 0, 0.6);
    mk(gCyl(0.04, 0.04, 6), CYANM, g, -0.4, 3, -0.4, 1, 0.5, 1);
    bx(g, 0.6, 0.25, 0.1, GLASS, 0, 0, 0.62); // lobby
    bx(g, 0.7, 0.04, 0.2, C.white, 0, 0.25, 0.65);
    for (const [x, z] of [
      [0.5, 0.85],
      [-0.5, 0.85],
    ])
      sp(g, 0.12, '#6fae58', x, 0.1, z, 0, 1.1);
  },
  command(g) {
    bx(g, 1.95, 0.12, 1.95, C.concrete);
    cy(g, 0.85, 0.6, C.white, 0, 0.12, 0, 8, 0.75);
    cy(g, 0.45, 1.6, '#dfe6ea', 0, 0.72, 0, 8, 0.3);
    mk(gCyl(0.5, 0.5, 16), CYANM, g, 0, 1.3, 0, 1, 0.05, 1);
    const d = sp(g, 0.3, C.white, 0.55, 0.95, 0.45, 1, 0.35);
    d.rotation.x = 0.6;
    cy(g, 0.03, 0.6, C.metal, 0, 2.3, 0, 5);
    mk(gIco(0), CYANM, g, 0, 2.9, 0, 0.07, 0.07, 0.07);
    const d2 = sp(g, 0.22, C.white, -0.6, 0.75, -0.55, 1, 0.35);
    d2.rotation.x = -0.6;
    bx(g, 0.04, 0.6, 0.04, C.metal, -0.6, 0.12, -0.55);
    for (const x of [-0.5, 0.5]) bx(g, 0.5, 0.02, 0.3, '#e8c84a', x, 0.12, 0.75);
    flagpole(g, -0.75, 0.12, 0.75, 1);
  },
  hillfort(g) {
    // Stenen uitkijkpost op een aarden wal met een houten ring
    cy(g, 0.5, 0.06, C.soil, 0, 0, 0, 10);
    cy(g, 0.47, 0.26, '#6f7a48', 0, 0.04, 0, 10, 0.36);
    for (let k = 0; k < 14; k++) {
      const an = (k / 14) * TAU;
      if (Math.sin(an) > 0.8) continue;
      const x = Math.cos(an) * 0.34,
        z = Math.sin(an) * 0.34;
      cy(g, 0.028, 0.22, C.wood, x, 0.26, z, 5);
      cn(g, 0.028, 0.06, C.woodd, x, 0.48, z, 5);
    }
    bx(g, 0.66, 0.03, 0.03, C.woodd, 0, 0.42, -0.3);
    bx(g, 0.34, 0.72, 0.34, C.stone, 0, 0.3, -0.02);
    bx(g, 0.36, 0.05, 0.36, C.stoned, 0, 0.62, -0.02);
    bx(g, 0.44, 0.06, 0.44, C.stoned, 0, 1.0, -0.02);
    crenel(g, 0.44, 0.44, 1.06, C.stone, 2);
    for (const y of [0.45, 0.78]) bx(g, 0.05, 0.14, 0.02, '#26231f', 0, y, 0.155);
    bx(g, 0.02, 0.14, 0.05, '#26231f', 0.155, 0.7, -0.02);
    bx(g, 0.14, 0.2, 0.03, '#3b2a1a', 0, 0.3, 0.155);
    bx(g, 0.16, 0.03, 0.3, C.soil, 0, 0.12, 0.32);
    flagpole(g, 0.1, 1.06, -0.1, 0.45);
  },
  siegeworks(g) {
    // Timmerwerf met een half afgebouwde blijde en stapels boomstammen
    bx(g, 1.92, 0.03, 1.92, '#8d7856');
    bx(g, 0.95, 0.55, 0.7, C.wood, -0.45, 0, -0.55);
    gr(g, 1.05, 0.36, 0.85, '#6e4429', -0.45, 0.55, -0.55);
    bx(g, 0.5, 0.4, 0.02, '#3b2a1a', -0.45, 0, -0.195);
    for (const x of [-0.9, 0]) bx(g, 0.05, 0.55, 0.05, C.woodd, x, 0, -0.2);
    // Het geraamte van de blijde: twee A-bokken met een as
    for (const z of [0.0, 0.42]) {
      bx(g, 0.06, 0.95, 0.06, C.wood, 0.15, 0, z).rotation.z = -0.33;
      bx(g, 0.06, 0.95, 0.06, C.wood, 0.77, 0, z).rotation.z = 0.33;
      bx(g, 0.8, 0.06, 0.07, C.woodd, 0.46, 0, z);
      bx(g, 0.5, 0.05, 0.05, C.woodd, 0.46, 0.4, z);
    }
    const ax = cy(g, 0.035, 0.6, C.dmetal, 0.46, 0.88, -0.09, 6);
    ax.rotation.x = Math.PI / 2;
    bx(g, 0.07, 0.06, 0.55, C.woodd, 0.46, 0, 0.21);
    bx(g, 1.15, 0.06, 0.06, C.woodd, 0.25, 0.03, 0.78, 0.1); // werparm ligt nog op de grond
    bx(g, 0.24, 0.22, 0.24, '#6b5a44', 0.78, 0, 0.75);
    // Boomstammen en een zaagbok
    for (const [y, z] of [
      [0.06, 0.25],
      [0.06, 0.4],
      [0.06, 0.55],
      [0.18, 0.32],
      [0.18, 0.47],
    ]) {
      const l = cy(g, 0.065, 0.6, '#7a5a36', -0.45, y, z, 7);
      l.rotation.z = Math.PI / 2;
      l.position.x = -0.15;
    }
    bx(g, 0.4, 0.04, 0.08, C.wood, -0.6, 0.22, 0.8);
    for (const x of [-0.76, -0.44]) bx(g, 0.04, 0.22, 0.12, C.woodd, x, 0, 0.8);
    banner(g, -0.75, 0.15, -0.18);
    flagpole(g, -0.85, 0, 0.85, 0.9);
  },
  windmill(g) {
    // Hollandse stellingmolen: taps lijf, kap en vier wieken die draaien
    cy(g, 0.42, 0.12, C.stoned, 0, 0, 0, 8);
    cy(g, 0.36, 0.55, C.brick, 0, 0.12, 0, 8, 0.31);
    cy(g, 0.31, 0.65, '#5a4a3e', 0, 0.67, 0, 8, 0.22);
    cy(g, 0.44, 0.04, C.woodd, 0, 0.6, 0, 8);
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * TAU;
      bx(g, 0.025, 0.5, 0.025, C.woodd, Math.cos(an) * 0.4, 0.12, Math.sin(an) * 0.4);
    }
    bx(g, 0.14, 0.24, 0.03, '#3b2a1a', 0, 0.12, 0.34);
    bx(g, 0.1, 0.12, 0.02, WIN, 0, 0.85, 0.27);
    bx(g, 0.02, 0.12, 0.1, WIN, 0.27, 0.95, 0);
    gr(g, 0.5, 0.26, 0.48, '#4a3a2c', 0, 1.3, 0, Math.PI / 2);
    bx(g, 0.04, 0.04, 0.32, C.woodd, 0, 1.36, -0.38); // staart om de kap te draaien
    bx(g, 0.04, 0.04, 0.62, C.woodd, 0, 1.0, -0.62).rotation.x = -0.6;
    const s = new T3.Group();
    s.position.set(0, 1.4, 0.3);
    s.userData.spin = 0.9;
    s.userData.axis = 'z';
    sp(s, 0.06, C.woodd, 0, 0, 0.02);
    for (let k = 0; k < 4; k++) {
      const th = (k / 4) * TAU;
      // Zet een balkje in het draaiende vlak van de wiek met hoek th
      const part = (w, h, d, c, lx, ly, z) => {
        const o = bx(
          s,
          w,
          h,
          d,
          c,
          lx * Math.cos(th) - ly * Math.sin(th),
          lx * Math.sin(th) + ly * Math.cos(th),
          z,
        );
        o.rotation.z = th;
      };
      part(0.04, 0.95, 0.04, C.woodd, 0, 0, 0.03);
      part(0.18, 0.72, 0.01, '#e8e0cc', 0.11, 0.2, 0.06);
      for (const lx of [0.03, 0.2]) part(0.015, 0.74, 0.02, '#6b5038', lx, 0.2, 0.07);
      for (let i = 0; i < 5; i++) part(0.19, 0.015, 0.02, '#6b5038', 0.11, 0.24 + i * 0.16, 0.07);
    }
    mergeStatic(s);
    g.add(s);
  },
  powdermill(g) {
    // Stenen molenhuis met waterrad en een stapel donkere kruitvaten
    bx(g, 1.92, 0.03, 0.34, '#3f6f8e', 0, 0, -0.85);
    bx(g, 1.1, 0.68, 0.8, C.stone, -0.35, 0, -0.25);
    gr(g, 1.2, 0.42, 0.95, C.tile, -0.35, 0.68, -0.25);
    bx(g, 1.24, 0.04, 0.05, C.woodd, -0.35, 1.08, -0.25);
    door(g, 1.1, 0.3, 0.2, 0.32, '#3b2a1a', -0.55);
    bx(g, 0.12, 0.14, 0.02, WIN, -0.15, 0.32, 0.155);
    bx(g, 0.02, 0.14, 0.12, WIN, 0.205, 0.32, -0.1);
    chim(g, -0.7, 0.8, -0.45, 0.4, C.stoned);
    // Waterrad aan de zijkant, draait als de molen werkt
    bx(g, 0.04, 0.5, 0.04, C.woodd, 0.28, 0, -0.55);
    const w = new T3.Group();
    w.position.set(0.32, 0.36, -0.55);
    w.userData.spin = 0.8;
    w.userData.axis = 'x';
    const rim = cy(w, 0.34, 0.06, C.woodd, 0.03, 0, 0, 12);
    rim.rotation.z = Math.PI / 2;
    for (let k = 0; k < 8; k++) {
      const th = (k / 8) * TAU;
      const p = bx(w, 0.12, 0.1, 0.03, C.wood, 0.0, Math.sin(th) * 0.34 - 0.05, Math.cos(th) * 0.34);
      p.rotation.x = -th;
    }
    mergeStatic(w);
    g.add(w);
    // Kruitvaten: donker met ijzeren banden
    for (const [x, y, z] of [
      [0.35, 0, 0.35],
      [0.58, 0, 0.35],
      [0.81, 0, 0.35],
      [0.46, 0.22, 0.35],
      [0.7, 0.22, 0.35],
      [0.4, 0, 0.62],
      [0.65, 0, 0.62],
    ]) {
      cy(g, 0.1, 0.22, '#3a2e26', x, y, z, 8, 0.09);
      cy(g, 0.105, 0.025, '#22201e', x, y + 0.05, z, 8);
      cy(g, 0.105, 0.025, '#22201e', x, y + 0.16, z, 8);
    }
    sp(g, 0.12, '#2a2622', -0.2, 0.04, 0.55, 0, 0.6);
    sp(g, 0.1, '#2a2622', -0.05, 0.03, 0.7, 0, 0.6);
    bx(g, 0.25, 0.12, 0.02, '#c0453a', 0.85, 0.5, 0.75); // gevaarbord
    bx(g, 0.03, 0.5, 0.03, C.woodd, 0.85, 0, 0.74);
  },
  canalhouse(g) {
    // Smal en hoog grachtenpand met trapgevel, witte kozijnen en hijsbalk
    const wit = '#f1ece0';
    bx(g, 0.58, 1.45, 0.78, C.brick, 0, 0, -0.06);
    for (let i = 0; i < 4; i++) {
      const w = 0.58 - i * 0.14;
      bx(g, w, 0.14, 0.08, C.brick, 0, 1.45 + i * 0.14, 0.29);
      bx(g, w + 0.04, 0.03, 0.1, wit, 0, 1.59 + i * 0.14, 0.29);
    }
    gr(g, 0.74, 0.5, 0.56, C.slate, 0, 1.45, -0.08, Math.PI / 2);
    for (let r = 0; r < 4; r++)
      for (const x of [-0.14, 0.14]) {
        const y = 0.38 + r * 0.3;
        bx(g, 0.15, 0.22, 0.02, wit, x, y, 0.335);
        bx(g, 0.1, 0.17, 0.02, WIN, x, y + 0.025, 0.345);
        bx(g, 0.02, 0.22, 0.15, wit, 0.295, y, x - 0.08);
        bx(g, 0.02, 0.17, 0.1, WIN, 0.305, y + 0.025, x - 0.08);
      }
    bx(g, 0.15, 0.24, 0.02, wit, 0, 1.62, 0.335);
    bx(g, 0.1, 0.18, 0.02, WIN, 0, 1.65, 0.345);
    // Voordeur met stoep en de hijsbalk boven in de gevel
    bx(g, 0.18, 0.3, 0.03, '#2d4a3a', -0.12, 0.06, 0.34);
    bx(g, 0.24, 0.04, 0.04, wit, -0.12, 0.36, 0.345);
    bx(g, 0.32, 0.06, 0.18, C.stone, -0.12, 0, 0.42);
    bx(g, 0.04, 0.04, 0.24, C.woodd, 0, 1.9, 0.4);
    bx(g, 0.01, 0.2, 0.01, '#3a3a3a', 0, 1.7, 0.5);
    bx(g, 0.6, 0.03, 0.06, wit, 0, 1.45, 0.3);
  },
  bastion(g) {
    // Laag vijfhoekig vestingwerk met een kanon bovenop
    cy(g, 0.5, 0.36, C.stone, 0, 0, 0, 5, 0.44);
    cy(g, 0.44, 0.04, C.stoned, 0, 0.36, 0, 5);
    const ap = 0.44 * Math.cos(Math.PI / 5),
      len = 2 * 0.44 * Math.sin(Math.PI / 5);
    for (let k = 0; k < 5; k++) {
      const ph = ((k + 0.5) / 5) * TAU;
      bx(g, len * 0.92, 0.12, 0.07, C.stone, Math.sin(ph) * ap, 0.4, Math.cos(ph) * ap, ph);
    }
    for (let k = 0; k < 5; k++) {
      const an = (k / 5) * TAU;
      bx(g, 0.05, 0.36, 0.05, C.stoned, Math.sin(an) * 0.47, 0, Math.cos(an) * 0.47, an);
    }
    // Kanon op een houten affuit, gericht naar voren
    bx(g, 0.22, 0.08, 0.3, C.woodd, 0, 0.4, 0);
    for (const x of [-0.13, 0.13]) {
      const w = cy(g, 0.08, 0.03, C.woodd, x, 0.48, 0.06, 10);
      w.rotation.z = Math.PI / 2;
      w.position.x = x > 0 ? x + 0.03 : x;
    }
    const c = cy(g, 0.05, 0.45, '#2e3236', 0, 0.52, -0.08, 8, 0.04);
    c.rotation.x = Math.PI / 2 - 0.2;
    for (const [x, z] of [
      [-0.2, -0.22],
      [-0.13, -0.24],
      [-0.17, -0.16],
    ])
      sp(g, 0.035, '#222426', x, 0.44, z);
    flagpole(g, 0.25, 0.4, -0.2, 0.5);
  },
  starforge(g) {
    // Donkere smelterij met een paars gloeiende smeltkroes voor sterrenmetaal
    bx(g, 1.92, 0.05, 1.92, '#4a4c56');
    bx(g, 1.4, 0.75, 1.1, '#34363f', -0.2, 0, -0.3);
    bx(g, 1.44, 0.06, 1.14, '#565a66', -0.2, 0.75, -0.3);
    bx(g, 1.41, 0.05, 1.11, VIOLETM, -0.2, 0.5, -0.3);
    bx(g, 0.4, 0.45, 0.03, '#1e1f24', -0.4, 0, 0.255);
    for (const [x, z] of [
      [-0.6, -0.6],
      [-0.2, -0.6],
      [0.2, -0.6],
    ]) {
      cy(g, 0.1, 0.4, '#2a2c34', x, 0.81, z, 8);
      mk(gCyl(0.07, 0.07, 8), VIOLETM, g, x, 1.21, z, 1, 0.03, 1);
    }
    // De smeltkroes
    cy(g, 0.36, 0.12, '#2a2c34', 0.55, 0, 0.5, 10);
    cy(g, 0.3, 0.42, '#3a3c46', 0.55, 0.12, 0.5, 10, 0.34);
    mk(gCyl(0.29, 0.29, 10), VIOLETM, g, 0.55, 0.53, 0.5, 1, 0.03, 1);
    bx(g, 0.5, 0.05, 0.05, C.dmetal, 0.25, 0.7, 0.2, 0.8);
    // Een brok meteoriet dat nog gesmolten moet worden
    mk(gDod(), mat('#2b2830'), g, -0.55, 0.12, 0.6, 0.22, 0.16, 0.2);
    mk(gOct(), VIOLETM, g, -0.5, 0.28, 0.6, 0.06, 0.12, 0.06);
    mk(gOct(), VIOLETM, g, -0.66, 0.22, 0.68, 0.04, 0.08, 0.04);
  },
  fusionplant(g) {
    // Fusiereactor: een ring (tokamak) met een roze kern onder een glazen koepel
    cy(g, 0.97, 0.15, C.white, 0, 0, 0, 16);
    // Dunne gloeiende rand om de voet (een volle schijf gloeit veel te fel)
    mk(gTorus(0.97, 0.025, 4, 32), PINKM, g, 0, 0.15, 0, 1, 1, 1).rotation.x = Math.PI / 2;
    const t = mk(gTorus(0.42, 0.13, 8, 24), mat('#9aa2ac', { m: 0.5, r: 0.4 }), g, 0, 0.45, 0, 1, 1, 1);
    t.rotation.x = Math.PI / 2;
    for (let k = 0; k < 8; k++) {
      const an = (k / 8) * TAU;
      bx(g, 0.08, 0.36, 0.2, '#3d4450', Math.cos(an) * 0.42, 0.27, Math.sin(an) * 0.42, -an);
    }
    sp(g, 0.16, PINKM, 0, 0.45, 0, 1);
    const pr2 = mk(gTorus(0.42, 0.05, 6, 24), PINKM, g, 0, 0.45, 0, 1, 1, 1);
    pr2.rotation.x = Math.PI / 2;
    sp(g, 0.8, mat('#cdeaff', { t: 1, o: 0.28, r: 0.1 }), 0, 0.15, 0, 1, 0.95).castShadow = false;
    // Koelbuizen naar een bijgebouwtje
    bx(g, 0.4, 0.4, 0.35, '#dfe3e8', 0.68, 0.15, -0.68);
    for (const y of [0.25, 0.4]) bx(g, 0.05, 0.05, 0.5, C.metal, 0.6, y, -0.4, -0.8);
    cy(g, 0.12, 0.6, '#dfe3e8', -0.75, 0.15, -0.6, 10, 0.09);
  },
  arcology(g) {
    // Getrapte woontoren met groene tuinen op elk terras en banden van glas
    const lagen = 4;
    for (let i = 0; i < lagen; i++) {
      const w = 1.7 - i * 0.34,
        y = i * 0.6;
      bx(g, w, 0.6, w, '#e8edf0', 0, y, 0);
      bx(g, w + 0.02, 0.2, w + 0.02, GLASS, 0, y + 0.25, 0);
      bx(g, w - 0.04, 0.04, w - 0.04, '#6fae58', 0, y + 0.6, 0);
      if (i < lagen - 1) {
        const r = w / 2 - 0.1;
        for (const [x, z] of [
          [r, r],
          [-r, r],
          [r, -r],
        ])
          sp(g, 0.08, '#4f8a3c', x, y + 0.68, z, 0, 1.2);
      }
    }
    cy(g, 0.03, 0.6, C.metal, 0, 2.44, 0, 5);
    mk(gIco(0), VIOLETM, g, 0, 3.06, 0, 0.06, 0.06, 0.06);
    bx(g, 0.3, 0.3, 0.03, '#2b2f35', 0, 0, 0.855);
  },
  railgun(g) {
    // Geschutskoepel met twee lange rails waartussen een paarse gloed loopt
    cy(g, 0.45, 0.18, C.concrete, 0, 0, 0, 8);
    cy(g, 0.32, 0.1, '#3a3d48', 0, 0.18, 0, 12);
    bx(g, 0.42, 0.26, 0.44, '#4a4e5a', 0, 0.28, -0.05);
    for (const x of [-0.25, 0.25]) {
      bx(g, 0.08, 0.2, 0.3, '#3a3d48', x, 0.28, -0.1);
      bx(g, 0.085, 0.03, 0.25, VIOLETM, x, 0.42, -0.1);
    }
    const r = new T3.Group();
    r.position.set(0, 0.5, -0.05);
    r.rotation.x = -0.32;
    for (const x of [-0.08, 0.08]) {
      bx(r, 0.05, 0.06, 1.05, '#2e3236', x, 0, 0.35);
      bx(r, 0.02, 0.03, 0.95, VIOLETM, x * 0.55, 0.015, 0.38);
    }
    for (const z of [0.05, 0.35, 0.65]) bx(r, 0.26, 0.12, 0.05, '#4a4e5a', 0, -0.03, z);
    mergeStatic(r);
    g.add(r);
  },
  mechbay(g) {
    // Werf voor lopende robots: hal met een gele stelling waarin een mech hangt
    bx(g, 1.92, 0.05, 1.92, '#7d8287');
    bx(g, 1.3, 0.95, 0.75, '#9aa2a8', -0.3, 0, -0.55);
    bx(g, 1.34, 0.06, 0.79, '#6f777e', -0.3, 0.95, -0.55);
    bx(g, 0.8, 0.75, 0.02, '#2e3236', -0.3, 0, -0.17);
    bx(g, 1.32, 0.05, 0.77, VIOLETM, -0.3, 0.78, -0.55);
    for (const x of [-0.75, 0.15]) bx(g, 0.04, 0.75, 0.04, '#e8c84a', x, 0, -0.16);
    // Gele stelling
    const geel = '#e0b240';
    for (const [x, z] of [
      [0.25, 0.25],
      [0.9, 0.25],
      [0.25, 0.9],
      [0.9, 0.9],
    ])
      bx(g, 0.06, 1.35, 0.06, geel, x, 0, z);
    for (const y of [0.7, 1.32]) {
      bx(g, 0.71, 0.05, 0.05, geel, 0.575, y, 0.25);
      bx(g, 0.71, 0.05, 0.05, geel, 0.575, y, 0.9);
      bx(g, 0.05, 0.05, 0.71, geel, 0.25, y, 0.575);
      bx(g, 0.05, 0.05, 0.71, geel, 0.9, y, 0.575);
    }
    bx(g, 0.2, 0.03, 0.65, '#4c5359', 0.32, 0.72, 0.575);
    const m = makeUnit('mech', false);
    m.position.set(0.6, 0.05, 0.58);
    m.rotation.y = 0.6;
    m.scale.setScalar(0.85);
    g.add(m);
    for (const [x, z] of [
      [-0.8, 0.4],
      [-0.6, 0.4],
    ])
      bx(g, 0.16, 0.16, 0.16, '#5b6670', x, 0.05, z);
    bx(g, 1.5, 0.02, 0.06, '#e8c84a', -0.1, 0.05, 0.05);
  },
  stargate(g) {
    // De Sterrenpoort: een grote staande ring met een paarse gloed, op een trap-platform
    const s = new T3.Group();
    s.rotation.y = Math.PI / 4; // met de voorkant naar de camera
    cy(s, 0.99, 0.16, '#cfd4de', 0, 0, 0, 8);
    cy(s, 0.8, 0.14, '#e6e9f2', 0, 0.16, 0, 8);
    mk(gCyl(0.81, 0.81, 8), VIOLETM, s, 0, 0.2, 0, 1, 0.08, 1);
    for (let i = 0; i < 3; i++) bx(s, 0.7 - i * 0.12, 0.1, 0.12, '#dfe3ea', 0, i * 0.1, 0.92 - i * 0.12);
    // Zuilen op de hoeken met gloeiende punten
    for (const [x, z] of [
      [-0.72, -0.5],
      [0.72, -0.5],
      [-0.72, 0.5],
      [0.72, 0.5],
    ]) {
      bx(s, 0.12, 0.7, 0.12, '#bfc5d2', x, 0.16, z);
      mk(gOct(), VIOLETM, s, x, 0.98, z, 0.07, 0.12, 0.07);
    }
    // Klemmen die de ring vasthouden
    for (const x of [-0.45, 0.45]) bx(s, 0.2, 0.32, 0.3, '#8e93a6', x, 0.3, 0);
    const rc = 1.12;
    mk(gTorus(0.78, 0.12, 8, 36), mat('#b8bdcc', { m: 0.55, r: 0.35 }), s, 0, rc, 0, 1, 1, 1);
    for (let k = 0; k < 9; k++) {
      const an = (k / 9) * TAU + Math.PI / 2;
      const o = bx(s, 0.1, 0.12, 0.3, VIOLETM, Math.cos(an) * 0.88, rc + Math.sin(an) * 0.88 - 0.06, 0);
      o.rotation.z = an - Math.PI / 2;
    }
    // De poort zelf: een gloeiend vlak, en een binnenring die langzaam ronddraait
    for (const [m2, sc] of [
      [GATE_MAT, 1],
      [GATE_MAT2, 0.55],
    ])
      mk(GATE_DISC, m2, s, 0, rc, 0, sc, sc, 1).castShadow = false;
    const spin = new T3.Group();
    spin.position.y = rc;
    spin.userData.spin = 0.6;
    spin.userData.axis = 'z';
    mk(gTorus(0.62, 0.025, 4, 30), VIOLETM, spin, 0, 0, 0, 1, 1, 1);
    for (let k = 0; k < 3; k++) {
      const an = (k / 3) * TAU;
      mk(gOct(), VIOLETM, spin, Math.cos(an) * 0.62, Math.sin(an) * 0.62, 0, 0.06, 0.06, 0.06);
    }
    s.add(spin);
    mergeStatic(s);
    g.add(s);
  },
};
// Muren: een paal met armen naar de buurmuren
export function wallMask(b) {
  let m = 0;
  const n = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  n.forEach(([dx, dy], k) => {
    const o = bById.get(bmap[(b.y + dy) * W + b.x + dx]);
    if (o && B[o.type].wall) m |= 1 << k;
  });
  return m;
}
function makeWall(g, type, m) {
  const col = { palisade: C.wood, gate: C.wood, stonewall: C.stone, concrete: C.concrete }[type],
    h = { palisade: 0.55, gate: 0.6, stonewall: 0.6, concrete: 0.7 }[type],
    t = type === 'palisade' ? 0.16 : 0.24;
  if (type === 'palisade') {
    const pts = [[0, 0]];
    [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].forEach(([dx, dz], k) => {
      if ((m >> k) & 1) for (const f of [0.18, 0.36]) pts.push([dx * f, dz * f]);
    });
    for (const [x, z] of pts) {
      cy(g, 0.07, h, C.wood, x, 0, z, 6);
      cn(g, 0.07, 0.12, C.woodd, x, h, z, 6);
    }
    return;
  }
  if (type === 'gate') {
    const ns = m & 5 && !(m & 10);
    bx(g, ns ? 0.22 : 0.22, h + 0.15, 0.22, C.woodd, ns ? -0.38 : 0, 0, ns ? 0 : -0.38);
    bx(g, 0.22, h + 0.15, 0.22, C.woodd, ns ? 0.38 : 0, 0, ns ? 0 : 0.38);
    bx(g, ns ? 0.98 : 0.2, 0.12, ns ? 0.2 : 0.98, C.wood, 0, h + 0.05, 0);
    bx(g, ns ? 0.5 : 0.08, h - 0.1, ns ? 0.08 : 0.5, '#7a5a36', 0, 0, 0);
    flagpole(g, 0, h + 0.15, 0, 0.3);
    return;
  }
  bx(g, t * 1.4, h + 0.12, t * 1.4, col);
  [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ].forEach(([dx, dz], k) => {
    if ((m >> k) & 1) {
      bx(g, dx ? 0.5 : t, h, dz ? 0.5 : t, col, dx * 0.25, 0, dz * 0.25);
      if (type === 'stonewall')
        bx(g, dx ? 0.18 : t * 1.1, 0.1, dz ? 0.18 : t * 1.1, C.stoned, dx * 0.3, h, dz * 0.3);
    }
  });
}
export function makeCamp(g, tier) {
  bx(g, 2.6, 0.04, 2.6, '#5d4a36');
  // Tentkleur per niveau: van huiden in de oertijd tot donker staal later
  const TENT = [
    '#7a5a3a',
    '#8a3a2a',
    '#6b4a30',
    '#7a2e2e',
    '#3a3a4a',
    '#5d4a3a',
    '#4a4e54',
    '#3a3f45',
    '#2a2c32',
  ];
  const tc = TENT[Math.min(tier, TENT.length - 1)];
  for (const [x, z, r] of [
    [-0.6, -0.5, 0.45],
    [0.55, -0.6, 0.45],
    [-0.5, 0.6, 0.4],
  ]) {
    cn(g, r, 0.7, tc, x, 0, z, 6);
    cy(g, 0.02, 0.18, C.woodd, x, 0.66, z, 4); // tentstok steekt uit de punt
    bx(g, 0.14, 0.2, 0.02, '#2a201a', x, 0, z + r * 0.8); // ingang
  }
  // Puntige palen in een ring, schuin naar buiten zodat het dreigend oogt
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    const p = cy(g, 0.05, 0.6, C.woodd, Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3, 5);
    p.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    cn(g, 0.05, 0.1, '#3a2a1e', Math.cos(a) * 1.44, 0.57, Math.sin(a) * 1.44, 5);
  }
  // Kookvuur met stenen, een totempaal met schedel en wat buit
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    sp(g, 0.05, '#6e6a64', 0.3 + Math.cos(a) * 0.18, 0.02, 0.3 + Math.sin(a) * 0.18);
  }
  flame(g, 0.3, 0, 0.3, 1.2);
  bx(g, 0.1, 0.9, 0.1, '#5a3e2a', -0.95, 0, 0.05);
  sp(g, 0.07, '#e8e0c8', -0.95, 0.95, 0.05);
  bx(g, 0.34, 0.04, 0.04, '#5a3e2a', -0.95, 0.72, 0.05);
  for (const [x, z] of [
    [0.85, 0.3],
    [0.75, 0.48],
  ])
    bx(g, 0.18, 0.16, 0.18, '#7a5a36', x, 0, z);
  sp(g, 0.1, '#d9b860', 0.95, 0.04, 0.5, 0, 0.6); // gestolen goud
  bx(g, 0.04, 0.4, 0.04, C.woodd, -0.2, 0, -0.95); // wapenrek
  bx(g, 0.5, 0.04, 0.04, C.woodd, 0, 0.32, -0.95);
  for (let k = 0; k < 3; k++) cy(g, 0.012, 0.45, '#7d6a52', -0.1 + k * 0.12, 0, -0.93, 4);
  flagpole(g, 0, 0, 0, 1.2, FOE);
  if (tier >= 3) bx(g, 0.5, 0.4, 0.4, C.dmetal, 0.6, 0, 0.5);
  if (tier >= 5) {
    // Latere kampen: een wachttoren van ijzer met een rode lamp
    for (const [x, z] of [
      [0.8, -1.0],
      [1.0, -0.8],
    ])
      bx(g, 0.05, 0.9, 0.05, C.dmetal, x, 0, z);
    bx(g, 0.35, 0.05, 0.35, C.dmetal, 0.9, 0.9, -0.9);
    mk(gIco(0), mat('#ff4a3a', { e: '#ff4a3a' }), g, 0.9, 1.02, -0.9, 0.06, 0.06, 0.06);
  }
}
// Een hangend doek in de legerkleur, zodat verdediging en leger direct opvallen
function banner(g, x, y, z) {
  bx(g, 0.16, 0.36, 0.02, TEAM, x, y, z);
  bx(g, 0.16, 0.05, 0.022, '#e9d9a6', x, y + 0.31, z);
}

// Ondergrond per soort gebouw, zodat je ze ook van ver uit elkaar houdt:
// wonen = lichte klinkers, economie = aangestampte aarde, leger = grijze steen
const PLATE = { home: '#c4ad84', eco: '#8a7454', mil: '#5f6672' };
const NO_PLATE = new Set(['farm', 'oilpump', 'campfire', 'lantern', 'streetlamp', 'road', 'townhall']);

export function makeBuilding(type, age, b) {
  const g = new T3.Group(),
    d = B[type];
  if (d.wall) makeWall(g, type, b ? wallMask(b) : 0);
  else {
    if (PLATE[d.cat] && !NO_PLATE.has(type)) bx(g, d.size * 0.97, 0.03, d.size * 0.97, PLATE[d.cat]);
    (MODELS[type] || MODELS.storage)(g, age, b);
  }
  return mergeStatic(g);
}
