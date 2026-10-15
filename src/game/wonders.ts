// Wereldwonderen in het spel: wie welk wonder heeft, wie eraan bouwt, en wat er gebeurt als er een af of kapot is.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { W } from '../config';
import { B } from '../data/buildings';
import { RIVAL, verb } from '../data/rivals';
import {
  TheWonder,
  ownWonders,
  theWonder,
  winBackText,
  wonderStatusText,
  wonderVerb,
} from '../data/wonders';
import { applyBonusChange } from './bonus';
import { gain } from './economy';
import { floater, fxRing } from './fx';
import { buildCost } from './placement';
import { cancelRivalWonder, rivalWonderSaving } from './rivals';
import { G, bById, sel } from './state';
import { checkVictory } from './victory';
import { toast } from '../ui/hud';
import { bmap, setBlk } from '../world/world';

// ---- Wie heeft wat ----

/**
 * Wie welk wonder heeft, uit de gebouwen die nu af zijn (van jou en van rivalen).
 * `before` is de vorige lijst: wie zijn wonder houdt, houdt ook de dag waarop hij het kreeg.
 */
export function wondersFromBuildings(before = {}) {
  const now = {};
  const put = (k, by) => {
    const old = before[k];
    now[k] = { by, day: old && old.by === by ? old.day : G.day };
  };
  for (const b of G.bs) if (b.done && B[b.type].wonder) put(b.type, 'you');
  for (const r of G.rivals || [])
    if (!r.dead) for (const b of r.bs) if (b.done && B[b.type].wonder) put(b.type, r.k);
  return now;
}

/** Zet G.wonders opnieuw na een verandering. Via het bonusregister, zodat de bonussen meteen gelden. */
export function refreshWonders() {
  applyBonusChange(() => (G.wonders = wondersFromBuildings(G.wonders)));
  store.uiDirty = true;
}

/** Hoeveel wonderen nu van jou zijn. */
export const myWonderCount = () => ownWonders(G.wonders).length;

/** De rivaal die dit wonder heeft, of null. */
const ownerRival = k => {
  const w = G.wonders[k];
  return w && w.by !== 'you' ? G.rivals.find(r => r.k === w.by) || null : null;
};

/** Bouwplaatsen van een wonder: [{ by: 'you' of rivaalsleutel, frac, b, rival }] */
export function wonderSites(k) {
  const sites = [];
  for (const b of G.bs)
    if (b.type === k && !b.done) sites.push({ by: 'you', frac: b.prog / b.bt, b, rival: null });
  for (const r of G.rivals || [])
    if (!r.dead)
      for (const b of r.bs)
        if (b.type === k && !b.done) sites.push({ by: r.k, frac: b.prog / b.bt, b, rival: r });
  return sites;
}

/** Alles over één wonder: eigenaar, wie eraan bouwt of ervoor spaart, en de tekst daarvan (zie wonderStatusText). */
export function wonderStatus(k) {
  const owner = G.wonders[k] ? G.wonders[k].by : null;
  const sites = wonderSites(k);
  const saving = rivalWonderSavings()
    .filter(s => s.k === k)
    .map(s => ({ by: s.rival.k, frac: s.frac }));
  return { owner, sites, ...wonderStatusText(owner, sites, saving) };
}

/** Rivalen die zichtbaar sparen voor een wonder (vanaf de helft): [{ k, rival, frac }], de verste eerst. */
export function rivalWonderSavings() {
  const list = [];
  for (const r of G.rivals || []) {
    const saving = rivalWonderSaving(r);
    if (saving) list.push({ ...saving, rival: r });
  }
  return list.sort((a, b) => b.frac - a.frac);
}

/** Wonderen waaraan een rivaal nu bouwt, de verste eerst: voor de doelenkaart. */
export function rivalWonderRaces() {
  const list = [];
  for (const r of G.rivals || [])
    if (!r.dead)
      for (const b of r.bs)
        if (B[b.type].wonder && !b.done) list.push({ k: b.type, rival: r, b, frac: b.prog / b.bt });
  return list.sort((a, b) => b.frac - a.frac);
}

/** Waarom je dit wonder nu niet kunt neerzetten, of null als het mag. */
export function wonderBlocked(k) {
  const owner = G.wonders[k];
  if (owner && owner.by === 'you') return `${TheWonder(k)} ${wonderVerb(k, 'is', 'zijn')} al van jou`;
  if (owner) return `${TheWonder(k)} ${wonderVerb(k, 'is', 'zijn')} al gebouwd door ${rivalName(owner.by)}`;
  if (G.bs.some(b => b.type === k)) return `Je bouwt al aan ${theWonder(k)}`;
  return null;
}
const rivalName = k => (RIVAL[k] ? RIVAL[k].n : 'een rivaal');

/** Hetzelfde als een hele melding, en bij een wonder van een rivaal ook hoe je het terugkrijgt (of null). */
export function wonderBlockedNote(k) {
  const why = wonderBlocked(k);
  if (!why) return null;
  const owner = G.wonders[k];
  return owner && owner.by !== 'you' ? `${why}. ${winBackText(k, owner.by)}` : `${why}.`;
}

// ---- Af ----

/** Jij hebt een wonder af (vanuit completeBuilding). `silent`: bij het veroveren, zonder feest. */
export function playerWonderDone(b, silent) {
  const k = b.type;
  // Bouwde een rivaal aan hetzelfde wonder? Dan was dat voor niets: hij krijgt zijn spaargeld terug.
  const beaten = [];
  for (const r of G.rivals || [])
    for (const site of r.bs.slice())
      if (site.type === k && !site.done) {
        cancelRivalWonder(r, site);
        beaten.push(r);
      }
  refreshWonders();
  if (silent) return;
  G.stats.wondersBuilt++;
  if (beaten.length) G.stats.wonderRaces++;
  const s = B[k].size / 2;
  fxRing(b.x + s, b.y + s, '#e2b92c');
  floater(b.x + s, b.y + s, 'WERELDWONDER', '#e2b92c');
  sfx('age');
  const race = beaten.length ? ` Je was ${RIVAL[beaten[0].k].n} net voor!` : '';
  toast(`${TheWonder(k)} ${wonderVerb(k, 'is', 'zijn')} klaar!${race} ${B[k].perk}.`, 'good');
  checkVictory(); // misschien is dit je vierde wonder
}

/**
 * Een rivaal heeft een wonder af (vanuit game/rivals.js); `wonder` is zijn gebouw. Bouwde jij er ook aan, dan is dat voorbij:
 * je bouwplaats verdwijnt en je krijgt alles terug wat je ervoor betaalde.
 */
export function rivalWonderDone(r, wonder) {
  const k = wonder.type;
  const mine = G.bs.filter(b => b.type === k && !b.done);
  for (const b of mine) removeSite(b);
  refreshWonders();
  const who = `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'heeft', 'hebben')}`;
  const back = mine.length ? ' Je bouwplaats is weg; je krijgt je grondstoffen terug.' : '';
  store.notePos = [wonder.x + 1.5, wonder.y + 1.5];
  toast(`${who} ${theWonder(k)} gebouwd.${back} ${winBackText(k, r.k)}`, 'bad');
}

// Een bouwplaats van jou weghalen, met alles wat je ervoor betaalde terug
function removeSite(b) {
  const d = B[b.type];
  gain(buildCost(b.type));
  b.dead = true;
  setBlk(b, false);
  for (let dy = 0; dy < d.size; dy++)
    for (let dx = 0; dx < d.size; dx++) {
      const i = (b.y + dy) * W + b.x + dx;
      if (bmap[i] === b.id) bmap[i] = 0;
    }
  G.bs = G.bs.filter(o => o !== b);
  bById.delete(b.id);
  if (sel.b === b.id) sel.b = null;
  store.mapVersion++;
}

// ---- Kapot ----

/**
 * Een wonder is verwoest (van jou of van een rivaal), of een bouwplaats ervan. Het wonder is dan weer vrij:
 * iedereen kan het opnieuw bouwen.
 */
export function wonderDestroyed(b) {
  const k = b.type;
  refreshWonders();
  store.notePos = [b.x + 1.5, b.y + 1.5];
  if (b.kind === 'b') {
    if (b.done)
      toast(
        `Je ${B[k].n} ${wonderVerb(k, 'is', 'zijn')} verwoest. Het wonder is weer vrij: iedereen kan het opnieuw bouwen.`,
        'bad',
      );
    else toast(`Je bouwplaats van ${theWonder(k)} is verwoest.`, 'bad');
    return;
  }
  const info = RIVAL[(G.rivals.find(o => o.id === b.rival) || {}).k];
  if (b.done) {
    const whose = info ? ` van ${info.n}` : '';
    toast(
      `${TheWonder(k)}${whose} ${wonderVerb(k, 'is', 'zijn')} verwoest. Het wonder is weer vrij.`,
      'good',
    );
  } else {
    const again = info ? ` ${info.n} ${verb(info, 'moet', 'moeten')} opnieuw sparen.` : '';
    toast(`De bouwplaats van ${theWonder(k)} is verwoest.${again}`, 'good');
  }
}

/** Breek je dit gebouw af? Het stamhuis en een af wereldwonder niet. */
export const canDemolish = b => b.type !== 'townhall' && !(B[b.type].wonder && b.done);

/** Wie heeft het wonder, in een paar woorden (voor het selectiepaneel). */
export function ownerLine(k) {
  const w = G.wonders[k];
  if (!w) return '';
  if (w.by === 'you') return `Van jou sinds dag ${w.day}`;
  const r = ownerRival(k);
  return r ? `Van ${RIVAL[r.k].n} sinds dag ${w.day}` : '';
}
