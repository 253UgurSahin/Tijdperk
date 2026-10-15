// Eindscherm na winst of verlies: je score met medaille, nieuwe prestaties en de voorraadgrafiek.
// Bij een uitdaging komen kop, medaille en knoppen uit ui/challengeend.ts.
import type { GameResult, ScoreRow } from '../types';
import { sfx } from '../audio/sound';
import { AGES } from '../data/ages';
import { ACHIEVEMENT } from '../data/achievements';
import { RES } from '../data/resources';
import { DIFF_NAMES, MEDALS } from '../data/score';
import type { ScenarioDef } from '../data/scenarios';
import { VICTORY } from '../data/victories';
import { finishGame } from '../game/achievements';
import { wipe } from '../game/save';
import { currentChallenge } from '../game/scenario';
import { G, placeName } from '../game/state';
import { victoryFacts } from '../game/victory';
import { achievementIcon, clearAchievementCards, medalHTML, scoreText } from './achievements';
import { challengeEndParts } from './challengeend';
import { openChallengeList, retryChallenge } from './challenges';
import { ageTimeline, fmt, gem } from './format';
import { ico } from './glyphs';
import { openModal, showTitle } from './modals';
import { chartKeys, drawChart } from './panes/log';
import { showProfile } from './profile';
import { $ } from '../util/dom';

// Op welk eindscherm je zat (gewonnen of verloren), voor de knop "Terug" op het profielscherm
let lastWon = false;

// Getal met een echt minteken en punten voor duizendtallen: -900 wordt "−900"
const signed = (n: number): string => (n < 0 ? '−' + scoreText(-n) : scoreText(n));
// Hetzelfde, maar met een plus ervoor als het niet negatief is: "+4.638"
const plusMinus = (n: number): string => (n < 0 ? signed(n) : '+' + scoreText(n));
const factorText = (f: number) => '×' + String(f).replace('.', ',');

/**
 * Eén regel van de tabel: wat, hoeveel, punten per stuk en punten.
 * Altijd vier vakjes (geen colspan): op een smal scherm valt de kolom "per stuk" weg, en zo blijven
 * de punten toch netjes onder elkaar staan.
 */
const tableRow = (label: string, count: string, per: string, pts: string, cls = '') => `<tr class="${cls}">
    <th>${label}</th>
    <td class="cnt">${count}</td>
    <td class="per">${per}</td>
    <td class="pts">${pts}</td>
  </tr>`;

/** Een onderdeel van de score, zoals "Kampen veroverd · 4 · × 200 · 800". */
function scoreRowHTML(row: ScoreRow, result: GameResult) {
  // Tijdperken tellen vanaf je begin (meestal de Steentijd): in het Sterrentijdperk ben je 8 tijdperken verder
  const ageName = (AGES[result.age] || AGES[row.count]).n;
  const count = row.k === 'age' ? `${row.count} (${ageName})` : fmt(row.count);
  return tableRow(row.n, count, `× ${signed(row.per)}`, signed(row.pts));
}

/** De score als tabelletje: per onderdeel aantal × punten, dan samen, dan keer de moeilijkheid. */
function scoreTableHTML(result: GameResult) {
  // Wonderen bestaan nog niet in het spel: die regel alleen tonen als er punten zijn
  const rows = result.rows.filter(row => row.k !== 'wonders' || row.count > 0);
  const raw = result.raw ?? result.sum; // raw: de som, ook als die onder 0 komt
  // "Samen" alleen als er daarna nog iets met de som gebeurt (keer de moeilijkheid, of terug naar 0)
  const showSum = result.factor !== 1 || raw < 0;
  const sumRow = showSum
    ? tableRow('Samen', raw < 0 ? 'nooit onder 0' : '', '', scoreText(result.sum), 'sub')
    : '';
  // Vredige modus aangezet bij Normaal of Zwaar: dan heet de regel zo, en niet "Vredig"
  const factorName = result.peaceful ? 'Vredige modus' : DIFF_NAMES[result.diff];
  const factorPoints = plusMinus(result.score - result.sum); // wat de moeilijkheid erbij doet (of eraf haalt)
  const factorRow =
    result.factor !== 1 ? tableRow(factorName, factorText(result.factor), '', factorPoints, 'sub') : '';
  return `<table class="scoretab">
    <tbody>${rows.map(row => scoreRowHTML(row, result)).join('')}${sumRow}${factorRow}</tbody>
    <tfoot>${tableRow('Score', '', '', scoreText(result.score))}</tfoot>
  </table>`;
}

/** Medaille en score groot, met een regel over het record of de volgende medaille. */
function scoreHeadHTML(result: GameResult) {
  const medal = MEDALS.find(m => m.k === result.medal);
  // De eerstvolgende medaille die je nog niet hebt (de lijst loopt van hoog naar laag)
  const next = MEDALS.filter(m => m.min > result.score).pop();
  let line = '';
  if (result.record) line = `<span class="rec">${ico('★')}Nieuw record!</span>`;
  else if (next)
    line = `<span class="nextm">Nog ${scoreText(next.min - result.score)} punten voor ${next.n.toLowerCase()}</span>`;
  // Zonder medaille: een lege munt met een streepje
  const noMedal = '<span class="medal none lg" aria-label="Geen medaille"><span>–</span></span>';
  const medalIcon = medal ? medalHTML(medal.k, 'lg') : noMedal;
  const medalName = medal ? `Medaille: ${medal.n}` : 'Geen medaille';
  return `<div class="endhead">
    <span class="medalbox ${medal ? '' : 'none'}">${medalIcon}</span>
    <div><small>${medalName}</small><b class="endpts">${scoreText(result.score)}</b>${line}</div>
  </div>`;
}

/** De prestaties die je in dit spel voor het eerst haalde. */
function newAchievementsHTML() {
  const list = G.achieved.map(k => ACHIEVEMENT[k]).filter(Boolean);
  if (!list.length) return '<p class="endnone">Deze keer geen nieuwe prestaties.</p>';
  return `<div class="achchips">${list
    .map(a => `<span class="achchip" title="${a.d}">${achievementIcon(a)}<b>${a.n}</b></span>`)
    .join('')}</div>`;
}

/** Grafiek met je voorraad over de laatste tien minuten, met een legenda eronder. */
function chartHTML(keys: string[]) {
  if (G.hist.length < 2) return '';
  return `<div class="sect">Voorraad <span>laatste 10 minuten</span></div>
    <canvas class="endchart" width="560" height="140" aria-label="Grafiek van je voorraad"></canvas>
    <div class="chartkey">${keys.map(k => `<span>${gem(k)}${RES[k].n}</span>`).join('')}</div>`;
}

/** Kop, verhaal, score en knoppen bij een gewoon spel (zonder uitdaging). */
function freePlayParts(won: boolean, result: GameResult) {
  // Waarmee je won (sterrenpoort, overleven of een kort spel) bepaalt de kop en het verhaal
  const victory = VICTORY[G.wonBy] || VICTORY.stargate;
  const head = won
    ? `<div class="eyebrow">${victory.end.eyebrow}</div><h1>${victory.end.title}</h1>`
    : `<div class="eyebrow">Dag ${G.day}</div><h1>Het stamhuis is gevallen.</h1>`;
  const story = won
    ? victory.end.story(victoryFacts())
    : `${placeName()} hield ${G.day} dagen stand en bereikte de ${AGES[G.age].n.toLowerCase()}. Bouw volgende keer eerder torens en een leger, of speel in de vredige modus.`;
  // "Nieuwe wereld" opent meteen het nieuw-spelscherm: er gaat niets verloren, want het spel wordt eerst bewaard
  const buttons = won
    ? `<button class="primary" data-m="close">Verder bouwen</button><button data-m="newok">Nieuwe wereld</button>`
    : `<button class="primary" data-m="newok">Nieuwe wereld</button><button data-end="menu">Hoofdmenu</button>`;
  return {
    head,
    story,
    // De tijdlijn: bij de sterrenpoort helemaal vol, anders tot waar je kwam
    timelineAge: won && victory.k === 'stargate' ? AGES.length - 1 : G.age,
    score: `<div class="endscore">${scoreHeadHTML(result)}${scoreTableHTML(result)}</div>`,
    buttons,
  };
}

/** Kop, verhaal, medaille en knoppen bij een uitdaging (zie ui/challengeend.ts). De score staat eronder. */
function challengeParts(won: boolean, result: GameResult, def: ScenarioDef) {
  const parts = challengeEndParts(won, result, def);
  return {
    ...parts,
    timelineAge: G.age,
    score: `<div class="endscore">${parts.medal}${parts.key}</div>
      <div class="sect">Score</div>${scoreTableHTML(result)}${parts.extra}`,
  };
}

/** Laat het eindscherm zien. `won`: gewonnen (zie G.wonBy) of verloren (stamhuis gevallen, of de tijd op). */
export function showEndScreen(won: boolean) {
  const result = G.result || finishGame(); // meestal al bewaard bij het einde (zie game/achievements.ts)
  // De kaartjes bovenin zijn niet meer nodig: hieronder staan alle nieuwe prestaties van dit spel
  if (clearAchievementCards()) sfx('achieve');
  const keys = chartKeys(G.age);
  const def = currentChallenge();
  const { head, story, timelineAge, score, buttons } = def
    ? challengeParts(won, result, def)
    : freePlayParts(won, result);
  // Speelden er rivalen mee? Dan ook hoeveel je er versloeg
  const rivalsLine = () =>
    G.rivals.length ? `, ${G.stats.rivals || 0} van ${G.rivals.length} rivalen verslagen` : '';
  openModal(
    `${head}<div class="sheettl">${ageTimeline(timelineAge, true)}</div>
    <p>${story} ${fmt(G.stats.gathered)} grondstoffen verzameld, ${G.stats.killed} vijanden verslagen, ${G.stats.camps} kampen veroverd${rivalsLine()}.</p>
    ${score}
    <div class="sect">Nieuwe prestaties <span>${G.achieved.length}</span></div>
    ${newAchievementsHTML()}
    ${chartHTML(keys)}
    <div class="row">${buttons}<button class="quiet" data-end="profile">${ico('★')}Alle prestaties</button></div>`,
    { cls: 'endsheet' },
  );
  const canvas = $<HTMLCanvasElement>('#sheet .endchart');
  if (canvas) drawChart(canvas, G.hist, keys);
  lastWon = won;
}

// Knoppen op het eindscherm die niet in modals.ts staan
$('#modal').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-end]');
  if (!t) return;
  if (t.dataset.end === 'profile') showProfile({ back: () => showEndScreen(lastWon) });
  else if (t.dataset.end === 'retry') retryChallenge();
  else if (t.dataset.end === 'challenges') openChallengeList();
  else if (t.dataset.end === 'menu') {
    // Dit spel is voorbij: niet bewaren, zodat "Verder spelen" niet terugkomt naar een gevallen stad
    wipe();
    $('#modal').hidden = true;
    showTitle();
  }
});
