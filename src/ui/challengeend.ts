// Het eindscherm van een uitdaging: gehaald of niet, de medaille op tijd of verlies, en opnieuw proberen.
import type { GameResult } from '../types';
import { MEDALS } from '../data/score';
import {
  DAILY,
  MEDAL_ORDER,
  ageName,
  clockText,
  goalInSentence,
  medalRuleText,
  type ScenarioDef,
} from '../data/scenarios';
import { getProfile } from '../core/profile';
import { challengeStatus } from '../game/scenario';
import { G, placeName } from '../game/state';
import { medalHTML, scoreText } from './achievements';
import { ico } from './glyphs';

// De uitslag van een uitdaging heeft altijd een speltijd (time) en een verlies (losses), zie scoreNow in
// game/achievements.ts. Daarom staat er hieronder result.time! en result.losses!.

// "niets", "1 dorpeling of gebouw", "3 dorpelingen en gebouwen"
function lossText(n: number) {
  if (n === 0) return 'niets';
  return `${n} ${n === 1 ? 'dorpeling of gebouw' : 'dorpelingen en gebouwen'}`;
}

/** Kop en verhaal: gehaald, de tijd is om, of het stamhuis is gevallen. */
function headAndStory(won: boolean, def: ScenarioDef, result: GameResult) {
  const place = placeName();
  const goal = goalInSentence(def.goal);
  if (won) {
    const how =
      def.goal.type === 'survive'
        ? `${place} hield ${def.goal.value} nachten stand en verloor ${lossText(result.losses!)}.`
        : `${place} haalde het doel (${goal}) in ${clockText(result.time!)} speltijd.`;
    return {
      head: `<div class="eyebrow">Uitdaging gehaald · ${def.n}</div><h1>${result.medal === 'goud' ? 'Gelukt, met goud!' : 'Gelukt!'}</h1>`,
      story: how,
    };
  }
  // Hoe ver je kwam: "Je kwam tot de IJzertijd." of "Je kwam tot 7 van 10 nachten."
  const status = challengeStatus();
  const progress = def.goal.type === 'age' ? ageName(G.age) : status && status.text;
  const reached = progress ? ` Je kwam tot ${progress}.` : '';
  const again =
    def.k === DAILY ? 'Probeer het nog eens: vandaag blijft het dezelfde wereld.' : 'Probeer het nog eens.';
  // In een uitdaging is G.scenario er altijd
  if (G.scenario!.failed === 'time')
    return {
      head: `<div class="eyebrow">${def.n}</div><h1>De tijd is om.</h1>`,
      story: `Het doel was: ${goal}.${reached} ${again}`,
    };
  return {
    head: `<div class="eyebrow">${def.n} · dag ${G.day}</div><h1>Het stamhuis is gevallen.</h1>`,
    story: `${place} hield ${G.day} dagen stand in ${ageName(G.age)}. Het doel was: ${goal}.${reached} ${again}`,
  };
}

/** Wat je nog beter kunt doen voor de volgende medaille, zoals "Nog 1:30 sneller voor zilver". */
function nextMedalLine(def: ScenarioDef, result: GameResult) {
  const better = MEDAL_ORDER.slice(0, Math.max(0, (MEDAL_ORDER as string[]).indexOf(result.medal)));
  const goals = result.medal ? better : MEDAL_ORDER;
  const next = goals[goals.length - 1]; // de dichtstbijzijnde betere medaille
  if (!next || !G.won) return '';
  // next komt uit MEDAL_ORDER, dus die medaille bestaat
  const name = MEDALS.find(m => m.k === next)!.n.toLowerCase();
  if (def.medals.by === 'lost') return `Met minder verlies: ${name} (${medalRuleText(def.medals, next)})`;
  return `Nog ${clockText(result.time! - def.medals[next])} sneller voor ${name}`;
}

/** Medaille groot, met de tijd (of het verlies) eronder en een regel over je record of de volgende medaille. */
function medalHeadHTML(def: ScenarioDef, result: GameResult) {
  const medal = MEDALS.find(m => m.k === result.medal);
  const icon = medal
    ? medalHTML(medal.k, 'lg')
    : '<span class="medal none lg" aria-label="Geen medaille"><span>–</span></span>';
  const value = def.medals.by === 'lost' ? `${result.losses} verloren` : clockText(result.time!);
  const label = def.medals.by === 'lost' ? 'Verloren' : 'Speltijd';
  let line = '';
  if (result.record && G.won) line = `<span class="rec">${ico('★')}Nieuw record!</span>`;
  else if (nextMedalLine(def, result)) line = `<span class="nextm">${nextMedalLine(def, result)}</span>`;
  return `<div class="endhead">
    <span class="medalbox ${medal ? '' : 'none'}">${icon}</span>
    <div><small>${medal ? `Medaille: ${medal.n}` : G.won ? 'Geen medaille' : label}</small><b class="endpts chval">${value}</b>${line}</div>
  </div>`;
}

/** De drie medailles met wat ervoor nodig is; de jouwe licht op. */
function medalKeyHTML(def: ScenarioDef, result: GameResult) {
  return `<div class="chmedals end">${MEDALS.map(
    m =>
      `<span class="chm ${result.medal === m.k ? 'got' : ''}">${medalHTML(m.k)}<b>${m.n}</b><small>${medalRuleText(def.medals, m.k)}</small></span>`,
  ).join('')}</div>`;
}

/** Bij de wereld van de dag: je beste score van vandaag, als die hoger is dan deze (de score zelf staat al in de tabel). */
function dailyLine(def: ScenarioDef, result: GameResult) {
  if (def.k !== DAILY) return '';
  // De wereld van de dag heeft altijd een datum (zie dailyWorld)
  const best = getProfile().daily[def.date!];
  if (!best || best.score <= result.score) return '';
  return `<p class="chrec">${ico('★')}Beste vandaag: ${scoreText(best.score)}</p>`;
}

/**
 * De onderdelen van het eindscherm voor een uitdaging: head, story, medal (medaille en sleutel),
 * extra (regel onder de score) en buttons.
 */
export function challengeEndParts(won: boolean, result: GameResult, def: ScenarioDef) {
  const { head, story } = headAndStory(won, def, result);
  // Gewonnen: verder bouwen kan. Verloren: meteen opnieuw.
  const buttons = won
    ? `<button class="primary" data-m="close">Verder bouwen</button><button data-end="retry">Opnieuw</button><button data-end="challenges">Uitdagingen</button>`
    : `<button class="primary" data-end="retry">Opnieuw</button><button data-end="challenges">Uitdagingen</button><button data-end="menu">Hoofdmenu</button>`;
  return {
    head,
    story,
    medal: medalHeadHTML(def, result),
    key: medalKeyHTML(def, result),
    extra: dailyLine(def, result),
    buttons,
  };
}
