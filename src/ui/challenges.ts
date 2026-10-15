// Uitdagingen op het titelscherm: een lijst met opdrachten en de wereld van de dag, met uitleg en een startknop.
import type { NewGameOptions, Profile } from '../types';
import { sfx } from '../audio/sound';
import { getProfile } from '../core/profile';
import { AGES } from '../data/ages';
import { DIFFICULTIES } from '../data/difficulty';
import { MAP } from '../data/maps';
import { MODIFIER } from '../data/modifiers';
import { PEOPLE, isPeopleUnlocked } from '../data/peoples';
import { MEDALS } from '../data/score';
import {
  DAILY,
  GOAL_ICON,
  SCENARIOS,
  challengeMinutes,
  clockText,
  dailyWorld,
  dateKey,
  dateText,
  goalInSentence,
  goalText,
  medalRuleText,
  type ScenarioDef,
} from '../data/scenarios';
import { save, wipe } from '../game/save';
import { currentChallenge } from '../game/scenario';
import { G, newGame, placeName } from '../game/state';
import { medalHTML, scoreText } from './achievements';
import { ico } from './glyphs';
import { closeModal, showTitle } from './modals';
import { newGameDraft } from './newgame';
import { bannerHTML, peoplePickHTML, playerProfile, showPeoplePicker } from './peoples';
import { codeFromSeed } from '../util/seedcode';
import { $ } from '../util/dom';

// Welke uitdaging je het laatst bekeek, voor de volgende keer (alleen een gemak; mag ontbreken)
const KEY = 'tijdperken-uitdaging';
function rememberedPick() {
  try {
    return localStorage.getItem(KEY) || DAILY;
  } catch (e) {
    return DAILY;
  }
}
function rememberPick(k: string) {
  try {
    localStorage.setItem(KEY, k);
  } catch (e) {}
}

/** Wat het profiel bewaart over één uitdaging en over één dag (zie Profile in types.ts). Leeg: nog niets. */
type ScenarioRecord = Partial<Profile['scenarios'][string]>;
type DailyRecord = Partial<Profile['daily'][string]>;

/** Wat het profiel weet over een uitdaging: { medal, best, wins }, of leeg. */
const scenarioRecord = (k: string): ScenarioRecord => (getProfile() && getProfile().scenarios[k]) || {};

/** Je beste spel in de wereld van een dag: { score, medal, won }, of leeg. */
const dailyRecord = (date: string): DailyRecord => (getProfile() && getProfile().daily[date]) || {};

/** Hoeveel uitdagingen je met een medaille hebt gehaald, voor de knop op het titelscherm. */
export function medalCount() {
  return SCENARIOS.filter(s => scenarioRecord(s.k).medal).length;
}

/** Korte regel voor de knop "Wereld van de dag": je beste score vandaag, of de datum. */
export function dailyLine() {
  const today = dateKey();
  const best = dailyRecord(today).score;
  return best != null ? `beste vandaag: ${scoreText(best)}` : dateText(today);
}

// Een vaag sterretje op de plek van de medaille, zolang je er nog geen hebt
const noMedal = () =>
  `<span class="medal none slot" title="Nog geen medaille" aria-label="Nog geen medaille"><span>${ico('★')}</span></span>`;

// ---- de lijst ----

/** De uitdaging die bij een tegel hoort: een vaste uitdaging, of de wereld van vandaag. */
const challengeFor = (k: string) => (k === DAILY ? dailyWorld(dateKey()) : SCENARIOS.find(s => s.k === k));

/** Eén tegel in de lijst: pictogram, naam, doel en je medaille. */
function tileHTML(s: ScenarioDef, on: boolean) {
  const daily = s.k === DAILY;
  // De wereld van de dag heeft altijd een datum (zie dailyWorld)
  const medal = daily ? dailyRecord(s.date!).medal : scenarioRecord(s.k).medal;
  const sub = daily ? `${dateText(s.date!)} · ${goalText(s.goal)}` : goalText(s.goal);
  return `<button class="chtile ${on ? 'on' : ''} ${daily ? 'daily' : ''}" data-chpick="${s.k}" aria-pressed="${on}">
    <span class="chic">${ico(s.g)}</span>
    <span class="chtx"><b>${s.n}</b><small>${sub}</small></span>
    ${medal ? medalHTML(medal) : noMedal()}
  </button>`;
}

function listHTML(selected: string) {
  const daily = dailyWorld(dateKey());
  return `<div class="chlist">
    ${tileHTML(daily, selected === DAILY)}
    <div class="chsep">Uitdagingen <span>${medalCount()} van ${SCENARIOS.length} met medaille</span></div>
    ${SCENARIOS.map(s => tileHTML(s, s.k === selected)).join('')}
  </div>`;
}

// ---- de uitleg rechts ----

/** De spelregels als lijstje: wat het moeilijker maakt in het rood, wat helpt in het groen. */
export function modsHTML(s: ScenarioDef) {
  if (!s.modifiers.length) return '<p class="chnone">Geen extra regels: een gewone wereld.</p>';
  return `<ul class="chmods">${s.modifiers
    .map(k => MODIFIER[k])
    .map(
      m => `<li class="${m.hard ? 'hard' : 'help'}">
        <span class="chmic">${ico(m.g)}</span>
        <span><b>${m.n}</b><small>${m.d}.</small></span>
      </li>`,
    )
    .join('')}</ul>`;
}

/** Waarmee je begint: tijdperk, kaart, moeilijkheid en zaadcode, en het volk (vast of zelf te kiezen). */
function startHTML(s: ScenarioDef, people: string) {
  const facts = [
    AGES[s.startAge].n,
    MAP[s.map].n,
    DIFFICULTIES[s.diff].n,
    `zaadcode <span class="chcode">${codeFromSeed(s.seed)}</span>`,
  ].join(' · ');
  const why = s.k === DAILY ? 'Vandaag speelt iedereen met dit volk' : 'Vast volk in deze uitdaging';
  const folk = s.people
    ? `<div class="chfolk" style="--flag:${PEOPLE[s.people].c}">${bannerHTML(PEOPLE[s.people], 'sm')}<span><b>${PEOPLE[s.people].n}</b><small>${why}</small></span></div>`
    : peoplePickHTML(people);
  return `<p class="chstart">${facts}</p>${folk}`;
}

/** De drie medailles met wat je ervoor moet doen; die je al hebt, licht op. */
function medalsHTML(s: ScenarioDef, have: string | undefined) {
  const rows = MEDALS.map(
    m =>
      `<span class="chm ${have === m.k ? 'got' : ''}">${medalHTML(m.k)}<b>${m.n}</b><small>${medalRuleText(s.medals, m.k)}</small></span>`,
  ).join('');
  const lostNote =
    s.medals.by === 'lost'
      ? '<p class="nghint">Verloren: dorpelingen en gebouwen die je kwijtraakt (muren tellen niet).</p>'
      : '';
  return `<div class="chmedals">${rows}</div>${lostNote}`;
}

/** Wat je eerder haalde: je medaille en beste tijd, of je beste score van vandaag. */
function recordHTML(s: ScenarioDef) {
  if (s.k === DAILY) {
    // De wereld van de dag heeft altijd een datum (zie dailyWorld)
    const best = dailyRecord(s.date!);
    return best.score != null
      ? `<p class="chrec">${ico('★')}Beste score vandaag: <b>${scoreText(best.score)}</b></p>`
      : '<p class="chrec quiet">Nog niet gespeeld vandaag. Je beste score van de dag blijft bewaard.</p>';
  }
  const rec = scenarioRecord(s.k);
  if (!rec.wins) return '';
  // Wie de uitdaging haalde, heeft ook een beste tijd
  const best = s.medals.by === 'lost' ? `minste verlies ${rec.best}` : `snelste tijd ${clockText(rec.best!)}`;
  return `<p class="chrec">${ico('✓')}${rec.wins}× gehaald · ${best}</p>`;
}

/**
 * Waarschuwing onder Begin: er is maar één opslag, dus je opgeslagen spel verdwijnt. Niet bij dezelfde
 * uitdaging, want dan begin je die gewoon opnieuw.
 */
function overwriteHTML(s: ScenarioDef, hasSave: boolean) {
  if (!hasSave || !G) return '';
  const same = G.scenario && G.scenario.k === s.k && (G.scenario.date || '') === (s.date || '');
  if (same) return '';
  // (de tweede keer is er zeker een uitdaging: net gecontroleerd)
  const where = currentChallenge() ? currentChallenge()!.n : placeName();
  return `<p class="nghint warn">Let op: je opgeslagen spel (${where}, dag ${G.day}) wordt overschreven.</p>`;
}

function detailHTML(s: ScenarioDef, people: string, hasSave: boolean) {
  const daily = s.k === DAILY;
  // De wereld van de dag heeft altijd een datum (zie dailyWorld)
  const have = daily ? dailyRecord(s.date!).medal : scenarioRecord(s.k).medal;
  const minutes = challengeMinutes(s);
  const time = s.timeLimit
    ? `<span class="chlimit">${ico('⌛')}binnen ${minutes} min</span>`
    : `<span class="chlimit">${ico('⌛')}± ${minutes} min</span>`;
  const summary = `${s.people ? PEOPLE[s.people].n : PEOPLE[people].n}, ${goalInSentence(s.goal)}`;
  return `<section class="chdetail">
    <div class="chtop">
      <span class="chic big">${ico(s.g)}</span>
      <div><div class="eyebrow">${daily ? dateText(s.date!) : 'Uitdaging'}</div><h2>${s.n}</h2></div>
      ${have ? medalHTML(have, 'md') : ''}
    </div>
    <p class="chstory">${s.story}</p>
    <div class="chgoal"><span class="chgl">Doel</span><b>${ico(GOAL_ICON[s.goal.type])}${goalText(s.goal)}</b>${time}</div>
    ${recordHTML(s)}
    <div class="ngl">Spelregels</div>
    ${modsHTML(s)}
    <div class="ngl">Startsituatie</div>
    ${startHTML(s, people)}
    <div class="ngl">Medailles</div>
    ${medalsHTML(s, have)}
    <button class="mbtn primary ngstart" data-ch="start"><span>Begin</span><small>${summary}</small></button>
    ${overwriteHTML(s, hasSave)}
  </section>`;
}

function screenHTML(selected: string, people: string, hasSave: boolean) {
  return `<div class="tw ng ch">
    <div class="nghead">
      <button class="quiet ngback" data-ch="back">${ico('←')}Terug</button>
      <div class="eyebrow">Uitdagingen</div>
    </div>
    <h1 class="ngtitle">Kies je uitdaging</h1>
    <div class="chgrid">
      ${listHTML(selected)}
      ${detailHTML(challengeFor(selected)!, people, hasSave)}
    </div>
  </div>`;
}

// ---- het scherm zelf ----

/** Wat het uitdagingenscherm meekrijgt (zie showChallenges hieronder). */
interface ChallengeScreenOpts {
  focus?: string | null;
  hasSave?: boolean;
  onBack: () => void;
  onStart: (opts: NewGameOptions) => void;
}

/**
 * Laat de uitdagingen zien in het titelscherm `el`. `focus`: welke uitdaging eerst open staat ('daily' of een
 * sleutel). `hasSave`: er is een opgeslagen spel dat bij Begin verdwijnt. `onBack()`: terug naar het
 * hoofdmenu. `onStart(opts)`: begin met { scenario, people } (zie newGame).
 */
export function showChallenges(
  el: HTMLElement,
  { focus = null, hasSave = false, onBack, onStart }: ChallengeScreenOpts,
) {
  let selected = focus || rememberedPick();
  // Zo bestaat de gekozen uitdaging altijd (daarom staat er verderop challengeFor(selected)!)
  if (!challengeFor(selected)) selected = DAILY;
  // Je eigen volk (voor uitdagingen zonder vast volk): wat je bij een nieuwe wereld het laatst koos
  let people = newGameDraft().people;
  const draw = () => {
    el.innerHTML = screenHTML(selected, people, hasSave);
  };
  draw();
  el.onclick = e => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t) return;
    if (t.dataset.ch === 'start') {
      sfx('select');
      const s = challengeFor(selected)!;
      // Voor de zekerheid: nooit beginnen met een volk dat op slot zit
      const own = isPeopleUnlocked(people, playerProfile()) ? people : undefined;
      onStart({ scenario: { k: s.k, date: s.date || '' }, people: own });
      return;
    }
    sfx('tick');
    if (t.dataset.ch === 'back') onBack();
    else if (t.dataset.chpick) {
      selected = t.dataset.chpick;
      rememberPick(selected);
      draw();
      // Op een smal scherm staat de uitleg onder de lijst: scroll er even heen (draw tekent die altijd)
      if (matchMedia('(max-width: 860px)').matches)
        el.querySelector('.chdetail')!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (t.dataset.t === 'people')
      showPeoplePicker(people, k => {
        people = k;
        draw();
      });
  };
  el.oninput = el.onchange = el.onkeydown = null;
}

// ---- vanaf het eindscherm ----

/** Dezelfde uitdaging opnieuw, met hetzelfde volk. De wereld van de dag blijft die van dezelfde datum. */
export function retryChallenge() {
  const def = currentChallenge();
  if (!def) return;
  wipe();
  newGame({ scenario: { k: def.k, date: def.date || '' }, people: G.people });
  closeModal();
}

/** Terug naar de lijst met uitdagingen. Een gewonnen spel blijft bewaard ("Verder spelen"). */
export function openChallengeList() {
  if (G.over) wipe();
  else save();
  $('#modal').hidden = true;
  showTitle({ challenges: true, focus: G.scenario ? G.scenario.k : null });
}
