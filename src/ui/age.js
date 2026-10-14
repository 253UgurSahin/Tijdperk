// Naar het volgende tijdperk gaan.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { AGES, AGE_UP } from '../data/ages.js';
import { B, ROADS } from '../data/buildings.js';
import { RES, RKEYS } from '../data/resources.js';
import { computeAvail } from '../game/caches.js';
import { CHAPTERS, built } from '../game/chapters.js';
import { has, pay } from '../game/economy.js';
import { popNow } from '../game/entities.js';
import { G } from '../game/state.js';
import { canUpg, roadTier } from '../game/upgrades.js';
import { sigs } from './header.js';
import { toast } from './hud.js';
import { buildResBar } from './resources.js';
import { $ } from '../util/dom.js';
import { retiredIn } from '../data/succession.js';
import { UNITS } from '../data/units.js';

// Naar het volgende tijdperk
export function ageUp() {
  const nx = AGE_UP[G.age + 1];
  if (!nx || !has(nx.cost) || popNow() < nx.pop || !nx.need.every(built)) return;
  pay(nx.cost);
  G.age++;
  const b = $('#banner');
  b.innerHTML = `<div class="in"><div class="eyebrow">Hoofdstuk ${AGES[G.age].r}</div><div class="t">${AGES[G.age].n}</div><div class="y">${AGES[G.age].y} · ${CHAPTERS[G.age].t}</div></div>`;
  b.hidden = false;
  setTimeout(() => (b.hidden = true), 4500);
  const nr = RKEYS.filter(k => RES[k].age === G.age && !RES[k].cr).map(k => RES[k].n.toLowerCase());
  sfx('age');
  const nu = G.bs.filter(canUpg).length;
  const old = retiredIn(G.age).map(k => (B[k] || UNITS[k]).n.toLowerCase());
  toast(
    `De ${AGES[G.age].n.toLowerCase()} breekt aan. Ontdekt: ${nr.join(' en ')}. Nieuwe verbeteringen: werktuigen, wapens${nu ? ` en ${nu} gebouwen` : ''}.${old.length ? ` Verouderd: ${old.join(', ')}.` : ''}`,
    'age',
  );
  computeAvail();
  onAgeChange();
  setTimeout(
    () =>
      document.querySelectorAll('#resbar .res').forEach(el => {
        if (RES[el.dataset.k].age === G.age) {
          el.classList.add('new');
          setTimeout(() => el.classList.remove('new'), 3000);
        }
      }),
    60,
  );
}
export function onAgeChange() {
  store.curAge = G.age;
  document.body.dataset.age = G.age;
  const A = AGES[G.age];
  B.road.n = ROADS[roadTier()].n;
  B.road.cost = ROADS[roadTier()].cost;
  $('#locEyebrow').textContent = A.n;
  $('#ageNum').textContent = A.r;
  buildResBar(true);
  sigs.cats = null;
  sigs.grid = null;
  sigs.ins = null;
  store.uiDirty = true;
}
