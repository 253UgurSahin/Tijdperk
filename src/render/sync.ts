// Houdt de 3D-wereld gelijk met de spelstand (nieuwe gebouwen, mensen die lopen).
import type { Building, BuildingDef, Foe, GameState, Mobile } from '../types';
import * as T3 from 'three';
import { store } from '../core/store';
import { CN, CS, H, TAU, W } from '../config';
import { B } from '../data/buildings';
import { RES } from '../data/resources';
import { G, sel } from '../game/state';
import { RINGG, quadG, ringAt } from './decals';
import {
  bx,
  disposeMerged,
  gOct,
  gTorus,
  isMesh,
  mat,
  mergeFigure,
  mergeStatic,
  mergeWhole,
  mk,
} from './kit';
import { BOSS_SCALE } from '../data/bosses';
import { aimTurrets, findTurrets, type TurretState } from './turrets';
import { makeBuilding, makeCamp, wallMask } from './models';
import { hideNode, nodesNeedUpdate, rebuildNodes } from './nodes';
import { FOEK, makeUnit, makeVillager } from './people';
import { animEntity, clearDying, initAnim, startDeath, type Animated } from './animate';
import { LAYER, clearParticles, emit, puff } from './particles';
import { markOrder } from './effects';
import { camDist, isFar, pxu } from './camera';
import { CAM3, S3, cam } from './scene';
import { buildTerrain, flushTerrain, paintAll, repaintTile } from './terrain';
import { dirtyGround, node, road } from '../world/world';
import { groundChanged, shadeAll, shadeChanged } from './terrainlook';
import { miniChanged } from './minimap';
import { landSig, rivalColour } from '../game/rivals';

/** Wat er per gebouw in de 3D-wereld bewaard wordt: houder (g), model (m), hoogte en bewegende delen. */
interface BuildingRec {
  g: T3.Group;
  /** Het model met alle details, en de grove versie voor ver uitgezoomd (zie lodBuildings). */
  m: T3.Group;
  coarse: T3.Group;
  /** Verandert de sleutel (soort, tijdperk, klaar, muurvorm), dan wordt het model opnieuw gemaakt. */
  key: string;
  h: number;
  fires: T3.Object3D[];
  flags: T3.Object3D[];
  pumps: T3.Object3D[];
  lamps: T3.Object3D[];
  spins: T3.Object3D[];
  /** Het draaibare geschut van een toren (zie render/turrets.ts), of null. */
  turret: TurretState | null;
  /** Plekken in de wereld waar rook uit een schoorsteen komt: [x, y, z]. */
  chims: [number, number, number][];
  /** Was het gebouw af toen dit model gemaakt werd? */
  done: boolean;
  /** De tegels onder het gebouw: linkerbovenhoek (x, y) en grootte (s). */
  x: number;
  y: number;
  s: number;
  /** Vorige waarde van b.flash, om een nieuwe treffer te zien. */
  flPrev: number;
  /** Tijd tot het volgende rookpluimpje, en de bouwvoortgang bij het vorige beeldje. */
  smokeT?: number;
  prevProg?: number;
  /** Opveren (zie popBounce): de laatst geziene b.pop_t, wanneer het begon en of het nu bezig is. */
  popSeen: number | undefined;
  popAt: number;
  popping?: boolean;
}
/**
 * Een figuur zoals de 3D-weergave hem leest. Alleen soldaten van een rivaal hebben `rival` en `uk`,
 * alleen vijanden kunnen vluchten (`retreat`), en alleen vijanden hebben een soort (`type`) en kunnen
 * een kampioen zijn (`boss`); bij een dorpeling of jouw soldaat zijn die leeg.
 */
type Figure = Mobile & Partial<Pick<Foe, 'rival' | 'uk' | 'retreat' | 'type' | 'boss'>>;
/** Wat er per figuur (dorpeling, soldaat, vijand) in de 3D-wereld bewaard wordt (zie ook animate.ts). */
export interface EntityRec {
  g: T3.Group;
  body: T3.Group;
  key: string;
  /** Vorige getekende plek, kijkrichting en hoe hard hij beweegt. */
  px: number;
  py: number;
  ang: number;
  mv: number;
  /** Selectiecirkel: wanneer hij verscheen en hoe groot hij is. */
  selT: number;
  ringSize: number;
  ring: T3.Mesh<T3.RingGeometry, T3.MeshBasicMaterial>;
  /** De gekleurde schijf onder het figuur (zie drawDiscs): kleur, gewone grootte en of het een dorpeling is. */
  disc: T3.Color;
  dotR: number;
  discV: boolean;
  /** 1 als het figuur dit beeldje nog bestaat. */
  seen: number;
  /**
   * Het hele figuur als één vast beeldje (zie mergeWhole in kit.ts), voor ver uitgezoomd, en of dat nu in
   * beeld staat in plaats van het bewegende figuur.
   */
  statue: T3.Mesh | null;
  statueOn: boolean;
  /** De bewegende delen die even los liggen zolang het beeldje getoond wordt (zie showAsDot). */
  parts: T3.Object3D[];
  /** Het figuur in de spelstand. */
  e: Figure;
  /** De laatste bestemming van een soldaat (voor de markering bij een nieuw looporder). */
  gx?: number;
  gy?: number;
  // Voor de animatie (gezet door initAnim in animate.ts):
  /** 'v', 'u' of 'f', en de soort figuur (bijv. 'archer'). */
  kind: string;
  k: string;
  /** Soort aanval en wanneer de laatste begon. */
  atk: string;
  atkT: number;
  /** Vorige waarde van swing en flash, en wanneer hij voor het laatst geraakt werd. */
  swPrev: number;
  flPrev: number;
  hitT: number;
  /** Gewone hoogte en grootte van het figuur. */
  baseY: number;
  baseS: number;
  /** De werparm van een blijde, anders null. */
  arm: T3.Object3D | null;
  // Bij het sneuvelen (gezet door startDeath en stepDying in animate.ts):
  dieT?: number;
  machine?: boolean;
  fallDir?: number;
  landed?: number;
  // Alleen bij een kampioen (gezet door bossLook):
  /** Hij ziet er al uit als kampioen (groter, met kroon). */
  bossLook?: boolean;
  /** De gouden kroon boven zijn hoofd, en hoe hoog die gewoon hangt. */
  crown?: T3.Group;
  crownY?: number;
  /** Hoogte boven de grond voor zijn naam en levensbalk (zie overlay.ts). */
  bossTop?: number;
}
/** Wat er per vijandelijk kamp in de 3D-wereld bewaard wordt. */
interface CampRec {
  g: T3.Group;
  fires: T3.Object3D[];
}

export const BG3 = new T3.Group(),
  EG3 = new T3.Group(),
  CG3 = new T3.Group();
S3.add(BG3, EG3, CG3);
export const bRec = new Map<number, BuildingRec>(),
  eRec = new Map<number, EntityRec>(),
  cRec = new Map<number, CampRec>();
let lastG: GameState | null = null,
  terrSnap: Uint8Array | null = null,
  unlSig = '';
// Steigers rond een bouwplaats: palen, liggers op een paar hoogtes en een schoor
export function scaffold(g: T3.Object3D, s: number, h: number) {
  const m = mat('#8a6a40'),
    plank = mat('#9a7c52'),
    e = s * 0.5;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, 1],
    [1, 0],
  ])
    bx(g, 0.045, h, 0.045, m, x * e, 0, z * e);
  for (let y = 0.3; y < h; y += 0.38) {
    bx(g, s, 0.035, 0.035, m, 0, y, e);
    bx(g, 0.035, 0.035, s, m, e, y, 0);
    // Loopplank op de voorkant
    bx(g, s * 0.98, 0.02, 0.12, plank, 0, y + 0.03, e + 0.07);
  }
  const brace = bx(g, 0.03, Math.hypot(e, h) * 0.95, 0.03, m, -e * 0.5, 0, e);
  brace.rotation.z = -Math.atan2(e, h);
}
let lastBT = 0;
const tmpV = new T3.Vector3();
// Rook uit schoorstenen: dunne pluimpjes bij huizen, dikkere grijze rook bij werkplaatsen die draaien
function chimneySmoke(r: BuildingRec, b: Building, d: BuildingDef, dt: number) {
  if (!r.chims.length || !b.done) return;
  const busy = (d.conv || d.gen) && b.act > 0;
  const rate = busy ? 2.6 : 1.6;
  r.smokeT = (r.smokeT || Math.random()) - dt * rate;
  if (r.smokeT > 0) return;
  r.smokeT += 1;
  if (Math.abs(r.g.position.x - cam.x) + Math.abs(r.g.position.z - cam.y) > camDist() * 1.6) return;
  for (const c of r.chims)
    emit(
      LAYER.soft,
      c[0],
      c[1],
      c[2],
      0.12 + Math.random() * 0.06,
      busy ? 0.5 : 0.32,
      -0.06,
      busy ? 3.4 : 3.2,
      0.05,
      busy ? 0.45 : 0.32,
      busy ? 0x8f8b84 : 0xdedad2,
      busy ? 0.55 : 0.5,
    );
}
// Bouwplaats: stofwolkjes zolang er gewerkt wordt; bij oplevering een stofring en wat glinstering
function buildDust(r: BuildingRec, b: Building, s: number, dt: number) {
  if (b.prog > (r.prevProg ?? b.prog) && Math.random() < dt * 5) {
    const side = Math.random() * 4,
      u = Math.random() - 0.5;
    const x = side < 1 ? u * s : side < 2 ? s / 2 : side < 3 ? u * s : -s / 2,
      z = side < 1 ? s / 2 : side < 2 ? u * s : side < 3 ? -s / 2 : u * s;
    puff(LAYER.soft, 2, r.g.position.x + x, 0.08, r.g.position.z + z, 0.4, 0.3, 1, 0.06, 0.2, 0xc9b48a, 0.55);
  }
  r.prevProg = b.prog;
}
function finishedBurst(g: T3.Group, s: number) {
  const p = g.position,
    n = 14 + s * 6, // grotere gebouwen: meer stof
    speed = 1.2 + s * 0.3;
  // Stof dat in een ring over de grond wegrolt
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    emit(
      LAYER.soft,
      p.x + Math.sin(a) * s * 0.5,
      0.08,
      p.z + Math.cos(a) * s * 0.5,
      Math.sin(a) * speed,
      0.15,
      Math.cos(a) * speed,
      1.2,
      0.08,
      0.3 + s * 0.05,
      0xd2c09a,
      0.6,
    );
  }
  // Wat stof dat opwaait, en glinstering die omhoog spat en weer valt
  puff(LAYER.soft, 4 + s * 2, p.x, 0.3, p.z, 0.6, 0.8, 1.4, 0.15, 0.5, 0xe0d0a8, 0.4);
  puff(LAYER.glow, 10 + s * 3, p.x, 0.6, p.z, 0.8, 1.5, 0.9, 0.04, 0.01, 0xffe6a0, 0.9, -1.5);
}
// Opveren na het opleveren (of na een verbetering): eerst platter en breder, dan hoger en smaller,
// en zo uitdempen, als een veer. Intussen dijt een ring van stof uit over de grond.
const POP_TIME = 0.8; // seconden
function popBounce(r: BuildingRec, s: number) {
  const a = store.TM - r.popAt;
  if (a >= POP_TIME) {
    if (r.popping) r.m.scale.set(1, 1, 1);
    if (r.popping) r.coarse.scale.set(1, 1, 1);
    r.popping = false;
    return;
  }
  r.popping = true;
  const spring = Math.exp(-a * 5) * Math.cos(a * 18);
  r.m.scale.set(1 + spring * 0.1, 1 - spring * 0.22, 1 + spring * 0.1);
  r.coarse.scale.copy(r.m.scale);
  const p = r.g.position;
  ringAt(p.x, p.z, s * 0.55 + a * 2.4, '#f1dfb8', 0.75 * (1 - a / POP_TIME), 0.07);
}
// Treffer op een gebouw: stof en een paar vonken ergens op de gevel
function buildingHit(r: BuildingRec, s: number) {
  const p = r.g.position,
    x = p.x + (Math.random() - 0.5) * s * 0.8,
    z = p.z + (Math.random() - 0.5) * s * 0.8,
    y = 0.2 + Math.random() * r.h * 0.7;
  puff(LAYER.soft, 3, x, y, z, 0.5, 0.4, 0.9, 0.06, 0.22, 0x9a8c76, 0.6);
  puff(LAYER.glow, 3, x, y, z, 1.4, 1.4, 0.3, 0.035, 0.01, 0xffc070, 1, -4);
}
/**
 * Er is iets veranderd op de tegels (x0, y0) tot en met (x1, y1): gebouwd, gekapt, een weg gelegd.
 * Dan moeten daar de minikaart en de schaduw op de grond opnieuw, en het strooisel (gras, steentjes).
 */
export function changedAt(x0: number, y0: number, x1 = x0, y1 = y0): void {
  miniChanged(x0, y0, x1, y1);
  shadeChanged(x0, y0, x1, y1);
  groundChanged();
}
// Staan de gebouwen nu in hun grove versie (ver uitgezoomd)?
let farLod = false;
export const buildingsFar = () => farLod;
/**
 * Ver uitgezoomd wisselen alle gebouwen in één keer naar hun grove model (een paar honderd hoekpunten in
 * plaats van duizenden), en dichtbij weer terug. Dat scheelt de grafische kaart het meest juist als de
 * hele stad in beeld is.
 */
function lodBuildings() {
  const far = isFar();
  if (far === farLod) return;
  farLod = far;
  for (const r of bRec.values()) {
    r.m.visible = !far;
    r.coarse.visible = far;
  }
}
/** Hoe lang het vorige beeldje duurde (seconden), voor bewegingen die niet van de framerate mogen afhangen. */
let frameDt = 1 / 60;
const seenBuildings = new Set<number>(); // (hergebruikt: niet elk beeldje een nieuwe)
export function syncBuildings() {
  const seen = seenBuildings,
    dt = lastBT ? Math.min(0.1, store.TM - lastBT) : 0;
  seen.clear();
  lastBT = store.TM;
  frameDt = dt || 1 / 60;
  lodBuildings();
  for (const b of G.bs) {
    const d = B[b.type],
      s = d.size;
    seen.add(b.id);
    const key =
      b.type +
      '|' +
      (b.type === 'townhall' ? G.age : '') +
      '|' +
      (b.done ? 1 : 0) +
      '|' +
      (d.wall ? wallMask(b) : '');
    let r = bRec.get(b.id);
    if (!r || r.key !== key) {
      // Net opgeleverd, of het stamhuis krijgt het uiterlijk van een nieuw tijdperk: dan veert het even op
      const justFinished = r && !r.done && b.done;
      const newLook = r && r.done && b.done && b.type === 'townhall' && r.key.split('|')[1] !== String(G.age);
      const pops = justFinished || newLook;
      if (r) {
        BG3.remove(r.g);
        disposeMerged(r.g);
      }
      const g = new T3.Group(),
        m = makeBuilding(b.type, G.age, b),
        coarse = makeBuilding(b.type, G.age, b, false);
      g.add(m, coarse);
      // Van ver zie je de grove versie; dichtbij de fijne (zie lodBuildings)
      m.visible = !farLod;
      coarse.visible = farLod;
      g.position.set(b.x + s / 2, 0, b.y + s / 2);
      const box = new T3.Box3().setFromObject(m);
      const h = Math.max(0.3, box.max.y);
      if (!b.done) {
        scaffold(g, s, Math.max(0.6, h * 0.85));
        const f = new T3.Mesh(quadG, mat('#a58a62'));
        f.scale.set(s * 0.98, 1, s * 0.98);
        f.position.y = 0.02;
        f.receiveShadow = true;
        g.add(f);
      }
      g.traverse(o => {
        o.userData.bid = b.id;
      });
      BG3.add(g);
      const fires: T3.Object3D[] = [],
        flags: T3.Object3D[] = [],
        pumps: T3.Object3D[] = [],
        lamps: T3.Object3D[] = [],
        spins: T3.Object3D[] = [],
        chims: [number, number, number][] = [];
      g.updateMatrixWorld(true);
      // Schoorstenen alleen uit het fijne model, anders rookt elke schoorsteen dubbel
      m.traverse(o => {
        if (o.userData.chim) {
          o.getWorldPosition(tmpV);
          chims.push([tmpV.x, tmpV.y, tmpV.z]);
        }
      });
      g.traverse(o => {
        if (o.userData.fire) fires.push(o);
        if (o.userData.flag) flags.push(o);
        if (o.userData.pump) pumps.push(o);
        if (o.userData.lamp) lamps.push(o);
        if (o.userData.spin) spins.push(o);
      });
      r = {
        g,
        m,
        coarse,
        key,
        h,
        fires,
        flags,
        pumps,
        lamps,
        spins,
        turret: findTurrets(g, b.id),
        chims,
        done: b.done,
        flPrev: 0,
        x: b.x,
        y: b.y,
        s,
        popSeen: b.pop_t, // zie hieronder: een nieuwe pop_t betekent een verbetering
        popAt: pops ? store.TM : -9,
      };
      bRec.set(b.id, r);
      if (pops) finishedBurst(g, s);
      changedAt(b.x, b.y, b.x + s - 1, b.y + s - 1);
    }
    chimneySmoke(r, b, d, dt);
    const fl = b.flash || 0;
    if (fl > r.flPrev + 0.05) buildingHit(r, s);
    r.flPrev = fl;
    if (!b.done) {
      buildDust(r, b, s, dt);
      // Het gebouw rijst langzaam uit de grond op, binnen de steigers
      const p = Math.min(1, b.prog / b.bt);
      r.m.position.y = r.coarse.position.y = -r.h * (1 - (0.12 + 0.88 * p));
    } else {
      // Een verbetering (niveau omhoog) laat het gebouw ook even opveren (zie game/upgrades.ts)
      if (b.pop_t !== r.popSeen) {
        r.popSeen = b.pop_t;
        r.popAt = store.TM;
      }
      popBounce(r, s);
    }
    for (const f of r.fires) {
      const k = 0.85 + Math.sin(store.TM * 13 + b.id) * 0.1 + Math.sin(store.TM * 7.3 + b.id * 2) * 0.08;
      f.scale.set(1, k * (b.on === false ? 0.2 : 1), 1);
    }
    for (const f of r.flags) f.rotation.y = Math.sin(store.TM * 2 + b.id) * 0.25;
    for (const p of r.pumps) if (b.on && b.done) p.rotation.z = Math.sin(store.TM * 2.2 + b.id) * 0.25;
    // Draaiende delen (molenwieken, waterrad, ringen) draaien alleen als het gebouw af is en aan staat
    // (userData.axis is 'x', 'y' of 'z')
    if (b.done && b.on !== false)
      for (const o of r.spins)
        o.rotation[(o.userData.axis || 'y') as 'x' | 'y' | 'z'] = store.TM * o.userData.spin + b.id;
    // Het geschut van een toren draait mee naar de vijand waarop hij schiet
    if (b.done && r.turret) aimTurrets(r.turret, b, store.TM);
  }
  for (const [id, r] of bRec)
    if (!seen.has(id)) {
      BG3.remove(r.g);
      disposeMerged(r.g);
      bRec.delete(id);
      changedAt(r.x, r.y, r.x + r.s - 1, r.y + r.s - 1);
    }
}
function entKey(e: Figure): string {
  if (e.rival) return 'r' + e.rival + e.uk; // soldaat van een rivaal
  if (e.boss) return 'boss' + e.type; // een kampioen ziet er anders uit (zie bossLook)
  return e.kind === 'v' ? 'v' + e.job : e.kind === 'u' ? 'u' + e.k : 'f' + e.type;
}
// Een kampioen: veel groter, met een gouden kroon boven zijn hoofd en een gouden schijf eronder
const GOLD = mat('#e2b92c', { m: 0.6, r: 0.35 });
function bossLook(r: EntityRec, e: Foe) {
  r.bossLook = true;
  // De kroon hangt aan het figuur (zodat hij meebeweegt en mee omvalt), maar het figuur zelf is al
  // vergroot: daarom delen we hoogte en maat door die vergroting
  const top = new T3.Box3().setFromObject(r.body).max.y,
    s = r.body.scale.x || 1;
  const crown = new T3.Group();
  crown.position.y = (top + 0.1) / s;
  crown.scale.setScalar(1 / s);
  mk(gTorus(0.09, 0.025, 4, 16), GOLD, crown, 0, 0, 0, 1, 1, 1).rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    mk(gOct(), GOLD, crown, Math.cos(a) * 0.09, 0.05, Math.sin(a) * 0.09, 0.025, 0.06, 0.025);
  }
  crown.traverse(o => (o.userData.eid = e.id)); // ook de kroon is aan te klikken
  r.body.add(crown);
  r.crown = crown;
  r.crownY = crown.position.y;
  r.g.scale.setScalar(BOSS_SCALE);
  r.bossTop = (top + 0.25) * BOSS_SCALE; // net boven de kroon: daar komen naam en levensbalk (zie overlay.ts)
  r.disc.set('#e2b92c');
}
const BASEG = new T3.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
/**
 * Alle gekleurde schijven onder de figuren in twee keer getekend (één laag voor dorpelingen, één voor soldaten
 * en vijanden) in plaats van één keer per figuur: met honderden figuren scheelt dat veel werk.
 */
interface DiscLayer {
  mesh: T3.InstancedMesh<T3.CircleGeometry, T3.MeshBasicMaterial>;
  /** Hoe doorzichtig gewoon (zonder stippen). */
  alpha: number;
}
function discLayer(alpha: number, size: number): DiscLayer {
  const mesh = new T3.InstancedMesh(
    BASEG as T3.CircleGeometry,
    new T3.MeshBasicMaterial({ transparent: true, opacity: alpha, depthWrite: false }),
    size,
  );
  // Elke schijf staat ergens anders: niet als één geheel wegsnijden buiten beeld
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.count = 0;
  S3.add(mesh);
  return { mesh, alpha };
}
const discs = { v: discLayer(0.32, 256), u: discLayer(0.55, 256) };
const discM = new T3.Matrix4(),
  discS = new T3.Vector3(),
  discP = new T3.Vector3(),
  discQ = new T3.Quaternion();
/** Elk beeldje: de schijven op de plek van hun figuur zetten (ver uitgezoomd groter en voller: stippen). */
function drawDiscs() {
  const n = { v: 0, u: 0 };
  for (const r of eRec.values()) if (r.g.visible) n[r.discV ? 'v' : 'u']++;
  for (const k of ['v', 'u'] as const) {
    const layer = discs[k];
    // Te weinig plek: een grotere laag maken (de oude geven we vrij)
    if (n[k] > layer.mesh.instanceMatrix.count) {
      S3.remove(layer.mesh);
      layer.mesh.dispose();
      discs[k] = discLayer(layer.alpha, Math.ceil(n[k] * 1.5));
    }
    discs[k].mesh.count = 0;
    discs[k].mesh.material.opacity = dots ? Math.min(1, discs[k].alpha * 1.7) : discs[k].alpha;
  }
  for (const r of eRec.values()) {
    if (!r.g.visible) continue;
    const layer = discs[r.discV ? 'v' : 'u'].mesh,
      i = layer.count++,
      s = r.dotR * dotGrow * r.g.scale.x;
    discP.set(r.g.position.x, 0.025, r.g.position.z);
    discM.compose(discP, discQ, discS.set(s, s, s));
    layer.setMatrixAt(i, discM);
    layer.setColorAt(i, r.disc);
  }
  for (const k of ['v', 'u'] as const) {
    const layer = discs[k].mesh;
    layer.instanceMatrix.needsUpdate = true;
    if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
  }
}
/** Iets dat beweegt en zijn plek bij de vorige speltik onthoudt (figuur of projectiel). */
interface Moving {
  x: number;
  y: number;
  prevX?: number;
  prevY?: number;
}
/** Positie om te tekenen: tussen vorige en huidige speltik in. Bij een grote sprong (teleport) niet. */
export function smoothPos(e: Moving): [number, number] {
  // prevX en prevY worden altijd samen gezet (zie update.ts)
  if (e.prevX == null || Math.abs(e.x - e.prevX) + Math.abs(e.y - e.prevY!) > 2) return [e.x, e.y];
  const a = store.alpha;
  return [e.prevX + (e.x - e.prevX) * a, e.prevY! + (e.y - e.prevY!) * a];
}

// Het materiaal van alle selectiecirkels (één voor allemaal; de dekking pulseert voor allemaal gelijk)
const RING_MAT = new T3.MeshBasicMaterial({ color: '#9fe28a', transparent: true, opacity: 0.95, depthWrite: false });
// Grote eenheden (paarden, wagens, geschut) krijgen een grotere selectiecirkel
const BIG_RING = new Set([
  'tank',
  'knight',
  'chariot',
  'cuirassier',
  'trebuchet',
  'bombard',
  'rocket',
  'mech',
]);
// Gereedschap dat een dorpeling vasthoudt, voor de juiste werkbeweging
const TOOL: Record<string, string> = { food: 'hoe', sand: 'hoe', build: 'hammer' };
function syncEnt(e: Figure, make: () => T3.Group): EntityRec {
  let r = eRec.get(e.id);
  const key = entKey(e);
  if (!r || r.key !== key) {
    if (r) {
      EG3.remove(r.g);
      wholeFigure(r);
      disposeMerged(r.g);
    }
    // g = de houder (positie, draaiing, cirkels eronder), body = alleen het figuur zelf (voor de omlijning)
    const body = make(),
      g = new T3.Group();
    // Ver uitgezoomd: het hele figuur als één beeldje (in de rusthouding, dus nu meteen gemaakt)
    const statue = mergeWhole(body);
    // Vaste blokjes per bewegend deel samenvoegen: veel minder om te tekenen (zie mergeFigure in kit.ts)
    mergeFigure(body);
    if (statue) {
      statue.visible = false;
      body.add(statue);
    }
    g.add(body);
    body.traverse(o => {
      if (isMesh(o)) o.castShadow = e.kind !== 'v' && !(e.kind === 'f' && e.camp);
    });
    EG3.add(g);
    // ringSize, ring en seen worden hieronder ingevuld
    r = {
      g,
      body,
      key,
      px: e.x,
      py: e.y,
      ang: 0,
      mv: 0,
      selT: -9,
      statue,
      statueOn: false,
      parts: [] as T3.Object3D[],
    } as EntityRec;
    const ring = new T3.Mesh(RINGG, RING_MAT);
    r.ringSize = e.kind === 'u' && BIG_RING.has(e.k) ? 0.42 : 0.28;
    ring.scale.setScalar(r.ringSize);
    // Gekleurde schijf onder elk figuur, zodat je in één oogopslag ziet wie wie is (getekend in drawDiscs):
    // licht = dorpeling, blauw = jouw leger, rood = vijand, eigen kleur = soldaat van een rivaal
    r.disc = new T3.Color(
      e.rival ? rivalColour(e.rival) : e.kind === 'v' ? '#f1e6c4' : e.kind === 'u' ? '#3d8bff' : '#ff4a3a',
    );
    r.discV = e.kind === 'v';
    r.dotR = e.kind === 'v' ? 0.18 : e.kind === 'u' && (e.k === 'tank' || e.k === 'knight') ? 0.4 : 0.25;
    ring.position.y = 0.03;
    ring.renderOrder = 3;
    g.add(ring);
    r.ring = ring;
    g.traverse(o => {
      o.userData.eid = e.id;
    });
    initAnim(r, e.kind, e.kind === 'v' ? 'v' : e.kind === 'u' ? e.k : e.uk || FOEK[e.type] || 'plunder');
    eRec.set(e.id, r);
  }
  r.seen = 1;
  r.e = e;
  // Teken tussen de vorige en de huidige speltik in (zie store.alpha), voor vloeiende beweging
  const [ex, ey] = smoothPos(e);
  e.rx = ex;
  e.ry = ey;
  const g = r.g,
    dx = ex - r.px,
    dy = ey - r.py,
    sp = Math.hypot(dx, dy);
  // Tempo in tegels per seconde, uitgemiddeld over ongeveer vijf beeldjes van 60 Hz (op elke framerate gelijk)
  const k = 1 - Math.pow(0.8, frameDt * 60);
  r.mv += (sp / frameDt - r.mv) * k;
  if (sp > 0.002) r.ang = Math.atan2(dx, dy);
  // Stilstaan: kijk naar het doel (het doel van een dorpeling heeft geen plek, dus die niet)
  else if (e.kind !== 'v' && e.tgt && e.tgt.x != null && !e.tgt.dead) {
    const tx = e.tgt.x + (e.tgt.kind === 'b' ? B[e.tgt.type].size / 2 : 0),
      ty = e.tgt.y + (e.tgt.kind === 'b' ? B[e.tgt.type].size / 2 : 0);
    if (Math.hypot(tx - ex, ty - ey) > 0.05) r.ang = Math.atan2(tx - ex, ty - ey);
  }
  r.px = ex;
  r.py = ey;
  g.position.set(ex, 0, ey);
  const da = ((r.ang - g.rotation.y + Math.PI * 3) % TAU) - Math.PI;
  g.rotation.y += da * (1 - Math.pow(0.75, frameDt * 60)); // draaien: even vlot op 30 als op 144 Hz
  showAsDot(r);
  return r;
}
// Ver uitgezoomd worden figuurtjes gekleurde stippen: de schijf eronder, groter en voller, zonder het figuur.
// Ze zijn dan toch maar een paar pixels groot, en elk figuurtje bestaat uit een tiental losse delen om te
// tekenen. (Licht = dorpeling, blauw = jouw leger, rood = vijand, eigen kleur = soldaat van een rivaal.)
// Een stip is op het scherm steeds even groot: DOT_PX pixels (straal) voor een soldaat of vijand, een dorpeling
// iets kleiner. Zo worden de bewakers van een kamp losse stippen en niet samen één grote rode vlek.
const DOT_DIST = 27 / 0.22,
  DOT_PX = 3.4;
let dots = false,
  statues = false,
  dotGrow = 1;
// Kleiner dan dit (pixels per tegel) zie je armen en benen niet meer bewegen: dan het vaste beeldje
const STATUE_PX = 32;
/*
 * Wat er niet getekend wordt, halen we ook echt even weg uit de wereld: three.js rekent anders elk beeldje
 * toch de plek van elk onderdeel uit, ook als het onzichtbaar is. Als stip gaat het hele figuur eruit (alleen
 * de schijf blijft, zie drawDiscs); als beeldje gaan de bewegende delen eruit (de kroon van een kampioen
 * blijft altijd staan).
 */
function showAsDot(r: EntityRec) {
  // Buiten beeld (met wat speling, ook voor de schaduw) hoeft het figuur er ook niet te zijn
  viewSphere.center.set(r.g.position.x, 0.4, r.g.position.z);
  const show = !dots && viewFrustum.intersectsSphere(viewSphere);
  if (show !== (r.body.parent === r.g)) {
    if (show) r.g.add(r.body);
    else r.g.remove(r.body);
  }
  const still = statues && !!r.statue;
  if (still !== r.statueOn) {
    if (still) {
      r.parts = r.body.children.filter(c => c !== r.statue && c !== r.crown);
      r.body.remove(...r.parts);
    } else restoreParts(r);
    r.statueOn = still;
    // (statue bestaat hier: zonder beeldje is still altijd false)
    r.statue!.visible = still;
  }
}
/** Het figuur weer helemaal compleet (voor het omvallen of opruimen): alle delen terug, zonder beeldje. */
function wholeFigure(r: EntityRec) {
  if (r.body.parent !== r.g) r.g.add(r.body);
  restoreParts(r);
  if (r.statue) r.statue.visible = false;
  r.statueOn = false;
}
function restoreParts(r: EntityRec) {
  if (r.parts.length) r.body.add(...r.parts);
  r.parts = [];
}
// Selectiecirkel: verschijnt met een kort "plopje" (groter, dan terug naar normaal) en pulseert zacht
function showRing(r: EntityRec, on: boolean) {
  if (on && !r.ring.visible) r.selT = store.TM;
  r.ring.visible = on;
  if (!on) return;
  const pop = Math.max(0, 1 - (store.TM - r.selT) / 0.22);
  r.ring.scale.setScalar(r.ringSize * (1 + pop * 0.6) * dotGrow);
  r.ring.material.opacity = 0.75 + Math.sin(store.TM * 4) * 0.15 + pop * 0.1;
}

// Wat de camera nu ziet (elk beeldje opnieuw), om figuren buiten beeld over te slaan
const viewFrustum = new T3.Frustum(),
  viewMatrix = new T3.Matrix4(),
  viewSphere = new T3.Sphere(new T3.Vector3(), 3);
export function syncEntities() {
  viewMatrix.multiplyMatrices(CAM3.projectionMatrix, CAM3.matrixWorldInverse);
  viewFrustum.setFromProjectionMatrix(viewMatrix);
  dots = camDist() > DOT_DIST;
  statues = pxu() < STATUE_PX;
  // (0,25 tegel is de gewone straal van de schijf onder een soldaat, zie syncEnt)
  dotGrow = dots ? Math.max(1, DOT_PX / (0.25 * pxu())) : 1;
  for (const r of eRec.values()) r.seen = 0;
  for (const v of G.vs) {
    if (v.hidden) {
      // Binnen (slapen of schuilen): het figuur blijft bestaan maar is even onzichtbaar. Anders werden 's
      // ochtends alle dorpelingen in één beeldje opnieuw gebouwd, en dat hapert.
      const r = eRec.get(v.id);
      if (r) {
        r.seen = 1;
        r.e = v;
        r.g.visible = false;
        r.ring.visible = false;
      }
      continue;
    }
    const r = syncEnt(v, () => makeVillager(v.job));
    r.g.visible = true;
    const work = (v.state === 'gather' || v.state === 'build') && r.mv < 0.3;
    // Een dorpeling heeft geen wapen: swing en cd ontbreken, dus hij valt nooit aan.
    // (Daarom de omweg via Mobile: het type Villager kent die velden niet.)
    animEntity(
      r,
      v as Mobile as Animated,
      r.mv > 0.3,
      work,
      TOOL[v.job] || (v.state === 'build' ? 'hammer' : 'pick'),
    );
    const c = r.body.userData.carry as T3.Mesh | undefined;
    if (c) {
      c.visible = v.carry.amt > 0 && !r.statueOn;
      // Wie iets draagt, weet ook wat (carry.res)
      if (c.visible) c.material = mat(RES[v.carry.res!] ? RES[v.carry.res!].c : '#8a6a44');
    }
    showRing(r, sel.vs.has(v.id));
  }
  for (const u of G.us) {
    const r = syncEnt(u, () => makeUnit(u.k, false));
    const f = r.body.userData.fly as T3.Group | undefined;
    if (f) {
      f.position.y = 0.9 + Math.sin(store.TM * 3 + u.id) * 0.06;
      f.traverse(o => {
        if (o.userData.rotor) o.rotation.y = store.TM * 30;
      });
    }
    animEntity(r, u, r.mv > 0.3, false);
    // Nieuw looporder voor een geselecteerde eenheid: een markering op de bestemming
    if (u.gx !== r.gx || u.gy !== r.gy) {
      if (r.gx !== undefined && sel.us.has(u.id) && (u.order === 'move' || u.order === 'amove'))
        markOrder(u.gx, u.gy, u.order === 'amove');
      r.gx = u.gx;
      r.gy = u.gy;
    }
    showRing(r, sel.us.has(u.id));
  }
  for (const f of G.foes) {
    // Een rivaal heeft gewone soldaten in zijn eigen kleur; andere vijanden hun eigen rode figuren
    // (een soldaat van een rivaal heeft altijd een soort, uk: zie spawnRivalUnit in game/rivals.ts)
    const make = () =>
      f.rival ? makeUnit(f.uk!, false, rivalColour(f.rival)) : makeUnit(FOEK[f.type] || 'plunder', true);
    const r = syncEnt(f, make);
    if (f.boss && !r.bossLook) bossLook(r, f);
    // De kroon draait langzaam rond en zweeft een beetje
    if (r.crown) {
      r.crown.rotation.y = store.TM * 1.5;
      // crownY is samen met de kroon gezet (zie bossLook)
      r.crown.position.y = r.crownY! + Math.sin(store.TM * 2.4) * 0.02;
    }
    const fl = r.body.userData.fly as T3.Group | undefined;
    if (fl) {
      fl.position.y = 0.9 + Math.sin(store.TM * 3 + f.id) * 0.06;
      fl.traverse(o => {
        if (o.userData.rotor) o.rotation.y = store.TM * 30;
      });
    }
    animEntity(r, f, r.mv > 0.3, false);
    r.g.visible = !f.retreat || f.alpha > 0.05;
    r.ring.visible = false;
  }
  for (const [id, r] of eRec)
    if (!r.seen) {
      EG3.remove(r.g);
      eRec.delete(id);
      // Gesneuveld (niet: naar binnen gegaan of gevlucht)? Dan laten omvallen (ook als het net een stip was).
      wholeFigure(r);
      if (r.e && r.e.dead && !r.e.retreat && !r.e.hidden) {
        r.body.visible = true;
        startDeath(r);
      } else disposeMerged(r.g);
    }
  drawDiscs();
}
export function syncCamps() {
  const seen = new Set<number>();
  for (const c of G.camps) {
    if (!c.alive) continue;
    seen.add(c.id);
    let r = cRec.get(c.id);
    if (!r) {
      const g = new T3.Group();
      makeCamp(g, c.tier);
      mergeStatic(g);
      g.position.set(c.x + 1, 0, c.y + 1);
      g.traverse(o => {
        o.userData.camp = c.id;
      });
      CG3.add(g);
      const fires: T3.Object3D[] = [];
      g.traverse(o => {
        if (o.userData.fire) fires.push(o);
      });
      r = { g, fires };
      cRec.set(c.id, r);
    }
    for (const f of r.fires) f.scale.y = 0.85 + Math.sin(store.TM * 12 + c.id) * 0.15;
  }
  for (const [id, r] of cRec)
    if (!seen.has(id)) {
      CG3.remove(r.g);
      disposeMerged(r.g);
      cRec.delete(id);
    }
}
/**
 * Roep `found(i)` aan voor elke tegel i waar `now` anders is dan `before`. We vergelijken vier tegels tegelijk
 * (als één getal van 32 bits): elk beeldje de hele kaart nalopen gaat zo op een grote kaart een stuk sneller.
 * (Dat kan, want deze rijen beginnen vooraan in hun eigen geheugen en de kaart is een veelvoud van 16 breed.)
 */
function forEachChange(now: Uint8Array, before: Uint8Array, found: (i: number) => void): void {
  const a = new Uint32Array(now.buffer, now.byteOffset, now.length >> 2),
    b = new Uint32Array(before.buffer, before.byteOffset, before.length >> 2);
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue;
    for (let i = k * 4; i < k * 4 + 4; i++) if (now[i] !== before[i]) found(i);
  }
}
function resetWorld3D() {
  for (const r of eRec.values()) wholeFigure(r);
  for (const m of [bRec, eRec, cRec])
    for (const r of m.values()) {
      (r.g.parent || S3).remove(r.g);
      disposeMerged(r.g);
    }
  clearDying();
  clearParticles();
  bRec.clear();
  eRec.clear();
  cRec.clear();
  buildTerrain();
  paintAll();
  rebuildNodes(true);
  terrSnap = road.slice();
  unlSig = landSig();
  store.nodeSnap = node.slice();
  store.nodeAge = G.age;
  lastG = G;
  groundChanged();
  shadeAll(); // de hele schaduwkaart
  store.mapVersion++; // en de hele minikaart
}
export function checkWorld() {
  if (lastG !== G) {
    resetWorld3D();
    return;
  }
  // Nieuw gebied gekocht (of land van een rivaal veranderd): alleen die stukken grond (plus een rand) opnieuw schilderen
  const us = landSig();
  if (us !== unlSig) {
    const before = unlSig;
    unlSig = us;
    for (let c = 0; c < CN * CN; c++) {
      if (before[c] === us[c]) continue;
      const cx = (c % CN) * CS,
        cy = Math.floor(c / CN) * CS;
      for (let y = cy - 1; y <= cy + CS; y++)
        for (let x = cx - 1; x <= cx + CS; x++) if (x >= 0 && y >= 0 && x < W && y < H) repaintTile(x, y);
    }
    rebuildNodes(false); // bomen en rotsen in de wildernis zijn donkerder
    groundChanged();
    store.mapVersion++; // de hele minikaart opnieuw
  }
  // Een krater of andere grondkleur (zie markGroundDirty in world.ts)
  for (const i of dirtyGround) {
    repaintTile(i % W, (i / W) | 0);
    miniChanged(i % W, (i / W) | 0);
  }
  dirtyGround.clear();
  // terrSnap en store.nodeSnap zijn gezet door resetWorld3D (hierboven, bij een nieuw spel)
  forEachChange(road, terrSnap!, i => {
    terrSnap![i] = road[i];
    const x = i % W,
      y = (i / W) | 0;
    // Ook de tegels eromheen: een weg kan schuin over hun hoeken lopen (zie roadPieces in terrain.ts)
    for (let ty = Math.max(0, y - 1); ty <= Math.min(H - 1, y + 1); ty++)
      for (let tx = Math.max(0, x - 1); tx <= Math.min(W - 1, x + 1); tx++) repaintTile(tx, ty);
    changedAt(x, y);
  });
  flushTerrain();
  // Echt iets veranderd (boom gekapt, nieuw tijdperk) of alleen de camera verschoven?
  const newAge = G.age !== store.nodeAge;
  let changed = newAge;
  forEachChange(node, store.nodeSnap!, i => {
    const x = i % W,
      y = (i / W) | 0;
    if (!node[i]) {
      // Alleen weg (gekapt of opgebruikt): die ene verbergen, de minikaart en schaduwkaart daar bijwerken,
      // en verder niets opnieuw opbouwen (het gras eronder blijft zoals het is)
      hideNode(i);
      store.nodeSnap![i] = 0;
      miniChanged(x, y, x, y);
      shadeChanged(x, y, x, y);
      return;
    }
    changed = true;
    changedAt(x, y);
  });
  // In een nieuw tijdperk verschijnen overal nieuwe bronnen: de hele schaduwkaart opnieuw
  if (newAge) shadeAll();
  if (changed) {
    store.nodeSnap = node.slice();
    store.nodeAge = G.age;
  }
  if (changed || nodesNeedUpdate()) rebuildNodes(false);
}
