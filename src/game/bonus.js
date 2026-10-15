// Bonusregister: één plek die alle bonussen bij elkaar telt (onderzoek, volk, zegeningen, wonderen, regels, ...).
import { blessingBonuses } from '../data/blessings.js';
import { limitTotal, sumAll } from '../data/bonus.js';
import { modifierBonuses } from '../data/modifiers.js';
import { peopleBonuses } from '../data/peoples.js';
import { TECH } from '../data/tech.js';
import { wonderBonuses } from '../data/wonders.js';
import { G } from './state.js';

/*
 * Waar bonussen vandaan komen. Elke bron krijgt de spelstand en geeft een lijst bonus-objecten,
 * zoals { 'army.dmg': 0.15 }. Een bron toevoegen is één regel.
 * Let op: nieuwe spelstand (zoals G.people) moet ook in save.js opgeslagen en geladen worden.
 * Verandert een bron tijdens het spel? Doe het via applyBonusChange(() => ...) hieronder.
 */
const SOURCES = [
  // Onderzoek dat klaar is (het `bonus`-veld in src/data/tech.js)
  g => TECH.filter(T => T.bonus && g.tech && g.tech[T.k]).map(T => T.bonus),
  // Gekozen zegeningen (G.blessings bewaart alleen de sleutels, zie src/data/blessings.js)
  g => blessingBonuses(g.blessings),
  // Je volk (G.people bewaart alleen de sleutel, zie src/data/peoples.js)
  g => peopleBonuses(g.people),
  // Spelregels van een uitdaging (G.mods bewaart alleen de sleutels, zie src/data/modifiers.js)
  g => modifierBonuses(g.mods),
  // Tijdelijke bonussen uit gebeurtenissen (G.buffs; game/events.js haalt ze eraf als ze voorbij zijn)
  g => (g.buffs || []).map(b => b.bonus),
  // Wereldwonderen die van jou zijn (G.wonders: wie welk wonder heeft, zie src/data/wonders.js)
  g => wonderBonuses(g.wonders),
];

/** Alle bonussen die nu gelden, als losse objecten. */
export const activeBonuses = () => (G ? SOURCES.flatMap(source => source(G)) : []);

// mul() en add() worden elke speltik heel vaak gevraagd. Daarom tellen we pas opnieuw
// als er een ander spel is, als de speltijd verder is, of na applyBonusChange().
let lastCount = { game: null, time: NaN, sums: {} };
function totals() {
  if (!G) return {};
  const stale = lastCount.game !== G || lastCount.time !== G.t;
  if (stale) {
    lastCount = { game: G, time: G.t, sums: sumAll(activeBonuses()) };
  }
  return lastCount.sums;
}

/** Vermenigvuldiger voor een sleutel: 15% bonus geeft 1.15. Zonder bonus precies 1. */
export const mul = key => Math.max(0, 1 + limitTotal(key, totals()[key] || 0));

/** Vaste bonus voor een sleutel (tegels, levens per seconde, ...). Zonder bonus precies 0. */
export const add = key => totals()[key] || 0;

// Hoeveel keer zo groot iets wordt (en niet delen door 0)
const growth = (before, after) => (before > 0 ? after / before : 1);

/**
 * Verander een bron van bonussen, bijvoorbeeld onderzoek dat klaar is:
 * applyBonusChange(() => (G.tech.forging = 1)). Het register telt daarna meteen opnieuw.
 * Krijgen gebouwen of soldaten meer levenspunten, dan groeit wat er al staat ook mee.
 */
export function applyBonusChange(change) {
  const bldBefore = mul('bld.hp'),
    hallBefore = mul('hall.hp'),
    armyBefore = mul('army.hp');
  change();
  lastCount.game = null; // zo telt het register bij de volgende vraag opnieuw
  const bldGrow = growth(bldBefore, mul('bld.hp')),
    hallGrow = growth(hallBefore, mul('hall.hp')),
    armyGrow = growth(armyBefore, mul('army.hp'));
  if (bldGrow !== 1) for (const b of G.bs) b.hp *= bldGrow;
  // Het stamhuis heeft er een eigen sleutel bij (zoals bij de Piramide)
  if (hallGrow !== 1) for (const b of G.bs) if (b.type === 'townhall') b.hp *= hallGrow;
  if (armyGrow !== 1)
    for (const u of G.us) {
      u.mhp *= armyGrow;
      u.hp *= armyGrow;
    }
}
