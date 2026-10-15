// Het nieuw-spelscherm: kies je volk, moeilijkheid, kaart, zaadcode en hoe je wint. Daarna begint de wereld.
import { sfx } from '../audio/sound.js';
import { H, W } from '../config.js';
import { DIFFICULTIES, cleanDiff } from '../data/difficulty.js';
import { MAP, MAPS, cleanMap } from '../data/maps.js';
import { PLACES } from '../data/names.js';
import { DEFAULT_PEOPLE, PEOPLE, isPeopleUnlocked } from '../data/peoples.js';
import { SELECTABLE_VICTORIES, VICTORY, cleanVictories } from '../data/victories.js';
import { G } from '../game/state.js';
import { esc } from './format.js';
import { ico } from './glyphs.js';
import { peoplePickHTML, playerProfile, showPeoplePicker } from './peoples.js';
import { cleanCode, codeFromSeed, randomSeed, seedFromCode } from '../util/seedcode.js';
import { BIOME, generateWorld } from '../world/generate.js';

// Je laatste keuzes (zonder zaadcode) blijven bewaard in de browser, voor de volgende nieuwe wereld
const KEY = 'tijdperken-nieuwe-wereld';
function rememberedChoices() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  } catch (e) {
    return {};
  }
}
function rememberChoices(draft) {
  const { people, diff, map, victories } = draft;
  try {
    localStorage.setItem(KEY, JSON.stringify({ people, diff, map, victories }));
  } catch (e) {}
}

/**
 * De keuzes waarmee het scherm opent: wat je de vorige keer koos, met een nieuwe zaadcode.
 * Met `keepCode` houden we de code van de wereld die nu achter het titelscherm ligt.
 */
export function newGameDraft(keepCode = false) {
  // Een uitdaging heeft haar eigen instellingen (zoals Zwaar of een vast volk): die nemen we niet over
  const plainGame = !!G && !G.scenario;
  const last = { ...(plainGame ? G.opts : {}), ...rememberedChoices() };
  const people =
    PEOPLE[last.people] && isPeopleUnlocked(last.people, playerProfile()) ? last.people : DEFAULT_PEOPLE;
  return {
    people,
    // Wat ontbreekt of niet meer bestaat, wordt de standaard (Normaal, continent, de sterrenpoort)
    diff: cleanDiff(last.diff),
    map: cleanMap(last.map),
    victories: cleanVictories(last.victories),
    code: keepCode && plainGame ? G.opts.seedCode : codeFromSeed(randomSeed()),
  };
}

// ---- Onderdelen van het scherm ----

/** Kopje boven een onderdeel, met eventueel een korte toelichting rechts. */
const label = (text, note = '') => `<div class="ngl">${text}${note ? `<span>${note}</span>` : ''}</div>`;

function diffHTML(draft) {
  const buttons = DIFFICULTIES.map(
    (d, i) =>
      `<button class="${i === draft.diff ? 'on' : ''}" data-diff="${i}" aria-pressed="${i === draft.diff}">
        <b>${d.n}</b><small>${d.d}</small><span class="dscore">score ×${String(d.score).replace('.', ',')}</span>
      </button>`,
  ).join('');
  return `<section class="ng-diff">${label('Moeilijkheid')}<div class="diff four">${buttons}</div></section>`;
}

function mapHTML(draft) {
  const tiles = MAPS.map(
    m =>
      `<button class="ngtile ${m.k === draft.map ? 'on' : ''}" data-map="${m.k}" aria-pressed="${m.k === draft.map}">${ico(m.g)}<b>${m.n}</b></button>`,
  ).join('');
  return `<section class="ng-map">${label('Kaart')}<div class="ngtiles">${tiles}</div>
    <p class="nghint">${MAP[draft.map].d}.</p></section>`;
}

/** Tekst onder de zaadcode: wat hij doet, of wat er mis is. */
const seedHint = ok =>
  ok
    ? 'Zelfde code en kaart = dezelfde wereld. Deel hem met een vriend.'
    : 'Na TP- komen 4 tot 6 letters of cijfers, zoals TP-7K2Q.';

/** De zaadcode met een kaartje van de wereld die eruit groeit. */
function atlasHTML(draft) {
  const seed = seedFromCode(draft.code);
  const ok = seed !== null;
  const place = ok ? PLACES[seed % PLACES.length] : '';
  return `<section class="ng-atlas">
    <div class="ngmap ${ok ? '' : 'empty'}">
      <canvas width="${W}" height="${H}" aria-label="Kaartje van je wereld"></canvas>
      <span class="ngplace">${ok ? `${ico('⚑')}${place}` : 'Geen geldige code'}</span>
    </div>
    <div class="ngseed">
      ${label('Zaadcode')}
      <div class="seedrow">
        <input id="ngSeed" class="${ok ? '' : 'bad'}" value="${esc(draft.code)}" maxlength="10" spellcheck="false"
          autocomplete="off" autocapitalize="characters" aria-label="Zaadcode" aria-invalid="${!ok}" />
        <button data-ng="dice" title="Willekeurige wereld">${ico('⚄')}<span>Willekeurig</span></button>
      </div>
      <p class="nghint ${ok ? '' : 'warn'}" id="ngSeedHint">${seedHint(ok)}</p>
    </div>
  </section>`;
}

function victoriesHTML(draft) {
  const rows = SELECTABLE_VICTORIES.map(v => {
    const on = draft.victories.includes(v.k);
    return `<button class="vic ${on ? 'on' : ''}" data-vic="${v.k}" role="checkbox" aria-checked="${on}">
      <span class="vbox">${on ? ico('✓') : ''}</span>
      <span class="vic-ic">${ico(v.g)}</span>
      <span class="vtxt"><b>${v.n}</b><small>${v.d}</small></span>
      <span class="vlen">${v.len}</span>
    </button>`;
  }).join('');
  return `<section class="ng-win">${label('Winnen', 'wat het eerst lukt')}<div class="vics">${rows}</div>
    <p class="nghint" id="ngWinHint">${winNotes(draft).join(' ')}</p></section>`;
}

/** Korte opmerkingen onder "Winnen", alleen als een keuze iets betekent wat je niet meteen ziet. */
function winNotes(draft) {
  const notes = [];
  const stargate = draft.victories.includes('stargate');
  const short = draft.victories.some(k => !VICTORY[k].full);
  if (!stargate) notes.push('Zonder de sterrenpoort tellen prestaties voor winnen niet mee.');
  else if (short)
    notes.push(
      'Prestaties voor winnen tellen alleen met de sterrenpoort. Na een kort doel kun je daarvoor doorspelen.',
    );
  // Op Vredig komt er niemand: dan is overleven alleen wachten
  if (DIFFICULTIES[draft.diff].peaceful && draft.victories.includes('survive'))
    notes.push('Op Vredig komen geen aanvallen: overleven is dan alleen wachten.');
  return notes;
}

function setupHTML(draft) {
  const ok = seedFromCode(draft.code) !== null;
  // Met komma's: op een telefoon loopt dit door op een tweede regel, zonder los puntje aan het eind
  const summary = `${PEOPLE[draft.people].n}, ${DIFFICULTIES[draft.diff].n.toLowerCase()}, ${MAP[draft.map].n.toLowerCase()}`;
  return `<div class="tw ng">
    <div class="nghead">
      <button class="quiet ngback" data-ng="back">${ico('←')}Terug</button>
      <div class="eyebrow">Nieuwe wereld</div>
    </div>
    <h1 class="ngtitle">Stel je wereld in</h1>
    <div class="nggrid">
      <div class="ngcol">
        <section class="ng-folk">${label('Volk')}${peoplePickHTML(draft.people)}</section>
        ${diffHTML(draft)}
        ${victoriesHTML(draft)}
      </div>
      <div class="ngcol">
        ${mapHTML(draft)}
        ${atlasHTML(draft)}
      </div>
    </div>
    <button class="mbtn primary ngstart" data-ng="start" ${ok ? '' : 'disabled'}><span>Begin</span><small>${summary}</small></button>
  </div>`;
}

// ---- Kaartje van de wereld ----

// Kleuren per landschap, zoals de grond in het spel (iets feller, want het kaartje is klein)
const COLORS = {
  [BIOME.BEACH]: [196, 176, 124],
  [BIOME.GRASS]: [104, 136, 64],
  [BIOME.FOREST]: [60, 92, 46],
  [BIOME.HILLS]: [128, 122, 80],
  [BIOME.MOUNTAIN]: [146, 140, 132],
  [BIOME.DESERT]: [214, 186, 128],
  [BIOME.SALT]: [222, 222, 212],
};
// Een paar kaartjes onthouden, zodat heen en weer klikken tussen kaartsoorten meteen werkt
const previews = new Map();
let previewTimer = 0;

/** Maak een plaatje van een wereld: kleur per landschap, met wat schaduw zodat je de bergen ziet. */
function worldImage(world) {
  const img = new ImageData(W, H);
  const { biome, elev, levels } = world;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c;
      if (biome[i] === BIOME.WATER) {
        const deep = Math.min(1, Math.max(0, (levels.sea - elev[i]) / (levels.sea - levels.deep)));
        c = [70 - deep * 26, 112 - deep * 34, 128 - deep * 24];
      } else {
        // Licht van linksboven: een helling naar het licht toe is lichter
        const up = elev[Math.max(0, y - 1) * W + Math.max(0, x - 1)];
        const shade = 1 + Math.max(-0.25, Math.min(0.25, (elev[i] - up) * 9));
        c = COLORS[biome[i]].map(v => v * shade);
      }
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
  return img;
}

/** Teken het kaartje bij de huidige zaadcode en kaartsoort. Een nieuwe wereld maken duurt even. */
function paintPreview(el, draft) {
  const canvas = el.querySelector('.ngmap canvas');
  const seed = seedFromCode(draft.code);
  if (!canvas || seed === null) return;
  const key = `${seed}:${draft.map}`;
  const img = previews.get(key);
  canvas.parentElement.classList.toggle('busy', !img);
  if (img) {
    const ctx = canvas.getContext('2d');
    ctx.putImageData(img, 0, 0);
    // Je startplek: een ring in het midden
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#2b2520';
    ctx.fillStyle = '#fcf7ec';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  clearTimeout(previewTimer);
  // Pas na een korte pauze: wie een code typt, wil niet bij elke letter wachten
  previewTimer = setTimeout(() => {
    // Niet meer nodig als je het scherm al verliet of de code intussen niet meer klopt
    const now = seedFromCode(draft.code);
    if (now === null || el.hidden || !el.querySelector('.ngmap canvas')) return;
    const nowKey = `${now}:${draft.map}`;
    if (!previews.has(nowKey)) previews.set(nowKey, worldImage(generateWorld(now, W, H, draft.map)));
    if (previews.size > 12) previews.delete(previews.keys().next().value);
    paintPreview(el, draft);
  }, 280);
}

// ---- Het scherm zelf ----

/**
 * Laat het nieuw-spelscherm zien in het titelscherm `el`. `draft` zijn de keuzes (zie newGameDraft).
 * `onBack()`: terug naar het hoofdmenu. `onStart(opts)`: begin de wereld met deze keuzes.
 */
export function showNewGame(el, draft, { onBack, onStart }) {
  const draw = () => {
    el.innerHTML = setupHTML(draft);
    paintPreview(el, draft);
  };
  // Na het typen: Begin aan of uit, en de tekst eronder bijwerken (zonder alles opnieuw te tekenen)
  const codeTyped = () => {
    const ok = seedFromCode(draft.code) !== null;
    const input = el.querySelector('#ngSeed');
    input.classList.toggle('bad', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    el.querySelector('.ngstart').disabled = !ok;
    const hint = el.querySelector('#ngSeedHint');
    hint.classList.toggle('warn', !ok);
    hint.textContent = seedHint(ok);
    if (ok) {
      const seed = seedFromCode(draft.code);
      el.querySelector('.ngplace').innerHTML = `${ico('⚑')}${PLACES[seed % PLACES.length]}`;
    }
    el.querySelector('.ngmap').classList.toggle('empty', !ok);
    paintPreview(el, draft);
  };
  const start = () => {
    const seed = seedFromCode(draft.code);
    if (seed === null) return;
    rememberChoices(draft);
    onStart({ seed, people: draft.people, diff: draft.diff, map: draft.map, victories: draft.victories });
  };
  draw();
  el.onclick = e => {
    const t = e.target.closest('button');
    if (!t) return;
    const ng = t.dataset.ng;
    if (ng === 'start') {
      sfx('select');
      start();
      return;
    }
    sfx('tick');
    if (ng === 'back') onBack();
    else if (ng === 'dice') {
      draft.code = codeFromSeed(randomSeed());
      draw();
    } else if (t.dataset.t === 'people')
      showPeoplePicker(draft.people, k => {
        draft.people = k;
        draw();
      });
    else if (t.dataset.diff !== undefined) {
      draft.diff = +t.dataset.diff;
      draw();
    } else if (t.dataset.map) {
      draft.map = t.dataset.map;
      draw();
    } else if (t.dataset.vic) toggleVictory(el, draft, t, draw);
  };
  el.oninput = e => {
    if (e.target.id !== 'ngSeed') return;
    draft.code = e.target.value;
    codeTyped();
  };
  // Klaar met typen: de code netjes schrijven ("tp 7k2q" wordt "TP-7K2Q")
  el.onchange = e => {
    if (e.target.id !== 'ngSeed') return;
    const clean = cleanCode(draft.code);
    if (clean) e.target.value = draft.code = clean;
  };
  el.onkeydown = e => {
    if (e.target.id === 'ngSeed' && e.key === 'Enter') start();
  };
}

/** Een manier om te winnen aan of uit. De laatste mag niet uit: er moet altijd een doel zijn. */
function toggleVictory(el, draft, tile, draw) {
  const k = tile.dataset.vic;
  if (!draft.victories.includes(k)) {
    draft.victories = cleanVictories([...draft.victories, k]);
    draw();
    return;
  }
  if (draft.victories.length > 1) {
    draft.victories = draft.victories.filter(v => v !== k);
    draw();
    return;
  }
  // De laatste: even "nee" schudden en zeggen waarom
  sfx('bad');
  tile.classList.remove('nope');
  void tile.offsetWidth; // zo begint de animatie opnieuw
  tile.classList.add('nope');
  const hint = el.querySelector('#ngWinHint');
  hint.textContent = 'Kies minstens één manier om te winnen.';
  hint.classList.add('warn');
}
