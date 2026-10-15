// Grondstoffen bovenaan: per grondstof alleen het plaatje en de voorraad. Meer weten? Muis erop voor de
// uitleg, of klik voor de lijst met alles (met tempo en werkers).
import type { GameState } from '../types';
import { store } from '../core/store';
import { SET } from '../core/settings';
import { sfx } from '../audio/sound';
import { AGE_UP } from '../data/ages';
import { B, BKEYS } from '../data/buildings';
import { GATHER, RES, RKEYS } from '../data/resources';
import { demand, wr } from '../game/caches';
import { armyHungry, armyUpkeep } from '../game/military';
import { buildCost } from '../game/placement';
import { G } from '../game/state';
import { mouse } from '../input/input';
import { VH, VW, worldEl } from '../render/scene';
import { esc, fmt, gem } from './format';
import { ico } from './glyphs';
import { setHTML, sigs } from './header';
import { closeSidePanels } from './panel';
import { $, isCompact, isNarrow } from '../util/dom';
import { clamp } from '../util/math';

/** Hoeveel er per minuut bij komt (of af gaat, dan negatief), per grondstof. main.ts rekent het uit. */
export const rate: Record<string, number> = {};

// ---- wat er in de strook staat ----

// Eerst wat je nu nodig hebt (bouwen, het volgende tijdperk), dan de rest via de knop +N
function relevantRes() {
  const out: string[] = [],
    add = (k: string) => {
      if (k && RES[k] && RES[k].age <= G.age && !out.includes(k)) out.push(k);
    };
  if (store.placing) for (const k in B[store.placing].cost) add(k);
  const nx = AGE_UP[G.age + 1];
  if (nx) for (const k in nx.cost) add(k);
  ['food', 'wood', 'stone'].forEach(add);
  for (const k in demand) add(k);
  for (const b of G.bs) {
    const d = B[b.type];
    if (b.done && d.conv) for (const k in d.conv.out) add(k);
  }
  RKEYS.filter(k => RES[k].age === G.age).forEach(add);
  return out;
}
// Getallen in de strook tellen vloeiend op of af naar de echte voorraad (zie tickResourceNumbers hieronder)
const shown: Record<string, number> = {};
let shownFor: GameState | null = null; // het spel waar deze getallen bij horen: bij een ander spel opnieuw
const shownValue = (k: string): number => shown[k] ?? G.res[k];
/** Eén grondstof in beeld: de getallen (strook en lijst met alles) en de waarde die er nu staat. */
interface ShownNumber {
  k: string;
  els: HTMLElement[];
  value: number | null;
}
// De getallen in beeld, per grondstof. Eén keer opgezocht na het tekenen, niet elk beeldje.
let numbers: ShownNumber[] | null = null;

// In de strook: alleen het plaatje en het getal (de naam staat in de uitleg). data-rank zegt hoe belangrijk
// hij nu is (0 = het belangrijkst): bij te weinig plek vallen de minst belangrijke weg (zie fitResBar).
const barItem = (k: string, rank: number): string =>
  `<button class="res" data-k="${k}" data-rank="${rank}" aria-label="${RES[k].n}">${gem(k)}<b>${fmt(shownValue(k))}</b></button>`;
// In de lijst met alles: plaatje, naam, voorraad, tempo en hoeveel er aan werken
const listItem = (k: string): string =>
  `<div class="res" data-k="${k}">${gem(k)}<span class="rn">${RES[k].n}</span><b>${fmt(shownValue(k))}</b><em></em><span class="wk"></span></div>`;

/** Zoveel grondstoffen hooguit in de strook: op een telefoon een paar, op de computer zoveel als past. */
const barLimit = (): number => (isNarrow() ? 4 : isCompact() ? 6 : 14);

export function buildResBar(force?: boolean) {
  const keys = relevantRes().slice(0, barLimit());
  const sig = keys.join();
  if (!force && sigs.resbar === sig) return;
  sigs.resbar = sig;
  // In de strook op de vaste volgorde van alle grondstoffen (voedsel, hout, steen, ...)
  const inOrder = [...keys].sort((a, b) => RKEYS.indexOf(a) - RKEYS.indexOf(b));
  $('#resbar').innerHTML =
    inOrder.map(k => barItem(k, keys.indexOf(k))).join('') +
    `<button class="quiet" id="resMore" aria-expanded="${!$('#resPop').hidden}" title="Alle grondstoffen"></button>`;
  numbers = null; // opnieuw getekend: de getallen straks opnieuw opzoeken
}
function updateResPop() {
  const p = $('#resPop');
  if (p.hidden) return;
  const ks = RKEYS.filter(k => RES[k].age <= G.age);
  const before = sigs.respop;
  setHTML(
    p,
    'respop',
    ks.join(),
    () =>
      `<div class="rph"><b>Alle grondstoffen</b><button class="quiet x" data-close="1" aria-label="Sluiten">${ico('✕')}</button></div>` +
      `<div class="rpl">${ks.map(listItem).join('')}</div>`,
  );
  if (sigs.respop !== before) numbers = null; // opnieuw getekend: de getallen straks opnieuw opzoeken
}

/** Zoek de getallen in beeld op: per grondstof alle plekken waar hij staat (strook én lijst met alles). */
function findNumbers(): ShownNumber[] {
  const byKey = new Map<string, ShownNumber>();
  for (const el of document.querySelectorAll<HTMLElement>('#resbar .res, #resPop .res')) {
    // Elk vakje heeft een sleutel (data-k) en een getal (<b>), zie barItem en listItem hierboven
    const k = el.dataset.k!;
    if (!byKey.has(k)) byKey.set(k, { k, els: [], value: null });
    byKey.get(k)!.els.push(el.querySelector('b')!);
  }
  // Wat niet meer in beeld staat, begint later gewoon bij de echte voorraad
  for (const k in shown) if (!byKey.has(k)) delete shown[k];
  return [...byKey.values()];
}
/**
 * Elk beeldje: elk getal schuift een stukje op naar de echte voorraad, zodat je een grote buit ziet binnenkomen.
 * Met "Animaties" uit (instellingen) springt het getal meteen.
 */
export function tickResourceNumbers(rdt: number) {
  if (!G) return;
  if (shownFor !== G) {
    shownFor = G;
    for (const k in shown) delete shown[k];
  }
  if (!numbers) numbers = findNumbers();
  const step = SET.motion ? 1 - Math.exp(-rdt * 7) : 1;
  let widthChanged = false;
  for (const n of numbers) {
    const target = G.res[n.k];
    let value = shown[n.k] ?? target;
    // Staat het goede getal er al? Dan niets te doen (zo is het meestal)
    if (value === target && n.value === target) continue;
    value += (target - value) * step;
    if (Math.abs(target - value) < 0.5) value = target;
    shown[n.k] = value;
    if (n.value === value) continue;
    n.value = value;
    const text = fmt(value);
    for (const b of n.els) {
      if (b.textContent === text) continue;
      if ((b.textContent || '').length !== text.length) widthChanged = true;
      b.textContent = text;
    }
  }
  // Een getal met een teken meer of minder (999 → 1.000) is breder of smaller: opnieuw kijken wat er past
  if (widthChanged) fitResBar();
}

// ---- elke verversing: getallen, kleuren en de lijst ----

// Raakt deze grondstof op? Dan kleurt het getal rood.
function runningLow(k: string): boolean {
  if (k === 'food' && armyHungry()) return true;
  const r = rate[k] || 0;
  // Bij dit tempo is het binnen twee minuten op
  if (r < -1 && G.res[k] < -r * 2) return true;
  // Het is op, terwijl een gebouw het nodig heeft
  return G.res[k] < 1 && !!demand[k];
}
// Tempo als korte tekst: "+12/min" of "−5/min" (leeg als er bijna niets verandert)
function rateText(k: string): string {
  const r = rate[k];
  if (r === undefined || Math.abs(r) < 1) return '';
  return (r > 0 ? '+' : '−') + Math.abs(Math.round(r)) + '/min';
}
// Wie er aan werkt: dorpelingen die het verzamelen, of gebouwen die het maken
function workersOf(k: string, made: Record<string, number>): number {
  return GATHER.includes(k) ? wr[k] || 0 : made[k] || 0;
}

/**
 * Past de strook niet? Dan vallen de minst belangrijke grondstoffen weg tot hij past (één blijft er altijd
 * staan). De knop +N telt alles wat niet in de strook staat. Dit wordt elke keer opnieuw gemeten: is er
 * weer plek (bijvoorbeeld omdat de tekst bij de klok korter werd), dan komen ze vanzelf terug.
 */
function fitResBar() {
  const bar = $('#resbar'),
    more = $('#resMore'),
    items = [...bar.querySelectorAll<HTMLElement>('.res')],
    total = RKEYS.filter(k => RES[k].age <= G.age).length;
  const setMore = (left: number) => {
    const rest = total - items.length + left,
      text = '+' + rest;
    more.hidden = rest <= 0;
    if (more.textContent !== text) more.textContent = text;
  };
  // Eerst alles laten zien
  for (const el of items) el.hidden = false;
  setMore(0);
  let tooWide = bar.scrollWidth - bar.clientWidth;
  if (tooWide <= 1) return;
  // De knop +N komt er misschien nu pas bij: die kost ook plek
  if (more.hidden) {
    setMore(1);
    tooWide = bar.scrollWidth - bar.clientWidth;
  }
  // Eerst alle breedtes meten en dan pas verbergen: anders rekent de browser na elke stap alles opnieuw uit
  const gap = parseFloat(getComputedStyle(bar).columnGap) || 0,
    leastFirst = [...items].sort((a, b) => +b.dataset.rank! - +a.dataset.rank!),
    widths = leastFirst.map(el => el.offsetWidth + gap);
  let left = 0;
  // Met een paar beeldpunten speling, want "+9" kan "+10" worden
  while (tooWide > -4 && left < leastFirst.length - 1) {
    tooWide -= widths[left];
    leastFirst[left].hidden = true;
    left++;
  }
  setMore(left);
}

// Getallen en kleuren in de strook en in de lijst met alles
function fillResItems() {
  // Gebouwen die iets maken, per grondstof (voor "zoveel werken eraan")
  const made: Record<string, number> = {};
  for (const b of G.bs) {
    const d = B[b.type];
    if (b.done && b.on && d.conv) for (const k in d.conv.out) made[k] = (made[k] || 0) + 1;
    if (b.done && d.pump) made[d.pump.res] = (made[d.pump.res] || 0) + 1;
  }
  // Wat je nu wilt bouwen: grondstoffen waar je te weinig van hebt, kleuren rood
  const need = store.placing ? buildCost(store.placing) : null;
  for (const el of document.querySelectorAll<HTMLElement>('#resbar .res,#resPop .res')) {
    // Elk vakje heeft een sleutel (data-k). Het getal zelf telt vloeiend mee (zie tickResourceNumbers).
    const k = el.dataset.k!;
    el.classList.toggle('short', !!(need && need[k] > G.res[k]));
    el.classList.toggle('low', runningLow(k));
    const em = el.querySelector('em');
    if (em) {
      const rt = rateText(k);
      if (em.textContent !== rt) em.textContent = rt;
      em.classList.toggle('down', rt.startsWith('−'));
    }
    const wk = el.querySelector<HTMLElement>('.wk');
    if (wk) {
      const n = workersOf(k, made);
      if (wk.dataset.n !== String(n)) {
        wk.dataset.n = String(n);
        wk.innerHTML = n ? `${ico(GATHER.includes(k) ? '☺' : '⚙')}${n}` : '';
        wk.title = GATHER.includes(k) ? 'Dorpelingen die dit verzamelen' : 'Gebouwen die dit maken';
      }
    }
  }
}

/** De strook bovenaan bijwerken: de getallen, rood als iets opraakt, wat er past, en de open lijst. */
export function updateResources() {
  buildResBar();
  updateResPop();
  fillResItems();
  // Eerst de getallen, dan kijken wat er past (een getal kan breder worden, zoals 999 → 1.000)
  fitResBar();
}

// ---- uitleg als je met de muis over een grondstof gaat ----

function resTipHTML(k: string): string {
  const users = BKEYS.filter(b => {
      const d = B[b];
      const inp = d.conv ? d.conv.in : d.gen && d.gen.in;
      return inp && inp[k] && G.bs.some(x => x.type === b && x.done);
    }).map(b => B[b].n),
    makers = BKEYS.filter(b => B[b].conv && B[b].conv.out[k]).map(b => B[b].n),
    rt = rateText(k).replace('/min', ' per minuut');
  const lines = [`${fmt(G.res[k])} op voorraad${rt ? ' · ' + rt : ''}`];
  if (GATHER.includes(k)) lines.push(`${wr[k] || 0} dorpelingen verzamelen`);
  if (makers.length) lines.push(`Gemaakt in: ${makers.join(', ')}`);
  if (users.length) lines.push(`Verbruikt door: ${users.join(', ')}`);
  // Voedsel: wat je leger eet, en een waarschuwing als het honger heeft
  if (k === 'food' && G.us.length) lines.push(`Leger eet ${Math.round(armyUpkeep())} per minuut`);
  const hungry =
    k === 'food' && armyHungry()
      ? '<span class="lack">Je leger heeft honger en vecht slechter. Zorg voor voedsel!</span>'
      : '';
  return `<b>${RES[k].n}</b>${lines.map(l => `<span>${esc(l)}</span>`).join('')}${hungry}`;
}
function showResTip(e: PointerEvent) {
  const r = (e.target as HTMLElement).closest<HTMLElement>('.res');
  if (!r || mouse.touch) return;
  const tip = $('#hovertip'),
    rr = r.getBoundingClientRect(),
    w = worldEl.getBoundingClientRect();
  tip.className = '';
  tip.innerHTML = resTipHTML(r.dataset.k!);
  tip.hidden = false;
  tip.dataset.res = '1';
  // In de strook bovenaan: uitleg eronder. In de lijst met alles: ernaast.
  const inList = !!r.closest('#resPop');
  tip.style.left = clamp((inList ? rr.right + 8 : rr.left) - w.left, 8, VW - 280) + 'px';
  tip.style.top = clamp((inList ? rr.top : rr.bottom + 8) - w.top, 8, VH - 140) + 'px';
}
function hideResTip(e: PointerEvent) {
  const to = e.relatedTarget as HTMLElement | null;
  if (!to || !to.closest || !to.closest('.res')) {
    const t = $('#hovertip');
    delete t.dataset.res;
    t.hidden = true;
  }
}
for (const id of ['#resbar', '#resPop']) {
  $(id).addEventListener('pointerover', showResTip);
  $(id).addEventListener('pointerout', hideResTip);
}

// ---- de lijst met alles: een kaartje onder de knop waarmee je hem opende ----

function openResPop(anchor: HTMLElement) {
  // Eén ding tegelijk: een open paneel of de kaart (en op een telefoon het doel) gaat eerst dicht
  closeSidePanels();
  const p = $('#resPop');
  p.hidden = false;
  // Eén ding tegelijk: zolang de lijst open is, wijken de doelen en de meldingen even (zie top.css)
  document.body.classList.add('respop');
  sigs.respop = null;
  updateResPop();
  $('#resMore')?.setAttribute('aria-expanded', 'true');
  // Op een telefoon staat de lijst vast onder de bovenbalk (zie CSS); op de computer onder de knop
  if (isCompact()) {
    p.style.left = p.style.top = '';
    return;
  }
  // Op grote schermen is de HUD vergroot (CSS zoom): rekenen in beeldpunten, dan delen door de zoom.
  // De lijst blijft links van de klok rechtsboven, zodat hij daar niet overheen valt.
  const zoom = parseFloat(getComputedStyle(p).zoom) || 1,
    width = p.offsetWidth * zoom,
    a = anchor.getBoundingClientRect(),
    w = worldEl.getBoundingClientRect(),
    clockLeft = $('#ageplate').getBoundingClientRect().left - w.left,
    maxLeft = Math.max(8, Math.min(VW, clockLeft) - width - 8),
    left = clamp(a.left - w.left - 14, 8, maxLeft);
  p.style.left = left / zoom + 'px';
  p.style.top = (a.bottom - w.top + 10) / zoom + 'px';
  // Het puntje bovenaan wijst naar de knop
  const arrow = clamp(a.left - w.left + a.width / 2 - left, 18, width - 18);
  p.style.setProperty('--ax', arrow / zoom + 'px');
}
export function closeResPop() {
  const p = $('#resPop');
  if (p.hidden) return;
  p.hidden = true;
  document.body.classList.remove('respop');
  $('#resMore')?.setAttribute('aria-expanded', 'false');
  const t = $('#hovertip');
  if (t.dataset.res) {
    delete t.dataset.res;
    t.hidden = true;
  }
}
// Klik op een grondstof of op +N: de lijst open (of weer dicht)
$('#resbar').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.res,#resMore');
  if (!t) return;
  sfx('tick');
  if ($('#resPop').hidden) openResPop(t);
  else closeResPop();
  store.uiDirty = true;
});
$('#resPop').addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('[data-close]')) closeResPop();
});
// Ergens anders klikken of tikken sluit de lijst (en op een telefoon de kaart)
addEventListener(
  'pointerdown',
  e => {
    const t = e.target as HTMLElement;
    if (!t.closest('#resPop,#resbar')) closeResPop();
    if (document.body.classList.contains('showmap') && !t.closest('#mapPanel,#modal,#sidebtns'))
      document.body.classList.remove('showmap');
  },
  true,
);
// Esc sluit eerst de lijst, voordat het spel de toets gebruikt (bijv. om bouwen te annuleren)
addEventListener(
  'keydown',
  e => {
    if (e.key === 'Escape' && !$('#resPop').hidden) {
      closeResPop();
      e.stopPropagation();
    }
  },
  true,
);
// Ander schermformaat: de strook opnieuw opbouwen (op een telefoon passen er minder in)
addEventListener('resize', () => {
  sigs.resbar = null;
  closeResPop();
});
