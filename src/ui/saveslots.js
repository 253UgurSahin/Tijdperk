// Opslaan en laden: een scherm met de drie eigen plekken en de automatische opslag, elk als kaartje.
import { sfx } from '../audio/sound.js';
import { SET } from '../core/settings.js';
import {
  AUTO_SLOT,
  MANUAL_SLOTS,
  SLOTS,
  gameText,
  sameGame,
  saveErrorText,
  savedAtText,
  slotLabel,
  slotName,
  slotSummary,
  slotTitle,
} from '../data/saveslots.js';
import { currentMeta, deleteSlot, liveGameAtRisk, listSlots, loadSlot, saveToSlot } from '../game/save.js';
import { G } from '../game/state.js';
import { TOUCH, ageTimeline } from './format.js';
import { ico } from './glyphs.js';
import { toast } from './hud.js';
import { closeModalAndPlay, openModal } from './modals.js';
import { $ } from '../util/dom.js';

// Wat er open staat: opslaan of laden, welke plek om "zeker weten?" vraagt, welke net is opgeslagen en
// een melding in het venster zelf (een gewone melding valt achter het venster).
// onLoaded draait na het laden (het titelscherm gaat dan dicht), onClose als het venster dichtgaat.
let view = { mode: 'save', ask: null, fresh: null, message: null, onLoaded: null, onClose: null };

/** Het scherm Opslaan (vanuit het pauzemenu): kies een van de drie plekken. */
export function showSaveScreen() {
  view = { mode: 'save', ask: null, fresh: null, message: null, onLoaded: null, onClose: null };
  draw();
}

/**
 * Het scherm Laden: de automatische opslag en de drie plekken. `message`: een foutmelding die meteen bovenaan
 * staat (bijvoorbeeld als "Verder spelen" niet lukte).
 */
export function showLoadScreen({ onLoaded = null, onClose = null, message = null } = {}) {
  const note = message ? { kind: 'bad', text: message } : null;
  view = { mode: 'load', ask: null, fresh: null, message: note, onLoaded, onClose };
  draw();
}

const inGame = () => $('#title').hidden && G && !G.over;
const slotNumber = id => (id === AUTO_SLOT ? ico('↻') : id);
const clickWord = () => (TOUCH ? 'Tik' : 'Klik');

/** Een lege plek. Bij opslaan kun je er meteen op klikken. */
function emptyCardHTML(id) {
  const body = `<span class="slotnum">${slotNumber(id)}</span><span class="slotbody"><b>Leeg</b>`;
  if (view.mode === 'save')
    return `<div class="slot empty"><button class="slotmain" data-slot="${id}">${body}<small>${clickWord()} om hier op te slaan</small></span></button></div>`;
  const why = id === AUTO_SLOT ? 'Nog niets automatisch opgeslagen' : 'Hier heb je nog niets opgeslagen';
  return `<div class="slot empty"><div class="slotmain">${body}<small>${why}</small></span></div></div>`;
}

/** Een plek met een opslag: stad, volk, tijdperk, dag, tijdlijn en wanneer opgeslagen. */
function cardHTML(id, meta) {
  const action = view.mode === 'save' ? 'overschrijven' : 'laden';
  const won = meta.won ? ' <i class="slotwon">gewonnen</i>' : '';
  return `<div class="slot${view.fresh === id ? ' fresh' : ''}">
    <button class="slotmain" data-slot="${id}" aria-label="${slotName(id)}: ${slotTitle(meta)}, ${slotSummary(meta)}. ${clickWord()} om te ${action}.">
      <span class="slotnum">${slotNumber(id)}</span>
      <span class="slotbody"><b>${slotTitle(meta)}${won}</b><small>${slotSummary(meta)}</small>${ageTimeline(meta.age)}</span>
      <span class="slottime"><b>${savedAtText(meta.at)}</b><small>${slotLabel(id)}</small></span>
    </button>
    <button class="quiet slotdel" data-slot-del="${id}" title="Wissen" aria-label="${slotName(id)} wissen">${ico('✕')}</button>
  </div>`;
}

// De vragen "zeker weten?": wat er achter de plek staat en op de knop
const ASK = {
  overwrite: { verb: 'overschrijven', button: 'Overschrijven' },
  delete: { verb: 'wissen', button: 'Wissen' },
  load: { verb: 'laden', button: 'Laden' },
};

/** Wat er gebeurt als je ja zegt, in één zin. */
function askResultText(meta, kind) {
  if (kind === 'delete') return `${gameText(meta)} is daarna weg.`;
  const now = currentMeta();
  if (kind === 'load') return `Je spel nu (${gameText(now)}) staat niet op een eigen plek en is daarna weg.`;
  // Overschrijven: staat hier een eerder moment van hetzelfde spel, dan raak je niets kwijt
  if (sameGame(meta, now)) return `Hier staat ${gameText(meta)}. Die wordt vervangen door dag ${now.day}.`;
  return `Hier staat nu ${gameText(meta)}. Dat spel gaat verloren.`;
}

/** Dezelfde plek, maar nu met de vraag of het zeker is (overschrijven, wissen of laden). */
function askCardHTML(id, meta, kind) {
  const question = `${slotName(id)} ${ASK[kind].verb}?`;
  return `<div class="slot ask" role="group" aria-label="${question}">
    <span class="slotnum">${slotNumber(id)}</span>
    <span class="slotbody"><b>${question}</b><small>${askResultText(meta, kind)}</small></span>
    <span class="slotask">
      <button class="primary" data-slot-yes="${id}">${ASK[kind].button}</button>
      <button data-slot-no>Nee</button>
    </span>
  </div>`;
}

/** Bovenaan het laadscherm: wat er met je spel van nu gebeurt. */
function loadIntroText() {
  if (liveGameAtRisk()) {
    const how = inGame() ? 'onder Opslaan in het menu' : 'via Verder spelen → Menu → Opslaan';
    return `Je spel nu (${gameText(currentMeta())}) staat niet op een eigen plek. Laad je een ander spel, dan is het daarna weg. Bewaar het eerst ${how}.`;
  }
  return inGame() ? 'Wat je sinds je laatste opslag deed, gaat verloren.' : '';
}

/** Onder het opslaanscherm: wanneer het spel zelf voor het laatst opsloeg. */
function autoLineHTML(auto) {
  if (!SET.autosave)
    return 'Automatisch opslaan staat uit (Instellingen → Spel). Bij Hoofdmenu slaat het spel wel op.';
  // Een opslag uit een eerdere versie heeft geen tijd: dan alleen de dag
  const last = !auto ? 'nog niet' : auto.at ? `${savedAtText(auto.at)}, dag ${auto.day}` : `dag ${auto.day}`;
  return `Automatisch opgeslagen: ${last}. Dat gebeurt elke minuut.`;
}

function draw() {
  const slots = listSlots();
  const saving = view.mode === 'save';
  const ids = saving ? MANUAL_SLOTS : SLOTS;
  const cards = ids.map(id => {
    const meta = slots[id];
    if (!meta) return emptyCardHTML(id);
    if (view.ask && view.ask.id === id) return askCardHTML(id, meta, view.ask.kind);
    return cardHTML(id, meta);
  });
  let intro = '';
  if (saving) {
    const now = currentMeta();
    intro = `<p class="slotintro">Je spel nu: <b>${slotTitle(now)}</b> · ${slotSummary(now)}</p>`;
  } else {
    const text = loadIntroText();
    if (text) intro = `<p class="slotintro">${text}</p>`;
  }
  const message = view.message
    ? `<p class="slotmsg ${view.message.kind}" role="status">${view.message.text}</p>`
    : '';
  const footer = saving
    ? `<p class="slotauto">${ico('↻')}<span>${autoLineHTML(slots[AUTO_SLOT])}</span></p>`
    : '';
  openModal(
    `<button class="quiet x" data-m="pause" aria-label="Terug">${ico('✕')}</button>
    <div class="eyebrow">${saving ? 'Opslaan' : 'Laden'}</div><h1>${saving ? 'Kies een plek' : 'Welk spel wil je laden?'}</h1>
    ${intro}
    ${message}
    <div class="slots">${cards.join('')}</div>
    ${footer}
    <div class="row"><button class="primary" data-m="pause">Terug</button></div>`,
    { cls: 'slotsheet', onClose: view.onClose },
  );
  view.fresh = null; // het oplichten van een net opgeslagen plek gebeurt maar één keer
}

/** Opslaan op een plek, met een melding of het lukte. */
function writeSlot(id) {
  const error = saveToSlot(id);
  if (error) {
    view.message = { kind: 'bad', text: saveErrorText(error, true) };
    toast(view.message.text, 'bad');
    return;
  }
  view.fresh = id;
  view.message = { kind: 'good', text: `Opgeslagen op ${slotName(id).toLowerCase()}.` };
  sfx('done');
  toast(view.message.text, 'good');
}

/** Een plek laden. Gelukt: venster dicht en verder spelen. */
function readSlot(id) {
  const meta = listSlots()[id];
  if (!loadSlot(id)) {
    view.message = { kind: 'bad', text: 'Deze opslag kon niet geladen worden. Probeer een andere plek.' };
    toast(view.message.text, 'bad');
    return false;
  }
  const onLoaded = view.onLoaded;
  closeModalAndPlay();
  if (onLoaded) onLoaded();
  toast(`Geladen: ${slotTitle(meta)}, dag ${meta.day}.`, 'good');
  return true;
}

$('#modal').addEventListener('click', e => {
  if (!$('#sheet').classList.contains('slotsheet')) return;
  const t = e.target.closest('[data-slot],[data-slot-del],[data-slot-yes],[data-slot-no]');
  if (!t) return;
  sfx('tick');
  const d = t.dataset;
  view.message = null;
  if (d.slotNo !== undefined) view.ask = null;
  else if (d.slotDel) view.ask = { id: d.slotDel, kind: 'delete' };
  else if (d.slotYes) {
    const ask = view.ask;
    view.ask = null;
    if (ask && ask.kind === 'delete') {
      deleteSlot(ask.id);
      view.message = { kind: '', text: `${slotName(ask.id)} is gewist.` };
    } else if (ask && ask.kind === 'load') {
      if (readSlot(ask.id)) return; // het venster is al dicht
    } else if (ask) writeSlot(ask.id);
  } else if (view.mode === 'load') {
    // Raak je zo je spel van nu kwijt (het staat alleen op de automatische plek)? Dan eerst vragen.
    if (liveGameAtRisk() && !sameGame(listSlots()[d.slot], currentMeta()))
      view.ask = { id: d.slot, kind: 'load' };
    else if (readSlot(d.slot)) return; // het venster is al dicht
  } else if (listSlots()[d.slot]) view.ask = { id: d.slot, kind: 'overwrite' };
  else writeSlot(d.slot);
  draw();
});
