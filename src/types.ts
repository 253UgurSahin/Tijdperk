// Gedeelde types: hoe spelgegevens, de spelstand en eenheden eruitzien.
// Typen van losse speldata (zegeningen, gebeurtenissen, volken, ...) staan bij hun lijst in src/data/.

/** Hoeveelheid per grondstof, bijv. `{ wood: 30, stone: 10 }`. */
export type Cost = Record<string, number>;
/** Een tegel `[x, y]`. */
export type Tile = [number, number];
export type Path = Tile[];

// ---------- vaste spelgegevens ----------
export interface ResDef {
  n: string;
  c: string;
  age: number;
  cr?: 1;
}
export interface AgeDef {
  n: string;
  y: string;
  r: string;
  title: string;
  sub: string;
  lvl: string;
  acc: string;
}
export interface AgeUpDef {
  cost: Cost;
  pop: number;
  need: string[];
}
export interface Chapter {
  t: string;
  s: string;
  o: [string, () => boolean][];
}
export interface NodeDef {
  k: string;
  res: string;
  amt: [number, number];
  age: number;
  n: string;
  pump?: 1;
}
export interface DefenseDef {
  r: number;
  dmg: number;
  rate: number;
  air?: 1;
  splash?: number;
  laser?: 1;
}
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
  /** Geluid bij het werk (zie audio/sound.ts). */
  snd?: string;
  // Alleen bij wereldwonderen (zie data/wonders.ts):
  wonder?: boolean;
  /** Lidwoord ('de' of 'het'), en of de naam meervoud is. */
  article?: string;
  plural?: boolean;
  /** Eigen bouwtijd in seconden. */
  bt?: number;
  bonus?: Bonus;
  /** Korte uitleg van de bonus. */
  perk?: string;
}
export interface RoadDef {
  n: string;
  cost: Cost;
}
export interface UnitDef {
  n: string;
  src: string;
  age: number;
  hp: number;
  dmg: number;
  r: number;
  rate: number;
  spd: number;
  cost: Cost;
  t: number;
  proj?: 1;
  splash?: number;
  air?: 1;
  big?: 1;
  fly?: 1;
  ride?: 1;
  /** Extra schade tegen een soort doel: ruiters, pantser, vliegers, schutters of kampen (zie bonusMul). */
  bonus?: { vs: 'ride' | 'big' | 'air' | 'proj' | 'camp'; mul: number; d: string };
  /** Hoort bij één volk (zie data/peoples.ts). */
  people?: string;
  /** Korte extra uitleg bij de knop om hem te trainen. */
  note?: string;
  snd?: string;
}
export interface FoeDef {
  n: string;
  hp: number;
  dmg: number;
  spd: number;
  r: number;
  rate: number;
  proj?: 1;
  big?: 1;
  air?: 1;
  ride?: 1;
  snd?: string;
}
export interface TechDef {
  k: string;
  age: number;
  n: string;
  g: string;
  d: string;
  cost: Cost;
  t: number;
  /** Wat het onderzoek oplevert (sleutels uit data/bonus.ts). */
  bonus: Bonus;
}

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
  /** Verslagen vijanden: na 3, 8 en 15 wordt hij veteraan, elite en held (zie game/army.ts). */
  kills?: number;
  /** Looptempo in formatie, zodat de groep samen aankomt; 0 = op volle snelheid (zie formationMove). */
  pace?: number;
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
  /** Wachtpost: waar hij naar terugloopt als het rustig is. */
  hx: number;
  hy: number;
  retreat?: boolean;
  aggro?: boolean;
  swing?: number;
  // Alleen bij soldaten van een rivaal (zie spawnRivalUnit in game/rivals.ts):
  /** Nummer van de rivaal. */
  rival?: number;
  /** Soort soldaat (sleutel uit UNITS). */
  uk?: string;
  /** Thuis op wacht, onderweg naar jou, aan het aanvallen of op weg naar huis. */
  mode?: RivalMode;
  ride?: boolean;
  splash?: number;
  snd?: string;
  /** Speltijd waarop de mars of aanval voorbij is. */
  until?: number;
  /** Gezamenlijk looptempo van de groep op weg naar jou. */
  pace?: number;
  /** Een soldaat van een bondgenoot die jou komt helpen (zie sendHelpers in game/diplomacy.ts). */
  helper?: boolean;
  /** Speltijd waarop die helper aankwam. */
  since?: number;
  /** Een kampioen die een aanval leidt: het tijdperk waar hij bij hoort (zie data/bosses.ts). */
  boss?: number;
}
/** Wat een soldaat van een rivaal doet: thuis op wacht, op mars, aanvallen, naar huis, of jou helpen. */
export type RivalMode = 'home' | 'march' | 'raid' | 'return' | 'help';

export interface Camp extends Hittable {
  kind: 'c';
  tier: number;
  mhp: number;
  alive: boolean;
}

/** Een gebouw van een rivaal (zie addBuilding in game/rivals.ts). Jouw gebouwen zijn `Building`. */
export interface RivalBuilding extends Hittable {
  kind: 'rb';
  /** Nummer van de rivaal. */
  rival: number;
  type: string;
  mhp: number;
  done: boolean;
  /** Bouwvoortgang en bouwtijd in seconden. */
  prog: number;
  bt: number;
  /** Herlaadtijd van een toren. */
  cd: number;
  aim?: number;
}

/** Een handelsverdrag: elke minuut geef je `giveAmt` van `give` en krijg je `getAmt` van `get`. */
export interface TradeDeal {
  give: string;
  giveAmt: number;
  get: string;
  getAmt: number;
}

/** De diplomatie met een rivaal (zie diplomacyStart in data/diplomacy.ts en game/diplomacy.ts). */
export interface Diplomacy {
  /** Relatie, van −100 (vijandig) tot 100 (beste vrienden). */
  rel: number;
  /** Het handelsverdrag (of null), en seconden sinds de laatste ruil. */
  trade: TradeDeal | null;
  tradeT: number;
  /** De handel wacht omdat je te weinig hebt (dan komt er maar één melding). */
  tradeShort?: boolean;
  /** Bondgenootschap, en oorlog (verklaard door jou of door hen) sinds dag `warDay`. */
  ally: boolean;
  atWar: boolean;
  warDay: number;
  /** Dag van hun laatste aanval op jou (of van de vrede of een betaalde eis). */
  lastAttack: number;
  /** Dag waarop ze je echt voor het laatst aanvielen: terugslaan is dan geen verraad. */
  raidDay: number;
  /** Je weigerde hun eis: op deze dag vallen ze aan (0 = niet). */
  threatDay: number;
  /** Je betaalde hun eis: tot deze dag vallen ze niet aan (0 = niet). */
  spareUntil: number;
  /** Per actie de dag vanaf wanneer je het opnieuw mag vragen. */
  retry: Record<string, number>;
  /** Geschenken van de laatste tijd (zakt 1 per dag). */
  gifts: number;
  /** Dag waarop ze je voor het laatst hulp stuurden, en dag van hun volgende bericht. */
  helpDay: number;
  offerDay: number;
}

/** Een rivaliserende beschaving (zie newRival in game/rivals.ts), met de diplomatie erbij. */
export interface Rival extends Diplomacy {
  /** Klein nummer: soldaten en gebouwen verwijzen hiernaar. */
  id: number;
  /** Naam en kleur (sleutel uit data/rivals.ts). */
  k: string;
  /** Karakter: bouwer, krijger of handelaar. */
  p: string;
  age: number;
  /** Spaarpot voor gebouwen en tijdperken, en die voor soldaten. */
  bank: number;
  war: number;
  /** Seconden tot de volgende soldaat klaar is, en hoeveel er al getraind zijn. */
  trainT: number;
  trained: number;
  /** Linkerbovenhoek van hun stamhuis. */
  x: number;
  y: number;
  /** De gebieden (nummers) die van hen zijn. */
  chunks: number[];
  bs: RivalBuilding[];
  attacks: number;
  /** Alleen in oude opslag: de dag van de volgende aanval (bij het laden weggehaald, zie cleanDiplomacy). */
  nextAttack?: number;
  grewDay: number;
  giftDay: number;
  /** Speltijd van jouw laatste aanval op hen, en van de laatste treffer op hun stad. */
  angry: number;
  alarm: number;
  buildWait: number;
  /** Spaarpot voor een wereldwonder, en hoe lang ze niet proberen er een neer te zetten. */
  wonderPot: number;
  wonderWait: number;
  dead: boolean;
  deadDay: number;
}

export type Target = Building | Villager | Unit | Foe | Camp | RivalBuilding;
export type Mobile = Villager | Unit | Foe;
/**
 * Iets wat je aanvalt, met wat de diplomatie erover vraagt: van welke rivaal is het (`rival`, alleen bij
 * soldaten en gebouwen van een rivaal) en is het een helper van een bondgenoot? Bij de rest is dat leeg.
 */
export type AttackTarget = Target & { rival?: number; helper?: boolean };

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
  /** Geschoten door een helper van een bondgenoot, en van welke rivaal die is (anders 0). */
  ally: boolean;
  allyOf: number;
  /** Jouw soldaat die schoot (anders null): verslaat het schot een vijand, dan telt dat voor hem. */
  by?: Unit | null;
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
  | {
      type: 'chip';
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      max: number;
      col: string;
    }
  | { type: 'ring'; x: number; y: number; life: number; max: number; col: string };

export interface LogEntry {
  d: number;
  t: string;
  k: string;
  x?: number;
  y?: number;
  id: number;
}
/** Een aanbod van de reizende handelaar: je krijgt `amt` van `want` voor `price` van `give`. */
export interface Offer {
  want: string;
  amt: number;
  give: string;
  price: number;
  until: number;
  /** Een aanbod van de handelaar heeft geen afzender; een bericht van een rivaal wel (zie RivalOffer). */
  from?: undefined;
}
/** Wat een rivaal je stuurt: een ruil, een vraag om hulp, een verbond, een eis of vrede. */
export type OfferKind = 'trade' | 'ask' | 'ally' | 'demand' | 'peace';
/**
 * Een bericht van een rivaal (zie makeRivalOffer in game/diplomacy.ts), in hetzelfde kaartje als de
 * handelaar. Bij een ruil krijg je `amt` van `want`; bij een ruil, vraag of eis betaal je `price` van `give`.
 */
export interface RivalOffer {
  /** Nummer van de rivaal die het stuurt. */
  from: number;
  kind: OfferKind;
  /** Speltijd waarop het bericht verloopt: geen antwoord telt als nee. */
  until: number;
  /** De zin zonder de naam (voor het kaartje), en de hele zin (voor het logboek). */
  line?: string;
  text?: string;
  want?: string;
  amt?: number;
  give?: string;
  price?: number;
  /** Bij een eis: zoveel dagen vallen ze niet aan als je betaalt. */
  spareDays?: number;
}
/** Het kaartje van een gebeurtenis dat nu openstaat (zie startEvent in game/events.ts). */
export interface GameEvent {
  /** Sleutel uit data/events.ts. */
  k: string;
  /** Speltijd waarop de laatste keuze vanzelf gebeurt. */
  until: number;
  text: string;
  /** De gebeurtenis waar dit een vervolg op is, of leeg. */
  from: string;
  /** Tegel van de bosbrand. */
  fx?: number;
  fy?: number;
}

/** Een bonus: per sleutel uit data/bonus.ts hoeveel erbij, bijv. `{ 'army.dmg': 0.15 }` is 15% meer schade. */
export type Bonus = Record<string, number>;

/** Een tijdelijke bonus uit een gebeurtenis (zie addBuff in game/events.ts). */
export interface Buff {
  k: string;
  n: string;
  /** Pictogram. */
  g: string;
  /** De gekozen knop (ontbreekt bij oude opslag). */
  l?: string;
  d: string;
  bonus: Bonus;
  /** Speltijd waarop de bonus voorbij is. */
  until: number;
}

/** Een vervolg op een gebeurtenis dat nog komt: gebeurtenis k op dag `day`, na gebeurtenis `from`. */
export interface Followup {
  k: string;
  day: number;
  from: string;
}

/** Een zegening die je nog mag kiezen: bij welk tijdperk, en vanaf welke speltijd. */
export interface BlessingSlot {
  age: number;
  at: number;
  /** De beloning voor een verslagen kampioen: dan liggen er andere kaarten (zie game/bosses.ts). */
  boss?: boolean;
}

/** De sterrenpoort die oplaadt (zie data/finale.ts en game/finale.ts). */
export interface FinaleState {
  /** Zoveel uur (op de klok) laadt de poort al op, en zoveel uur moet hij in totaal (0 = verwoest). */
  hours: number;
  need: number;
  /** Alle rivalen zijn al opgeroepen voor hun grote aanval. */
  rivalsCalled: boolean;
  /** Helemaal opgeladen: de poort is open. */
  done: boolean;
  /** Zo vaak werd de poort verwoest tijdens het opladen. */
  resets: number;
}

/** De kampioen die de volgende aanval leidt: het tijdperk waar hij bij hoort (zie game/bosses.ts). */
export interface PendingBoss {
  age: number;
}

/** Wie een wereldwonder heeft ('you' of de sleutel van een rivaal), en sinds welke dag. */
export interface WonderOwner {
  by: string;
  day: number;
}

/** De keuzes van het nieuw-spelscherm (zie gameOpts in game/state.ts). */
export interface GameOpts {
  people: string;
  diff: number;
  map: string;
  seedCode: string;
  /** Manieren om te winnen (sleutels uit data/victories.ts). */
  victories: string[];
  rivals: number;
}

/**
 * Wat je aan newGame meegeeft (zie game/state.ts): de keuzes van het nieuw-spelscherm, of een uitdaging.
 * Wat ontbreekt, wordt de standaard; zonder seed komt er een willekeurige wereld.
 */
export interface NewGameOptions {
  seed?: number;
  people?: string;
  diff?: number;
  map?: string;
  victories?: string[];
  rivals?: number;
  /** Spelregels (sleutels uit data/modifiers.ts); komen van de uitdaging. */
  mods?: string[];
  /** De uitdaging: sleutel, en bij de wereld van de dag de datum. */
  scenario?: { k: string; date: string };
}

/** De uitdaging van dit spel (zie cleanScenarioState in data/scenarios.ts). */
export interface ScenarioState {
  k: string;
  /** Datum van de wereld van de dag, zoals "2026-10-15"; anders leeg. */
  date: string;
  /** Speltijd waarop het doel gehaald werd, of null. */
  doneAt: number | null;
  /** 'time' als de tijd op was, anders leeg. */
  failed: '' | 'time';
  warned: number;
}

/** Eén regel van de eindscore (zie gameScore in data/score.ts). */
export interface ScoreRow {
  k: string;
  n: string;
  count: number;
  per: number;
  pts: number;
}

/** Eén afgelopen spel, zoals het in het profiel staat (zie scoreNow in game/achievements.ts). */
export interface GameRecord {
  score: number;
  medal: string;
  won: boolean;
  /** Waarmee je won; ontbreekt in profielen van vóór de keuze hoe je wint. */
  wonBy?: string;
  age: number;
  day: number;
  people: string;
  diff: number;
  /** Speelde je met de vredige modus aan? Ontbreekt in oudere profielen. */
  peaceful?: boolean;
  // Alleen bij een uitdaging:
  scenario?: string;
  date?: string;
  /** Tijd of verlies waarmee de medaille gehaald is (lager is beter). */
  value?: number;
  time?: number;
  losses?: number;
  /** Wanneer het spel in het profiel kwam (tijd in ms). */
  at?: number;
}

/** De eindscore van een spel: de profielregel plus de losse regels van de score. */
export interface GameResult extends GameRecord {
  at: number;
  rows: ScoreRow[];
  raw: number;
  sum: number;
  factor: number;
  /** Was het een nieuw record? */
  record: boolean;
}

/** Het spelersprofiel (zie core/profile.ts). Blijft bewaard, ook na een nieuw spel. */
export interface Profile {
  /** Prestatie → wanneer gehaald (tijd in ms). */
  achievements: Record<string, number>;
  games: number;
  wins: number;
  best: { score: number; perPeople: Record<string, number>; perDiff: Record<string, number> };
  unlockedPeoples: string[];
  /** Je laatste spellen, nieuwste eerst. */
  recent: GameRecord[];
  /** Per uitdaging: beste medaille, beste tijd of minste verlies, en hoe vaak gewonnen. */
  scenarios: Record<string, { medal: string; best: number | null; wins: number }>;
  /** Per datum: je beste spel in de wereld van de dag. */
  daily: Record<string, { score: number; medal: string; won: boolean }>;
}

/**
 * Tellers voor doelen, prestaties en de score. Per getrainde soort eenheid komt er een teller bij
 * (sleutel uit UNITS); daarom mag er elke sleutel in staan.
 */
export interface Stats {
  gathered: number;
  killed: number;
  born: number;
  camps: number;
  trained: number;
  knight: number;
  /** Muren en poorten gebouwd. */
  walls: number;
  /** Aanvallen doorstaan, en de dag waarop de laatste aanval echt begon. */
  survived: number;
  raidDay: number;
  meteors: number;
  /** Rivalen verslagen. */
  rivals: number;
  wondersBuilt: number;
  /** Wonderen afgemaakt terwijl een rivaal hetzelfde wonder bouwde. */
  wonderRaces: number;
  /** Wonderen veroverd door een rivaal te verslaan. */
  wondersTaken: number;
  /** Kampioenen verslagen (zie game/bosses.ts). */
  bosses: number;
  /** Bondgenootschappen en handelsverdragen gesloten, en grondstoffen ontvangen via verdragen. */
  alliances: number;
  treaties: number;
  traded: number;
  /** Dorpelingen en gebouwen (geen muren) die je kwijtraakte. */
  lost: number;
  /** Stond de vredige modus ooit aan in dit spel? Dan telt de score half. */
  peaceUsed: boolean;
  [unit: string]: number | boolean;
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
  /** Aanvallers die nog komen; `boss` is het tijdperk van de kampioen die de aanval leidt. */
  spawnQ: { type: number; x: number; y: number; scale: number; at: number; boss?: number }[];
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
  /** Het kaartje bovenaan: een aanbod van de handelaar of een bericht van een rivaal, of null. */
  offer: Offer | RivalOffer | null;
  stance: Stance;
  diff: number;
  tech: Record<string, number>;
  research: { k: string; t: number } | null;
  /** Je volk (sleutel uit data/peoples.ts). */
  people: string;
  /** Gekozen zegeningen (sleutels uit data/blessings.ts) en die je nog mag kiezen. */
  blessings: string[];
  blessingQueue: BlessingSlot[];
  forceRaid: number;
  /** Gebeurtenissen: het kaartje dat nu openstaat, en de speltijd van de laatste. */
  event: GameEvent | null;
  lastEvent: number;
  /** Tijdelijke bonussen uit gebeurtenissen. */
  buffs: Buff[];
  /** Vervolgen die nog komen. */
  followups: Followup[];
  /** Gebeurtenissen die al geweest zijn (de laatste 60). */
  eventsSeen: string[];
  /** Alleen in oude opslag (het oogstfeest); bij laden wordt het een tijdelijke bonus. */
  buff?: { work?: number };
  training: boolean;
  trainT: number;
  peaceful: boolean;
  won: boolean;
  /** Waarmee je won (sleutel uit data/victories.ts, of 'scenario'), of leeg. */
  wonBy: string;
  over: boolean;
  bought: number;
  hungry: boolean;
  stats: Stats;
  /** Prestaties die je in dít spel voor het eerst haalde. */
  achieved: string[];
  /** De eindscore, zodra het spel gewonnen of verloren is. */
  result: GameResult | null;
  /** Telt dit spel al mee bij "gespeeld" in je profiel? */
  countedAsPlayed: boolean;
  opts: GameOpts;
  /** De uitdaging van dit spel, of null. */
  scenario: ScenarioState | null;
  /** Spelregels van een uitdaging (sleutels uit data/modifiers.ts). */
  mods: string[];
  rivals: Rival[];
  /** Wie welk wereldwonder heeft. */
  wonders: Record<string, WonderOwner>;
  /** De dag waarop de handelaar van het Oost-Indisch Huis voor het laatst kwam. */
  traderDay: number;
  /** De sterrenpoort die oplaadt, of null zolang hij nog nooit af was. */
  finale: FinaleState | null;
  /** De kampioen die de volgende aanval leidt, of null. */
  boss: PendingBoss | null;
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
  /** Bij uitbreiden: de grondstof die je zoekt. */
  r?: string;
}

export interface Meteor {
  x: number;
  y: number;
  t: number;
  falling: boolean;
}
