// Eindscherm na winst of verlies: je score met medaille, nieuwe prestaties en de voorraadgrafiek.
import { sfx } from '../audio/sound.js';
import { AGES } from '../data/ages.js';
import { ACHIEVEMENT } from '../data/achievements.js';
import { RES } from '../data/resources.js';
import { DIFF_NAMES, MEDALS } from '../data/score.js';
import { finishGame } from '../game/achievements.js';
import { wipe } from '../game/save.js';
import { G, placeName } from '../game/state.js';
import { achievementIcon, clearAchievementCards, medalHTML, scoreText } from './achievements.js';
import { ageTimeline, fmt, gem } from './format.js';
import { ico } from './glyphs.js';
import { openModal, showTitle } from './modals.js';
import { chartKeys, drawChart } from './panes/log.js';
import { showProfile } from './profile.js';
import { $ } from '../util/dom.js';

// Op welk eindscherm je zat (gewonnen of verloren), voor de knop "Terug" op het profielscherm
let lastWon = false;

// Getal met een echt minteken en punten voor duizendtallen: -900 wordt "−900"
const signed = n => (n < 0 ? '−' + scoreText(-n) : scoreText(n));
// Hetzelfde, maar met een plus ervoor als het niet negatief is: "+4.638"
const plusMinus = n => (n < 0 ? signed(n) : '+' + scoreText(n));
const factorText = f => '×' + String(f).replace('.', ',');

/**
 * Eén regel van de tabel: wat, hoeveel, punten per stuk en punten.
 * Altijd vier vakjes (geen colspan): op een smal scherm valt de kolom "per stuk" weg, en zo blijven
 * de punten toch netjes onder elkaar staan.
 */
const tableRow = (label, count, per, pts, cls = '') => `<tr class="${cls}">
    <th>${label}</th>
    <td class="cnt">${count}</td>
    <td class="per">${per}</td>
    <td class="pts">${pts}</td>
  </tr>`;

/** Een onderdeel van de score, zoals "Kampen veroverd · 4 · × 200 · 800". */
function scoreRowHTML(row) {
  // Tijdperken tellen vanaf de Steentijd: in het Sterrentijdperk ben je 8 tijdperken verder
  const count = row.k === 'age' ? `${row.count} (${AGES[row.count].n})` : fmt(row.count);
  return tableRow(row.n, count, `× ${signed(row.per)}`, signed(row.pts));
}

/** De score als tabelletje: per onderdeel aantal × punten, dan samen, dan keer de moeilijkheid. */
function scoreTableHTML(result) {
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
    <tbody>${rows.map(scoreRowHTML).join('')}${sumRow}${factorRow}</tbody>
    <tfoot>${tableRow('Score', '', '', scoreText(result.score))}</tfoot>
  </table>`;
}

/** Medaille en score groot, met een regel over het record of de volgende medaille. */
function scoreHeadHTML(result) {
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
function chartHTML(keys) {
  if (G.hist.length < 2) return '';
  return `<div class="sect">Voorraad <span>laatste 10 minuten</span></div>
    <canvas class="endchart" width="560" height="140" aria-label="Grafiek van je voorraad"></canvas>
    <div class="chartkey">${keys.map(k => `<span>${gem(k)}${RES[k].n}</span>`).join('')}</div>`;
}

/** Laat het eindscherm zien. `won`: gewonnen (Sterrenpoort) of verloren (stamhuis gevallen). */
export function showEndScreen(won) {
  const result = G.result || finishGame(); // meestal al bewaard bij het einde (zie game/achievements.js)
  // De kaartjes bovenin zijn niet meer nodig: hieronder staan alle nieuwe prestaties van dit spel
  if (clearAchievementCards()) sfx('achieve');
  const keys = chartKeys(G.age);
  const last = AGES.length - 1;
  const head = won
    ? `<div class="eyebrow">Hoofdstuk ${AGES[last].r} voltooid</div><h1>Van vuursteen tot sterrenpoort.</h1>`
    : `<div class="eyebrow">Dag ${G.day}</div><h1>Het stamhuis is gevallen.</h1>`;
  const story = won
    ? `${placeName()} doorliep de hele geschiedenis in ${G.day} dagen.`
    : `${placeName()} hield ${G.day} dagen stand en bereikte de ${AGES[G.age].n.toLowerCase()}. Bouw volgende keer eerder torens en een leger, of speel in de vredige modus.`;
  const buttons = won
    ? `<button class="primary" data-m="close">Verder bouwen</button><button data-m="new">Nieuwe wereld</button>`
    : `<button class="primary" data-m="newok">Nieuwe wereld</button><button data-end="menu">Hoofdmenu</button>`;
  openModal(
    `${head}<div class="sheettl">${ageTimeline(won ? last : G.age, true)}</div>
    <p>${story} ${fmt(G.stats.gathered)} grondstoffen verzameld, ${G.stats.killed} vijanden verslagen, ${G.stats.camps} kampen veroverd.</p>
    <div class="endscore">${scoreHeadHTML(result)}${scoreTableHTML(result)}</div>
    <div class="sect">Nieuwe prestaties <span>${G.achieved.length}</span></div>
    ${newAchievementsHTML()}
    ${chartHTML(keys)}
    <div class="row">${buttons}<button class="quiet" data-end="profile">${ico('★')}Alle prestaties</button></div>`,
    { cls: 'endsheet' },
  );
  const canvas = $('#sheet .endchart');
  if (canvas) drawChart(canvas, G.hist, keys);
  lastWon = won;
}

// Knoppen op het eindscherm die niet in modals.js staan
$('#modal').addEventListener('click', e => {
  const t = e.target.closest('[data-end]');
  if (!t) return;
  if (t.dataset.end === 'profile') showProfile({ back: () => showEndScreen(lastWon) });
  else if (t.dataset.end === 'menu') {
    // Dit spel is voorbij: niet bewaren, zodat "Verder spelen" niet terugkomt naar een gevallen stad
    wipe();
    $('#modal').hidden = true;
    showTitle();
  }
});
