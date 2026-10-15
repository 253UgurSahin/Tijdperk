// Volken in de interface: kaarten om je volk te kiezen, het vaandel, en wat je volk goed kan.
import { store } from '../core/store.js';
import { SET } from '../core/settings.js';
import { sfx } from '../audio/sound.js';
import { PEOPLE, PEOPLES, isPeopleUnlocked, startLine } from '../data/peoples.js';
import { G } from '../game/state.js';
import { ico } from './glyphs.js';
import { closeModal, openModal } from './modals.js';
import { $ } from '../util/dom.js';

/** Het spelersprofiel met prestaties. Zolang er nog geen prestaties zijn, is het leeg. */
export const playerProfile = () => store.profile || {};

/** Vaandel in de kleur van het volk, met zijn teken erop. `size`: 'sm' (klein) of 'lg' (groot). */
export const bannerHTML = (people, size = '') =>
  `<span class="banner ${size}" style="--flag:${people.c}" aria-hidden="true">${ico(people.g)}</span>`;

// Wat een volk goed kan, als losse regels (met het startvoordeel als laatste, als dat gevraagd is)
function linesHTML(people, withStart = true) {
  const start = withStart ? startLine(people.k) : '';
  return (
    people.d.map(line => `<span class="fl">${line}</span>`).join('') +
    (start ? `<span class="fl fstart">${start}</span>` : '')
  );
}

/** Eén kaart in de kiezer: vaandel, naam, motto, voordelen, en of hij op slot zit. */
function cardHTML(people, chosen, profile) {
  const open = isPeopleUnlocked(people.k, profile);
  const cls = ['folk', chosen && 'on', !open && 'locked'].filter(Boolean).join(' ');
  const state = !open
    ? `<span class="fstate lock">${ico('⚿')}Op slot · ${people.locked.text}</span>`
    : chosen
      ? `<span class="fstate pick">${ico('✓')}Gekozen</span>`
      : '';
  return `<button class="${cls}" data-folk="${people.k}" style="--flag:${people.c}" aria-pressed="${chosen}"${open ? '' : ' aria-disabled="true"'}>
    ${bannerHTML(people)}
    <span class="fhead"><b>${people.n}</b><i>${people.motto}</i></span>
    <span class="flines">${linesHTML(people)}</span>
    ${state}
  </button>`;
}

// Wat er gebeurt als je in de kiezer een volk kiest (dat zegt het titelscherm)
let onPick = null;
let current = null;
let closeTimer = 0;

const gridHTML = () => {
  const profile = playerProfile();
  return PEOPLES.map(people => cardHTML(people, people.k === current, profile)).join('');
};

/** Open de kiezer met alle volken. `pick(k)` wordt aangeroepen met het gekozen volk. */
export function showPeoplePicker(chosen, pick) {
  clearTimeout(closeTimer);
  current = chosen;
  onPick = pick;
  const locked = PEOPLES.filter(people => !isPeopleUnlocked(people.k, playerProfile())).length;
  const unlockTip = locked ? ` Volken met een slotje speel je vrij met de opdracht op hun kaart.` : '';
  openModal(
    `<button class="quiet x" data-m="close" aria-label="Sluiten">${ico('✕')}</button>
    <div class="eyebrow">Nieuwe wereld</div><h1>Kies je volk</h1>
    <p>Elk volk heeft eigen voordelen, het hele spel lang.${unlockTip}</p>
    <div class="folkgrid">${gridHTML()}</div>`,
    { cls: 'folksheet' },
  );
}

function choose(card) {
  const k = card.dataset.folk;
  if (!isPeopleUnlocked(k, playerProfile())) {
    // Op slot: de kaart schudt even "nee"
    sfx('bad');
    card.classList.remove('nope');
    void card.offsetWidth; // zo begint de animatie opnieuw
    card.classList.add('nope');
    return;
  }
  sfx('select');
  current = k;
  $('#sheet .folkgrid').innerHTML = gridHTML();
  const pick = onPick;
  onPick = null;
  if (pick) pick(k);
  // Even laten zien welke kaart je koos, dan terug naar het titelscherm.
  // Alleen als de kiezer nog open is: anders zou je net een ander venster dichtdoen.
  closeTimer = setTimeout(
    () => {
      if (!$('#modal').hidden && $('#sheet').classList.contains('folksheet')) closeModal();
    },
    SET.motion ? 280 : 0,
  );
}

$('#modal').addEventListener('click', e => {
  const card = e.target.closest('[data-folk]');
  if (card && onPick) choose(card);
});

/** Knop op het titelscherm: welk volk je nu hebt gekozen, klik om te wisselen. */
export function peoplePickHTML(k) {
  const people = PEOPLE[k];
  return `<button class="folkpick" data-t="people" style="--flag:${people.c}" aria-label="Volk: ${people.n}. Kies een ander volk">
    ${bannerHTML(people, 'sm')}
    <span class="fp"><b>${people.n}</b><small>${people.motto}</small></span>
    <span class="fchg">Kies</span>
  </button>`;
}

/** Je volk in het pauzescherm: vaandel, naam en wat het goed kan. */
export function peopleBarHTML() {
  const people = PEOPLE[G.people];
  return `<div class="folkbar" style="--flag:${people.c}">
    ${bannerHTML(people)}
    <div><b>${people.n}</b> <i>${people.motto}</i><span class="flines">${linesHTML(people, false)}</span></div>
  </div>`;
}

/** Venster met je volk en zijn voordelen (vanuit het overzicht onderin). */
export function showPeopleInfo() {
  const people = PEOPLE[G.people];
  openModal(
    `<button class="quiet x" data-m="close" aria-label="Sluiten">${ico('✕')}</button>
    <div class="eyebrow">Je volk</div>
    <div style="--flag:${people.c}">
      <div class="folkinfo">${bannerHTML(people, 'lg')}<div><h1>${people.n}</h1><p>${people.motto}</p></div></div>
      <div class="flines big">${linesHTML(people)}</div>
    </div>
    <div class="row"><button class="primary" data-m="close">Terug naar het spel</button></div>`,
  );
}
