// Het nieuw-spelscherm: kies je volk, moeilijkheid, kaart, zaadcode, rivalen en hoe je wint. Daarna begint de wereld.
import type { NewGameOptions } from '../types';
import { sfx } from '../audio/sound';
import { H, W } from '../config';
import { nextAttackDay, relText, relationLabel, startRel } from '../data/diplomacy';
import { DIFFICULTIES, cleanDiff } from '../data/difficulty';
import { MAP, MAPS, cleanMap } from '../data/maps';
import { PLACES } from '../data/names';
import { DEFAULT_PEOPLE, PEOPLE, isPeopleUnlocked } from '../data/peoples';
import { SELECTABLE_VICTORIES, VICTORY, cleanVictories, victoryAllowed } from '../data/victories';
import { DEFAULT_RIVALS, MAX_RIVALS, PERSONALITY, RIVAL, cleanRivalCount, rivalLineup } from '../data/rivals';
import { pickRivalSites, type RivalSite } from '../world/rivalsites';
import { G } from '../game/state';
import { esc } from './format';
import { ico } from './glyphs';
import { bannerHTML, peoplePickHTML, playerProfile, showPeoplePicker } from './peoples';
import { cleanCode, codeFromSeed, randomSeed, seedFromCode } from '../util/seedcode';
import { BIOME, generateWorld, type GeneratedWorld } from '../world/generate';

/** De keuzes op het nieuw-spelscherm: volk, moeilijkheid, kaart, doelen, rivalen en zaadcode. */
export interface NewGameDraft {
  people: string;
  diff: number;
  map: string;
  victories: string[];
  rivals: number;
  code: string;
}
/** Wat we van de vorige keer onthielden. Kan uit oude opslag komen: newGameDraft kijkt alles na. */
type RememberedChoices = Partial<Omit<NewGameDraft, 'code'>>;

// Je laatste keuzes (zonder zaadcode) blijven bewaard in de browser, voor de volgende nieuwe wereld
const KEY = 'tijdperken-nieuwe-wereld';
function rememberedChoices(): RememberedChoices {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  } catch (e) {
    return {};
  }
}
function rememberChoices(draft: NewGameDraft) {
  const { people, diff, map, victories, rivals } = draft;
  try {
    localStorage.setItem(KEY, JSON.stringify({ people, diff, map, victories, rivals }));
  } catch (e) {}
}

/**
 * De keuzes waarmee het scherm opent: wat je de vorige keer koos, met een nieuwe zaadcode.
 * Met `keepCode` houden we de code van de wereld die nu achter het titelscherm ligt.
 */
export function newGameDraft(keepCode = false): NewGameDraft {
  // Een uitdaging heeft haar eigen instellingen (zoals Zwaar of een vast volk): die nemen we niet over
  const plainGame = !!G && !G.scenario;
  const remembered = rememberedChoices();
  const last = { ...(plainGame ? G.opts : {}), ...remembered };
  // Rivalen: wat je de vorige keer koos, anders één (de wereld achter het titelscherm telt niet mee)
  const rivals = Number.isInteger(remembered.rivals) ? cleanRivalCount(remembered.rivals) : DEFAULT_RIVALS;
  // Ontbreekt het volk (of bestaat het niet meer), dan is PEOPLE[...] leeg en wordt het DEFAULT_PEOPLE
  const people =
    PEOPLE[last.people!] && isPeopleUnlocked(last.people!, playerProfile()) ? last.people! : DEFAULT_PEOPLE;
  return {
    people,
    // Wat ontbreekt of niet meer bestaat, wordt de standaard (Normaal, continent, de sterrenpoort)
    diff: cleanDiff(last.diff),
    map: cleanMap(last.map),
    victories: cleanVictories(last.victories, rivals),
    rivals,
    code: keepCode && plainGame ? G.opts.seedCode : codeFromSeed(randomSeed()),
  };
}

// ---- Onderdelen van het scherm ----

/** Kopje boven een onderdeel, met eventueel een korte toelichting rechts. */
const label = (text: string, note = '') =>
  `<div class="ngl">${text}${note ? `<span>${note}</span>` : ''}</div>`;

function diffHTML(draft: NewGameDraft) {
  const buttons = DIFFICULTIES.map(
    (d, i) =>
      `<button class="${i === draft.diff ? 'on' : ''}" data-diff="${i}" aria-pressed="${i === draft.diff}">
        <b>${d.n}</b><small>${d.d}</small><span class="dscore">score ×${String(d.score).replace('.', ',')}</span>
      </button>`,
  ).join('');
  return `<section class="ng-diff">${label('Moeilijkheid')}<div class="diff four">${buttons}</div></section>`;
}

function mapHTML(draft: NewGameDraft) {
  const tiles = MAPS.map(
    m =>
      `<button class="ngtile ${m.k === draft.map ? 'on' : ''}" data-map="${m.k}" aria-pressed="${m.k === draft.map}">${ico(m.g)}<b>${m.n}</b></button>`,
  ).join('');
  return `<section class="ng-map">${label('Kaart')}<div class="ngtiles">${tiles}</div>
    <p class="nghint">${MAP[draft.map].d}.</p></section>`;
}

/** Tekst onder de zaadcode: wat hij doet, of wat er mis is. */
const seedHint = (ok: boolean) =>
  ok
    ? 'Zelfde code en kaart = dezelfde wereld. Deel hem met een vriend.'
    : 'Na TP- komen 4 tot 6 letters of cijfers, zoals TP-7K2Q.';

/** De zaadcode met een kaartje van de wereld die eruit groeit. */
function atlasHTML(draft: NewGameDraft) {
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

function victoriesHTML(draft: NewGameDraft) {
  const rows = SELECTABLE_VICTORIES.map(v => {
    const on = draft.victories.includes(v.k);
    // Verovering kan alleen met minstens één rivaal
    const allowed = victoryAllowed(v, draft.rivals);
    const why = allowed ? v.d : 'Kies eerst minstens 1 rivaal';
    return `<button class="vic ${on ? 'on' : ''}" data-vic="${v.k}" role="checkbox" aria-checked="${on}" ${allowed ? '' : 'disabled'}>
      <span class="vbox">${on ? ico('✓') : ''}</span>
      <span class="vic-ic">${ico(v.g)}</span>
      <span class="vtxt"><b>${v.n}</b><small>${why}</small></span>
      <span class="vlen">${v.len}</span>
    </button>`;
  }).join('');
  return `<section class="ng-win">${label('Winnen', 'wat het eerst lukt')}<div class="vics">${rows}</div>
    <p class="nghint" id="ngWinHint">${winNotes(draft).join(' ')}</p></section>`;
}

/** Korte opmerkingen onder "Winnen", alleen als een keuze iets betekent wat je niet meteen ziet. */
function winNotes(draft: NewGameDraft) {
  const notes: string[] = [];
  const stargate = draft.victories.includes('stargate');
  const short = draft.victories.some(k => !VICTORY[k].full);
  if (!stargate) notes.push('Zonder de sterrenpoort tellen prestaties voor winnen niet mee.');
  else if (short)
    notes.push(
      'Prestaties voor winnen tellen alleen met de sterrenpoort. Win je eerst op een andere manier, dan kun je daarvoor doorspelen.',
    );
  // Op Vredig komt er niemand: dan is overleven alleen wachten
  if (DIFFICULTIES[draft.diff].peaceful && draft.victories.includes('survive'))
    notes.push('Op Vredig komen geen aanvallen: overleven is dan alleen wachten.');
  return notes;
}

/** Hoeveel rivalen, met wie ze zijn (vast bij de zaadcode) en een korte uitleg. */
function rivalsHTML(draft: NewGameDraft) {
  const seed = seedFromCode(draft.code);
  // Een knop per aantal: Geen, 1, 2, 3
  const buttons = Array.from({ length: MAX_RIVALS + 1 }, (_, n) => n)
    .map(
      n =>
        `<button class="${n === draft.rivals ? 'on' : ''}" data-rivals="${n}" aria-pressed="${n === draft.rivals}">${n === 0 ? 'Geen' : n}</button>`,
    )
    .join('');
  const lineup = seed === null ? [] : rivalLineup(seed).slice(0, draft.rivals);
  // De relatie waarmee ze beginnen: op de zware standen lager (zie startRel in data/diplomacy.ts)
  const rel = (p: string) => startRel(p, draft.diff);
  // Per rivaal: vaandel, naam, karakter en in één zin wat dat karakter doet
  const who = lineup.map(
    ({ k, p }) =>
      `<span class="ngriv">${bannerHTML(RIVAL[k], 'xs')}<span>
        <b>${RIVAL[k].n}</b> <i>${PERSONALITY[p].n.toLowerCase()} · ${relationLabel(rel(p)).toLowerCase()} (${relText(rel(p))})</i>
        <small>${PERSONALITY[p].d}</small>
      </span></span>`,
  );
  // De eerste aanval: de vroegste dag van wie er meedoet, met de relatie waarmee ze beginnen (zie data/diplomacy.ts)
  const firstDays = lineup.map(({ p }) =>
    nextAttackDay({
      first: PERSONALITY[p].first,
      every: PERSONALITY[p].every,
      attacks: 0,
      lastAttack: 0,
      rel: rel(p),
    }),
  );
  const firstAttack = Math.max(4, firstDays.length ? Math.min(...firstDays) : 4);
  let hint = `Ze bouwen en groeien net als jij. De eerste aanval komt op zijn vroegst op dag ${firstAttack}. Hun stad staat als stip op de kaart. Met Diplomatie (paneel Leger) maak je vrienden of vijanden.`;
  if (!draft.rivals) hint = 'Alleen jij en de wildernis.';
  else if (DIFFICULTIES[draft.diff].peaceful)
    hint = 'Ze bouwen en groeien net als jij, maar op Vredig vallen ze niet aan.';
  return `<section class="ng-riv">${label('Rivalen', 'andere volken op de kaart')}
    <div class="seg rivseg">${buttons}</div>
    ${who.length ? `<div class="ngrivs">${who.join('')}</div>` : ''}
    <p class="nghint">${hint}</p></section>`;
}

function setupHTML(draft: NewGameDraft) {
  const ok = seedFromCode(draft.code) !== null;
  // Met komma's: op een telefoon loopt dit door op een tweede regel, zonder los puntje aan het eind
  const foes = draft.rivals ? `, ${draft.rivals} ${draft.rivals === 1 ? 'rivaal' : 'rivalen'}` : '';
  const summary = `${PEOPLE[draft.people].n}, ${DIFFICULTIES[draft.diff].n.toLowerCase()}, ${MAP[draft.map].n.toLowerCase()}${foes}`;
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
        ${rivalsHTML(draft)}
      </div>
    </div>
    <button class="mbtn primary ngstart" data-ng="start" ${ok ? '' : 'disabled'}><span>Begin</span><small>${summary}</small></button>
  </div>`;
}

// ---- Kaartje van de wereld ----

// Kleuren per landschap, zoals de grond in het spel (iets feller, want het kaartje is klein)
const COLORS: Record<number, number[]> = {
  [BIOME.BEACH]: [196, 176, 124],
  [BIOME.GRASS]: [104, 136, 64],
  [BIOME.FOREST]: [60, 92, 46],
  [BIOME.HILLS]: [128, 122, 80],
  [BIOME.MOUNTAIN]: [146, 140, 132],
  [BIOME.DESERT]: [214, 186, 128],
  [BIOME.SALT]: [222, 222, 212],
};
// Een paar kaartjes onthouden, zodat heen en weer klikken tussen kaartsoorten meteen werkt.
// Per kaartje ook waar de rivalen wonen (dezelfde plekken als in het spel, zie world/rivalsites.ts).
const previews = new Map<string, ImageData>(),
  rivalSpots = new Map<string, RivalSite[]>();
let previewTimer = 0;

/** Maak een plaatje van een wereld: kleur per landschap, met wat schaduw zodat je de bergen ziet. */
function worldImage(world: GeneratedWorld) {
  const img = new ImageData(W, H);
  const { biome, elev, levels } = world;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let c: number[];
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
function paintPreview(el: HTMLElement, draft: NewGameDraft) {
  const canvas = el.querySelector<HTMLCanvasElement>('.ngmap canvas');
  const seed = seedFromCode(draft.code);
  if (!canvas || seed === null) return;
  const key = `${seed}:${draft.map}`;
  const img = previews.get(key);
  // Het canvas staat altijd in het vak .ngmap (zie atlasHTML)
  canvas.parentElement!.classList.toggle('busy', !img);
  if (img) {
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(img, 0, 0);
    // Je startplek: een ring in het midden
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#2b2520';
    ctx.fillStyle = '#fcf7ec';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // De rivalen: een stip in hun eigen kleur
    const lineup = rivalLineup(seed);
    (rivalSpots.get(key) || []).slice(0, draft.rivals).forEach((spot, i) => {
      ctx.fillStyle = RIVAL[lineup[i].k].c;
      ctx.beginPath();
      ctx.arc(spot.x + 1, spot.y + 1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    return;
  }
  clearTimeout(previewTimer);
  // Pas na een korte pauze: wie een code typt, wil niet bij elke letter wachten
  previewTimer = setTimeout(() => {
    // Niet meer nodig als je het scherm al verliet of de code intussen niet meer klopt
    const now = seedFromCode(draft.code);
    if (now === null || el.hidden || !el.querySelector('.ngmap canvas')) return;
    const nowKey = `${now}:${draft.map}`;
    if (!previews.has(nowKey)) {
      const world = generateWorld(now, W, H, draft.map);
      previews.set(nowKey, worldImage(world));
      rivalSpots.set(nowKey, pickRivalSites(world.ter, W, H, now));
    }
    if (previews.size > 12) {
      // Er staan er meer dan 12 in, dus er is zeker een oudste
      const oldest = previews.keys().next().value!;
      previews.delete(oldest);
      rivalSpots.delete(oldest);
    }
    paintPreview(el, draft);
  }, 280);
}

// ---- Het scherm zelf ----

/** Wat het nieuw-spelscherm meekrijgt: terug naar het menu, en beginnen met deze keuzes. */
interface NewGameScreenOpts {
  onBack: () => void;
  onStart: (opts: NewGameOptions) => void;
}

/**
 * Laat het nieuw-spelscherm zien in het titelscherm `el`. `draft` zijn de keuzes (zie newGameDraft).
 * `onBack()`: terug naar het hoofdmenu. `onStart(opts)`: begin de wereld met deze keuzes.
 */
export function showNewGame(el: HTMLElement, draft: NewGameDraft, { onBack, onStart }: NewGameScreenOpts) {
  const draw = () => {
    el.innerHTML = setupHTML(draft);
    paintPreview(el, draft);
  };
  // Na het typen: Begin aan of uit, en de tekst eronder bijwerken (zonder alles opnieuw te tekenen)
  // (draw heeft het scherm al getekend, dus al deze onderdelen bestaan)
  const codeTyped = () => {
    const ok = seedFromCode(draft.code) !== null;
    const input = el.querySelector('#ngSeed')!;
    input.classList.toggle('bad', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    el.querySelector<HTMLButtonElement>('.ngstart')!.disabled = !ok;
    const hint = el.querySelector('#ngSeedHint')!;
    hint.classList.toggle('warn', !ok);
    hint.textContent = seedHint(ok);
    if (ok) {
      // ok: de code klopt, dus er is een seed
      const seed = seedFromCode(draft.code)!;
      el.querySelector('.ngplace')!.innerHTML = `${ico('⚑')}${PLACES[seed % PLACES.length]}`;
    }
    el.querySelector('.ngmap')!.classList.toggle('empty', !ok);
    // Andere code = andere rivalen
    el.querySelector('.ng-riv')!.outerHTML = rivalsHTML(draft);
    paintPreview(el, draft);
  };
  const start = () => {
    const seed = seedFromCode(draft.code);
    if (seed === null) return;
    rememberChoices(draft);
    const { people, diff, map, victories, rivals } = draft;
    onStart({ seed, people, diff, map, victories, rivals });
  };
  draw();
  el.onclick = e => {
    const t = (e.target as HTMLElement).closest('button');
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
    } else if (t.dataset.rivals !== undefined) {
      draft.rivals = cleanRivalCount(+t.dataset.rivals);
      // Zonder rivalen valt Verovering weg (en is er altijd nog een ander doel)
      draft.victories = cleanVictories(draft.victories, draft.rivals);
      draw();
    } else if (t.dataset.map) {
      draft.map = t.dataset.map;
      draw();
    } else if (t.dataset.vic) toggleVictory(el, draft, t, draw);
  };
  el.oninput = e => {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'ngSeed') return;
    draft.code = input.value;
    codeTyped();
  };
  // Klaar met typen: de code netjes schrijven ("tp 7k2q" wordt "TP-7K2Q")
  el.onchange = e => {
    const input = e.target as HTMLInputElement;
    if (input.id !== 'ngSeed') return;
    const clean = cleanCode(draft.code);
    if (clean) input.value = draft.code = clean;
  };
  el.onkeydown = e => {
    if ((e.target as HTMLElement).id === 'ngSeed' && e.key === 'Enter') start();
  };
}

/** Een manier om te winnen aan of uit. De laatste mag niet uit: er moet altijd een doel zijn. */
function toggleVictory(el: HTMLElement, draft: NewGameDraft, tile: HTMLElement, draw: () => void) {
  // Alleen aangeroepen voor een knop met data-vic
  const k = tile.dataset.vic!;
  if (!draft.victories.includes(k)) {
    draft.victories = cleanVictories([...draft.victories, k], draft.rivals);
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
  const hint = el.querySelector('#ngWinHint')!;
  hint.textContent = 'Kies minstens één manier om te winnen.';
  hint.classList.add('warn');
}
