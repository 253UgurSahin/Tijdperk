// Winnen: kijkt of je een van de gekozen doelen hebt gehaald (zie data/victories.js) en toont dan het eindscherm.
import { store } from '../core/store.js';
import { AGES } from '../data/ages.js';
import { VICTORY, reachedVictory } from '../data/victories.js';
import { endGame, upgradeWin } from './achievements.js';
import { chargeFrac } from '../data/finale.js';
import { isCharging } from './finale.js';
import { checkChallenge } from './scenario.js';
import { G, placeName } from './state.js';
import { myWonderCount } from './wonders.js';

/** Alles wat de doelen willen weten, uit de spelstand van nu. */
export function victoryFacts() {
  return {
    age: G.age,
    day: G.day,
    stargate: !!(G.finale && G.finale.done), // de poort is af én helemaal opgeladen (zie game/finale.js)
    charge: chargeFrac(G.finale), // hoe vol de poort is, van 0 tot 1
    charging: isCharging(),
    stargateBusy: G.bs.some(b => b.type === 'stargate'),
    campsLeft: G.camps.filter(c => c.alive).length,
    wonders: myWonderCount(), // wereldwonderen die nu van jou zijn
    rivals: G.rivals.length,
    rivalsBeaten: G.rivals.filter(r => r.dead).length,
    place: placeName(),
    ageName: AGES[G.age].n,
  };
}

/** De gekozen overwinningen van dit spel, met hoe ver je bent. Voor de doelenkaart. */
export const victoryGoals = () => {
  const f = victoryFacts();
  return G.opts.victories.map(k => ({ v: VICTORY[k], frac: VICTORY[k].frac(f), text: VICTORY[k].text(f) }));
};

/** Heb je net gewonnen? Dan het spel als gewonnen markeren en het eindscherm tonen. */
export function checkVictory() {
  if (!G || G.over) return;
  // Een uitdaging heeft haar eigen doel (en soms een tijdsgrens), zie game/scenario.js
  if (G.scenario) {
    checkChallenge();
    return;
  }
  if (G.won) {
    checkFullVictoryAfterShort();
    return;
  }
  const k = reachedVictory(G.opts.victories, victoryFacts());
  if (!k) return;
  G.won = true;
  G.wonBy = k;
  store.uiDirty = true;
  // Bij een nieuw tijdperk eerst even de banner laten zien (en bij de sterrenpoort het licht), dan pas het eindscherm
  endGame(true, k === 'age' || k === 'stargate' ? 2600 : 800);
}

/**
 * Al gewonnen met een kort doel en doorgespeeld? Haal je daarna toch nog een volledig doel (de sterrenpoort),
 * dan telt dat alsnog als echte overwinning, met de prestaties en het eindscherm die daarbij horen.
 */
function checkFullVictoryAfterShort() {
  if (VICTORY[G.wonBy]?.full) return;
  const fullGoals = G.opts.victories.filter(k => VICTORY[k].full);
  // Let op: reachedVictory maakt van een lege lijst de standaard, dus eerst zelf kijken of er iets over is
  if (!fullGoals.length) return;
  const k = reachedVictory(fullGoals, victoryFacts());
  if (!k) return;
  store.uiDirty = true;
  upgradeWin(k, 2600);
}
