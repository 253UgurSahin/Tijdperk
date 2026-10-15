// Prestaties tijdens het spel: kijkt om de paar tellen wat je bereikt hebt, en rekent aan het eind je score uit.
import { addAchievement, addPeople, addResult, getProfile, saveProfile } from '../core/profile.js';
import { ACHIEVEMENT, emptyFacts, fullAge, newAchievements } from '../data/achievements.js';
import { BLESSING } from '../data/blessings.js';
import { B } from '../data/buildings.js';
import { PEOPLE } from '../data/peoples.js';
import { gameScore } from '../data/score.js';
import { G } from './state.js';
import { showAchievement } from '../ui/achievements.js';
import { showEndScreen } from '../ui/endscreen.js';
import { note } from '../ui/hud.js';

/** Stond de vredige modus in dit spel ooit aan? Dan telt de score als Vredig, ook als hij nu uit staat. */
const peaceUsed = () => G.peaceful || G.stats.peaceUsed;

/** Alles wat de prestaties willen weten, verzameld uit de spelstand (zie emptyFacts in data/achievements.js). */
export function gameFacts() {
  const standing = G.bs.filter(b => b.done).map(b => b.type);
  return {
    ...emptyFacts(),
    age: G.age,
    day: G.day,
    diff: G.diff,
    peaceful: peaceUsed(),
    people: G.people,
    won: G.won,
    lost: G.over,
    villagers: G.vs.length,
    soldiers: G.us.length,
    camps: G.stats.camps,
    campsLeft: G.camps.filter(c => c.alive).length,
    kills: G.stats.killed,
    raidsSurvived: G.stats.survived,
    gathered: G.stats.gathered,
    inventions: Object.keys(G.tech).length,
    blessings: G.blessings.length,
    riskyBlessings: G.blessings.filter(k => BLESSING[k] && BLESSING[k].risk).length,
    // Muren van vóór de teller (oude opslag) tellen ook, als ze af zijn en nog staan
    builtWalls: G.stats.walls > 0 || G.bs.some(b => b.done && B[b.type].wall),
    fullAge: fullAge(standing),
    expansions: G.bought,
    meteors: G.stats.meteors,
  };
}

/** Kijk of er nieuwe prestaties zijn. Draait om de paar tellen (zie game/update.js) en aan het eind. */
export function checkAchievements() {
  const profile = getProfile();
  if (!G || !profile) return;
  // Het eerste moment dat er echt gespeeld wordt, telt het spel mee als gespeeld
  if (!G.countedAsPlayed) {
    G.countedAsPlayed = true;
    profile.games++;
    saveProfile();
  }
  const keys = newAchievements(gameFacts(), profile.achievements);
  for (const k of keys) unlock(k);
}

/** Een prestatie halen: in het profiel zetten, laten zien, en misschien een volk vrijspelen. */
function unlock(k) {
  const profile = getProfile();
  const achievement = ACHIEVEMENT[k];
  if (!addAchievement(profile, k)) return;
  if (!G.achieved.includes(k)) G.achieved.push(k);
  const people = achievement.unlocks && PEOPLE[achievement.unlocks.people];
  if (people) addPeople(profile, people.k);
  saveProfile();
  showAchievement(achievement, people);
  note(`Prestatie behaald: ${achievement.n}.${people ? ` Nieuw volk: ${people.n}.` : ''}`, 'good');
}

/**
 * De eindscore van dit spel. Wordt één keer bewaard (bij winst of verlies, wat het eerst komt);
 * wie na het winnen doorspeelt, houdt de score van het moment van winnen.
 */
export function finishGame() {
  checkAchievements();
  if (G.result) return G.result;
  // Stond de vredige modus ooit aan, dan telt de score als Vredig (ook als je hem later weer uitzette)
  const diff = peaceUsed() ? 0 : G.diff;
  const score = gameScore({
    age: G.age,
    wonders: 0, // wonderen komen later
    camps: G.stats.camps,
    kills: G.stats.killed,
    days: G.day,
    diff,
  });
  const game = {
    score: score.total,
    medal: score.medal ? score.medal.k : '',
    won: G.won,
    age: G.age,
    day: G.day,
    people: G.people,
    diff,
    peaceful: diff === 0 && G.diff !== 0, // wel Normaal of Zwaar gekozen, maar met de vredige modus
  };
  const record = addResult(getProfile(), game);
  saveProfile();
  G.result = { ...game, rows: score.rows, raw: score.raw, sum: score.sum, factor: score.factor, record };
  return G.result;
}

/** Het spel is gewonnen of verloren: score bewaren en na een korte pauze het eindscherm tonen. */
export function endGame(won, delay = 800) {
  finishGame();
  setTimeout(() => showEndScreen(won), delay);
}
