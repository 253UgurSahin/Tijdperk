// Diplomatie in het spel: relaties met rivalen, verdragen, oorlog en vrede, berichten en hulp van bondgenoten.
// De getallen (kansen, kosten, grenzen) staan in data/diplomacy.ts.
import type { AttackTarget, Cost, Foe, OfferKind, Rival, RivalMode, RivalOffer, Target } from '../types';
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { W } from '../config';
import { B } from '../data/buildings';
import {
  ALLY_KEEP,
  ALLY_MIN,
  ASK_REASONS,
  DRIFT_PER_DAY,
  HELP_CHANCE,
  OFFER_REL,
  OFFER_TIME,
  REL,
  RETALIATE_DAYS,
  RETRY_DAYS,
  TRADE_EVERY,
  TRADE_KEEP,
  TRADE_MIN,
  TRADE_RESERVE,
  WAR_AT,
  type OfferRelation,
  allyChance,
  amountFor,
  attackWait,
  clampRel,
  conquestEffect,
  drift,
  giftCost,
  giftEffect,
  giftValue,
  helperCount,
  nextAttackDay,
  offerKinds,
  peaceChance,
  powerRatio,
  relText,
  restingRel,
  rivalTrade,
  surplusRes,
  tradeChance,
  tradeDeal,
  tradeWaits,
  tributeChance,
  tributeFor,
} from '../data/diplomacy';
import { GATHER, RES } from '../data/resources';
import { PERSONALITY, RIVAL, armyPower, costValue, rivalUnits, verb } from '../data/rivals';
import type { Fighter } from '../data/rivals';
import { UNITS } from '../data/units';
import { gain, has, pay } from './economy';
import { dayLength, th } from './events';
import { isDead, isMarching, isRaider, moveToward } from './military';
import { hasRule } from './mods';
import { recallArmy, resText, rivalArmy, rivalById, spawnRivalUnit } from './rivals';
import { G } from './state';
import { armsMul } from './upgrades';
import { veteranMul } from './army';
import { sigs } from '../ui/header';
import { note, toast } from '../ui/hud';
import { dist } from '../util/math';
import { isUnl, passable } from '../world/world';

// Zo lang blijven soldaten van een bondgenoot hoogstens helpen
const HELP_TIME = 110;

// ---- Kleine hulpjes ----

/** De naam van een rivaal. */
const nameOf = (r: Rival): string => RIVAL[r.k].n;
/** Naam plus werkwoord: says(r, 'valt', 'vallen') wordt "De Zoutkoningen vallen". */
const says = (r: Rival, one: string, many: string): string => `${nameOf(r)} ${verb(RIVAL[r.k], one, many)}`;
/** "voedsel", "hout": de naam van een grondstof in een zin. */
const resName = (k: string): string => RES[k].n.toLowerCase();
/** Grondstoffen om mee te geven en te ruilen: wat je in je tijdperk kunt verzamelen. */
const tradeKeys = (): string[] => GATHER.filter(k => RES[k].age <= G.age);
/** Alle rivalen die nog meedoen. */
const living = (): Rival[] => (G && G.rivals ? G.rivals.filter(r => !r.dead) : []);
/** Gooi met een kans in procenten: true als het lukt. */
const roll = (chance: number): boolean => Math.random() * 100 < chance;
/** De relatie als heel getal, zoals je hem ziet: alle grenzen rekenen hiermee, zodat "+20" ook echt genoeg is. */
const relNow = (r: Rival): number => Math.round(r.rel);
// De interface opnieuw laten tekenen: het paneel Leger, de selectie en het venster Diplomatie
function refresh(): void {
  sigs.rivals = null;
  sigs.ins = null;
  store.uiDirty = true;
}

// ---- Sterkte ----

// Torens tellen mee voor de sterkte, net als soldaten (alleen gebouwen met een verdediging komen hier)
const towerStats = (type: string, hp: number): Fighter => ({
  hp,
  dmg: B[type].def!.dmg,
  rate: B[type].def!.rate,
});

/** Hoe sterk een rivaal is: zijn leger plus zijn torens. */
export function rivalPower(r: Rival): number {
  const army = rivalArmy(r).map(f => ({ hp: f.mhp, dmg: f.dmg, rate: f.rate }));
  const towers = r.bs.filter(b => b.done && B[b.type].def).map(b => towerStats(b.type, b.mhp));
  return armyPower(army) + armyPower(towers);
}
/** Hoe sterk jij bent, op dezelfde manier geteld. */
export function yourPower(): number {
  // Veteranen tellen zwaarder: hun levens zitten al in mhp, hun schade via veteranMul (zie game/army.ts)
  const army = G.us.map(u => ({
    hp: u.mhp,
    dmg: UNITS[u.k].dmg * armsMul() * veteranMul(u),
    rate: UNITS[u.k].rate,
  }));
  const towers = G.bs.filter(b => b.done && B[b.type].def).map(b => towerStats(b.type, B[b.type].hp));
  return armyPower(army) + armyPower(towers);
}
/** Hoeveel keer zo sterk jij bent als deze rivaal (1 = even sterk). */
export const ratioWith = (r: Rival): number => powerRatio(yourPower(), rivalPower(r));

// ---- Oorlog of vrede? ----

/** Is het oorlog met de rivaal met dit nummer? */
export const atWarWith = (id: number): boolean => !!rivalById(id)?.atWar;

/**
 * Mag je leger of een toren deze soldaat vanzelf aanvallen? Ja bij gewone vijanden en bij soldaten die
 * jou aanvallen. Soldaten van een rivaal waarmee het vrede is (thuis of op weg naar huis) niet,
 * en soldaten van een bondgenoot die je komen helpen nooit.
 */
export function fairTarget(f: Foe): boolean {
  if (!f.rival) return true;
  if (f.helper) return false;
  if (f.mode === 'march' || f.mode === 'raid') return true;
  return atWarWith(f.rival);
}

/**
 * Valt deze soldaat van een rivaal jou aan (of gaat hij net naar huis)? Dan is terugslaan altijd goed.
 * (Gewone vijanden hebben geen mode: dan is het gewoon false.)
 */
export const strikesBack = (t: Target): boolean =>
  t.kind === 'f' && (['march', 'raid', 'return'] as (RivalMode | undefined)[]).includes(t.mode);

/** Vielen ze je de laatste dagen zelf aan? Dan is terugslaan geen verraad. */
const theyRaidedYou = (r: Rival): boolean => r.raidDay > 0 && G.day - r.raidDay <= RETALIATE_DAYS;

/** Op welke dag deze rivaal op zijn vroegst weer aanvalt (Infinity bij een bondgenoot). */
export function rivalAttackDay(r: Rival): number {
  const P = PERSONALITY[r.p];
  const day = nextAttackDay({
    first: P.first,
    every: P.every,
    attacks: r.attacks,
    lastAttack: r.lastAttack,
    rel: relNow(r),
    ally: r.ally,
    war: r.atWar,
  });
  // Je betaalde hun eis: tot die dag laten ze je met rust (behalve in een oorlog)
  if (r.spareUntil && !r.atWar && day !== Infinity) return Math.max(day, r.spareUntil);
  // Je weigerde hun eis: dan komen ze eerder (een bondgenoot eist niets)
  return r.threatDay && !r.ally ? Math.min(day, r.threatDay) : day;
}

/** Om de hoeveel dagen een rivaal ongeveer aanvalt, met zijn huidige relatie (Infinity bij een bondgenoot). */
export function attackEveryDays(r: Rival): number {
  const wait = attackWait({ rel: relNow(r), ally: r.ally, war: r.atWar });
  return wait === Infinity ? Infinity : Math.max(1, Math.round(PERSONALITY[r.p].every * wait));
}

// ---- De relatie verandert ----

/** Verander de relatie met een rivaal. Zakt ze te ver, dan stoppen verdragen of verklaren zij de oorlog. */
export function changeRelation(r: Rival | null, delta: number): void {
  if (!r || r.dead || !delta) return;
  r.rel = clampRel(r.rel + delta);
  checkLimits(r);
  refresh();
}

// Verdragen houden op als de relatie te laag wordt; heel laag en ze verklaren de oorlog
function checkLimits(r: Rival): void {
  if (r.ally && relNow(r) < ALLY_KEEP) {
    r.ally = false;
    store.notePos = [r.x + 1, r.y + 1];
    toast(`${says(r, 'zegt', 'zeggen')} het bondgenootschap op: de relatie is te laag geworden.`, 'bad');
  }
  if (r.trade && relNow(r) < TRADE_KEEP) {
    r.trade = null;
    store.notePos = [r.x + 1, r.y + 1];
    toast(`${says(r, 'stopt', 'stoppen')} de handel met jou: de relatie is te laag geworden.`, 'bad');
  }
  if (!r.atWar && relNow(r) <= WAR_AT) {
    startWar(r);
    store.notePos = [r.x + 1, r.y + 1];
    toast(`${says(r, 'verklaart', 'verklaren')} je de oorlog! Ze vallen voortaan vaker aan.`, 'bad');
    sfx('alarm');
  }
}

// Oorlog: verdragen vervallen en hun wachters en torens vallen je mensen aan
function startWar(r: Rival): void {
  r.atWar = true;
  r.warDay = G.day;
  r.ally = false;
  r.trade = null;
  r.spareUntil = 0;
  refresh();
}

/** Na vrede minstens deze relatie (Koel). */
const PEACE_REL = -40;

// Vrede: geen oorlog meer, de relatie is daarna minstens koel. Wie onderweg was, gaat naar huis.
function makePeace(r: Rival): void {
  r.atWar = false;
  r.rel = Math.max(r.rel, PEACE_REL);
  r.threatDay = 0;
  r.lastAttack = G.day; // niet meteen de volgende ochtend alweer een aanval
  recallArmy(r);
  standDown(r);
  refresh();
}

function makeAlly(r: Rival): void {
  r.ally = true;
  r.atWar = false;
  r.threatDay = 0;
  recallArmy(r);
  standDown(r);
  G.stats.alliances = (G.stats.alliances || 0) + 1;
  refresh();
}

// Jouw soldaten die nog op deze rivaal afgaan, stoppen en blijven staan waar ze zijn.
// Anders vechten ze na de vrede gewoon door, en begint de oorlog meteen opnieuw.
function standDown(r: Rival): void {
  // (alleen soldaten en gebouwen van een rivaal hebben een rivaal-nummer, zie AttackTarget)
  for (const u of G.us) {
    if (!u.tgt || (u.tgt as AttackTarget).rival !== r.id) continue;
    u.tgt = null;
    u.path = null;
    if (u.order === 'attack') {
      u.order = 'guard';
      u.gx = u.x;
      u.gy = u.y;
    }
  }
}

/**
 * Jij valt iets van een rivaal aan op zijn eigen land (zie rivalHurt in game/rivals.ts), één keer per aanval.
 * Zonder oorlogsverklaring: het is meteen oorlog, en de andere rivalen vertrouwen je minder.
 */
export function youAttacked(r: Rival): void {
  if (r.atWar) {
    changeRelation(r, REL.attackedAtWar);
    return;
  }
  r.rel = clampRel(r.rel + REL.attacked);
  startWar(r);
  store.notePos = [r.x + 1, r.y + 1];
  // Zij vielen jou net aan: terugslaan mag, de anderen vinden dat niet erg
  if (theyRaidedYou(r)) {
    toast(`Je slaat terug: nu is het oorlog met ${nameOf(r)}.`, 'bad');
    return;
  }
  const others = living().filter(o => o !== r);
  for (const o of others) changeRelation(o, REL.othersBetrayed);
  const trust = others.length
    ? ` De andere volken vertrouwen je minder (relatie ${relText(REL.othersBetrayed)}).`
    : '';
  toast(`Je valt ${nameOf(r)} aan zonder oorlogsverklaring: nu is het oorlog.${trust}`, 'bad');
}

// ---- Een aanval zonder oorlogsverklaring vraagt om een tweede klik ----

/**
 * Begint een aanval op dit doel (een gebouw of soldaat van een rivaal) een oorlog? Dan die rivaal, anders null.
 * Soldaten die jou aanvallen of naar huis gaan, mag je altijd terugslaan (zie rivalHurt in game/rivals.ts).
 */
export function surpriseTarget(t: AttackTarget | null | undefined): Rival | null {
  if (!t || !t.rival || t.helper || strikesBack(t)) return null;
  const r = rivalById(t.rival);
  return r && !r.dead && !r.atWar ? r : null;
}

// Na de eerste klik: welke rivaal, en tot wanneer (echte tijd, ook als het spel stilstaat) de tweede klik telt
const CONFIRM_MS = 8000;
let armed = { id: 0, until: 0 };

/** Wacht de aanval op deze rivaal op een tweede klik? (Dan zegt de knop "Zeker?") */
export const surpriseArmed = (r: Rival | null): boolean =>
  !!r && armed.id === r.id && Date.now() < armed.until;

/** Wat een aanval zonder oorlogsverklaring kost, in één zin (voor de waarschuwing en de tooltip). */
export function surpriseText(r: Rival): string {
  if (theyRaidedYou(r))
    return `Dan is het oorlog met ${nameOf(r)}. Zij vielen jou net aan, dus de anderen vinden dat niet erg.`;
  const others =
    living().length > 1 ? ` en vertrouwen de anderen je minder (relatie ${relText(REL.othersBetrayed)})` : '';
  return `Dan is het oorlog met ${nameOf(r)}${others}.`;
}

/**
 * Een aanval zonder oorlogsverklaring: de eerste klik geeft een waarschuwing (false),
 * een tweede klik binnen 8 seconden op iets van dezelfde rivaal valt echt aan (true).
 */
export function confirmSurprise(r: Rival): boolean {
  if (surpriseArmed(r)) {
    armed = { id: 0, until: 0 };
    return true;
  }
  armed = { id: r.id, until: Date.now() + CONFIRM_MS };
  store.notePos = [r.x + 1, r.y + 1];
  toast(`${surpriseText(r)} Klik nog een keer om aan te vallen.`, 'bad');
  refresh();
  return false;
}

/** Je versloeg een gezamenlijke vijand (een kamp of een kampioen): rivalen waarmee het vrede is, vinden dat goed. */
export function commonEnemyBeaten(kind: 'camp' | 'boss'): void {
  const glad = living().filter(r => !r.atWar);
  if (!glad.length) return;
  const delta = REL[kind];
  for (const r of glad) changeRelation(r, delta);
  const what = kind === 'camp' ? 'het vijandelijke kamp weg is' : 'de kampioen verslagen is';
  note(`De rivalen zijn blij dat ${what}: relatie ${relText(delta)}.`, 'good');
}

/** Je versloeg een rivaal: een Krijger krijgt respect, de anderen worden bang. */
export function rivalConquered(beaten: Rival): void {
  for (const r of living()) if (r !== beaten) changeRelation(r, conquestEffect(r.p));
  if (G.offer && G.offer.from === beaten.id) {
    G.offer = null;
    sigs.offer = null;
  }
}

// ---- Elke seconde ----

/** Werk de diplomatie met één rivaal bij (eens per seconde, vanuit game/rivals.ts). */
export function diplomacySecond(r: Rival): void {
  const days = 1 / dayLength();
  r.rel = drift(r.rel, restingOf(r), days);
  r.gifts = Math.max(0, r.gifts - days);
  checkLimits(r);
  if (r.trade) tradeTick(r);
  maybeOffer(r);
}

/** Waar de relatie met deze rivaal vanzelf naartoe schuift (zie restingRel in data/diplomacy.ts). */
export const restingOf = (r: Rival): number =>
  restingRel({ personality: r.p, diff: G.diff, trade: !!r.trade, ally: r.ally, war: r.atWar });

// Het handelsverdrag: elke minuut wordt er geruild, als je genoeg overhoudt
// (alleen aangeroepen als er een verdrag is, zie diplomacySecond)
function tradeTick(r: Rival): void {
  r.tradeT += 1;
  if (r.tradeT < TRADE_EVERY) return;
  r.tradeT = 0;
  const t = r.trade!;
  const give = { [t.give]: t.giveAmt };
  // Je laatste voorraad houd je zelf, anders verhongert je volk door de handel
  if (tradeWaits(G.res, t)) {
    // Eén melding als de handel wacht, niet elke minuut opnieuw
    if (!r.tradeShort) {
      const keep = t.giveAmt * (TRADE_RESERVE + 1);
      note(
        `Handel met ${nameOf(r)} wacht: je houdt je laatste ${resName(t.give)} zelf (ruilt weer vanaf ${keep}).`,
      );
    }
    r.tradeShort = true;
    return;
  }
  r.tradeShort = false;
  pay(give);
  gain({ [t.get]: t.getAmt });
  G.stats.traded = (G.stats.traded || 0) + t.getAmt;
}

// ---- Acties in het venster Diplomatie ----

/** Eén actie in het venster Diplomatie (zie diplomacyActions hieronder voor wat elk veld betekent). */
export interface DiplomacyAction {
  k: string;
  n: string;
  g: string;
  chance: number;
  cost?: Cost | null;
  deal?: string;
  yes: string;
  no?: string;
  why: string;
  danger?: boolean;
  bad?: boolean;
}

/** Hoe een actie afliep: gelukt of niet, en de zin voor de melding. */
export interface DiplomacyResult {
  ok: boolean;
  text: string;
}

// Hoe lang je nog moet wachten voor je dit opnieuw mag vragen (een zin), of ''
function retryText(r: Rival, k: string): string {
  const day = r.retry[k] || 0;
  return G.day < day ? `Ze willen pas op dag ${day} weer praten` : '';
}

// "Nodig: relatie +20 (nu −4)"
const needText = (min: number, rel: number): string => `Nodig: relatie ${relText(min)} (nu ${relText(rel)})`;

/**
 * Alle acties voor een rivaal, met wat ze kosten, de kans dat ze lukken en wat er dan gebeurt.
 * Zo zie je alles voordat je klikt. Elke actie: { k, n, g, chance, cost, deal, yes, no, why, danger, bad }.
 * - chance: kans in procenten (100 = zeker) · cost: wat je betaalt (grondstoffen) of null
 * - deal: wat er geruild wordt (tekst) · yes: wat er gebeurt als het lukt · no: als het mislukt
 * - why: waarom het nu niet kan (dan is de knop uit) · danger: rode knop (oorlog)
 * - bad: het gevolg is een verlies (opzeggen, oorlog), dus in het rood
 */
export function diplomacyActions(r: Rival): DiplomacyAction[] {
  const war = r.atWar;
  const noWar = war ? 'Niet tijdens een oorlog' : '';
  const actions = [giftAction(r)];
  actions.push(r.trade ? cancelTradeAction() : tradeAction(r, noWar));
  actions.push(r.ally ? cancelAllyAction() : allyAction(r, noWar));
  actions.push(tributeAction(r, noWar));
  actions.push(war ? peaceAction(r) : warAction(r));
  return actions;
}

function giftAction(r: Rival): DiplomacyAction {
  const cost = giftCost(G.res, tradeKeys(), G.age);
  const effect = giftEffect(r.p, r.gifts);
  let why = '';
  if (!cost) why = 'Je hebt nog niets om te geven';
  else if (!has(cost)) why = `Te weinig ${resName(Object.keys(cost)[0])}`;
  const less = r.gifts > 0 ? ' (minder: je gaf net al iets)' : '';
  // Boven het rustpunt zakt de relatie daarna weer langzaam terug: zeg dat erbij
  const rest = restingOf(r);
  const back =
    relNow(r) + effect > rest
      ? `Daarna zakt de relatie ${DRIFT_PER_DAY} per dag terug naar ${relText(rest)}.`
      : '';
  return {
    k: 'gift',
    n: 'Geschenk',
    g: '❖',
    chance: 100,
    cost,
    deal: back,
    yes: `Relatie ${relText(effect)}${less}`,
    why,
  };
}

function tradeAction(r: Rival, noWar: string): DiplomacyAction {
  const deal = tradeDeal(G.res, tradeKeys(), G.age);
  const chance = tradeChance({ rel: relNow(r), personality: r.p, war: r.atWar });
  let why = noWar;
  if (!why && hasRule('noTrade')) why = 'Handel staat uit in deze uitdaging';
  if (!why && relNow(r) < TRADE_MIN) why = needText(TRADE_MIN, relNow(r));
  if (!why) why = retryText(r, 'trade');
  if (!why && !deal) why = 'Je hebt nog niets om te ruilen';
  const dealText = deal
    ? `Elke minuut: ${deal.giveAmt} ${resName(deal.give)} → ${deal.getAmt} ${resName(deal.get)}`
    : '';
  const rest = restingRel({ personality: r.p, diff: G.diff, trade: true, ally: r.ally });
  return {
    k: 'trade',
    n: 'Handelsverdrag',
    g: '⚖',
    chance,
    deal: dealText,
    yes: `Lukt: relatie gaat vanzelf naar ${relText(rest)}`,
    no: `Mislukt: relatie ${relText(REL.tradeFail)}`,
    why,
  };
}

function cancelTradeAction(): DiplomacyAction {
  return {
    k: 'endtrade',
    n: 'Verdrag opzeggen',
    g: '✕',
    chance: 100,
    yes: `De handel stopt · relatie ${relText(REL.cancelTrade)}`,
    why: '',
    bad: true,
  };
}

function allyAction(r: Rival, noWar: string): DiplomacyAction {
  const odds = { rel: relNow(r), personality: r.p, war: r.atWar };
  const chance = allyChance({ ...odds, trade: !!r.trade });
  let why = noWar;
  if (!why && relNow(r) < ALLY_MIN) why = needText(ALLY_MIN, relNow(r));
  if (!why) why = retryText(r, 'ally');
  // Hoeveel een handelsverdrag de kans zou verhogen (alleen als je er nog geen hebt)
  const tradeBonus = r.trade ? 0 : allyChance({ ...odds, trade: true }) - chance;
  let tip = r.p === 'krijger' ? ' Een Krijger zegt zelden ja.' : '';
  if (tradeBonus > 0) tip += ` Met een handelsverdrag +${tradeBonus}% kans.`;
  const help = `Word je aangevallen, dan sturen ze met ${HELP_CHANCE[r.p] ?? 50}% kans ${helperCount(r.age)} soldaten.`;
  return {
    k: 'ally',
    n: 'Bondgenootschap',
    g: '⚭',
    chance,
    deal: `Ze vallen nooit aan. ${help}${tip}`,
    yes: 'Lukt: bondgenoot',
    no: `Mislukt: relatie ${relText(REL.allyFail)}`,
    why,
  };
}

function cancelAllyAction(): DiplomacyAction {
  return {
    k: 'endally',
    n: 'Verbond opzeggen',
    g: '✕',
    chance: 100,
    yes: `Ze kunnen weer aanvallen · relatie ${relText(REL.cancelAlly)}`,
    why: '',
    bad: true,
  };
}

function tributeAction(r: Rival, noWar: string): DiplomacyAction {
  const ratio = ratioWith(r);
  const chance = tributeChance({ ratio, personality: r.p });
  let why = noWar;
  if (!why && r.ally) why = 'Niet van een bondgenoot';
  if (!why && !chance) why = `Alleen als je minstens 1,5× zo sterk bent (nu ${ratioText(ratio)})`;
  if (!why) why = retryText(r, 'tribute');
  return {
    k: 'tribute',
    n: 'Schatting eisen',
    g: '⛁',
    chance,
    deal: `Ze betalen ${resText(tributeFor(r.age))}`,
    yes: `Lukt: relatie ${relText(REL.tributeOk)}`,
    no: `Mislukt: relatie ${relText(REL.tributeFail)}`,
    why,
  };
}

// "1,8×": hoeveel keer zo sterk je bent, met een komma
const ratioText = (ratio: number): string => `${ratio.toFixed(1).replace('.', ',')}×`;

function warAction(r: Rival): DiplomacyAction {
  const days = Math.max(1, PERSONALITY[r.p].every);
  return {
    k: 'war',
    n: 'Oorlog verklaren',
    g: '⚔',
    chance: 100,
    deal: `Verdragen vervallen. Ze vallen om de ${days} dagen aan; hun wachters en torens vechten terug.`,
    yes: `Relatie ${relText(REL.declareWar)}`,
    why: '',
    danger: true,
    bad: true,
  };
}

function peaceAction(r: Rival): DiplomacyAction {
  const warDays = G.day - r.warDay;
  const chance = peaceChance({ ratio: ratioWith(r), warDays, personality: r.p, rel: relNow(r) });
  let why = warDays < 1 ? 'Kan pas na een dag oorlog' : '';
  if (!why) why = retryText(r, 'peace');
  return {
    k: 'peace',
    n: 'Vrede voorstellen',
    g: '⚑',
    chance,
    deal: 'Geschenken en een sterk leger maken de kans groter.',
    yes: `Lukt: geen oorlog meer; relatie wordt ${relText(Math.max(relNow(r), PEACE_REL))}`,
    no: `Mislukt: ${RETRY_DAYS.peace} dag wachten`,
    why,
  };
}

/** Voer een actie uit (zie diplomacyActions). Geeft { ok, text } voor de melding in het venster. */
export function doDiplomacy(r: Rival | null, k: string): DiplomacyResult | null {
  if (!r || r.dead) return null;
  const action = diplomacyActions(r).find(a => a.k === k);
  if (!action || action.why) return null;
  const result = ACTIONS[k](r, action);
  if (result) {
    store.notePos = [r.x + 1, r.y + 1];
    toast(result.text, result.ok ? 'good' : 'bad');
    sfx(result.ok ? 'upgrade' : 'bad', 0.6);
  }
  refresh();
  return result;
}

// Een poging die kan mislukken: bij mislukken zakt de relatie en moet je even wachten
function attempt(
  r: Rival,
  k: string,
  chance: number,
  onSuccess: () => string,
  failRel: number,
  failText: string,
): DiplomacyResult {
  if (roll(chance)) return { ok: true, text: onSuccess() };
  r.retry[k] = G.day + RETRY_DAYS[k];
  changeRelation(r, failRel);
  return { ok: false, text: failText };
}

// Wat elke actie doet (de sleutel is de k van de actie, zie diplomacyActions)
const ACTIONS: Record<string, (r: Rival, a: DiplomacyAction) => DiplomacyResult> = {
  gift(r, a) {
    // Zonder iets om te geven is er een reden (why) en komt de actie hier niet: cost is er zeker
    pay(a.cost!);
    const effect = giftEffect(r.p, r.gifts);
    r.gifts += 1;
    changeRelation(r, effect);
    return { ok: true, text: `${says(r, 'neemt', 'nemen')} je geschenk aan: relatie ${relText(effect)}.` };
  },
  trade(r, a) {
    // Valt er niets te ruilen, dan is er een reden (why) en komt de actie hier niet: deal is er zeker
    const deal = tradeDeal(G.res, tradeKeys(), G.age)!;
    return attempt(
      r,
      'trade',
      a.chance,
      () => {
        r.trade = deal;
        r.tradeT = 0;
        G.stats.treaties = (G.stats.treaties || 0) + 1;
        return `Handelsverdrag met ${nameOf(r)}: elke minuut ${deal.giveAmt} ${resName(deal.give)} voor ${deal.getAmt} ${resName(deal.get)}.`;
      },
      REL.tradeFail,
      `${says(r, 'wil', 'willen')} nog niet met je handelen: relatie ${relText(REL.tradeFail)}.`,
    );
  },
  endtrade(r) {
    r.trade = null;
    changeRelation(r, REL.cancelTrade);
    return { ok: true, text: `Handelsverdrag met ${nameOf(r)} opgezegd.` };
  },
  ally(r, a) {
    return attempt(
      r,
      'ally',
      a.chance,
      () => {
        makeAlly(r);
        return `${nameOf(r)} ${verb(RIVAL[r.k], 'is', 'zijn')} nu je bondgenoot: ze vallen niet meer aan.`;
      },
      REL.allyFail,
      `${says(r, 'wijst', 'wijzen')} het bondgenootschap af: relatie ${relText(REL.allyFail)}.`,
    );
  },
  endally(r) {
    r.ally = false;
    changeRelation(r, REL.cancelAlly);
    return { ok: true, text: `Bondgenootschap met ${nameOf(r)} opgezegd.` };
  },
  tribute(r, a) {
    return attempt(
      r,
      'tribute',
      a.chance,
      () => {
        const goods = tributeFor(r.age);
        gain(goods);
        r.bank = Math.max(0, r.bank - costValue(goods)); // het komt uit hun spaarpot
        r.retry.tribute = G.day + RETRY_DAYS.tribute;
        changeRelation(r, REL.tributeOk);
        return `${says(r, 'betaalt', 'betalen')} schatting: ${resText(goods)}.`;
      },
      REL.tributeFail,
      `${says(r, 'weigert', 'weigeren')} te betalen: relatie ${relText(REL.tributeFail)}.`,
    );
  },
  war(r) {
    r.rel = clampRel(r.rel + REL.declareWar);
    startWar(r);
    sfx('alarm');
    return { ok: false, text: `Je verklaart ${nameOf(r)} de oorlog.` };
  },
  peace(r, a) {
    return attempt(
      r,
      'peace',
      a.chance,
      () => {
        makePeace(r);
        return `Vrede met ${nameOf(r)}. Wie onderweg was, gaat naar huis.`;
      },
      0,
      `${says(r, 'wil', 'willen')} nog geen vrede. Probeer het morgen opnieuw.`,
    );
  },
};

// ---- Berichten van rivalen (in het kaartje van de handelaar, zie ui/event.ts) ----

// Kies er één, waarbij een gewicht van 2 twee keer zoveel kans geeft als 1
function weightedPick(list: [OfferKind, number][]): OfferKind | null {
  const total = list.reduce((sum, [, w]) => sum + w, 0);
  let left = Math.random() * total;
  for (const [k, w] of list) {
    left -= w;
    if (left < 0) return k;
  }
  return null;
}

// Om de twee à drie dagen stuurt elke rivaal een bericht, overdag, als er geen ander kaartje openstaat
function maybeOffer(r: Rival): void {
  if (G.offer || G.event || G.over || G.day < r.offerDay || G.clock < 9 || G.clock > 16) return;
  r.offerDay = G.day + 2 + Math.floor(Math.random() * 2);
  const kinds = offerKinds({
    rel: relNow(r),
    personality: r.p,
    ally: r.ally,
    war: r.atWar,
    warDays: G.day - r.warDay,
    ratio: ratioWith(r),
  }).filter(
    // In de vredige modus dreigt niemand, en met gesloten grenzen komt er geen handel
    ([k]) => !(k === 'demand' && G.peaceful) && !(k === 'trade' && hasRule('noTrade')),
  );
  const kind = weightedPick(kinds);
  if (kind) makeRivalOffer(r, kind);
}

/** Zet een bericht van een rivaal klaar (zie OFFER_REL in data/diplomacy.ts voor wat ja en nee doen). */
export function makeRivalOffer(r: Rival, kind: OfferKind): boolean {
  const keys = tradeKeys();
  const offer: RivalOffer = { from: r.id, kind, until: G.t + OFFER_TIME };
  const surplus = surplusRes(G.res, keys);
  // Het werkwoord past bij de naam: "De Zoutkoningen bieden", "Het Duinvolk biedt"
  const v = (one: string, many: string): string => verb(RIVAL[r.k], one, many);
  if (kind === 'trade') {
    const deal = rivalTrade(G.res, keys, G.age, relNow(r));
    if (!deal) return false;
    Object.assign(offer, deal);
    offer.line = `${v('biedt', 'bieden')} ${deal.amt} ${resName(deal.want)} voor ${deal.price} ${resName(deal.give)}.`;
  } else if (kind === 'ask' || kind === 'demand') {
    if (!surplus) return false;
    const value = giftValue(G.age) * (kind === 'ask' ? 0.8 : 1.5);
    offer.give = surplus;
    offer.price = amountFor(value, surplus);
    const what = `${offer.price} ${resName(surplus)}`;
    const reason = ASK_REASONS[Math.floor(Math.random() * ASK_REASONS.length)];
    if (kind === 'ask') offer.line = `${v('vraagt', 'vragen')} om ${what}: ${reason}.`;
    else {
      // Betaal je, dan laten ze je zo lang met rust als ze nu tussen twee aanvallen wachten (minstens 2 dagen)
      offer.spareDays = Math.max(2, attackEveryDays(r));
      offer.line = `${v('eist', 'eisen')} ${what}. Weiger je, dan vallen ze morgen aan.`;
    }
  } else if (kind === 'ally') {
    offer.line = `${v('stelt', 'stellen')} een bondgenootschap voor: ze vallen dan nooit aan en helpen je bij aanvallen.`;
  } else if (kind === 'peace') {
    offer.line = `${v('wil', 'willen')} vrede sluiten.`;
  } else return false;
  // Het kaartje zet de naam er vet boven; in het logboek staat de hele zin
  offer.text = `${nameOf(r)} ${offer.line}`;
  G.offer = offer;
  // Het kaartje zelf laat het bericht zien; in het logboek komt het ook
  store.notePos = [r.x + 1, r.y + 1];
  note(offer.text, kind === 'demand' ? 'bad' : '');
  sfx(kind === 'demand' ? 'bad' : 'select');
  sigs.offer = null;
  return true;
}

/** Wat ja en nee doen met de relatie, voor op het kaartje: { yes, no }. */
export const offerRelation = (kind: OfferKind): OfferRelation => OFFER_REL[kind] || { yes: 0, no: 0 };

/** Je antwoordt op het bericht van een rivaal: ja (`yes`) of nee. */
export function answerRivalOffer(yes: boolean): void {
  // Alleen bij een bericht van een rivaal (zie ui/event.ts). Zonder bericht is r leeg en stopt het.
  const o = G.offer as RivalOffer;
  const r = o && rivalById(o.from);
  G.offer = null;
  sigs.offer = null;
  store.uiDirty = true;
  if (!r || r.dead) return;
  const rel = offerRelation(o.kind);
  store.notePos = [r.x + 1, r.y + 1];
  if (!yes) {
    refuse(r, o);
    return;
  }
  // (een bericht met `give` heeft ook altijd een `price`, en met `want` een `amt`: zie makeRivalOffer)
  if (o.give && !has({ [o.give]: o.price! })) return;
  if (o.give) pay({ [o.give]: o.price! });
  if (o.want) gain({ [o.want]: o.amt! });
  if (o.kind === 'ally') makeAlly(r);
  if (o.kind === 'peace') makePeace(r);
  if (o.kind === 'demand') {
    // Betaald: ze wachten weer een hele tijd met aanvallen (zie rivalAttackDay)
    r.lastAttack = G.day;
    r.threatDay = 0;
    r.spareUntil = G.day + (o.spareDays || 2);
  }
  changeRelation(r, rel.yes);
  const after = rel.yes ? ` Relatie ${relText(rel.yes)}.` : '';
  const done = {
    trade: `Geruild met ${nameOf(r)}: ${o.amt} ${o.want ? resName(o.want) : ''} ontvangen.`,
    ask: `Je helpt ${nameOf(r)}.`,
    demand: `Je betaalt ${nameOf(r)}. Ze vallen niet aan vóór dag ${r.spareUntil}.`,
    ally: `${nameOf(r)} ${verb(RIVAL[r.k], 'is', 'zijn')} nu je bondgenoot.`,
    peace: `Vrede met ${nameOf(r)}.`,
  };
  toast(done[o.kind] + after, 'good');
  sfx('upgrade');
}

// Nee gezegd (of niet geantwoord, `late`): bij een eis komen ze morgen aanvallen
function refuse(r: Rival, o: RivalOffer, late = false): void {
  const rel = offerRelation(o.kind);
  changeRelation(r, rel.no);
  const after = rel.no ? ` Relatie ${relText(rel.no)}.` : '';
  const answer = late ? `Je gaf ${nameOf(r)} geen antwoord.` : `Je weigert.`;
  if (o.kind === 'demand' && !r.dead) {
    r.threatDay = G.day + 1;
    r.spareUntil = 0;
    toast(`${answer} ${says(r, 'komt', 'komen')} morgen aanvallen.${after}`, 'bad');
  } else if (late) note(`${answer}${after}`);
  else note(`Bericht van ${nameOf(r)} afgeslagen.${after}`);
}

/** Het bericht verloopt zonder antwoord: dat telt als nee. */
export function expireRivalOffer(): void {
  // Alleen bij een bericht van een rivaal (zie game/update.ts). Zonder bericht is r leeg en stopt het.
  const o = G.offer as RivalOffer;
  const r = o && rivalById(o.from);
  G.offer = null;
  sigs.offer = null;
  store.uiDirty = true;
  if (!r || r.dead) return;
  store.notePos = [r.x + 1, r.y + 1];
  refuse(r, o, true);
}

// ---- Hulp van bondgenoten ----

/**
 * Je wordt aangevallen: elke bondgenoot stuurt misschien soldaten (hoogstens één keer per dag).
 * `attacker` is het nummer van de rivaal die aanvalt (die helpt natuurlijk niet), of 0.
 */
export function allyHelp(attacker = 0): void {
  if (G.peaceful) return;
  for (const r of living()) {
    if (!r.ally || r.id === attacker || r.helpDay === G.day) continue;
    if (!roll(HELP_CHANCE[r.p] ?? 50)) continue;
    r.helpDay = G.day;
    sendHelpers(r);
  }
}

/** Soldaten van een bondgenoot verschijnen aan de rand van jouw land, aan de kant van hun stad. */
export function sendHelpers(r: Rival): void {
  const spot = borderToward(r.x + 1, r.y + 1);
  if (!spot) return;
  const kinds = rivalUnits(r.age);
  const n = helperCount(r.age);
  for (let k = 0; k < n; k++) {
    const x = spot.x + ((k % 3) - 1) * 0.7,
      y = spot.y + (Math.floor(k / 3) - 0.5) * 0.7;
    const f = spawnRivalUnit(r, kinds[k % kinds.length], x, y);
    f.mode = 'help';
    f.helper = true; // hoort niet bij hun leger thuis en wordt niet bewaard
    f.aggro = true;
    f.since = G.t;
    f.until = G.t + HELP_TIME;
  }
  store.notePos = [spot.x, spot.y];
  toast(`${says(r, 'stuurt', 'sturen')} ${n} soldaten om je te helpen!`, 'good');
}

// De laatste tegel van jouw land op de lijn van je stamhuis naar (tx, ty): daar komen helpers binnen
function borderToward(tx: number, ty: number): { x: number; y: number } | null {
  const h = th();
  if (!h) return null;
  const sx = h.x + 1,
    sy = h.y + 1;
  const len = Math.hypot(tx - sx, ty - sy) || 1;
  let spot: { x: number; y: number } | null = null;
  for (let step = 0; step < len; step++) {
    const x = sx + ((tx - sx) * step) / len,
      y = sy + ((ty - sy) * step) / len;
    if (!isUnl(x | 0, y | 0)) break;
    if (passable((y | 0) * W + (x | 0))) spot = { x, y };
  }
  return spot;
}

/**
 * Wat een helper van een bondgenoot doet (vanuit rivalThink in game/rivals.ts): de dichtstbijzijnde aanvaller
 * aanvallen, of anders naar je stamhuis lopen. Na een tijdje, of als er niemand meer aanvalt, gaat hij weer.
 * Geeft true als hij een doel heeft (dan valt fUpdate aan).
 * (Een helper heeft altijd een eindtijd `until` en een aankomsttijd `since`, zie sendHelpers.)
 */
export function helperThink(f: Foe, dt: number): boolean {
  if (G.t > f.until!) {
    f.retreat = true;
    return false;
  }
  f.rt -= dt;
  if (!f.tgt || isDead(f.tgt) || f.rt <= 0) {
    f.rt = 1;
    const next = nearestAttacker(f);
    if (next !== f.tgt) f.path = null;
    f.tgt = next;
  }
  if (f.tgt) return true;
  // Niemand meer om tegen te vechten: even bij je stamhuis wachten, en dan weer naar huis
  if (G.t - f.since! > 30) {
    f.retreat = true;
    return false;
  }
  const h = th();
  if (h) moveToward(f, h.x + 1, h.y + 3, dt, f.spd, f.air);
  return false;
}

// De dichtstbijzijnde vijand van jou (niet van hun eigen volk), binnen 40 tegels
function nearestAttacker(f: Foe): Foe | null {
  let best: Foe | null = null,
    bd = 40;
  for (const e of G.foes) {
    if (e === f || e.helper || e.rival === f.rival) continue;
    if (!isRaider(e) && !isMarching(e)) continue;
    if (e.air && !f.air && !f.proj) continue;
    const d = dist(f.x, f.y, e.x, e.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Helpers van bondgenoten die nu in je land zijn (voor aanvallers die ook hen aanvallen). */
export const helpersNear = (x: number, y: number, r: number): Foe[] =>
  G.foes.filter(h => h.helper && !h.retreat && !h.dead && dist(x, y, h.x, h.y) < r);

/** De volgende stap met deze rivaal, als korte tip voor de kaart in het venster Diplomatie (of leeg). */
export const nextStep = (r: Rival): string => {
  if (r.atWar || r.ally) return ''; // daar zeggen de fiches Oorlog en Bondgenoot al genoeg
  if (relNow(r) < TRADE_MIN) return `Handel vanaf ${relText(TRADE_MIN)}`;
  if (relNow(r) < ALLY_MIN) return `Bondgenoot vanaf ${relText(ALLY_MIN)}`;
  return 'Klaar voor een bondgenootschap';
};
