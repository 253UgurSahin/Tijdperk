// Profielscherm: al je prestaties (ook die nog op slot zitten), je beste scores en je laatste spellen.
import { sfx } from '../audio/sound.js';
import { getProfile, resetProfile } from '../core/profile.js';
import { AGES } from '../data/ages.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATS, AGE_BUILDINGS } from '../data/achievements.js';
import { B } from '../data/buildings.js';
import { PEOPLE, PEOPLES, isPeopleUnlocked } from '../data/peoples.js';
import { DIFF_NAMES, MEDALS, medalFor } from '../data/score.js';
import { achievementIcon, medalHTML, scoreText } from './achievements.js';
import { ico } from './glyphs.js';
import { closeModal, openModal } from './modals.js';
import { bannerHTML } from './peoples.js';
import { $ } from '../util/dom.js';

/** Hoeveel prestaties je hebt, van hoeveel. */
export function achievementCount(profile = getProfile()) {
  const have = (profile && profile.achievements) || {};
  return { got: ACHIEVEMENTS.filter(a => have[a.k]).length, total: ACHIEVEMENTS.length };
}

// Datum kort en in het Nederlands, zoals "15 okt. 2026"
const dateText = at =>
  typeof at === 'number'
    ? new Date(at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

// Bij "Bouwmeester": welke gebouwen nieuw zijn in de Middeleeuwen en later (de Middeleeuwen staan erbij als voorbeeld)
const MIN_BUILDER_AGE = 3;
function builderHTML() {
  const names = age => AGE_BUILDINGS[age].map(k => B[k].n).join(', ');
  const allAges = [];
  for (let age = MIN_BUILDER_AGE; age < AGE_BUILDINGS.length; age++) {
    if (AGE_BUILDINGS[age]) allAges.push(`${AGES[age].n}: ${names(age)}`);
  }
  return `<small class="achhint" title="${allAges.join('\n')}">Bijv. ${AGES[MIN_BUILDER_AGE].n}: ${names(MIN_BUILDER_AGE)}</small>`;
}

/** Eén prestatie als kaartje. Op slot: grijs. Geheim en op slot: ??? */
function cardHTML(a, at) {
  const open = !!at;
  const secret = a.hidden && !open;
  const people = a.unlocks && PEOPLE[a.unlocks.people];
  let unlock = '';
  if (people) {
    const unlockText = open ? `${people.n} vrijgespeeld` : `Speelt ${people.n} vrij`;
    unlock = `<span class="achunl">${bannerHTML(people, 'xs')}${unlockText}</span>`;
  }
  const hint = a.k === 'builder' ? builderHTML() : '';
  const cls = ['ach', open ? 'got' : 'lock', secret && 'secret'].filter(Boolean).join(' ');
  return `<div class="${cls}">
    ${achievementIcon(a, open)}
    <div class="achtx">
      <b>${secret ? '???' : a.n}</b>
      <span>${secret ? 'Geheime prestatie: je ziet pas wat het is als je hem haalt' : a.d}</span>
      ${hint}
      ${unlock}
      ${open ? `<small class="achdate">${ico('✓')}${dateText(at) || 'Gehaald'}</small>` : ''}
    </div>
  </div>`;
}

/** Bovenaan: vier tegels met de belangrijkste getallen. */
function statsHTML(profile) {
  const { got, total } = achievementCount(profile);
  const best = profile.best.score;
  const medal = medalFor(best);
  const pct = Math.round((got / total) * 100);
  return `<div class="profstats">
    <div class="pstile"><small>Gespeeld</small><b>${profile.games}</b></div>
    <div class="pstile"><small>Gewonnen</small><b>${profile.wins}</b></div>
    <div class="pstile"><small>Beste score</small><b>${best ? scoreText(best) : '–'}${medal ? medalHTML(medal.k) : ''}</b></div>
    <div class="pstile wide"><small>Prestaties</small><b>${got} <i>/ ${total}</i></b>
      <span class="pbar" role="progressbar" aria-valuenow="${got}" aria-valuemin="0" aria-valuemax="${total}" aria-label="Prestaties gehaald"><span style="width:${pct}%"></span></span></div>
  </div>`;
}

/** Beste score per volk en per moeilijkheid. */
function bestHTML(profile) {
  const perPeople = PEOPLES.map(people => {
    const score = profile.best.perPeople[people.k];
    const open = isPeopleUnlocked(people.k, profile);
    // Een score als je er een hebt, anders een streepje, of een slotje als het volk nog op slot zit
    let scoreLabel = '–';
    if (score) scoreLabel = scoreText(score);
    else if (!open) scoreLabel = ico('⚿');
    const tip = open ? '' : 'Op slot · ' + people.locked.text;
    return `<div class="pbest ${open ? '' : 'locked'}" style="--flag:${people.c}" title="${tip}">
      ${bannerHTML(people, 'sm')}<span><small>${people.n}</small><b>${scoreLabel}</b></span>
    </div>`;
  }).join('');
  const perDiff = DIFF_NAMES.map((name, i) => {
    const score = profile.best.perDiff[i];
    return `<div class="pbest diff"><span><small>${name}</small><b>${score ? scoreText(score) : '–'}</b></span></div>`;
  }).join('');
  return `<div class="sect">Beste score <span>per volk en per moeilijkheid</span></div>
    <div class="pbests">${perPeople}</div><div class="pbests three">${perDiff}</div>`;
}

/** Je laatste spellen als lijstje. */
function recentHTML(profile) {
  if (!profile.recent.length)
    return '<div class="sect">Laatste spellen</div><p class="endnone">Nog geen spel uitgespeeld. Win of verlies een spel om hier je score te zien.</p>';
  const rows = profile.recent
    .map(game => {
      const people = PEOPLE[game.people];
      const age = AGES[game.age] || AGES[0];
      const diffName = game.peaceful ? 'Vredige modus' : DIFF_NAMES[game.diff] || '';
      return `<tr>
        <td><span class="rfolk">${people ? bannerHTML(people, 'xs') + people.n : ''}</span></td>
        <td>${game.won ? '<b class="won">Gewonnen</b>' : 'Gevallen'} · ${age.n}</td>
        <td>${diffName} · dag ${game.day}</td>
        <td class="pts">${scoreText(game.score)}</td>
        <td>${medalHTML(game.medal)}</td>
      </tr>`;
    })
    .join('');
  return `<div class="sect">Laatste spellen <span>nieuwste eerst</span></div>
    <table class="recent"><tbody>${rows}</tbody></table>`;
}

/** Alle prestaties, per groep, met hoeveel je er van die groep hebt. */
function listHTML(profile) {
  const have = profile.achievements;
  return Object.entries(ACHIEVEMENT_CATS)
    .map(([cat, name]) => {
      const list = ACHIEVEMENTS.filter(a => a.cat === cat);
      const got = list.filter(a => have[a.k]).length;
      return `<div class="sect">${name} <span>${got} / ${list.length}</span></div>
        <div class="achgrid">${list.map(a => cardHTML(a, have[a.k])).join('')}</div>`;
    })
    .join('');
}

// Hoe het profielscherm geopend werd, zodat het na "Profiel wissen" op dezelfde manier terugkomt
let profileOptions = {};

/**
 * Open het profielscherm.
 * `back`: wat er gebeurt bij "Terug" of "Klaar" (bijv. terug naar het pauzemenu); zonder gaat het venster dicht.
 * `onClose`: draait als het venster dichtgaat, ook met Esc of een klik ernaast.
 */
export function showProfile({ back = null, onClose = null } = {}) {
  profileOptions = { back, onClose };
  const profile = getProfile();
  const medals = MEDALS.map(m => `<span>${medalHTML(m.k)} ${m.n} vanaf ${scoreText(m.min)}</span>`).join('');
  openModal(
    `<button class="quiet x" data-prof="back" aria-label="Terug">${ico('✕')}</button>
    <div class="eyebrow">Jouw profiel</div><h1>Prestaties</h1>
    <p>Prestaties en scores blijven bewaard, ook als je een nieuwe wereld begint. Aantallen tellen per spel. Met sommige prestaties speel je een nieuw volk vrij.</p>
    ${statsHTML(profile)}
    ${bestHTML(profile)}
    <p class="medalkey">${medals}</p>
    ${listHTML(profile)}
    ${recentHTML(profile)}
    <div class="row"><button class="primary" data-prof="back">Klaar</button><button class="quiet" data-prof="reset">Profiel wissen</button></div>`,
    { cls: 'profsheet', onClose },
  );
}

$('#modal').addEventListener('click', e => {
  const t = e.target.closest('[data-prof]');
  if (!t) return;
  sfx('tick');
  if (t.dataset.prof === 'back') {
    if (profileOptions.back) profileOptions.back();
    else closeModal();
  } else if (t.dataset.prof === 'reset') {
    // Twee keer klikken, zodat je niet per ongeluk alles kwijtraakt
    t.dataset.prof = 'resetok';
    t.textContent = 'Zeker? Alles gaat weg';
    t.classList.add('danger-t');
  } else if (t.dataset.prof === 'resetok') {
    resetProfile();
    showProfile(profileOptions);
  }
});
