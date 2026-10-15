// Het spelersprofiel: prestaties, beste scores en gespeelde spellen. Blijft bewaard, ook na een nieuw spel.
import type { GameRecord, Profile } from '../types';
import { DAILY, betterMedal, medalRank } from '../data/scenarios';
import { store } from './store';

export const PKEY = 'tijdperken-profiel-v1';
// Zoveel van je laatste spellen onthouden we voor het profielscherm
const RECENT = 8;
// Zoveel dagen onthouden we de beste score van de wereld van de dag
const DAILY_DAYS = 30;

/** Een gespeelde uitdaging: de sleutel, de datum en de waarde (tijd of verlies) staan er altijd bij. */
type ChallengeRecord = GameRecord & { scenario: string; date: string; value: number };

/** Een nieuw, leeg profiel. */
export const emptyProfile = (): Profile => ({
  achievements: {}, // sleutel → wanneer gehaald (tijd in ms)
  games: 0, // gespeelde spellen
  wins: 0, // gewonnen spellen
  best: { score: 0, perPeople: {}, perDiff: {} }, // hoogste scores: in totaal, per volk, per moeilijkheid
  unlockedPeoples: [], // volken die je met prestaties hebt vrijgespeeld
  recent: [], // je laatste spellen, nieuwste eerst
  scenarios: {}, // per uitdaging: { medal, best, wins } (zie addChallengeResult)
  daily: {}, // per datum ("2026-10-15"): je beste spel in de wereld van de dag, { score, medal, won }
});

/** Maak van wat er bewaard was een volledig profiel; wat ontbreekt of kapot is, wordt de standaardwaarde. */
export function normalizeProfile(input: unknown): Profile {
  const p = emptyProfile();
  if (!input || typeof input !== 'object') return p;
  // Wat bewaard was, kan oud of kapot zijn; daarom wordt hieronder elk veld eerst gecontroleerd
  const raw = input as Partial<Profile>;
  const isObj = (v: unknown): v is object => !!v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(raw.achievements)) p.achievements = { ...raw.achievements };
  // Number.isFinite geeft alleen true bij een echt getal, dus daarna is het veld er zeker
  if (Number.isFinite(raw.games)) p.games = raw.games!;
  if (Number.isFinite(raw.wins)) p.wins = raw.wins!;
  if (isObj(raw.best)) {
    if (Number.isFinite(raw.best.score)) p.best.score = raw.best.score;
    if (isObj(raw.best.perPeople)) p.best.perPeople = { ...raw.best.perPeople };
    if (isObj(raw.best.perDiff)) p.best.perDiff = { ...raw.best.perDiff };
  }
  if (Array.isArray(raw.unlockedPeoples)) p.unlockedPeoples = raw.unlockedPeoples.slice();
  if (Array.isArray(raw.recent)) p.recent = raw.recent.slice(0, RECENT);
  if (isObj(raw.scenarios)) p.scenarios = { ...raw.scenarios };
  if (isObj(raw.daily)) p.daily = { ...raw.daily };
  return p;
}

/** Profiel uit de browser halen (of een leeg profiel als er niets is). */
export function loadProfile(): Profile {
  try {
    return normalizeProfile(JSON.parse(localStorage.getItem(PKEY) || 'null'));
  } catch (e) {
    return emptyProfile();
  }
}

/** Het profiel van nu bewaren in de browser. */
export function saveProfile(): void {
  try {
    localStorage.setItem(PKEY, JSON.stringify(store.profile));
  } catch (e) {}
}

/**
 * Het profiel van nu (dat staat op store, zodat alle onderdelen hetzelfde zien).
 * Het is er altijd: dit bestand laadt het profiel meteen bij het opstarten (zie onderaan).
 */
export const getProfile = (): Profile => store.profile!;

/** Een prestatie in het profiel zetten. Geeft true als hij nieuw is. */
export function addAchievement(p: Profile, k: string, at = Date.now()): boolean {
  if (p.achievements[k]) return false;
  p.achievements[k] = at;
  return true;
}

/** Een volk vrijspelen. Geeft true als het nieuw is. */
export function addPeople(p: Profile, k: string): boolean {
  if (p.unlockedPeoples.includes(k)) return false;
  p.unlockedPeoples.push(k);
  return true;
}

/**
 * Een afgelopen spel in het profiel zetten: beste scores, gewonnen spellen en de lijst met laatste spellen.
 * `game` = { score, medal, won, age, day, people, diff }. Geeft true als het een nieuw record is.
 */
export function addResult(p: Profile, game: GameRecord, at = Date.now()): boolean {
  const record = raiseBest(p, game);
  if (game.won) p.wins++;
  p.recent.unshift({ ...game, at });
  p.recent.length = Math.min(p.recent.length, RECENT);
  return record;
}

/**
 * Een spel dat al in het profiel staat opnieuw invullen, met een nieuwe score. Voor wie eerst een kort doel
 * haalt en daarna doorspeelt tot de sterrenpoort. `at` zegt welk spel (zie addResult). Telt niet als extra
 * gewonnen spel. Geeft true als het een nieuw record is.
 */
export function replaceResult(p: Profile, at: number, game: GameRecord): boolean {
  const record = raiseBest(p, game);
  const i = p.recent.findIndex(old => old.at === at);
  if (i >= 0) p.recent[i] = { ...game, at };
  return record;
}

/**
 * Een gespeelde uitdaging of wereld van de dag in het profiel zetten. Telt niet mee voor de beste scores per
 * volk en moeilijkheid: die zijn voor gewone spellen (een uitdaging kan bijvoorbeeld rijk beginnen).
 * `game` is zoals bij addResult, met daarbij scenario (sleutel), date (bij de wereld van de dag), medal
 * (van de uitdaging) en value (tijd of verlies, waarmee de medaille gehaald is; lager is beter).
 * Geeft true als het een nieuw record is: een betere medaille of tijd, of een hogere score die dag.
 */
export function addChallengeResult(p: Profile, game: GameRecord, at = Date.now()): boolean {
  if (game.won) p.wins++;
  p.recent.unshift({ ...game, at });
  p.recent.length = Math.min(p.recent.length, RECENT);
  // Bij een uitdaging zijn sleutel, datum en waarde altijd ingevuld (zie scoreNow in game/achievements.ts)
  const challenge = game as ChallengeRecord;
  return game.scenario === DAILY ? raiseDaily(p, challenge) : raiseScenario(p, challenge);
}

/** Beste medaille en beste tijd (of minste verlies) van een uitdaging bijwerken. */
function raiseScenario(p: Profile, game: ChallengeRecord): boolean {
  const old = p.scenarios[game.scenario] || { medal: '', best: null, wins: 0 };
  if (!game.won) {
    p.scenarios[game.scenario] = old;
    return false;
  }
  const betterValue = old.best == null || game.value < old.best;
  const record = medalRank(game.medal) < medalRank(old.medal) || betterValue;
  p.scenarios[game.scenario] = {
    medal: betterMedal(old.medal, game.medal),
    best: betterValue ? game.value : old.best,
    wins: old.wins + 1,
  };
  return record;
}

/** De beste score van die dag bijwerken, en alleen de laatste dagen bewaren. */
function raiseDaily(p: Profile, game: ChallengeRecord): boolean {
  const old = p.daily[game.date] || { score: 0, medal: '', won: false };
  const record = !p.daily[game.date] || game.score > old.score;
  // De hoogste score, maar ook de beste medaille van die dag: een hogere score kan met een slechtere medaille zijn
  p.daily[game.date] = {
    score: record ? game.score : old.score,
    medal: game.won ? betterMedal(old.medal, game.medal) : old.medal,
    won: !!(old.won || game.won),
  };
  // Datums als "2026-10-15" staan op alfabet ook op tijd: de oudste vallen eraf
  const dates = Object.keys(p.daily).sort().reverse();
  for (const date of dates.slice(DAILY_DAYS)) delete p.daily[date];
  return record;
}

/** Beste scores ophogen (in totaal, per volk, per moeilijkheid). Geeft true als het een nieuw record is. */
function raiseBest(p: Profile, game: GameRecord): boolean {
  const record = game.score > p.best.score;
  p.best.score = Math.max(p.best.score, game.score);
  p.best.perPeople[game.people] = Math.max(p.best.perPeople[game.people] || 0, game.score);
  p.best.perDiff[game.diff] = Math.max(p.best.perDiff[game.diff] || 0, game.score);
  return record;
}

/** Alles wissen: een leeg profiel (volken gaan weer op slot). */
export function resetProfile(): void {
  store.profile = emptyProfile();
  saveProfile();
}

// Meteen bij het opstarten laden, zodat de volkenkiezer op het titelscherm weet wat vrij is
store.profile = loadProfile();
