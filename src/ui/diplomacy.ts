// Het venster Diplomatie: per rivaal de relatie, verdragen en alle acties met kans, kosten en gevolg.
// Ook de relatie als woord en balkje (voor het paneel Leger) en het kaartje met een bericht van een rivaal.
import { sfx } from '../audio/sound';
import { AGES } from '../data/ages';
import {
  ALLY_KEEP,
  ALLY_MIN,
  DRIFT_PER_DAY,
  OFFER_TIME,
  TRADE_KEEP,
  TRADE_MIN,
  WAR_AT,
  relText,
  relationLevel,
} from '../data/diplomacy';
import { RES } from '../data/resources';
import { PERSONALITY, RIVAL, strengthWord } from '../data/rivals';
import {
  attackEveryDays,
  diplomacyActions,
  doDiplomacy,
  nextStep,
  offerRelation,
  restingOf,
  rivalAttackDay,
  rivalPower,
  yourPower,
} from '../game/diplomacy';
import { has } from '../game/economy';
import { rivalArmy, rivalById } from '../game/rivals';
import { G } from '../game/state';
import { costHTML, esc, gem } from './format';
import { ico } from './glyphs';
import { closeModal, openModal } from './modals';
import { bannerHTML } from './peoples';
import { showRival } from './rivals';
import { $ } from '../util/dom';

// ---- De relatie in het klein (paneel Leger, selectie, tooltips) ----

// De stand van de relatie met een rivaal: In oorlog en Bondgenoot gaan voor het getal
const levelOf = r => relationLevel(r.rel, r.ally, r.atWar);

/** De relatie als gekleurd woord met getal: "Vriendelijk +24". */
export function relChipHTML(r) {
  const level = levelOf(r);
  return `<span class="relchip lvl-${level.k}" title="Relatie ${relText(r.rel)} (van −100 tot +100)">${level.n} ${relText(r.rel)}</span>`;
}

/** Kleine tekens voor wat er geldt: oorlog, handelsverdrag, bondgenootschap. */
export function pactIconsHTML(r) {
  const icons = [];
  if (r.atWar) icons.push(`<span class="pact bad" title="In oorlog">${ico('⚔')}</span>`);
  if (r.trade) icons.push(`<span class="pact good" title="Handelsverdrag">${ico('⚖')}</span>`);
  if (r.ally) icons.push(`<span class="pact ally" title="Bondgenootschap">${ico('⚭')}</span>`);
  return icons.join('');
}

/** De relatie als woord, voor in een tooltip of een zin: "Vriendelijk (+24)". */
export const relationWords = r => `${levelOf(r).n} (${relText(r.rel)})`;

// Van een relatie (−100 tot 100) naar een plek op de balk (0 tot 100%)
const barPos = rel => (rel + 100) / 2;

/** De relatie als balk van −100 tot 100, met streepjes waar oorlog dreigt en waar handel en een verbond kunnen. */
export function relBarHTML(r) {
  const value = Math.round(r.rel);
  const level = relationLevel(value, r.ally, r.atWar);
  // De vulling loopt vanaf het midden (0) naar links (slecht) of naar rechts (goed)
  const left = Math.min(50, barPos(value)),
    width = Math.abs(barPos(value) - 50);
  return `<div class="relbar lvl-${level.k}" role="meter" aria-label="Relatie" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="${value}">
      <i class="fill" style="left:${left}%;width:${width}%"></i>
      <i class="mid"></i>
      <i class="tick war" style="left:${barPos(WAR_AT)}%"></i>
      <i class="tick" style="left:${barPos(TRADE_MIN)}%"></i>
      <i class="tick" style="left:${barPos(ALLY_MIN)}%"></i>
      <i class="pin" style="left:${barPos(value)}%"></i>
    </div>
    <div class="relscale">
      <span class="war" style="left:${barPos(WAR_AT)}%" title="Zakt de relatie tot ${relText(WAR_AT)}, dan verklaren ze je de oorlog">Oorlog</span>
      <span class="zero" style="left:50%">0</span>
      <span style="left:${barPos(TRADE_MIN)}%">Handel</span>
      <span style="left:${barPos(ALLY_MIN)}%">Verbond</span>
    </div>`;
}

// ---- Het venster ----

// Welke rivaal bovenaan in beeld komt, de uitkomst van de laatste actie, en de oorlogsknop die om bevestiging vraagt
let focusId = 0;
// Op een telefoon staan alleen de acties van één rivaal open: de gekozen, of anders de eerste
let openId = 0;
let lastResult = null;
let armedWar = 0;

/** Open het venster Diplomatie. Met `id` komt die rivaal in beeld. Het spel staat stil zolang het open is. */
export function showDiplomacy(id = 0) {
  focusId = id;
  lastResult = null;
  armedWar = 0;
  openModal(sheetHTML(), { cls: 'diplosheet' });
  const card = id && document.querySelector(`#sheet [data-card="${id}"]`);
  if (card) card.scrollIntoView({ block: 'nearest' });
}

// Het venster opnieuw tekenen na een actie, op dezelfde plek
function redraw() {
  const sheet = $('#sheet');
  const top = sheet.scrollTop;
  sheet.innerHTML = sheetHTML();
  sheet.scrollTop = top;
}

function sheetHTML() {
  const list = (G && G.rivals) || [];
  const alive = list.filter(r => !r.dead),
    beaten = list.filter(r => r.dead);
  openId = alive.some(r => r.id === focusId) ? focusId : alive.length ? alive[0].id : 0;
  const none = alive.length ? '' : '<p class="dnone">Er zijn geen rivalen meer over.</p>';
  return `<button class="quiet x" data-dip="close" aria-label="Sluiten">${ico('✕')}</button>
    <div class="eyebrow">Rivalen</div><h1>Diplomatie</h1>
    <p>Hoe denken de andere volken over jou? Vrienden vallen minder vaak aan, handelen met je en helpen je in nood. Het spel staat stil zolang dit venster open is.</p>
    ${alive.map(cardHTML).join('')}${none}${beatenHTML(beaten)}
    <div class="row"><button class="primary" data-dip="close">Klaar</button></div>`;
}

// Sterkte in woorden (zelfde sleutels als strengthWord in data/rivals.ts)
const STRENGTH = { zwakker: 'zwakker dan jij', gelijk: 'even sterk als jij', sterker: 'sterker dan jij' };

function cardHTML(r) {
  const info = RIVAL[r.k];
  const level = levelOf(r);
  const power = strengthWord(rivalPower(r), yourPower());
  const soldiers = rivalArmy(r).length;
  const result =
    lastResult && lastResult.id === r.id
      ? `<div class="dres ${lastResult.ok ? 'good' : 'bad'}">${ico(lastResult.ok ? '✓' : '✕')}<span>${esc(lastResult.text)}</span></div>`
      : '';
  // De gekozen rivaal krijgt een rand; op een smal scherm zijn de andere kaarten dichtgeklapt (zie diplomacy.css)
  const open = openId === r.id;
  const classes = ['dcard', `lvl-${level.k}`, focusId === r.id && 'focus', !open && 'fold']
    .filter(Boolean)
    .join(' ');
  const unfold = open
    ? ''
    : `<button class="quiet dopen" data-dip="open" data-rid="${r.id}">${ico('➜')}Toon acties</button>`;
  return `<section class="${classes}" data-card="${r.id}">
    <div class="dhead">
      ${bannerHTML(info)}
      <div class="dname">
        <b>${esc(info.n)}</b>
        <small>${PERSONALITY[r.p].n} · ${AGES[r.age].n} · ${soldiers} ${soldiers === 1 ? 'soldaat' : 'soldaten'} · <span class="rivpow ${power}">${STRENGTH[power]}</span></small>
      </div>
      <div class="drel lvl-${level.k}"><b>${level.n}</b><span>${relText(r.rel)}</span></div>
    </div>
    ${relBarHTML(r)}
    <div class="dfacts">${factsHTML(r)}</div>
    ${result}
    <div class="dacts">${diplomacyActions(r)
      .map(a => actionHTML(r, a))
      .join('')}</div>
    ${unfold}
    <button class="quiet dlook" data-dip="look" data-rid="${r.id}">${ico('◎')}Bekijk hun stad</button>
  </section>`;
}

// Wat er nu geldt, als fiches: oorlog, verbond, verdrag, waar de relatie vanzelf heen gaat,
// wanneer ze aanvallen en wat de volgende stap is
function factsHTML(r) {
  const chips = [];
  if (r.atWar) chips.push(chip('bad', '⚔', `In oorlog sinds dag ${r.warDay}`));
  if (r.ally) chips.push(chip('ally', '⚭', `Bondgenoot: valt nooit aan · stopt onder ${relText(ALLY_KEEP)}`));
  if (r.trade) {
    const t = r.trade;
    const deal = `Elke minuut ${t.giveAmt} ${resName(t.give)} → ${t.getAmt} ${resName(t.get)}`;
    chips.push(chip('good', '⚖', `${deal} · stopt onder ${relText(TRADE_KEEP)}`));
  }
  const drift = driftLine(r);
  if (drift) chips.push(chip('', '↻', drift));
  if (!r.ally) chips.push(chip('', '⌛', attackLine(r)));
  const step = nextStep(r);
  if (step) chips.push(chip('soft', '➜', step));
  return chips.join('');
}

// De relatie schuift elke dag een stukje naar een rustpunt (zie restingRel in data/diplomacy.ts)
function driftLine(r) {
  const now = Math.round(r.rel),
    rest = restingOf(r);
  if (now === rest) return '';
  const way = now > rest ? 'Zakt' : 'Stijgt';
  return `${way} vanzelf naar ${relText(rest)} (${DRIFT_PER_DAY} per dag)`;
}

const chip = (tone, glyph, text) => `<span class="dchip ${tone}">${ico(glyph)}${esc(text)}</span>`;
const resName = k => RES[k].n.toLowerCase();

// Hoe vaak ze aanvallen, en wanneer op zijn vroegst weer
function attackLine(r) {
  if (G.peaceful) return 'Vredige modus: valt niet aan';
  if (r.threatDay && r.threatDay >= G.day) return `Komt op dag ${r.threatDay} aanvallen: je weigerde hun eis`;
  const every = attackEveryDays(r);
  const next = rivalAttackDay(r);
  const when = next > G.day ? ` · niet vóór dag ${next}` : ' · kan nu aanvallen';
  return `Valt ongeveer om de ${every} ${every === 1 ? 'dag' : 'dagen'} aan${when}`;
}

/** Eén actie als tegel: naam, kans, kosten of ruil, en wat er gebeurt als het lukt of mislukt. */
function actionHTML(r, a) {
  const off = !!a.why || (a.cost && !has(a.cost));
  const armed = a.k === 'war' && armedWar === r.id;
  // De kans in een kleur: groen = grote kans, oranje = misschien, rood = klein. Bij een verlies (oorlog) in inkt.
  let tone = a.chance >= 70 ? 'hi' : a.chance >= 35 ? 'mid' : 'lo';
  if (a.bad) tone = 'sure';
  const chance = a.why
    ? ''
    : `<span class="dch ${tone}" title="Kans dat het lukt">${a.chance >= 100 ? 'zeker' : `${a.chance}%`}</span>`;
  const cost = a.cost ? `<span class="dline dcost">Kost ${costHTML(a.cost)}</span>` : '';
  const deal = a.deal ? `<span class="dline">${esc(a.deal)}</span>` : '';
  const outcome = a.why
    ? `<span class="why">${esc(a.why)}</span>`
    : `<span class="dfx ${a.bad ? 'down' : 'up'}">${esc(a.yes)}</span>${a.no ? `<span class="dfx down">${esc(a.no)}</span>` : ''}`;
  const cls = ['dact', a.danger && 'danger', armed && 'armed'].filter(Boolean).join(' ');
  return `<button class="${cls}" data-dip="${a.k}" data-rid="${r.id}" ${off ? 'disabled' : ''}>
    <span class="dat"><span class="g">${ico(a.g)}</span><b>${armed ? 'Zeker? Klik nogmaals' : a.n}</b>${chance}</span>
    ${cost}${deal}${outcome}
  </button>`;
}

// Verslagen rivalen: één regel onderaan
function beatenHTML(list) {
  if (!list.length) return '';
  const names = list.map(r => `${bannerHTML(RIVAL[r.k], 'xs')}${esc(RIVAL[r.k].n)} (dag ${r.deadDay})`);
  return `<p class="dbeaten">Verslagen: ${names.join(' · ')}</p>`;
}

$('#modal').addEventListener('click', e => {
  const t = e.target.closest('[data-dip]');
  if (!t || t.disabled) return;
  const k = t.dataset.dip;
  sfx('tick');
  if (k === 'close') {
    closeModal();
    return;
  }
  const r = rivalById(+t.dataset.rid);
  if (!r || r.dead) return;
  if (k === 'look') {
    closeModal();
    showRival(r);
    return;
  }
  // Een dichtgeklapte kaart openen (alleen op een smal scherm): de andere klappen dan dicht
  if (k === 'open') {
    focusId = r.id;
    lastResult = null;
    redraw();
    const card = document.querySelector(`#sheet [data-card="${r.id}"]`);
    if (card) card.scrollIntoView({ block: 'start' });
    return;
  }
  // Oorlog verklaren vraagt eerst om bevestiging: twee keer klikken
  if (k === 'war' && armedWar !== r.id) {
    armedWar = r.id;
    redraw();
    return;
  }
  armedWar = 0;
  const result = doDiplomacy(r, k);
  if (result) lastResult = { id: r.id, ...result };
  redraw();
});

// ---- Een bericht van een rivaal (in het kaartje bovenaan, zie renderOffer in ui/event.ts) ----

// Wat er op de knop staat om ja te zeggen
const YES = { trade: 'Ruil', ask: 'Geef', demand: 'Betaal', ally: 'Sluit verbond', peace: 'Sluit vrede' };
// Bij deze berichten kost nee iets: dan staat er een echte knop "Weiger" in plaats van alleen een kruisje
const REAL_NO = ['ask', 'demand', 'ally'];

/** Het kaartje bij een bericht van een rivaal: wie, wat, wat ja en nee doen, en hoe lang het nog openstaat. */
export function rivalOfferHTML(o) {
  const r = rivalById(o.from);
  if (!r) return '';
  const info = RIVAL[r.k];
  const rel = offerRelation(o.kind);
  const canPay = !o.give || has({ [o.give]: o.price });
  // De getallen staan al in de zin; hier wat ja en nee doen (geen antwoord telt als nee)
  const effects = [];
  if (!canPay)
    effects.push(`<span class="no">Te weinig ${gem(o.give)} ${RES[o.give].n.toLowerCase()}</span>`);
  if (o.kind === 'demand') {
    effects.push(`Ja: ${o.spareDays || 2} dagen geen aanval`);
    effects.push(`<span class="no">Nee of geen antwoord: aanval op dag ${G.day + 1}</span>`);
  } else {
    if (rel.yes) effects.push(`Ja: relatie ${relText(rel.yes)}`);
    if (rel.no) effects.push(`Nee of geen antwoord: relatie ${relText(rel.no)}`);
  }
  const left = Math.max(0, o.until - G.t);
  const timeBar = `<div class="bar acc"><i style="width:${Math.min(100, (left / OFFER_TIME) * 100)}%"></i></div>`;
  const no = REAL_NO.includes(o.kind)
    ? `<button class="quiet offno" data-o="no">Weiger</button>`
    : `<button class="quiet" data-o="no" aria-label="Weigeren" title="Weigeren">${ico('✕')}</button>`;
  // Oudere berichten hebben alleen de hele zin (met de naam); dan tonen we die
  const line = o.line || o.text;
  return [
    `<div class="ic riv">${bannerHTML(info, 'sm')}</div>`,
    `<div class="t"><b>${esc(info.n)}</b>${esc(line)}<small class="offx">${effects.join(' · ')}</small>${timeBar}</div>`,
    `<button class="primary" data-o="ok" ${canPay ? '' : 'disabled'}>${YES[o.kind] || 'Ja'}</button>`,
    no,
  ].join('');
}
