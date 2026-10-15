// Doelen linksboven: wat je nodig hebt voor het volgende tijdperk.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGES, AGE_UP } from '../data/ages';
import { B } from '../data/buildings';
import { GATHER, RES } from '../data/resources';
import { avail } from '../game/caches';
import { CHAPTERS, built } from '../game/chapters';
import { popNow } from '../game/entities';
import { G } from '../game/state';
import { measureHud } from '../main';
import { ageUp } from './age';
import { andJoin, lackList, placed } from './coach';
import { fmt, gem } from './format';
import { setHTML, sigs } from './header';
import { setExpand } from './hud';
import { togglePanel } from './panel';
import { $, isCompact } from '../util/dom';

export function renderChronicle() {
  const nx = AGE_UP[G.age + 1];
  const rows: string[] = [];
  let allReq = true,
    fix = '';
  if (nx) {
    for (const n of nx.need) {
      const ok = built(n);
      allReq = allReq && ok;
      rows.push(
        `<span class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '○'}</span><span>${B[n].n}</span><span class="v ${ok ? 'ok' : ''}">${ok ? 'klaar' : placed(n) ? 'bezig' : 'nodig'}</span>`,
      );
    }
    const pv = Math.min(1, popNow() / nx.pop);
    allReq = allReq && pv >= 1;
    rows.push(
      `<div class="rq"><span>☺</span><span>Inwoners</span><span class="v ${pv >= 1 ? 'ok' : ''}">${popNow()} / ${nx.pop}</span><div class="bar ${pv >= 1 ? '' : 'acc'}"><i style="width:${pv * 100}%"></i></div></div>`,
    );
    for (const k in nx.cost) {
      const v = Math.min(1, G.res[k] / nx.cost[k]);
      allReq = allReq && v >= 1;
      rows.push(
        `<div class="rq">${gem(k)}<span>${RES[k].n}</span><span class="v ${v >= 1 ? 'ok' : ''}">${fmt(G.res[k])} / ${fmt(nx.cost[k])}</span><div class="bar ${v >= 1 ? '' : 'acc'}"><i style="width:${v * 100}%"></i></div></div>`,
      );
      if (v < 1 && !fix && GATHER.includes(k) && !avail[k]) fix = k;
    }
  }
  const miss = nx ? lackList(nx) : [];
  const sig = JSON.stringify([G.age, rows, allReq, G.won, fix, miss, placed('command'), store.missionOpen]);
  setHTML($('#mission'), 'mission', sig, () => {
    if (!nx)
      return `<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Laatste tijdperk</span><i>${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><p class="why">${CHAPTERS[G.age].s}</p><div class="reqs"><span class="${built('command') ? 'ok' : 'no'}">${built('command') ? '✓' : '○'}</span><span>Commandocentrum</span><span class="v">${built('command') ? 'klaar' : 'nodig'}</span></div>${G.won ? '<p class="why">Je beschaving heeft de hele geschiedenis doorlopen.</p>' : ''}</div>`;
    const A = AGES[G.age + 1];
    return `<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Naar de ${A.n.toLowerCase()}</span><i>${AGES[G.age].r} → ${A.r} ${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><div class="ages">${AGES.map((a, i) => `<i class="${i <= G.age ? 'done' : ''}" title="${a.n}"></i>`).join('')}</div><p class="why">${A.sub}</p>
    <button class="primary" id="ageBtn" ${allReq ? '' : 'disabled'}>${allReq ? 'Ga naar de ' + A.n.toLowerCase() + ' →' : 'Nog ' + andJoin(miss) + ' nodig'}</button>
    ${fix ? `<button id="fixBtn">Gebied uitbreiden</button><p class="why">Er ligt nog geen ${RES[fix].n.toLowerCase()} binnen je grenzen.</p>` : ''}
    <div class="reqs">${rows.join('')}</div></div>`;
  });
  $('#mission').classList.toggle('closed', !store.missionOpen);
}
$('#mission').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button');
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
