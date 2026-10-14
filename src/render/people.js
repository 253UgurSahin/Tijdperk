// 3D-figuurtjes voor dorpelingen, soldaten en vijanden.
import * as T3 from 'three';
import { RES } from '../data/resources.js';
import { C, CYANM, FOE, GB, TEAM, TEAMD, bx, cn, cy, gIco, mat, mk, sp } from './kit.js';

const SKIN = ['#e2b48c', '#c99470', '#a8754f', '#f0c8a0'];
const JOBCOL = {
  auto: '#cdbf9c',
  build: '#d9773a',
  food: '#c9a14a',
  wood: '#8a6a44',
  stone: '#8b8f88',
  sand: '#d8c184',
};
function person(g, o) {
  const sk = SKIN[o.skin || 0];
  const lL = new T3.Group(),
    lR = new T3.Group(),
    aL = new T3.Group(),
    aR = new T3.Group();
  lL.position.set(-0.05, 0.2, 0);
  lR.position.set(0.05, 0.2, 0);
  bx(lL, 0.06, 0.2, 0.07, o.pants || '#4a4038', 0, -0.2, 0);
  bx(lR, 0.06, 0.2, 0.07, o.pants || '#4a4038', 0, -0.2, 0);
  bx(g, 0.18, 0.2, 0.11, o.shirt, 0, 0.2, 0);
  if (o.sash) bx(g, 0.185, 0.05, 0.115, o.sash, 0, 0.32, 0);
  // Soldaten en vijanden dragen een gekleurd borststuk: blauw = jouw leger, rood = vijand
  if (o.tabard) bx(g, 0.19, 0.15, 0.118, o.tabard, 0, 0.21, 0);
  sp(g, 0.075, sk, 0, 0.47, 0, 0);
  if (o.hat === 'helmet') sp(g, 0.085, o.hatc || '#8e979f', 0, 0.5, 0, 0, 0.7);
  else if (o.hat === 'cap') bx(g, 0.15, 0.05, 0.15, o.hatc || '#5b6644', 0, 0.52, 0);
  else if (o.hat === 'hood') cn(g, 0.1, 0.16, o.hatc || '#6b5a40', 0, 0.48, 0, 6);
  else if (o.hat === 'hair') sp(g, 0.078, '#3b2a1a', 0, 0.5, -0.01, 0, 0.6);
  else if (o.hat === 'straw') cn(g, 0.13, 0.08, '#d9c27a', 0, 0.5, 0, 8); // strohoed van dorpelingen
  if (o.crest) bx(g, 0.03, 0.08, 0.12, o.crest, 0, 0.57, 0); // pluim op de helm, in legerkleur
  aL.position.set(-0.12, 0.38, 0);
  aR.position.set(0.12, 0.38, 0);
  bx(aL, 0.05, 0.18, 0.06, o.shirt, 0, -0.18, 0);
  bx(aR, 0.05, 0.18, 0.06, o.shirt, 0, -0.18, 0);
  if (o.tool) {
    const t = new T3.Group();
    t.position.set(0, -0.17, 0.04);
    aR.add(t);
    if (o.tool === 'spear') {
      cy(t, 0.012, 0.6, C.woodd, 0, -0.2, 0, 4);
      cn(t, 0.025, 0.08, '#c9ccce', 0, 0.4, 0, 4);
    } else if (o.tool === 'axe') {
      cy(t, 0.012, 0.26, C.woodd, 0, -0.05, 0, 4);
      bx(t, 0.08, 0.06, 0.02, '#b8bcbf', 0.03, 0.15, 0);
    } else if (o.tool === 'pick') {
      cy(t, 0.012, 0.26, C.woodd, 0, -0.05, 0, 4);
      bx(t, 0.16, 0.025, 0.025, '#9a9ea2', 0, 0.19, 0);
    } else if (o.tool === 'hoe') {
      cy(t, 0.012, 0.3, C.woodd, 0, -0.08, 0, 4);
      bx(t, 0.06, 0.02, 0.06, '#9a9ea2', 0, 0.2, 0.02);
    } else if (o.tool === 'hammer') {
      cy(t, 0.012, 0.2, C.woodd, 0, -0.03, 0, 4);
      bx(t, 0.07, 0.05, 0.05, '#6e6a64', 0, 0.15, 0);
    } else if (o.tool === 'bow') {
      bx(t, 0.015, 0.34, 0.015, C.woodd, 0, -0.05, 0.05);
    } else if (o.tool === 'sword') {
      bx(t, 0.02, 0.26, 0.01, '#d4d8db', 0, 0, 0);
    } else if (o.tool === 'gun') {
      bx(t, 0.03, 0.03, 0.32, '#2e3236', 0, 0.02, 0.1);
    } else if (o.tool === 'sling') {
      bx(t, 0.01, 0.12, 0.01, '#7a5a36', 0, 0, 0);
    }
  }
  if (o.shield) bx(aL, 0.02, 0.16, 0.12, o.shield, -0.03, -0.24, 0);
  g.add(lL, lR, aL, aR);
  g.userData.limbs = { lL, lR, aL, aR };
  const cr = new T3.Mesh(GB, mat('#8a6a44'));
  cr.scale.set(0.12, 0.12, 0.08);
  cr.position.set(0, 0.22, -0.1);
  cr.visible = false;
  g.add(cr);
  g.userData.carry = cr;
  return g;
}
const JOBTOOL = {
  wood: 'axe',
  stone: 'pick',
  copper: 'pick',
  tin: 'pick',
  iron: 'pick',
  gold: 'pick',
  coal: 'pick',
  lithium: 'pick',
  sand: 'hoe',
  food: 'hoe',
  build: 'hammer',
};
// Dorpelingen: kleiner, gewone werkkleding in de kleur van hun taak, geen legerkleuren
export function makeVillager(job) {
  const g = new T3.Group();
  g.scale.setScalar(1.12);
  person(g, {
    shirt: JOBCOL[job] || (RES[job] ? RES[job].c : '#cdbf9c'),
    pants: '#6b5a44',
    tool: JOBTOOL[job],
    hat: job === 'build' ? 'cap' : job === 'food' || job === 'auto' ? 'straw' : 'hair',
    hatc: '#c9a14a',
    skin: (job || '').length % 4,
  });
  return g;
}
export function makeUnit(k, foe) {
  const g = new T3.Group(),
    T = foe ? FOE : TEAM,
    TD = foe ? '#7a2a24' : TEAMD;
  if (k === 'tank') {
    bx(g, 0.7, 0.22, 0.44, foe ? '#5a3a32' : '#5b6644', 0, 0.06, 0);
    bx(g, 0.74, 0.1, 0.12, '#2e3236', 0, 0, 0.2);
    bx(g, 0.74, 0.1, 0.12, '#2e3236', 0, 0, -0.2);
    bx(g, 0.34, 0.16, 0.3, foe ? '#6a3a32' : '#6b7650', 0, 0.28, 0);
    const b = bx(g, 0.5, 0.05, 0.05, '#3a3f33', 0.3, 0.34, 0);
    bx(g, 0.14, 0.04, 0.14, T, 0, 0.44, 0);
    return g;
  }
  if (k === 'fieldgun') {
    const b = cy(g, 0.05, 0.55, '#2e3236', 0, 0.22, 0, 8);
    b.rotation.z = Math.PI / 2 - 0.2;
    b.position.x = 0.1;
    for (const z of [-0.15, 0.15]) {
      const w = cy(g, 0.14, 0.04, C.woodd, 0, 0.14, z, 10);
      w.rotation.x = Math.PI / 2;
    }
    bx(g, 0.3, 0.04, 0.04, C.woodd, -0.25, 0.08, 0);
    const p = new T3.Group();
    p.position.x = -0.35;
    person(p, { shirt: T, hat: 'cap', hatc: TD });
    g.add(p);
    return g;
  }
  if (k === 'drone') {
    const b = new T3.Group();
    b.position.y = 0.9;
    bx(b, 0.22, 0.06, 0.22, foe ? '#7a2a24' : '#1b8188', 0, 0, 0);
    for (const [x, z] of [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18],
    ]) {
      bx(b, 0.2, 0.02, 0.03, C.dmetal, x / 2, 0.02, z / 2, Math.atan2(z, x));
      const r = cy(b, 0.09, 0.01, '#cfd6da', x, 0.05, z, 8);
      r.userData.rotor = 1;
    }
    mk(gIco(0), foe ? mat('#ff4a3a', { e: '#ff4a3a' }) : CYANM, b, 0, -0.03, 0, 0.04, 0.04, 0.04);
    g.add(b);
    g.userData.fly = b;
    return g;
  }
  if (k === 'knight') {
    bx(g, 0.16, 0.2, 0.46, '#6b4a32', 0, 0.24, 0);
    for (const [x, z] of [
      [-0.06, -0.16],
      [0.06, -0.16],
      [-0.06, 0.16],
      [0.06, 0.16],
    ])
      bx(g, 0.05, 0.24, 0.05, '#5a3e2a', x, 0, z);
    bx(g, 0.08, 0.18, 0.1, '#6b4a32', 0, 0.36, 0.22);
    const p = new T3.Group();
    p.position.y = 0.28;
    person(p, { shirt: '#9aa3ae', tabard: T, crest: T, hat: 'helmet', tool: 'spear', shield: T });
    g.add(p);
    g.userData.rider = p;
    return g;
  }
  if (k === 'raider') {
    bx(g, 0.16, 0.2, 0.46, '#4a3a2a', 0, 0.24, 0);
    for (const [x, z] of [
      [-0.06, -0.16],
      [0.06, -0.16],
      [-0.06, 0.16],
      [0.06, 0.16],
    ])
      bx(g, 0.05, 0.24, 0.05, '#3a2a1e', x, 0, z);
    const p = new T3.Group();
    p.position.y = 0.28;
    person(p, {
      shirt: '#7a3434',
      tabard: FOE,
      crest: FOE,
      hat: 'helmet',
      hatc: '#5d5f63',
      tool: 'sword',
      shield: FOE,
    });
    g.add(p);
    return g;
  }
  if (k === 'wolf') {
    bx(g, 0.14, 0.14, 0.4, '#7d7466', 0, 0.14, 0);
    bx(g, 0.11, 0.11, 0.14, '#8a8274', 0, 0.2, 0.24);
    cn(g, 0.03, 0.06, '#6d6458', 0.03, 0.3, 0.24, 4);
    cn(g, 0.03, 0.06, '#6d6458', -0.03, 0.3, 0.24, 4);
    for (const [x, z] of [
      [-0.05, -0.13],
      [0.05, -0.13],
      [-0.05, 0.13],
      [0.05, 0.13],
    ])
      bx(g, 0.04, 0.14, 0.04, '#6d6458', x, 0, z);
    bx(g, 0.04, 0.04, 0.18, '#6d6458', 0, 0.2, -0.26);
    return g;
  }
  if (k === 'armored') {
    bx(g, 0.62, 0.3, 0.4, '#5a3a32', 0, 0.08, 0);
    for (const [x, z] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2],
    ]) {
      const w = cy(g, 0.09, 0.05, '#1e1e1e', x, 0.1, z, 8);
      w.rotation.x = Math.PI / 2;
    }
    bx(g, 0.18, 0.1, 0.16, '#4a2e28', 0, 0.38, 0);
    bx(g, 0.3, 0.04, 0.04, '#2e2e2e', 0.2, 0.42, 0);
    return g;
  }
  const U = {
    spear: { shirt: '#b89363', tool: 'spear', hat: 'hair' },
    slinger: { shirt: '#a08a5e', tool: 'sling', hat: 'hood' },
    warrior: { shirt: '#b9853a', tool: 'sword', hat: 'helmet', hatc: '#b9853a', shield: T },
    archer: { shirt: '#6f8f45', tool: 'bow', hat: 'hood', hatc: '#4f6a34' },
    rifle: { shirt: '#3f5f8a', tool: 'gun', hat: 'cap', hatc: '#2b3f5e', pants: '#e8e4d8' },
    soldier: { shirt: '#5f6b3c', tool: 'gun', hat: 'helmet', hatc: '#4a5530' },
    exo: { shirt: '#3c4a52', tool: 'gun', hat: 'helmet', hatc: '#2a3238', pants: '#2a3238' },
    plunder: { shirt: '#8a4b37', tool: 'axe', hat: 'hood', hatc: '#5a3020' },
    merc: { shirt: '#6d4a3a', tool: 'gun', hat: 'cap', hatc: '#4a3a2a' },
  }[k] || { shirt: '#8a8a8a', tool: 'spear' };
  // Soldaten en vijanden: groter dan dorpelingen, met borststuk en pluim in hun kleur
  person(g, Object.assign({ tabard: T, crest: U.hat === 'helmet' || U.hat === 'cap' ? T : null }, U));
  g.scale.setScalar(k === 'exo' ? 1.75 : 1.45);
  return g;
}
export const FOEK = ['wolf', 'plunder', 'raider', 'merc', 'armored', 'drone'];
