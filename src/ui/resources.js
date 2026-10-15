// Grondstoffenstrook bovenaan en de uitleg als je eroverheen beweegt.
import { store } from '../core/store.js';
import { SET } from '../core/settings.js';
import { sfx } from '../audio/sound.js';
import { AGE_UP } from '../data/ages.js';
import { B, BKEYS } from '../data/buildings.js';
import { GATHER, RES, RKEYS } from '../data/resources.js';
import { demand, wr } from '../game/caches.js';
import { G } from '../game/state.js';
import { mouse } from '../input/input.js';
import { VH, VW, worldEl } from '../render/scene.js';
import { fmt, gem } from './format.js';
import { ico } from './glyphs.js';
import { setHTML, sigs } from './header.js';
import { $, isCompact, isNarrow } from '../util/dom.js';
import { clamp } from '../util/math.js';

// Uitleg bij een grondstof als je eroverheen beweegt
$('#resbar').addEventListener('pointerover', e => {
  const r = e.target.closest('.res');
  if (!r || mouse.touch) return;
  const k = r.dataset.k,
    tip = $('#hovertip'),
    rr = r.getBoundingClientRect(),
    w = worldEl.getBoundingClientRect();
  const users = BKEYS.filter(b => {
      const d = B[b];
      const inp = d.conv ? d.conv.in : d.gen && d.gen.in;
      return inp && inp[k] && G.bs.some(x => x.type === b && x.done);
    }).map(b => B[b].n),
    makers = BKEYS.filter(b => B[b].conv && B[b].conv.out[k]).map(b => B[b].n),
    rt = rate[k] || 0;
  tip.className = '';
  tip.innerHTML = `<b>${RES[k].n}</b><span>${fmt(G.res[k])} op voorraad · ${rt >= 0 ? '+' : '−'}${Math.abs(Math.round(rt))} per minuut</span>${GATHER.includes(k) ? `<span>${wr[k] || 0} dorpelingen verzamelen</span>` : ''}${makers.length ? `<span>Gemaakt in: ${makers.join(', ')}</span>` : ''}${users.length ? `<span>Verbruikt door: ${users.join(', ')}</span>` : ''}`;
  tip.hidden = false;
  tip.dataset.res = 1;
  // De strook staat bovenaan: uitleg er netjes onder (in de lijst +N ernaast)
  const inPop = !!r.closest('#resPop');
  tip.style.left = clamp((inPop ? rr.right + 8 : rr.left) - w.left, 8, VW - 280) + 'px';
  tip.style.top = clamp((inPop ? rr.top : rr.bottom + 8) - w.top, 8, VH - 120) + 'px';
});
$('#resbar').addEventListener('pointerout', e => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.res')) {
    const t = $('#hovertip');
    delete t.dataset.res;
    t.hidden = true;
  }
});
// Grondstoffenstrook (bovenaan): eerst wat je nu nodig hebt, de rest via de knop +N
export const rate = {};
function relevantRes() {
  const out = [],
    add = k => {
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
const shown = {};
let shownFor = null; // het spel waar deze getallen bij horen: bij een ander spel beginnen ze opnieuw
const shownValue = k => shown[k] ?? G.res[k];
// De getallen in beeld (strook en lijst +N), per grondstof. Eén keer opgezocht na het tekenen, niet elk beeldje.
let numbers = null;
const resItem = k =>
  `<div class="res" data-k="${k}">${gem(k)}<div><b>${fmt(shownValue(k))}</b><small>${RES[k].n}</small><em></em></div><span class="wk zero" title="${GATHER.includes(k) ? 'Dorpelingen op deze grondstof' : 'Gebouwen die dit maken'}">${ico(GATHER.includes(k) ? '☺' : '⚙')}<span>0</span></span></div>`;
export function buildResBar(force) {
  const all = relevantRes(),
    lim = isNarrow() ? 3 : isCompact() ? 4 : 14, // computer: strook bovenaan, zoveel als past
    max = Math.min(store.resMax, lim),
    keys = all.slice(0, max).sort((a, b) => RKEYS.indexOf(a) - RKEYS.indexOf(b)),
    rest = RKEYS.filter(k => RES[k].age <= G.age).length - keys.length;
  const sig = keys.join() + '|' + rest;
  if (!force && sigs.resbar === sig) return;
  sigs.resbar = sig;
  $('#resbar').innerHTML =
    keys.map(resItem).join('') +
    (rest > 0
      ? `<button class="quiet" id="resMore" aria-expanded="${!$('#resPop').hidden}" title="Alle grondstoffen">+${rest}</button>`
      : '');
  numbers = null; // opnieuw getekend: de getallen straks opnieuw opzoeken
  updateResPop();
}
/** Zoek de getallen in beeld op: per grondstof alle plekken waar hij staat (strook én lijst +N kan). */
function findNumbers() {
  const byKey = new Map();
  for (const el of document.querySelectorAll('#resbar .res, #resPop .res')) {
    const k = el.dataset.k;
    if (!byKey.has(k)) byKey.set(k, { k, els: [], value: null });
    byKey.get(k).els.push(el.querySelector('b'));
  }
  // Wat niet meer in beeld staat, begint later gewoon bij de echte voorraad
  for (const k in shown) if (!byKey.has(k)) delete shown[k];
  return [...byKey.values()];
}
/**
 * Elk beeldje: elk getal schuift een stukje op naar de echte voorraad, zodat je een grote buit ziet binnenkomen.
 * Met "Animaties" uit (instellingen) springt het getal meteen.
 */
export function tickResourceNumbers(rdt) {
  if (!G) return;
  if (shownFor !== G) {
    shownFor = G;
    for (const k in shown) delete shown[k];
  }
  if (!numbers) numbers = findNumbers();
  const step = SET.motion ? 1 - Math.exp(-rdt * 7) : 1;
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
    for (const b of n.els) if (b.textContent !== text) b.textContent = text;
  }
}
export function updateResPop() {
  const p = $('#resPop');
  if (p.hidden) return;
  const ks = RKEYS.filter(k => RES[k].age <= G.age);
  const before = sigs.respop;
  setHTML(p, 'respop', ks.join(), () => ks.map(resItem).join(''));
  if (sigs.respop !== before) numbers = null; // opnieuw getekend: de getallen straks opnieuw opzoeken
}
$('#resbar').addEventListener('click', e => {
  const m = e.target.closest('#resMore');
  if (m) {
    sfx('tick');
    const p = $('#resPop');
    p.hidden = !p.hidden;
    sigs.respop = null;
    updateResPop();
    m.setAttribute('aria-expanded', !p.hidden);
    store.uiDirty = true;
  }
});
addEventListener(
  'pointerdown',
  e => {
    const p = $('#resPop');
    if (!p.hidden && !e.target.closest('#resPop,#resMore')) p.hidden = true;
    if (document.body.classList.contains('showmap') && !e.target.closest('#mapPanel,#modal,#sidebtns'))
      document.body.classList.remove('showmap');
  },
  true,
);
addEventListener('resize', () => {
  store.resMax = 14;
  sigs.resbar = null;
});
