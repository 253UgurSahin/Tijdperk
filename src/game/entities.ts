import type { Building, Camp, Foe, Unit, Villager } from '../types';
// Gebouwen neerzetten en dorpelingen, soldaten en vijanden laten verschijnen.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { W } from '../config';
import { B } from '../data/buildings';
import { NAMES } from '../data/names';
import { FOES, UNITS } from '../data/units';
import { fxRing } from './fx';
import { G, bById } from './state';
import { add, mul } from './bonus';
import { armsMul, bMaxHp, bPop } from './upgrades';
import { startFinale } from './finale';
import { playerWonderDone } from './wonders';
import { toast } from '../ui/hud';
import { clamp } from '../util/math';
import { bmap, node, setBlk } from '../world/world';

export function placeBuilding(type: string, x: number, y: number, instant?: boolean): Building {
  const d = B[type],
    tot = Object.values(d.cost).reduce((a, b) => a + b, 0);
  const b: Building = {
    id: G.nid++,
    kind: 'b',
    type,
    x,
    y,
    hp: instant ? d.hp : Math.max(1, d.hp * 0.15),
    done: false,
    prog: 0,
    // Bouwtijd: een eigen getal (zoals bij wonderen), anders afhankelijk van de kosten
    bt:
      d.bt ||
      (type === 'stargate' ? 160 : type === 'command' ? 120 : d.wall ? 3 : clamp(4 + tot / 12, 5, 80)),
    on: true,
    ct: 0,
    cd: 0,
    gt: d.gen ? (d.gen.t ?? 0) : 0,
    run: false,
    q: [],
    qt: 0,
    act: 0,
  };
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) {
      const i = (y + dy) * W + x + dx;
      bmap[i] = b.id;
      if (!d.needNode) node[i] = 0;
    }
  G.bs.push(b);
  bById.set(b.id, b);
  if (instant) completeBuilding(b, true);
  return b;
}
export function completeBuilding(b: Building, silent?: boolean) {
  const d = B[b.type];
  b.done = true;
  b.hp = bMaxHp(b);
  setBlk(b, true);
  if (d.once === 'tools' && G.tools < 1.3) {
    G.tools = 1.3;
    G.carryCap += 5;
    if (!silent) toast('Smidse klaar: betere werktuigen voor iedereen', 'good');
  }
  b.pop_t = G.t;
  if (d.wall) G.stats.walls++; // voor de prestatie "win zonder muren"
  if (!silent) {
    store.notePos = [b.x + d.size / 2, b.y + d.size / 2];
    if (!d.wonder) toast(d.n + ' is klaar'); // een wonder krijgt een eigen melding, hieronder
    fxRing(b.x + d.size / 2, b.y + d.size / 2, '#ffffff');
    sfx('done');
    if (d.snd === 'creak') sfx('creak'); // de wieken van een nieuwe molen gaan draaien
  }
  // Een wereldwonder: nu van jou, met zijn bonus (zie game/wonders.ts)
  if (d.wonder) playerWonderDone(b, silent);
  // De sterrenpoort: hij moet eerst twee nachten opladen voordat je wint (zie game/finale.ts)
  if (d.win) startFinale(b);
  store.uiDirty = true;
}
export function spawnVillager(x: number, y: number): Villager {
  const v: Villager = {
    id: G.nid++,
    kind: 'v',
    x,
    y,
    name: NAMES[(Math.random() * NAMES.length) | 0],
    job: 'auto',
    state: 'idle',
    path: null,
    carry: { res: null, amt: 0 },
    hp: 40,
    mhp: 40,
    timer: 0,
    wait: 0,
    tgt: null,
    keep: null,
    res: null,
    threat: Math.random(),
    anim: Math.random() * 9,
    hidden: false,
    dir: 1,
  };
  G.vs.push(v);
  return v;
}
export function spawnUnit(k: string, x: number, y: number): Unit {
  const u = UNITS[k];
  const o: Unit = {
    id: G.nid++,
    kind: 'u',
    k,
    x,
    y,
    hp: u.hp * armsMul() * mul('army.hp'),
    mhp: u.hp * armsMul() * mul('army.hp'),
    cd: 0,
    path: null,
    order: 'guard',
    gx: x,
    gy: y,
    tgt: null,
    scan: 0,
    anim: Math.random() * 9,
    dir: 1,
    pt: 0,
    kills: 0, // verslagen vijanden: na 3, 8 en 15 een rang hoger (zie game/army.ts)
    pace: 0, // tempo als hij in formatie loopt, anders 0 (zie formationMove in game/army.ts)
  };
  G.us.push(o);
  return o;
}
export function spawnFoe(type: number, x: number, y: number, scale: number, camp?: Camp): Foe {
  const F = FOES[type];
  const f: Foe = {
    id: G.nid++,
    kind: 'f',
    type,
    x,
    y,
    hp: F.hp * scale,
    mhp: F.hp * scale,
    dmg: F.dmg * Math.sqrt(scale),
    spd: F.spd,
    r: F.r,
    rate: F.rate,
    air: !!F.air,
    ride: !!F.ride,
    proj: !!F.proj,
    big: !!F.big,
    cd: Math.random(),
    path: null,
    tgt: null,
    rt: 0,
    pt: 0,
    anim: Math.random() * 9,
    dir: 1,
    alpha: 1,
    camp: camp ? camp.id : 0,
    hx: x,
    hy: y,
  };
  G.foes.push(f);
  return f;
}
export const popCap = (): number => G.bs.reduce((a, b) => a + (b.done ? bPop(b) : 0), 0) + add('pop');
export const popNow = (): number => G.vs.length + G.us.length;
export const trainCost = (): number => 50 + G.age * 10;
