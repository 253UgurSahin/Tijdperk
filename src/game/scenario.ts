// Uitdagingen tijdens het spel: hoe ver je met het doel bent, hoeveel tijd er nog is, en winnen of verliezen.
import { store } from '../core/store';
import { challengeMedal, goalInSentence, goalProgress, goalText, scenarioDef } from '../data/scenarios';
import { endGame } from './achievements';
import { popNow } from './entities';
import { G } from './state';
import { toast } from '../ui/hud';

// Zoveel seconden voor het einde krijg je een waarschuwing (eerst bij 5 minuten, dan bij 1 minuut)
const WARNINGS = [300, 60];

/** De uitdaging van dit spel (met doel, tijd en medailles), of null in een gewoon spel. */
export const currentChallenge = () => (G && G.scenario ? scenarioDef(G.scenario) : null);

/** Wat het doel wil weten, uit de spelstand van nu (zie goalProgress in data/scenarios.js). */
function goalFacts(def) {
  return {
    age: G.age,
    startAge: def.startAge,
    day: G.day,
    pop: popNow(),
    camps: G.stats.camps,
    built: G.bs.filter(b => b.done).map(b => b.type),
    placed: G.bs.map(b => b.type),
  };
}

/**
 * Hoe het nu staat met de uitdaging, voor de doelenkaart:
 * def (de uitdaging), goal (het doel in woorden), frac, text en short (hoe ver), left (seconden over, of null).
 * Geeft null in een gewoon spel.
 */
export function challengeStatus() {
  const def = currentChallenge();
  if (!def) return null;
  const { frac, text, short } = goalProgress(def.goal, goalFacts(def));
  const timed = def.timeLimit && !G.won;
  return {
    def,
    goal: goalText(def.goal),
    frac: G.won ? 1 : frac,
    text,
    short: short || text,
    left: timed ? Math.max(0, def.timeLimit - G.t) : null,
  };
}

/** Elke halve seconde (via game/victory.js): doel gehaald? Tijd op? Of nog even waarschuwen. */
export function checkChallenge() {
  if (!G || G.won || G.over) return;
  const status = challengeStatus();
  if (!status) return;
  if (status.frac >= 1) {
    G.won = true;
    G.wonBy = 'scenario';
    G.scenario.doneAt = Math.round(G.t);
    store.uiDirty = true;
    // Bij een nieuw tijdperk eerst even de banner laten zien, dan pas het eindscherm
    endGame(true, status.def.goal.type === 'age' ? 2600 : 800);
    return;
  }
  if (status.left === 0) {
    G.over = true;
    G.scenario.failed = 'time';
    store.uiDirty = true;
    endGame(false, 300);
    return;
  }
  warnTime(status.left);
}

/** Nog 5 minuten, of nog 1 minuut: elk één keer zeggen. */
function warnTime(left) {
  if (left == null) return;
  // De kleinste grens waar we al onder zitten (bij 50 seconden over is dat de minuut, niet de 5 minuten)
  const due = WARNINGS.filter(s => left <= s).pop();
  if (!due || (G.scenario.warned && G.scenario.warned <= due)) return;
  G.scenario.warned = due;
  const minutes = due === 60 ? '1 minuut' : `${due / 60} minuten`;
  toast(`Nog ${minutes} om je doel te halen: ${goalInSentence(currentChallenge().goal)}.`, 'bad');
}

/**
 * De uitkomst van de uitdaging voor de eindscore en je profiel:
 * time (speltijd tot het doel, of tot het einde), lost (wat je kwijtraakte) en de medaille.
 */
export function challengeOutcome() {
  const def = currentChallenge();
  if (!def) return null;
  const time = G.scenario.doneAt ?? Math.round(G.t);
  const lost = G.stats.lost || 0;
  return { def, time, lost, medal: challengeMedal(def.medals, { won: G.won, time, lost }) };
}
