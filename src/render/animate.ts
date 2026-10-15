// Beweging van figuurtjes: lopen, werken, ademen, aanvallen (zwaai, terugslag, mondingsvuur) en neervallen.
import * as T3 from 'three';
import { store } from '../core/store';
import { LAYER, emit, puff } from './particles';
import { S3 } from './scene';

// Soorten aanval, zodat elk wapen zijn eigen beweging en effect krijgt
const ATTACK = {
  musketeer: 'musket',
  pirate: 'musket',
  rifle: 'gun',
  soldier: 'gun',
  exo: 'gun',
  merc: 'gun',
  plasma: 'blaster',
  spacepirate: 'blaster',
  bombard: 'cannon',
  fieldgun: 'cannon',
  tank: 'cannon',
  armored: 'cannon',
  mech: 'cannon',
  trebuchet: 'trebuchet',
  rocket: 'rocket',
  drone: 'drone',
  archer: 'bow',
  slinger: 'throw',
  javelin: 'throw',
  spear: 'thrust',
  pikeman: 'thrust',
  knight: 'thrust',
  chariot: 'thrust',
  wolf: 'bite',
};
// Voertuigen en geschut vallen niet om maar zakken weg in rook
const MACHINE = new Set(['tank', 'armored', 'rocket', 'drone', 'trebuchet', 'bombard', 'fieldgun', 'mech']);
// Hoe ver het wapen vooruit en hoe hoog het zit (voor het mondingsvuur)
const MUZZLE = {
  musket: [0.5, 0.6, 0xffd27a, 0.13],
  gun: [0.5, 0.6, 0xffe08a, 0.1],
  blaster: [0.55, 0.65, 0xb48aff, 0.14],
  cannon: [0.55, 0.3, 0xffb054, 0.22],
  rocket: [0.1, 0.45, 0xffa040, 0.18],
  drone: [0.1, 0.85, 0x7ff7ff, 0.08],
};

export const DG3 = new T3.Group();
S3.add(DG3);
const dying = [];

/** Nieuw record: begintoestand van de animatie. */
export function initAnim(r, kind, k) {
  r.kind = kind;
  r.k = k;
  r.atk = ATTACK[k] || 'chop';
  r.atkT = -9;
  r.swPrev = 0;
  r.flPrev = 0;
  r.hitT = -9;
  r.baseY = r.body.position.y;
  r.baseS = r.body.scale.y;
  const arm = r.body.getObjectByProperty('name', 'arm');
  r.arm = arm || null;
}

// Waar de loop van het wapen zit, in wereldcoördinaten
function muzzleAt(r, fwd, h) {
  const g = r.g;
  return [g.position.x + Math.sin(r.ang) * fwd, h, g.position.z + Math.cos(r.ang) * fwd];
}

// Eenmalig bij elk schot of elke slag: vuur, rook of een stofwolkje
function onAttack(r) {
  const M = MUZZLE[r.atk];
  if (!M) return;
  const [x, y, z] = muzzleAt(r, M[0], M[1]),
    fx = Math.sin(r.ang),
    fz = Math.cos(r.ang);
  emit(LAYER.glow, x, y, z, 0, 0, 0, 0.09, M[3], M[3] * 1.6, M[2], 1);
  emit(LAYER.glow, x + fx * 0.08, y, z + fz * 0.08, fx * 2, 0, fz * 2, 0.07, M[3] * 0.6, M[3], 0xffffff, 0.9);
  if (r.atk === 'musket') {
    // Zwart kruit: een flinke witte rookwolk die blijft hangen
    for (let k = 0; k < 4; k++)
      emit(
        LAYER.soft,
        x,
        y,
        z,
        fx * (0.6 + k * 0.3),
        0.15 + k * 0.05,
        fz * (0.6 + k * 0.3),
        1.6,
        0.06,
        0.26,
        0xeceae2,
        0.6,
      );
  } else if (r.atk === 'gun')
    emit(LAYER.soft, x, y, z, fx * 0.5, 0.2, fz * 0.5, 0.7, 0.04, 0.13, 0xd8d8d0, 0.45);
  else if (r.atk === 'cannon') {
    for (let k = 0; k < 6; k++)
      emit(
        LAYER.soft,
        x,
        y,
        z,
        fx * (0.8 + Math.random()) + (Math.random() - 0.5),
        0.3 + Math.random() * 0.3,
        fz * (0.8 + Math.random()) + (Math.random() - 0.5),
        1.8,
        0.1,
        0.4,
        0xcfcac0,
        0.6,
      );
  } else if (r.atk === 'rocket') {
    // Achteruit spuitende rook bij het afvuren
    for (let k = 0; k < 5; k++)
      emit(
        LAYER.soft,
        x - fx * 0.4,
        y,
        z - fz * 0.4,
        -fx * (1 + Math.random()),
        0.2,
        -fz * (1 + Math.random()),
        1.4,
        0.08,
        0.32,
        0xd6d2c8,
        0.55,
      );
  }
}

// Eenmalig bij een treffer: een paar vonkjes, zodat je ziet wie geraakt wordt
function onHit(r) {
  const g = r.g;
  puff(LAYER.glow, 3, g.position.x, 0.45, g.position.z, 1.2, 1.2, 0.25, 0.035, 0.01, 0xffc070, 1, -4);
}

/** Armen en benen van een mensfiguur. */
function limbs(L, walk, t, r, fighting, q, working, tool) {
  const s = walk ? Math.sin(t * 11) * 0.6 : 0;
  L.lL.rotation.x = s;
  L.lR.rotation.x = -s;
  L.aL.rotation.x = -s * 0.7;
  L.aR.rotation.x = s * 0.7;
  L.aL.rotation.z = 0;
  if (working) {
    if (tool === 'hoe') {
      // Schoffelen: beide armen laag heen en weer
      const h = Math.sin(t * 5);
      L.aR.rotation.x = L.aL.rotation.x = -0.9 + h * 0.45;
    } else {
      // Hakken en hameren: langzaam optillen, snel neer
      const p = (t * 1.5) % 1;
      L.aR.rotation.x = p < 0.7 ? -0.4 - 2.1 * (p / 0.7) : -2.5 + 2.4 * ((p - 0.7) / 0.3);
      L.aL.rotation.x = L.aR.rotation.x * 0.5;
    }
    return;
  }
  if (!fighting) return;
  const a = r.atk;
  if (a === 'gun' || a === 'musket' || a === 'blaster') {
    // Aanleggen: geweer op schouderhoogte, terugslag bij elk schot
    const kick = q < 1 ? (1 - q) * 0.45 : 0;
    L.aR.rotation.x = -1.45 + kick;
    L.aL.rotation.x = -1.3 + kick * 0.6;
    L.aL.rotation.z = -0.35;
  } else if (a === 'bow') {
    L.aR.rotation.x = -1.5;
    L.aL.rotation.x = q < 0.35 ? -1.5 + q * 1.2 : -1.5;
  } else if (a === 'throw') {
    // Werpen: arm naar achteren, dan met een zwaai naar voren
    L.aR.rotation.x =
      q < 0.3 ? -2.8 - q : q < 0.55 ? -3.1 + ((q - 0.3) / 0.25) * 2.6 : -0.5 - Math.max(0, 1 - q) * 0.3;
  } else if (a === 'thrust') {
    // Steken: wapen naar voren, korte stoot
    L.aR.rotation.x = -1.2 - (q < 1 ? Math.sin(Math.min(1, q * 2.5) * Math.PI) * 0.4 : 0);
  } else if (a === 'chop') {
    // Hakken: hoog optillen en neerslaan
    L.aR.rotation.x =
      q < 0.3
        ? -2.6 * (q / 0.3)
        : q < 0.5
          ? -2.6 + ((q - 0.3) / 0.2) * 3.0
          : 0.4 - Math.min(1, (q - 0.5) * 2) * 0.4;
    L.aL.rotation.x = -0.5;
  }
}

/**
 * Elk beeldje per figuur. e = de spelstand-entiteit, body = het figuur (of de ruiter), moving = loopt het.
 */
export function animEntity(r, e, moving, working, tool) {
  const t = store.TM + e.id,
    body = r.body;
  // Aanval begonnen? (e.swing springt op bij elk schot of elke slag)
  const sw = e.swing || 0;
  if (sw > r.swPrev + 0.05) {
    r.atkT = store.TM;
    onAttack(r);
  }
  r.swPrev = sw;
  const fl = e.flash || 0;
  if (fl > r.flPrev + 0.05) {
    r.hitT = store.TM;
    onHit(r);
  }
  r.flPrev = fl;
  const q = (store.TM - r.atkT) / (r.atk === 'trebuchet' ? 1.6 : 0.45);
  const fighting = !moving && e.tgt && !e.tgt.dead && (e.cd > 0 || q < 1);
  // Terugstoot (geschut) en uitval (zwaard), en een klein schokje bij een treffer
  let push = 0;
  if (q < 1) {
    if (r.atk === 'cannon' || r.atk === 'rocket') push = -0.1 * (1 - q) * (1 - q);
    else if (r.atk === 'chop' || r.atk === 'thrust' || r.atk === 'bite') push = Math.sin(q * Math.PI) * 0.08;
    else if (r.atk === 'gun' || r.atk === 'musket') push = -0.03 * (1 - q);
  }
  const hq = (store.TM - r.hitT) / 0.2;
  if (hq < 1) push -= 0.05 * (1 - hq);
  // Ademen en rondkijken als er niets te doen is
  const idle = !moving && !working && !fighting;
  body.position.z = push;
  body.position.y = r.baseY + (moving && !body.userData.fly ? Math.abs(Math.sin(t * 11)) * 0.02 : 0);
  body.scale.y = r.baseS * (idle ? 1 + Math.sin(t * 2.2) * 0.015 : 1);
  body.rotation.y = idle && !MACHINE.has(r.k) ? Math.sin(t * 0.45) * Math.sin(t * 0.17) * 0.5 : 0;
  body.rotation.x =
    working && tool !== 'hoe' ? Math.max(0, Math.sin(t * 1.5 * Math.PI * 2 - 1)) * 0.1 : working ? 0.15 : 0;
  // De werparm van de blijde slaat over bij het werpen en zakt langzaam terug
  if (r.arm)
    r.arm.rotation.x = q < 0.15 ? -0.75 + (q / 0.15) * 2.1 : q < 1 ? 1.35 - ((q - 0.15) / 0.85) * 2.1 : -0.75;
  const L = (body.userData.rider || body).userData.limbs;
  if (L) limbs(L, moving, t, r, fighting, q, working, tool);
}

/** Een figuur is gesneuveld: laat het omvallen en wegzakken in plaats van ineens te verdwijnen. */
export function startDeath(r) {
  DG3.add(r.g);
  r.ring.visible = false;
  if (r.base) r.base.visible = false;
  r.dieT = store.TM;
  r.machine = MACHINE.has(r.k);
  r.fallDir = Math.random() < 0.5 ? -1 : 1;
  r.g.traverse(o => {
    if (o.userData.eid != null) o.userData.eid = null;
  });
  const p = r.g.position;
  if (r.machine) puff(LAYER.soft, 6, p.x, 0.3, p.z, 0.6, 0.6, 2, 0.1, 0.45, 0x4a4440, 0.7);
  dying.push(r);
}

/** Elk beeldje: de gevallenen verder laten zakken. */
export function stepDying() {
  for (let i = dying.length - 1; i >= 0; i--) {
    const r = dying[i],
      a = store.TM - r.dieT,
      body = r.body;
    if (r.machine) {
      body.position.y = r.baseY - Math.max(0, a - 0.3) * 0.35;
      body.rotation.z = Math.min(1, a * 2) * 0.12 * r.fallDir;
    } else {
      // Omvallen (versnellend, zoals echt vallen), even liggen, dan in de grond zakken
      const f = Math.min(1, a / 0.45);
      // Ruiters met paard vallen opzij, mensen achterover of voorover
      body.rotation[body.userData.rider ? 'z' : 'x'] = r.fallDir * f * f * (body.userData.rider ? 1.3 : 1.45);
      body.position.y = r.baseY - Math.max(0, a - 1.0) * 0.4;
      if (a > 0.45 && !r.landed) {
        r.landed = 1;
        const p = r.g.position;
        puff(LAYER.soft, 4, p.x, 0.05, p.z, 0.5, 0.2, 0.7, 0.05, 0.16, 0xb8a888, 0.5);
      }
    }
    if (a > 2) {
      DG3.remove(r.g);
      dying.splice(i, 1);
    }
  }
}

/** Nieuw spel: gevallenen opruimen. */
export function clearDying() {
  for (const r of dying) DG3.remove(r.g);
  dying.length = 0;
}
