// Gedeelde types: hoe spelgegevens, de spelstand en eenheden eruitzien.

/** Hoeveelheid per grondstof, bijv. `{ wood: 30, stone: 10 }`. */
export type Cost = Record<string, number>;
/** Een tegel `[x, y]`. */
export type Tile = [number, number];
export type Path = Tile[];

// ---------- vaste spelgegevens ----------
export interface ResDef { n: string; c: string; age: number; cr?: 1 }
export interface AgeDef { n: string; y: string; r: string; title: string; sub: string; lvl: string; acc: string }
export interface AgeUpDef { cost: Cost; pop: number; need: string[] }
export interface Chapter { t: string; s: string; o: [string, () => boolean][] }
export interface NodeDef { k: string; res: string; amt: [number, number]; age: number; n: string; pump?: 1 }
export interface DefenseDef { r: number; dmg: number; rate: number; air?: 1; splash?: number; laser?: 1 }
export interface BuildingDef {
  n: string;
  cat: string;
  age: number;
  size: number;
  hp: number;
  cost: Cost;
  /** Hoogte, voor effecten en labels boven het gebouw. */
  h: number;
  desc?: string;
  pop?: number;
  drop?: 1;
  light?: number;
  def?: DefenseDef;
  nobuild?: 1;
  work?: number;
  train?: string;
  conv?: { in: Cost; out: Cost; t: number };
  gen?: { power: number; in?: Cost; t?: number; solar?: 1 };
  pump?: { res: string; t: number };
  power?: number;
  needNode?: string;
  once?: string;
  market?: 1;
  win?: 1;
  wall?: 1;
  gate?: 1;
  road?: 1;
}
export interface RoadDef { n: string; cost: Cost }
export interface UnitDef {
  n: string; src: string; age: number; hp: number; dmg: number; r: number; rate: number; spd: number; cost: Cost; t: number;
  proj?: 1; splash?: number; air?: 1; big?: 1; fly?: 1; ride?: 1;
}
export interface FoeDef { n: string; hp: number; dmg: number; spd: number; r: number; rate: number; proj?: 1; big?: 1; air?: 1 }
export interface TechDef { k: string; age: number; n: string; g: string; d: string; cost: Cost; t: number }

// ---------- gebouwen, dorpelingen, soldaten, vijanden ----------
interface Hittable {
  id: number;
  x: number;
  y: number;
  hp: number;
  dead?: boolean;
  hidden?: boolean;
  flash?: number;
  /** Plek bij de vorige speltik, om vloeiend tussen twee tikken in te tekenen. */
  prevX?: number;
  prevY?: number;
  /** Waar de 3D-weergave hem op dit moment tekent. */
  rx?: number;
  ry?: number;
}

export interface Building extends Hittable {
  kind: 'b';
  type: string;
  done: boolean;
  /** Bouwvoortgang (seconden werk) en totale bouwtijd. */
  prog: number;
  bt: number;
  on: boolean;
  /** Klok van fabriek/pomp, herlaadtijd van de verdediging, klok van de centrale. */
  ct: number;
  cd: number;
  gt: number;
  run: boolean;
  /** Wachtrij voor training (soorten eenheden) en de klok daarvan. */
  q: string[];
  qt: number;
  /** Hoe lang er nog zichtbaar gewerkt wordt (rook, gloed), in seconden. */
  act: number;
  lvl?: number;
  pop_t?: number;
  starved?: boolean;
  blocked?: boolean;
  rally?: { x: number; y: number } | null;
  aim?: number;
}

export type VTarget = { k: 'node'; i: number } | { k: 'farm'; b: Building } | { k: 'site'; b: Building };
export type VState = 'idle' | 'walk' | 'gather' | 'build' | 'hold' | 'sleep' | 'shelter';

export interface Villager extends Hittable {
  kind: 'v';
  name: string;
  /** 'auto', 'build' of een grondstof. */
  job: string;
  state: VState;
  path: Path | null;
  carry: { res: string | null; amt: number };
  mhp: number;
  timer: number;
  wait: number;
  tgt: VTarget | null;
  keep: VTarget | null;
  res: string | null;
  threat: number;
  anim: number;
  /** Kijkrichting op het scherm: -1 links, 1 rechts. */
  dir: number;
  hidden: boolean;
  /** Wat de dorpeling doet bij aankomst. */
  on?: string | null;
  shelter?: number;
  prefSite?: Building | null;
}

export type Order = 'guard' | 'move' | 'attack' | 'amove' | 'patrol';
export type Stance = 'guard' | 'hold' | 'aggr';

export interface Unit extends Hittable {
  kind: 'u';
  k: string;
  mhp: number;
  cd: number;
  path: Path | null;
  order: Order;
  gx: number;
  gy: number;
  px?: number;
  py?: number;
  tgt: Target | null;
  scan: number;
  anim: number;
  dir: number;
  pt: number;
  stance?: Stance;
  swing?: number;
}

export interface Foe extends Hittable {
  kind: 'f';
  type: number;
  mhp: number;
  dmg: number;
  spd: number;
  r: number;
  rate: number;
  air: boolean;
  proj: boolean;
  big: boolean;
  cd: number;
  path: Path | null;
  tgt: Target | null;
  rt: number;
  pt: number;
  anim: number;
  dir: number;
  alpha: number;
  /** Het kamp dat deze vijand bewaakt; 0 bij een aanval. */
  camp: number;
  hx: number;
  hy: number;
  retreat?: boolean;
  aggro?: boolean;
  swing?: number;
}

export interface Camp extends Hittable {
  kind: 'c';
  tier: number;
  mhp: number;
  alive: boolean;
}

export type Target = Building | Villager | Unit | Foe | Camp;
export type Mobile = Villager | Unit | Foe;

export interface Projectile {
  x: number;
  y: number;
  t: Target;
  lx: number;
  ly: number;
  dmg: number;
  splash: number;
  spd: number;
  col: string;
  foe: boolean;
  big: boolean;
  h0: number;
  done?: boolean;
  prevX?: number;
  prevY?: number;
}

export type Fx =
  | { type: 'beam'; x: number; y: number; x2: number; y2: number; life: number; col: string }
  | { type: 'boom'; x: number; y: number; life: number; r: number; max?: number }
  | { type: 'smoke'; x: number; y: number; z: number; vz: number; life: number; max: number; col?: string }
  | { type: 'float'; x: number; y: number; z: number; txt: string; col: string; life: number; max: number }
  | { type: 'chip'; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; col: string }
  | { type: 'ring'; x: number; y: number; life: number; max: number; col: string };

export interface LogEntry { d: number; t: string; k: string; x?: number; y?: number; id: number }
export interface Offer { want: string; amt: number; give: string; price: number; until: number }
export interface GameEvent { id: string; until: number; text?: string; ca?: Cost | null; r?: string; fx?: number; fy?: number }

/** Tellers voor de doelen; per getrainde soort eenheid komt er een teller bij. */
export interface Stats {
  gathered: number;
  killed: number;
  born: number;
  camps: number;
  trained: number;
  knight: number;
  [unit: string]: number;
}

export interface GameState {
  seed: number;
  age: number;
  res: Record<string, number>;
  /** Speltijd in seconden, uur van de dag (0-24) en dagnummer. */
  t: number;
  clock: number;
  day: number;
  speed: number;
  /** Gebieden (CN × CN) die van jou zijn: 1 = van jou. */
  unl: number[];
  bs: Building[];
  vs: Villager[];
  us: Unit[];
  foes: Foe[];
  proj: Projectile[];
  fx: Fx[];
  regrow: { i: number; t: number; at: number }[];
  camps: Camp[];
  spawnQ: { type: number; x: number; y: number; scale: number; at: number }[];
  log: LogEntry[];
  nid: number;
  raids: number;
  tools: number;
  carryCap: number;
  autoTrain: boolean;
  trainQ: number;
  toolLvl: number;
  armsLvl: number;
  rain: number;
  groups: Record<string, number[]>;
  hist: number[][];
  offer: Offer | null;
  stance: Stance;
  diff: number;
  tech: Record<string, number>;
  research: { k: string; t: number } | null;
  buff: { work?: number };
  forceRaid: number;
  event: GameEvent | null;
  lastEvent: number;
  training: boolean;
  trainT: number;
  peaceful: boolean;
  won: boolean;
  over: boolean;
  bought: number;
  hungry: boolean;
  stats: Stats;
  /** Aangekondigde of vallende meteoriet, en wanneer de volgende komt. */
  meteor?: Meteor | null;
  nextMeteor?: number;
  starMeteor?: boolean;
}

/** Wat de knop van de coach doet: een gebouw neerzetten (b) of iets anders (k). */
export interface CoachAct {
  l: string;
  b?: string;
  k?: 'age' | 'alarm' | 'expand' | 'sel';
  id?: number;
}

export interface Meteor { x: number; y: number; t: number; falling: boolean }
