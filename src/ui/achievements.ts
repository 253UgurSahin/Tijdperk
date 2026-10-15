// Prestaties in beeld: het kaartje dat even verschijnt als je er een haalt, en de pictogrammen en medailles.
import { sfx } from '../audio/sound';
import { AGES } from '../data/ages';
import { PEOPLE } from '../data/peoples';
import { MEDALS } from '../data/score';
import { ico } from './glyphs';
import { bannerHTML } from './peoples';
import { $ } from '../util/dom';

/** Pictogram van een prestatie: een kraal voor een tijdperk, een vaandel voor een volk, anders een teken. */
export function achievementIcon(a, open = true) {
  if (!open && a.hidden) return `<span class="achic">${ico('?')}</span>`;
  if (a.age != null)
    return `<span class="achic bead" style="--c:${AGES[a.age].acc}"><span>${AGES[a.age].r}</span></span>`;
  if (a.people) return `<span class="achic flag">${bannerHTML(PEOPLE[a.people], 'sm')}</span>`;
  return `<span class="achic">${ico(a.g)}</span>`;
}

/** Een score voluit, met punten voor duizendtallen: 10730 wordt "10.730". */
export const scoreText = n => Math.round(n).toLocaleString('nl-NL');

/** Een medaille (brons, zilver of goud) als rond plaatje met een lintje. `size`: '' of 'lg'. */
export function medalHTML(k, size = '') {
  const medal = MEDALS.find(m => m.k === k);
  if (!medal) return '';
  return `<span class="medal ${medal.k} ${size}" title="${medal.n}" aria-label="Medaille: ${medal.n}"><span>${ico('★')}</span></span>`;
}

// ---- het kaartje bovenin het scherm ----

// Kaartjes die nog moeten verschijnen; ze komen één voor één
const queue = [];
let showing = false;

const box = document.createElement('div');
box.id = 'achv';
box.setAttribute('role', 'status');
box.setAttribute('aria-live', 'polite');
$('#notes').prepend(box);

/** Laat een behaalde prestatie zien. `people` is het volk dat je ermee vrijspeelt (of niets). */
export function showAchievement(a, people) {
  queue.push({ a, people });
  if (!showing) showNext();
}

function showNext() {
  // Staat er een venster open (zoals een zegening) of het titelscherm, dan wacht het kaartje tot dat weg is.
  // Anders loopt de tijd van het kaartje af terwijl je het niet kunt zien.
  if (queue.length && (!$('#modal').hidden || !$('#title').hidden)) {
    showing = true;
    box.innerHTML = '';
    setTimeout(showNext, 300);
    return;
  }
  const next = queue.shift();
  if (!next) {
    showing = false;
    box.innerHTML = '';
    return;
  }
  showing = true;
  const { a, people } = next;
  const extra = people
    ? `<span class="achnew">${bannerHTML(people, 'xs')}Nieuw volk vrijgespeeld: <b>${people.n}</b></span>`
    : '';
  box.innerHTML = `<div class="achpop">
    ${achievementIcon(a)}
    <div class="achtx"><small>Prestatie behaald</small><b>${a.n}</b><span>${a.d}</span>${extra}</div>
  </div>`;
  sfx('achieve'); // elk kaartje zijn eigen klokje
  // Staan er nog meer klaar (bijv. na het laden van een oud spel), dan gaan ze sneller voorbij
  const time = queue.length > 1 ? 2200 : 4200;
  setTimeout(() => {
    box.firstElementChild?.classList.add('out');
    setTimeout(showNext, 260);
  }, time);
}

/**
 * Alle kaartjes weghalen, ook die nog moesten komen. Het eindscherm doet dit: dat laat alle nieuwe
 * prestaties van dit spel zelf al zien. Geeft het aantal kaartjes dat nog niet te zien was geweest.
 */
export function clearAchievementCards() {
  const unseen = queue.length;
  queue.length = 0;
  box.innerHTML = '';
  return unseen;
}
