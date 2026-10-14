// 3D-figuurtjes voor dorpelingen, soldaten en vijanden.
import * as T3 from 'three';
import { RES } from '../data/resources.js';
import { C, CYANM, FOE, GB, TEAM, TEAMD, VIOLETM, bx, cn, cy, gIco, mat, mk, sp } from './kit.js';

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
  else if (o.hat === 'straw')
    cn(g, 0.13, 0.08, '#d9c27a', 0, 0.5, 0, 8); // strohoed van dorpelingen
  else if (o.hat === 'horned') {
    // Barbaar: helm met twee hoorns
    sp(g, 0.085, o.hatc || '#6e6a64', 0, 0.5, 0, 0, 0.7);
    for (const x of [-1, 1]) cn(g, 0.025, 0.12, '#e8e0c8', x * 0.09, 0.5, 0, 5).rotation.z = -x * 0.9;
  } else if (o.hat === 'tricorn') {
    cy(g, 0.12, 0.03, o.hatc || '#2a2420', 0, 0.52, 0, 3);
    cy(g, 0.07, 0.06, o.hatc || '#2a2420', 0, 0.54, 0, 8);
  } else if (o.hat === 'widebrim') {
    // Brede hoed (musketier, kurassier), soms met een veer
    cy(g, 0.14, 0.02, o.hatc || '#2a2420', 0, 0.52, 0, 10);
    cy(g, 0.07, 0.08, o.hatc || '#2a2420', 0, 0.53, 0, 8);
    if (o.plume) bx(g, 0.03, 0.1, 0.12, o.plume, 0.06, 0.56, -0.02).rotation.x = -0.4;
  } else if (o.hat === 'morion') {
    // Morion: stalen helm met rand en kam (pikenier)
    sp(g, 0.085, o.hatc || '#7d868e', 0, 0.5, 0, 0, 0.75);
    cy(g, 0.12, 0.015, o.hatc || '#7d868e', 0, 0.5, 0, 10);
    bx(g, 0.02, 0.07, 0.14, o.hatc || '#7d868e', 0, 0.54, 0);
  } else if (o.hat === 'visor') {
    // Toekomsthelm met een gloeiend vizier
    sp(g, 0.09, o.hatc || '#2a2c34', 0, 0.48, 0, 0, 1.05);
    mk(GB, o.visor, g, 0, 0.45, 0.075, 0.13, 0.045, 0.04);
  }
  if (o.crest) bx(g, 0.03, 0.08, 0.12, o.crest, 0, 0.57, 0); // pluim op de helm, in legerkleur
  if (o.fur) bx(g, 0.22, 0.07, 0.14, o.fur, 0, 0.36, 0); // bontkraag over de schouders
  if (o.armor) bx(g, 0.195, 0.14, 0.125, o.armor, 0, 0.24, 0); // stalen borstplaat
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
    } else if (o.tool === 'pike') {
      // Piek: veel langer dan een speer
      cy(t, 0.012, 1.0, C.woodd, 0, -0.3, 0, 4);
      cn(t, 0.022, 0.1, '#c9ccce', 0, 0.7, 0, 4);
    } else if (o.tool === 'javelin') {
      cy(t, 0.01, 0.45, '#9a7a50', 0, -0.12, 0, 4);
      cn(t, 0.02, 0.06, '#b8bcbf', 0, 0.33, 0, 4);
    } else if (o.tool === 'bigaxe') {
      cy(t, 0.014, 0.34, C.woodd, 0, -0.08, 0, 4);
      bx(t, 0.12, 0.09, 0.02, '#a9adb0', 0.05, 0.16, 0);
    } else if (o.tool === 'blaster') {
      bx(t, 0.04, 0.05, 0.34, '#2a2c34', 0, 0.02, 0.1);
      mk(GB, o.glow || CYANM, t, 0, 0.035, 0.24, 0.02, 0.02, 0.1);
    } else if (o.tool === 'sling') {
      bx(t, 0.01, 0.12, 0.01, '#7a5a36', 0, 0, 0);
    }
  }
  if (o.shield && o.round) {
    const sh = cy(aL, 0.1, 0.02, o.shield, -0.035, -0.18, 0, 10);
    sh.rotation.z = Math.PI / 2;
    sp(aL, 0.025, '#b8bcbf', -0.06, -0.18, 0);
  } else if (o.shield) bx(aL, 0.02, 0.16, 0.12, o.shield, -0.03, -0.24, 0);
  // Pijlkoker met speren op de rug
  if (o.quiver) {
    bx(g, 0.06, 0.2, 0.06, '#6b4a32', 0.05, 0.18, -0.08);
    for (const x of [0.035, 0.065]) cy(g, 0.008, 0.36, '#9a7a50', x, 0.18, -0.08, 4);
  }
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
// Een paard (lijf, vier benen, hoofd), gebruikt door ridders, kurassiers en de strijdwagen
function horse(g, c, cd, z = 0) {
  bx(g, 0.16, 0.2, 0.46, c, 0, 0.24, z);
  for (const [x, dz] of [
    [-0.06, -0.16],
    [0.06, -0.16],
    [-0.06, 0.16],
    [0.06, 0.16],
  ])
    bx(g, 0.05, 0.24, 0.05, cd, x, 0, z + dz);
  bx(g, 0.08, 0.18, 0.1, c, 0, 0.36, z + 0.22);
  bx(g, 0.03, 0.12, 0.08, cd, 0, 0.4, z + 0.16); // manen
  bx(g, 0.03, 0.14, 0.04, cd, 0, 0.2, z - 0.24); // staart
}
// Wiel dat dwars op de rijrichting staat
function wheel(g, r, x, y, z, c = C.woodd) {
  const w = cy(g, r, 0.04, c, x, y, z, 10);
  w.rotation.z = Math.PI / 2;
  w.position.x = x + (x > 0 ? 0.04 : 0);
  return w;
}
// Sommige voertuigen zijn in de lengte langs x gebouwd; draai ze zodat de neus naar voren (z) wijst
function faceForward(g) {
  const h = new T3.Group();
  h.add(...g.children);
  h.rotation.y = -Math.PI / 2;
  g.add(h);
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
    bx(g, 0.5, 0.05, 0.05, '#3a3f33', 0.3, 0.34, 0); // kanonloop
    bx(g, 0.14, 0.04, 0.14, T, 0, 0.44, 0);
    return faceForward(g);
  }
  if (k === 'fieldgun') {
    const b = cy(g, 0.05, 0.55, '#2e3236', 0, 0.22, 0, 8);
    b.rotation.z = -(Math.PI / 2 - 0.2); // loop wijst naar voren, iets omhoog
    b.position.x = -0.05;
    for (const z of [-0.15, 0.15]) {
      const w = cy(g, 0.14, 0.04, C.woodd, 0, 0.14, z, 10);
      w.rotation.x = Math.PI / 2;
    }
    bx(g, 0.3, 0.04, 0.04, C.woodd, -0.25, 0.08, 0);
    const p = new T3.Group();
    p.position.x = -0.35;
    person(p, { shirt: T, hat: 'cap', hatc: TD });
    p.rotation.y = Math.PI / 2;
    g.add(p);
    return faceForward(g);
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
    horse(g, '#6b4a32', '#5a3e2a');
    bx(g, 0.18, 0.04, 0.2, T, 0, 0.42, -0.02); // zadeldek in legerkleur
    const p = new T3.Group();
    p.position.y = 0.28;
    person(p, { shirt: '#9aa3ae', tabard: T, crest: T, hat: 'helmet', tool: 'spear', shield: T });
    g.add(p);
    g.userData.rider = p;
    return g;
  }
  if (k === 'raider') {
    horse(g, '#4a3a2a', '#3a2a1e');
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
    return faceForward(g);
  }
  if (k === 'cuirassier') {
    // Kurassier: donker paard, stalen borstplaat en hoed met veer
    horse(g, '#3a2a1e', '#2a1e16');
    bx(g, 0.18, 0.04, 0.2, T, 0, 0.42, -0.02);
    const p = new T3.Group();
    p.position.y = 0.28;
    person(p, {
      shirt: '#4a4f56',
      armor: '#6e767e',
      sash: T,
      hat: 'widebrim',
      plume: T,
      tool: 'sword',
    });
    g.add(p);
    g.userData.rider = p;
    return g;
  }
  if (k === 'chariot') {
    // Strijdwagen: paard voorop, tweewielige bak met een menner erachter
    horse(g, '#8a6a44', '#6b4a32', 0.2);
    bx(g, 0.04, 0.04, 0.4, C.woodd, 0, 0.26, -0.05);
    bx(g, 0.32, 0.16, 0.22, '#9a7a50', 0, 0.14, -0.28);
    bx(g, 0.33, 0.04, 0.23, C.bronze, 0, 0.3, -0.28);
    for (const x of [-0.18, 0.18]) wheel(g, 0.13, x, 0.13, -0.28);
    const p = new T3.Group();
    p.position.set(0, 0.16, -0.3);
    person(p, { shirt: '#b9853a', tabard: T, hat: 'helmet', hatc: C.bronze, crest: T, tool: 'spear' });
    g.add(p);
    g.userData.rider = p;
    return g;
  }
  if (k === 'trebuchet') {
    // Blijde: houten werpgeschut op wielen met een tegengewicht, en een bedienaar
    bx(g, 0.26, 0.06, 0.6, C.woodd, 0, 0.1, 0);
    for (const x of [-0.15, 0.15]) {
      for (const z of [-0.22, 0.22]) wheel(g, 0.09, x, 0.09, z);
      bx(g, 0.04, 0.6, 0.04, C.wood, x * 0.8, 0.12, -0.12).rotation.x = 0.3;
      bx(g, 0.04, 0.6, 0.04, C.wood, x * 0.8, 0.12, 0.2).rotation.x = -0.3;
    }
    const ax = cy(g, 0.02, 0.3, C.dmetal, 0.15, 0.68, 0.04, 6);
    ax.rotation.z = Math.PI / 2;
    const arm = bx(g, 0.04, 0.7, 0.04, '#7a5a36', 0, 0.6, 0.12);
    arm.rotation.x = -0.75; // werparm schuin omhoog naar achteren
    arm.name = 'arm'; // beweegt bij het werpen (zie animate.js)
    bx(g, 0.02, 0.12, 0.02, '#5a4a3a', 0, 0.98, -0.4); // slinger aan het eind
    bx(g, 0.16, 0.14, 0.14, '#6e6a64', 0, 0.45, 0.18); // tegengewicht
    const p = new T3.Group();
    p.position.set(0.28, 0, -0.2);
    person(p, { shirt: '#8a6a44', tabard: T, hat: 'cap', hatc: TD });
    g.add(p);
    return g;
  }
  if (k === 'bombard') {
    // Kartouw: bronzen loop op een houten affuit, met een bedienaar
    bx(g, 0.2, 0.08, 0.5, C.woodd, 0, 0.12, -0.05);
    for (const x of [-0.14, 0.14]) wheel(g, 0.14, x, 0.14, 0.05);
    const b = cy(g, 0.075, 0.55, C.bronze, 0, 0.24, -0.12, 10, 0.06);
    b.rotation.x = Math.PI / 2 - 0.15;
    cy(g, 0.085, 0.04, '#8a6228', 0, 0.24, 0.34, 10).rotation.x = Math.PI / 2;
    for (const [x, z] of [
      [-0.12, -0.32],
      [-0.05, -0.36],
    ])
      sp(g, 0.035, '#2a2c30', x, 0.03, z);
    const p = new T3.Group();
    p.position.set(0.3, 0, -0.25);
    person(p, { shirt: '#5a3a2a', tabard: T, hat: 'widebrim', hatc: '#2a2420' });
    g.add(p);
    return g;
  }
  if (k === 'rocket') {
    // Raketwerper: vrachtwagen met een schuine bak vol raketbuizen
    const body = foe ? '#5a3a32' : '#5b6644';
    bx(g, 0.3, 0.12, 0.72, '#2e3236', 0, 0.06, 0);
    bx(g, 0.3, 0.2, 0.2, body, 0, 0.14, 0.24);
    bx(g, 0.26, 0.08, 0.02, '#6fa7c4', 0, 0.24, 0.345);
    bx(g, 0.3, 0.06, 0.46, body, 0, 0.14, -0.1);
    for (const z of [-0.24, 0.02, 0.24]) for (const x of [-0.16, 0.16]) wheel(g, 0.07, x, 0.07, z, '#1e1e1e');
    const rk = new T3.Group();
    rk.position.set(0, 0.22, -0.28);
    rk.rotation.x = -0.6;
    bx(rk, 0.26, 0.16, 0.4, body, 0, 0, 0.18);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++) {
        const t = cy(rk, 0.03, 0.02, '#1e1e1e', -0.08 + j * 0.08, 0.05 + i * 0.07, 0.39, 6);
        t.rotation.x = Math.PI / 2;
      }
    g.add(rk);
    bx(g, 0.1, 0.04, 0.1, T, 0, 0.34, 0.24);
    return g;
  }
  if (k === 'mech') {
    // Mech: lopende robot. De benen en armen heten net als bij een mens, zodat ze meebewegen.
    const metal = foe ? '#4a2e2a' : '#5b6670',
      dark = '#2a2c34',
      glow = foe ? mat('#ff4a3a', { e: '#ff4a3a' }) : VIOLETM;
    const lL = new T3.Group(),
      lR = new T3.Group(),
      aL = new T3.Group(),
      aR = new T3.Group();
    for (const [l, x] of [
      [lL, -0.16],
      [lR, 0.16],
    ]) {
      l.position.set(x, 0.62, 0);
      bx(l, 0.1, 0.32, 0.12, metal, 0, -0.32, 0);
      bx(l, 0.08, 0.32, 0.1, dark, 0, -0.6, 0.02);
      bx(l, 0.14, 0.05, 0.24, metal, 0, -0.62, 0.04);
      mk(GB, glow, l, 0, -0.18, 0.065, 0.04, 0.04, 0.01);
    }
    bx(g, 0.36, 0.1, 0.22, dark, 0, 0.56, 0);
    bx(g, 0.42, 0.3, 0.36, metal, 0, 0.64, 0);
    bx(g, 0.3, 0.12, 0.08, T, 0, 0.8, 0.16);
    mk(GB, glow, g, 0, 0.82, 0.19, 0.24, 0.06, 0.04); // cockpitruit
    bx(g, 0.2, 0.1, 0.16, dark, 0, 0.94, -0.06);
    cy(g, 0.01, 0.2, C.metal, 0.12, 0.94, -0.12, 4);
    for (const [a, x] of [
      [aL, -0.27],
      [aR, 0.27],
    ]) {
      a.position.set(x, 0.86, 0);
      bx(a, 0.12, 0.12, 0.14, metal, 0, -0.1, 0);
      bx(a, 0.08, 0.08, 0.36, dark, 0, -0.16, 0.12);
      mk(GB, glow, a, 0, -0.14, 0.3, 0.04, 0.04, 0.02);
    }
    g.add(lL, lR, aL, aR);
    g.userData.limbs = { lL, lR, aL, aR };
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
    swordsman: { shirt: '#7d848a', tool: 'sword', hat: 'helmet', hatc: '#6e767e', shield: T, round: 1 },
    javelin: { shirt: '#8a7a52', tool: 'javelin', hat: 'hood', hatc: '#5d5030', quiver: 1 },
    musketeer: { shirt: '#4a3a30', tool: 'gun', hat: 'widebrim', hatc: '#22201e', sash: T, pants: '#3a3430' },
    pikeman: { shirt: '#6a5a48', tool: 'pike', hat: 'morion', armor: '#9aa3ae' },
    plasma: {
      shirt: '#3a3f4e',
      tool: 'blaster',
      glow: VIOLETM,
      hat: 'visor',
      hatc: '#2a2c34',
      visor: VIOLETM,
      pants: '#2a2c34',
      armor: '#565c6e',
    },
    plunder: { shirt: '#8a4b37', tool: 'axe', hat: 'hood', hatc: '#5a3020' },
    barbarian: { shirt: '#6b4a30', tool: 'bigaxe', hat: 'horned', fur: '#8a7a62', pants: '#4a3a2a' },
    pirate: { shirt: '#3a3a4a', tool: 'gun', hat: 'tricorn', sash: '#c0453a', pants: '#e0d8c4' },
    merc: { shirt: '#6d4a3a', tool: 'gun', hat: 'cap', hatc: '#4a3a2a' },
    spacepirate: {
      shirt: '#2a2c32',
      tool: 'blaster',
      glow: mat('#ff4a3a', { e: '#ff4a3a' }),
      hat: 'visor',
      hatc: '#1e2026',
      visor: mat('#ff3a3a', { e: '#ff3a3a' }),
      pants: '#1e2026',
      armor: '#3e424c',
    },
  }[k] || { shirt: '#8a8a8a', tool: 'spear' };
  // Soldaten en vijanden: groter dan dorpelingen, met borststuk en pluim in hun kleur
  person(g, Object.assign({ tabard: T, crest: U.hat === 'helmet' || U.hat === 'cap' ? T : null }, U));
  g.scale.setScalar(k === 'plasma' ? 1.85 : k === 'exo' ? 1.75 : k === 'spacepirate' ? 1.7 : 1.45);
  return g;
}
// Model per vijandsoort, in dezelfde volgorde als FOES in data/units.js
export const FOEK = [
  'wolf',
  'plunder',
  'barbarian',
  'raider',
  'pirate',
  'merc',
  'armored',
  'drone',
  'spacepirate',
];
