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
  TEAM,
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
  gIco,
  gr,
  mat,
  mergeStatic,
  mk,
  pr,
  sp,
  wins,
} from './kit.js';
import { bmap } from '../world/world.js';

const MODELS = {
  townhall(g, a) {
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
      flagpole(g, -0.6, 0, 0.6, 1.2);
    } else if (a === 1) {
      bx(g, 1.6, 0.6, 0.8, C.clay, 0, 0, -0.1);
      gr(g, 1.75, 0.55, 1, C.thatch, 0, 0.6, -0.1);
      bx(g, 0.6, 0.5, 0.6, C.wood, 0.55, 0, 0.5);
      gr(g, 0.7, 0.35, 0.75, C.thatch, 0.55, 0.5, 0.5, Math.PI / 2);
      door(g, 1.6, 0.6, 0.24, 0.34, '#3b2a1a', -0.3);
      wins(g, 1.6, 0.8, 0.3, 0.14, 3, 0, -0.1, 0.1);
      flagpole(g, -0.75, 0.6, 0.35, 0.9);
    } else if (a === 2) {
      bx(g, 1.9, 0.12, 1.9, C.stoned);
      bx(g, 0.95, 1.2, 0.95, C.stone, -0.3, 0, -0.3);
      crenel(g, 0.95, 0.95, 1.2, C.stone, 3);
      bx(g, 1.1, 0.6, 0.7, C.plaster, 0.3, 0, 0.45);
      gr(g, 1.2, 0.45, 0.85, C.slate, 0.3, 0.6, 0.45);
      wins(g, 1.1, 0.7, 0.3, 0.14, 3, 0.3, 0.45, 0.1);
      door(g, 1.1, 1.6, 0.26, 0.36, '#3b2a1a', 0.3);
      flagpole(g, -0.3, 1.32, -0.3, 0.8);
    } else if (a === 3) {
      bx(g, 1.8, 0.8, 1, C.brick, 0, 0, 0);
      gr(g, 1.9, 0.5, 1.15, C.slate, 0, 0.8, 0);
      bx(g, 0.45, 1.5, 0.45, C.brick, 0, 0, 0.35);
      pr(g, 0.55, 0.5, 0.55, C.slate, 0, 1.5, 0.35);
      bx(g, 0.26, 0.26, 0.02, '#f1ecdc', 0, 1.15, 0.585);
      wins(g, 1.8, 1, 0.4, 0.22, 5, 0, 0, 0.11);
      door(g, 0, 1.6, 0.3, 0.4, '#3b2a1a');
      flagpole(g, 0.7, 0.8, 0.3, 0.8);
    } else if (a === 4) {
      bx(g, 1.8, 0.15, 1.8, C.concrete);
      bx(g, 1.4, 1.6, 1.1, C.concrete, 0, 0.15, -0.15);
      for (let i = 0; i < 5; i++) bx(g, 1.42, 0.12, 1.12, GLASS, 0, 0.35 + i * 0.27, -0.15);
      bx(g, 0.6, 0.4, 0.5, '#9a9d97', 0.45, 0.15, 0.55);
      bx(g, 0.05, 0.6, 0.05, C.dmetal, -0.4, 1.75, -0.4);
      flagpole(g, 0.75, 0.15, 0.75, 1);
    } else {
      cy(g, 0.95, 0.15, C.white, 0, 0, 0, 16);
      cy(g, 0.55, 1.9, C.white, 0, 0.15, 0, 12, 0.42);
      mk(gCyl(0.62, 0.62, 24), CYANM, g, 0, 1.2, 0, 1, 0.06, 1);
      sp(g, 0.45, '#d9e6ea', 0, 2.05, 0, 1, 0.7);
      cy(g, 0.025, 0.6, C.metal, 0, 2.3, 0, 5);
      mk(gCyl(0.97, 0.97, 24), CYANM, g, 0, 0.15, 0, 1, 0.04, 1);
    }
  },
  hut(g) {
    cy(g, 0.36, 0.42, '#a9845a', 0, 0, 0, 8);
    cn(g, 0.47, 0.55, C.thatch, 0, 0.4, 0, 8);
    door(g, 0, 0.7, 0.15, 0.24, '#3b2a1a');
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
    bx(g, 0.12, 0.12, 0.02, WIN, 0.18, 0.22, 0.315);
    chim(g, 0.24, 0.6, -0.12);
  },
  foundry(g) {
    bx(g, 1.2, 0.6, 0.9, C.stone, -0.25, 0, -0.3);
    gr(g, 1.3, 0.4, 1.05, C.slate, -0.25, 0.6, -0.3);
    cy(g, 0.32, 0.7, C.stoned, 0.5, 0, 0.45, 10, 0.22);
    bx(g, 0.2, 0.16, 0.04, GLOWM, 0.5, 0.08, 0.77);
    cy(g, 0.09, 1.5, C.stoned, 0.5, 0.6, 0.45, 8);
    for (let k = 0; k < 3; k++) bx(g, 0.18, 0.05, 0.08, C.bronze, -0.4 + k * 0.2, 0, 0.55);
    flagpole(g, -0.8, 0.6, 0.1, 0.6);
  },
  bronzetower(g) {
    cy(g, 0.36, 1.1, C.stone, 0, 0, 0, 10, 0.3);
    cy(g, 0.36, 0.12, C.stoned, 0, 1.1, 0, 10);
    cn(g, 0.4, 0.5, C.bronze, 0, 1.22, 0, 10);
    bx(g, 0.06, 0.16, 0.02, '#26231f', 0, 0.6, 0.31);
    flagpole(g, 0, 1.7, 0, 0.3);
  },
  stonehouse(g) {
    bx(g, 0.8, 0.62, 0.7, C.stone);
    gr(g, 0.9, 0.4, 0.84, C.slate, 0, 0.62, 0);
    door(g, 0, 0.7, 0.16, 0.28, '#3b2a1a', -0.16);
    wins(g, 0.8, 0.7, 0.32, 0.13, 2, 0, 0, 0.1);
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
  },
  rowhouse(g) {
    bx(g, 0.9, 0.82, 0.62, C.brick);
    gr(g, 0.98, 0.32, 0.74, C.slate, 0, 0.82, 0);
    door(g, 0, 0.62, 0.13, 0.26, '#2b2f35', -0.22);
    door(g, 0, 0.62, 0.13, 0.26, '#2b2f35', 0.22);
    wins(g, 0.9, 0.62, 0.48, 0.14, 3, 0, 0, 0.1);
    for (const x of [-0.3, 0, 0.3]) chim(g, x, 1, -0.05, 0.2, C.brick);
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
    flame(g, 0.5, 1.9, 0.1, 0.6);
  },
  silicaworks(g) {
    bx(g, 1.6, 0.6, 1.2, C.white, 0, 0, -0.2);
    sp(g, 0.32, '#c9d4da', -0.4, 0.6, -0.2, 1, 0.6);
    sp(g, 0.32, '#c9d4da', 0.35, 0.6, -0.2, 1, 0.6);
    bx(g, 1.62, 0.1, 1.22, mat('#3a6f8e'), 0, 0.42, -0.2);
    bx(g, 0.4, 0.3, 0.5, C.concrete, 0.6, 0, 0.6);
    door(g, 1.6, 1.2 - 0.4, 0.3, 0.3, '#3d4247', 0);
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
  },
  apartment(g) {
    bx(g, 0.86, 1.85, 0.86, '#cfc5b2');
    for (let i = 0; i < 6; i++) bx(g, 0.88, 0.11, 0.88, GLASS, 0, 0.2 + i * 0.28, 0);
    bx(g, 0.3, 0.2, 0.3, '#9a9d97', 0.1, 1.85, -0.1);
    door(g, 0, 0.86, 0.18, 0.22, '#2b2f35');
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
  },
  batteryfab(g) {
    bx(g, 1.2, 0.6, 1.1, '#dfe3e4', -0.3, 0, -0.3);
    bx(g, 1.22, 0.08, 1.12, mat('#77bf40'), -0.3, 0.42, -0.3);
    for (let k = 0; k < 4; k++) {
      cy(g, 0.13, 0.5, '#77bf40', 0.75, 0, -0.7 + k * 0.38, 10);
      cy(g, 0.05, 0.06, C.metal, 0.75, 0.5, -0.7 + k * 0.38, 6);
    }
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
  },
  laser(g) {
    cy(g, 0.42, 0.25, C.concrete, 0, 0, 0, 12);
    sp(g, 0.36, '#dfe6ea', 0, 0.25, 0, 1, 0.7);
    cy(g, 0.06, 0.45, C.metal, 0, 0.45, 0, 8);
    mk(gIco(0), CYANM, g, 0, 0.92, 0, 0.09, 0.09, 0.09);
  },
  towerblock(g) {
    bx(g, 1.2, 3, 1.2, '#e8edf0');
    for (let i = 0; i < 10; i++) bx(g, 1.22, 0.18, 1.22, GLASS, 0, 0.25 + i * 0.27, 0);
    bx(g, 1.3, 0.1, 1.3, C.white, 0, 3, 0);
    sp(g, 0.25, '#6fae58', 0.2, 3.05, 0.2, 0, 0.6);
    mk(gCyl(0.04, 0.04, 6), CYANM, g, -0.4, 3, -0.4, 1, 0.5, 1);
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
    flagpole(g, -0.75, 0.12, 0.75, 1);
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
  const tc = ['#7a5a3a', '#8a3a2a', '#7a2e2e', '#5d4a3a', '#4a4e54', '#3a3f45'][tier];
  for (const [x, z] of [
    [-0.6, -0.5],
    [0.55, -0.6],
    [-0.5, 0.6],
  ])
    cn(g, 0.45, 0.7, tc, x, 0, z, 6);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    cy(g, 0.06, 0.5, C.woodd, Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3, 5);
  }
  flame(g, 0.3, 0, 0.3, 1.2);
  flagpole(g, 0, 0, 0, 1.2, FOE);
  if (tier >= 3) bx(g, 0.5, 0.4, 0.4, C.dmetal, 0.6, 0, 0.5);
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
