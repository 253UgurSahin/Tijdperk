// Doelen linksboven: wat je nodig hebt voor het volgende tijdperk, en hoe ver je bent met winnen.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { AGES, AGE_UP } from '../data/ages.js';
import { B } from '../data/buildings.js';
import { GATHER, RES } from '../data/resources.js';
import { avail } from '../game/caches.js';
import { CHAPTERS, built } from '../game/chapters.js';
import { popNow } from '../game/entities.js';
import { G } from '../game/state.js';
import { victoryGoals } from '../game/victory.js';
import { measureHud } from '../main.js';
import { ageUp } from './age.js';
import { andJoin, lackList, placed } from './coach.js';
import { fmt, gem } from './format.js';
import { ico } from './glyphs.js';
import { setHTML, sigs } from './header.js';
import { setExpand } from './hud.js';
import { togglePanel } from './panel.js';
import { $, isCompact } from '../util/dom.js';

export function renderChronicle() {
  const nx = AGE_UP[G.age + 1];
  let rows = [],
    allReq = true,
    fix = '',
    total = 0,
    ready = 0;
  if (nx) {
    for (const n of nx.need) {
      const ok = built(n);
      allReq = allReq && ok;
      rows.push(
        `<span class="ck ${ok ? 'ok' : placed(n) ? 'busy' : ''}">${ok ? ico('✓') : ''}</span><span class="${ok ? 'done' : ''}">${B[n].n}</span><span class="v ${ok ? 'ok' : ''}">${ok ? 'klaar' : placed(n) ? 'bezig' : 'nodig'}</span>`,
      );
    }
    const pv = Math.min(1, popNow() / nx.pop);
    allReq = allReq && pv >= 1;
    rows.push(
      `<div class="rq"><span class="ri">${ico('☺')}</span><span>Inwoners</span><span class="v ${pv >= 1 ? 'ok' : ''}">${popNow()} / ${nx.pop}</span><div class="bar ${pv >= 1 ? '' : 'acc'}"><i style="width:${pv * 100}%"></i></div></div>`,
    );
    // Grondstoffen: wat nog ontbreekt krijgt een eigen regel, wat al genoeg is één regel samen
    const enough = [];
    for (const k in nx.cost) {
      const v = Math.min(1, G.res[k] / nx.cost[k]);
      allReq = allReq && v >= 1;
      if (v >= 1) enough.push(RES[k].n);
      else
        rows.push(
          `<div class="rq">${gem(k)}<span>${RES[k].n}</span><span class="v">${fmt(G.res[k])} / ${fmt(nx.cost[k])}</span><div class="bar acc"><i style="width:${v * 100}%"></i></div></div>`,
        );
      if (v < 1 && !fix && GATHER.includes(k) && !avail[k]) fix = k;
    }
    if (enough.length)
      rows.push(
        `<span class="ck ok">${ico('✓')}</span><span class="done">Genoeg ${andJoin(enough.map(n => n.toLowerCase()))}</span><span class="v ok">klaar</span>`,
      );
    // Hoeveel van de eisen al klaar zijn (gebouwen, inwoners, elke grondstof)
    total = nx.need.length + 1 + Object.keys(nx.cost).length;
    ready =
      nx.need.filter(built).length +
      (popNow() >= nx.pop ? 1 : 0) +
      Object.keys(nx.cost).filter(k => G.res[k] >= nx.cost[k]).length;
  }
  const miss = nx ? lackList(nx) : [];
  const goals = goalsHTML();
  const sig = JSON.stringify([G.age, rows, ready, allReq, G.won, fix, miss, goals, store.missionOpen]);
  setHTML($('#mission'), 'mission', sig, () => {
    if (!nx)
      return `${goals}<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Laatste tijdperk</span><i>${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><p class="why">${CHAPTERS[G.age].s}</p>${G.won ? '<p class="why">Je hebt gewonnen. Bouw gerust verder.</p>' : ''}</div>`;
    const A = AGES[G.age + 1];
    // Het vak "Winnen" boven het tijdperk, zodat alles over het volgende tijdperk bij elkaar blijft
    return `${goals}<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Naar de ${A.n.toLowerCase()}</span><i>${AGES[G.age].r} → ${A.r} ${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><div class="ages">${AGES.map((a, i) => `<i class="${i <= G.age ? 'done' : ''}" title="${a.n}"></i>`).join('')}</div><p class="why">${A.sub}</p><div class="rqsum"><span>${ready} van ${total} eisen klaar</span><div class="bar ${ready >= total ? '' : 'acc'}"><i style="width:${(ready / total) * 100}%"></i></div></div>
    <button class="primary" id="ageBtn" ${allReq ? '' : 'disabled'}>${allReq ? 'Ga naar de ' + A.n.toLowerCase() + ' →' : 'Nog ' + andJoin(miss) + ' nodig'}</button>
    ${fix ? `<button id="fixBtn">Gebied uitbreiden</button><p class="why">Er ligt nog geen ${RES[fix].n.toLowerCase()} binnen je grenzen.</p>` : ''}
    <div class="reqs">${rows.join('')}</div></div>`;
  });
  $('#mission').classList.toggle('closed', !store.missionOpen);
}
/** Zo win je: een klein vak met één korte regel per gekozen doel (zie data/victories.js) en hoe ver je bent. */
function goalsHTML() {
  const rows = victoryGoals().map(({ v, text }) => {
    const won = G.won && G.wonBy === v.k;
    return `<div class="wg ${won ? 'ok' : ''}" title="${v.d}">${ico(v.g)}<span>${v.n}</span><small>${won ? 'gewonnen' : text}</small></div>`;
  });
  return `<div class="wingoals"><span class="wgl">Winnen</span><div class="wgrows">${rows.join('')}</div></div>`;
}
$('#mission').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.id === 'ageBtn') ageUp();
  else if (t.id === 'fixBtn') {
    sfx('tick');
    setExpand(true);
    if (isCompact()) togglePanel();
  } else if (t.id === 'ageToggle') {
    sfx('tick');
    if (isCompact()) {
      document.body.classList.remove('showgoal');
      measureHud();
      return;
    }
    store.missionOpen = !store.missionOpen;
    sigs.mission = null;
    renderChronicle();
  }
});
