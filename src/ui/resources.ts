// Grondstoffenstrook bovenaan en de uitleg als je eroverheen beweegt.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGE_UP } from '../data/ages';
import { B, BKEYS } from '../data/buildings';
import { GATHER, RES, RKEYS } from '../data/resources';
import { demand, wr } from '../game/caches';
import { G } from '../game/state';
import { mouse } from '../input/input';
import { VH, VW, worldEl } from '../render/scene';
import { fmt, gem } from './format';
import { ico } from './glyphs';
import { setHTML, sigs } from './header';
import { $, isCompact, isNarrow } from '../util/dom';
import { clamp } from '../util/math';

// Uitleg bij een grondstof als je eroverheen beweegt
$('#resbar').addEventListener('pointerover', e => {
  const r = (e.target as HTMLElement).closest<HTMLElement>('.res');
  if (!r || mouse.touch) return;
  const k = r.dataset.k!,
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
  tip.dataset.res = '1';
  // De strook staat bovenaan: uitleg er netjes onder (in de lijst +N ernaast)
  const inPop = !!r.closest('#resPop');
  tip.style.left = clamp((inPop ? rr.right + 8 : rr.left) - w.left, 8, VW - 280) + 'px';
  tip.style.top = clamp((inPop ? rr.top : rr.bottom + 8) - w.top, 8, VH - 120) + 'px';
});
$('#resbar').addEventListener('pointerout', e => {
  const to = e.relatedTarget as HTMLElement | null;
  if (!to || !to.closest || !to.closest('.res')) {
    const t = $('#hovertip');
    delete t.dataset.res;
    t.hidden = true;
  }
});
// Grondstoffenstrook (bovenaan): eerst wat je nu nodig hebt, de rest via de knop +N
export const rate: Record<string, number> = {};
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
const resItem = (k: string): string =>
  `<div class="res" data-k="${k}">${gem(k)}<div><b>${fmt(G.res[k])}</b><small>${RES[k].n}</small><em></em></div><span class="wk zero" title="${GATHER.includes(k) ? 'Dorpelingen op deze grondstof' : 'Gebouwen die dit maken'}">${ico(GATHER.includes(k) ? '☺' : '⚙')}<span>0</span></span></div>`;
export function buildResBar(force?: boolean) {
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
  updateResPop();
}
export function updateResPop() {
  const p = $('#resPop');
  if (p.hidden) return;
  const ks = RKEYS.filter(k => RES[k].age <= G.age);
  setHTML(p, 'respop', ks.join(), () => ks.map(resItem).join(''));
}
$('#resbar').addEventListener('click', e => {
  const m = (e.target as HTMLElement).closest('#resMore');
  if (m) {
    sfx('tick');
    const p = $('#resPop');
    p.hidden = !p.hidden;
    sigs.respop = null;
    updateResPop();
    m.setAttribute('aria-expanded', String(!p.hidden));
    store.uiDirty = true;
  }
});
addEventListener(
  'pointerdown',
  e => {
    const p = $('#resPop'),
      t = e.target as HTMLElement;
    if (!p.hidden && !t.closest('#resPop,#resMore')) p.hidden = true;
    if (document.body.classList.contains('showmap') && !t.closest('#mapPanel,#modal,#sidebtns'))
      document.body.classList.remove('showmap');
  },
  true,
);
addEventListener('resize', () => {
  store.resMax = 14;
  sigs.resbar = null;
});
