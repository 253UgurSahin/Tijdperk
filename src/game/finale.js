// De finale in het spel: de sterrenpoort laadt twee nachten op terwijl iedereen aanvalt. Daarna win je.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { DAYLEN } from '../config.js';
import { FINALE_RAID_MUL, FINALE_SIDES, chargeHours, nightsLeft, resetCharge } from '../data/finale.js';
import { attackSize, homeGuard } from '../data/rivals.js';
import { VICTORY } from '../data/victories.js';
import { burst, floater, fxRing } from './fx.js';
import { raidSize } from './military.js';
import { dayPace } from './mods.js';
import { launchAttack, rivalArmy, rivalUnitsFor, spawnRivalUnit } from './rivals.js';
import { G } from './state.js';
import { bMaxHp } from './upgrades.js';
import { checkVictory } from './victory.js';
import { showFinaleBanner } from '../ui/finale.js';
import { note, toast } from '../ui/hud.js';

/** Laadt de poort nu op? Dan komen er elke nacht grotere aanvallen (zie game/time.js en game/military.js). */
export const isCharging = () => !!(G && G.finale && !G.finale.done && G.finale.need > 0);

/** De sterrenpoort die af is, of null. */
export const finishedGate = () => (G ? G.bs.find(b => b.type === 'stargate' && b.done) || null : null);

/** Hoe heel de sterrenpoort is: { hp, max }, of null als er geen (af) staat. */
export function gateHealth() {
  const gate = finishedGate();
  return gate ? { hp: Math.max(0, gate.hp), max: bMaxHp(gate) } : null;
}

/** Telt de sterrenpoort in dit spel om te winnen, en heb je nog niet echt gewonnen? */
function gateCanWin() {
  if (G.scenario) return false; // een uitdaging heeft haar eigen doel
  if (!G.opts.victories.includes('stargate')) return false;
  return !(G.won && VICTORY[G.wonBy]?.full);
}

/** Hoe de aanvallen nu zijn: tijdens het opladen 2× zo groot en uit 3 richtingen. */
export const raidBoost = () =>
  isCharging() ? { size: FINALE_RAID_MUL, sides: FINALE_SIDES } : { size: 1, sides: 1 };

/** De sterrenpoort is af: het opladen begint (of opnieuw, als hij eerder verwoest werd). */
export function startFinale(gate) {
  if (!gateCanWin()) return;
  if (!G.finale) G.finale = { hours: 0, need: 0, rivalsCalled: false, done: false, resets: 0 };
  if (G.finale.done) return;
  G.finale.hours = 0;
  G.finale.need = chargeHours(G.clock);
  const rivals = callRivals();
  const nights = nightsLeft(G.clock, G.finale.need, 0);
  store.notePos = [gate.x + 1, gate.y + 1];
  fxRing(gate.x + 1, gate.y + 1, '#c9b6ff');
  // De regels van de finale staan groot in beeld (een melding is te snel weg), en daarna in het logboek
  if (G.peaceful) {
    showFinaleBanner([
      `Na ${nights} nachten gaat hij open, bij zonsopgang`,
      'Er komen geen aanvallen: bouw gerust verder',
    ]);
    toast(`De sterrenpoort laadt op. Na ${nights} nachten gaat hij open, bij zonsopgang.`, 'age');
  } else {
    // Eén rivaal over? Dan "je rivaal", anders "alle rivalen"
    const rivalLine = rivals === 1 ? 'Je rivaal valt ook aan' : `Alle ${rivals} rivalen vallen tegelijk aan`;
    const lines = [
      `Houd ${nights} nachten stand, tot zonsopgang`,
      `Elke nacht ±${raidSize()} vijanden uit ${FINALE_SIDES} richtingen`,
    ];
    if (rivals) lines.push(rivalLine);
    lines.push('Verwoest? Dan opnieuw beginnen · herstel hem op tijd');
    showFinaleBanner(lines);
    toast(
      `De sterrenpoort laadt op! Houd ${nights} nachten stand: elke nacht een aanval, ${FINALE_RAID_MUL}× zo groot, uit ${FINALE_SIDES} richtingen.${rivals ? ` ${rivalLine}.` : ''}`,
      'age',
    );
  }
  sfx('finale');
  store.finaleFlash = performance.now(); // een lichtflits in de wereld (zie render/finalefx.js)
  store.uiDirty = true;
}

/**
 * Alle rivalen die nog over zijn, sturen hun hele leger: dit is hun laatste kans.
 * Een klein leger vullen ze eerst snel aan. Niet in de vredige modus. Geeft het aantal rivalen.
 */
function callRivals() {
  if (G.peaceful || G.finale.rivalsCalled) return 0;
  G.finale.rivalsCalled = true;
  let count = 0;
  for (const r of G.rivals) {
    if (r.dead || r.ally) continue; // een bondgenoot doet niet mee (zie game/diplomacy.js)
    // Ook hun wacht gaat mee: alles wat ze hebben
    const army = rivalArmy(r).filter(f => f.mode === 'home');
    const kinds = rivalUnitsFor(r);
    const wanted = homeGuard(r.age) + attackSize(r.age, r.attacks, r.p, G.diff);
    while (army.length < wanted) army.push(spawnRivalUnit(r, kinds[army.length % kinds.length]));
    launchAttack(r, army);
    count++;
  }
  return count;
}

/** Elke speltik: de poort laadt op, op het tempo van de klok. Vol? Dan gaat hij open. */
export function updateFinale(dt) {
  if (!G.finale || G.finale.done) return;
  // Intussen echt gewonnen op een andere manier? Dan is de finale niet meer nodig
  if (!gateCanWin()) {
    G.finale = null;
    store.uiDirty = true;
    return;
  }
  if (!isCharging()) return;
  // Geen poort meer (op welke manier ook)? Dan is de lading weg: zonder poort gaat er ook niets open
  if (!finishedGate()) {
    resetCharge(G.finale);
    store.uiDirty = true;
    return;
  }
  // De vredige modus werd uitgezet tijdens het opladen: nu komen de rivalen alsnog
  if (!G.finale.rivalsCalled && !G.peaceful && callRivals())
    toast('Alle rivalen sturen hun hele leger op de sterrenpoort af!', 'bad');
  G.finale.hours += (dt * 24 * dayPace()) / DAYLEN;
  if (G.finale.hours >= G.finale.need) gateOpens();
}

// Helemaal opgeladen: de poort gaat open, de aanvallers vluchten en je wint
function gateOpens() {
  G.finale.done = true;
  G.finale.hours = G.finale.need;
  let fled = 0;
  for (const f of G.foes) {
    if (f.camp || f.retreat) continue;
    if (f.rival && f.mode !== 'march' && f.mode !== 'raid') continue; // thuis of al op weg naar huis
    // Soldaten van rivalen gaan naar huis zodra hun aanvalstijd om is (zie game/rivals.js)
    if (f.rival) f.until = G.t;
    else f.retreat = true;
    fled++;
  }
  const gate = finishedGate();
  if (gate) {
    const x = gate.x + 1,
      y = gate.y + 1;
    store.notePos = [x, y];
    fxRing(x, y, '#ffffff');
    for (let k = 0; k < 6; k++) burst(x + Math.random() * 2 - 1, y + Math.random() * 2 - 1, '#c9b6ff');
    floater(x, y, 'OPEN', '#e6dcff');
  }
  toast(`De zon komt op en de sterrenpoort gaat open!${fled ? ' De aanvallers vluchten.' : ''}`, 'good');
  sfx('charged');
  store.finaleFlash = performance.now();
  store.uiDirty = true;
  checkVictory();
}

/** De sterrenpoort is verwoest. Was hij aan het opladen, dan is die lading weg. */
export function gateDestroyed() {
  const charging = isCharging();
  if (charging) {
    resetCharge(G.finale);
    G.finale.resets++;
  }
  toast(
    charging
      ? 'De sterrenpoort is verwoest! Het opladen begint opnieuw zodra je hem weer bouwt.'
      : 'De sterrenpoort is verwoest.',
    'bad',
  );
  if (charging)
    note('Tip: herstel de poort op tijd met de knop Herstel op de balk bovenaan of in het paneel Leger.');
  store.uiDirty = true;
}

// Bij deze delen van zijn levens krijg je een waarschuwing dat de poort het zwaar heeft
const GATE_WARNINGS = [0.5, 0.25];

/**
 * De sterrenpoort is geraakt (hpBefore: zijn levens vóór de klap). Zakt hij tijdens het opladen
 * onder de helft of een kwart, dan waarschuwen we: hij staat vaak buiten beeld.
 */
export function gateHurt(gate, hpBefore) {
  if (!isCharging() || gate.hp <= 0) return;
  const max = bMaxHp(gate);
  const crossed = GATE_WARNINGS.some(part => hpBefore >= max * part && gate.hp < max * part);
  if (!crossed) return;
  store.notePos = [gate.x + 1, gate.y + 1];
  const left = Math.max(1, Math.round((gate.hp / max) * 100));
  toast(
    `De sterrenpoort wordt aangevallen: nog ${left}% heel. Herstel hem met de knop op de balk bovenaan.`,
    'bad',
  );
}
