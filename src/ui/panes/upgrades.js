// Paneel "Verbeteren": werktuigen, wapens, gebouwen en uitvindingen, steeds met wat het oplevert.
import { store } from '../../core/store.js';
import { sfx } from '../../audio/sound.js';
import { AGES } from '../../data/ages.js';
import { B } from '../../data/buildings.js';
import { TECH, TK } from '../../data/tech.js';
import { has, pay } from '../../game/economy.js';
import { G } from '../../game/state.js';
import {
  armsCost,
  armsRows,
  canUpg,
  hasT,
  lvlOf,
  toolRows,
  upgradeRows,
  toolCost,
  upgCost,
  upgrade,
  upgradeArms,
  upgradeTools,
} from '../../game/upgrades.js';
import { compareHTML, compareText, costHTML, esc } from '../format.js';
import { iconFor } from '../../render/icons.js';
import { ico } from '../glyphs.js';
import { setHTML, sigs } from '../header.js';
import { toast } from '../hud.js';
import { $ } from '../../util/dom.js';

// Volgende tijdperk als tekst, voor "volgende verbetering in de ..."
const nextAgeName = () => (AGES[G.age + 1] ? 'de ' + AGES[G.age + 1].n.toLowerCase() : 'een later tijdperk');

/** Eén blok: titel, uitleg, vergelijking nu → straks, kosten en knop. */
function block(key, title, level, about, rows, cost, maxed) {
  const can = !maxed && has(cost);
  return `<div class="ublock ${can ? 'can' : ''}"><div class="ut"><b>${title}</b><span>niveau ${level + 1}</span></div><p>${about}</p>${
    maxed
      ? `<div class="why">Volgende verbetering in ${nextAgeName()}.</div>`
      : `${compareHTML(rows)}<div class="upf">${costHTML(cost)}<button class="primary" data-g="${key}" ${can ? '' : 'disabled'}>Verbeteren</button></div>`
  }</div>`;
}

export function renderUpgrades() {
  const up = G.bs.filter(canUpg),
    aff = up.filter(b => has(upgCost(b))),
    techOpen = TECH.filter(T => T.age <= G.age && !hasT(T.k)).length,
    open = up.length + (G.age - G.toolLvl) + (G.age - G.armsLvl) + techOpen;
  $('#upgSect').textContent = open > 0 ? `${open} mogelijk` : 'alles klaar';
  const sig = JSON.stringify([
    G.age,
    G.toolLvl,
    G.armsLvl,
    has(toolCost()),
    has(armsCost()),
    up.map(b => b.id + ':' + lvlOf(b)),
    aff.length,
    Object.keys(G.tech),
    G.research && [G.research.k, Math.floor(G.research.t / 2)],
    TECH.map(T => (has(T.cost) ? 1 : 0)).join(''),
  ]);
  setHTML($('#upgrades'), 'upg', sig, () => {
    // 1. Werktuigen en wapens: gelden voor iedereen tegelijk
    let h = block(
      'tools',
      `${ico('⚒')} Werktuigen`,
      G.toolLvl,
      'Al je dorpelingen verzamelen sneller en dragen meer per keer.',
      toolRows(),
      toolCost(),
      G.toolLvl >= G.age,
    );
    h += block(
      'arms',
      `${ico('⛨')} Wapens en pantser`,
      G.armsLvl,
      'Je hele leger slaat harder en kan meer hebben, ook soldaten die je later traint.',
      armsRows(),
      armsCost(),
      G.armsLvl >= G.age,
    );

    // 2. Gebouwen: per soort één regel, met wat het belangrijkste is dat verbetert
    h += `<div class="usub">Gebouwen</div>`;
    if (!up.length)
      h += `<p class="small">Niets te verbeteren. Elk nieuw tijdperk geeft gebouwen een niveau extra.</p>`;
    else {
      const byType = {};
      for (const b of up) (byType[b.type] = byType[b.type] || []).push(b);
      h += `<div class="ulist">${Object.entries(byType)
        .map(([k, list]) => {
          const b = list[0],
            rows = upgradeRows(b),
            main = rows[0],
            c = upgCost(b),
            n = list.filter(x => has(upgCost(x))).length;
          return `<button class="urow" data-ut="${k}" ${n ? '' : 'disabled'} title="${esc(compareText(rows))}"><img src="${iconFor(k)}" alt=""><span><b>${B[k].n}${list.length > 1 ? ` ×${list.length}` : ''} · niveau ${lvlOf(b) + 1} → ${lvlOf(b) + 2}</b><small>${main[0]} ${main[1]} → ${main[2]}</small></span>${costHTML(c, true)}</button>`;
        })
        .join('')}</div>`;
      if (aff.length > 1)
        h += `<div class="upf"><span class="small">${aff.length} betaalbaar</span><button data-g="all">Alles verbeteren</button></div>`;
    }

    // 3. Uitvindingen: eerst wat nu kan, dan wat klaar is, dan een blik vooruit
    const now = TECH.filter(T => T.age <= G.age && !hasT(T.k)),
      done = TECH.filter(T => hasT(T.k)),
      soon = TECH.filter(T => T.age === G.age + 1);
    h += `<div class="usub">Uitvindingen <span class="small">${done.length}/${TECH.length}</span></div>`;
    if (G.research) {
      const T = TK[G.research.k];
      h += `<div class="ublock can"><div class="ut"><b>${ico(T.g)} ${T.n}</b><span>bezig · ${Math.ceil(T.t - G.research.t)}s</span></div><p>${T.d}</p><div class="bar acc"><i style="width:${(G.research.t / T.t) * 100}%"></i></div></div>`;
    }
    for (const T of now) {
      if (G.research && G.research.k === T.k) continue;
      const can = !G.research && has(T.cost);
      h += `<button class="tech ${can ? '' : ''}" data-tech="${T.k}" ${can ? '' : 'disabled'} title="${esc(T.d)}"><span class="g">${ico(T.g)}</span><b>${T.n}</b><span class="d">${T.d} · ${T.t}s</span>${costHTML(T.cost)}</button>`;
    }
    if (!now.length && !G.research)
      h += `<p class="small">Alle uitvindingen van dit tijdperk zijn klaar.</p>`;
    if (soon.length)
      h += `<p class="small" style="margin-top:8px">In ${nextAgeName()}: ${soon.map(T => T.n).join(', ')}.</p>`;
    if (done.length)
      h += `<p class="small" style="margin-top:6px">${ico('✓')} Klaar: ${done.map(T => T.n).join(', ')}.</p>`;
    return h;
  });
}
$('#upgrades').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  if (t.dataset.tech) {
    const T = TK[t.dataset.tech];
    if (!G.research && has(T.cost)) {
      pay(T.cost);
      G.research = { k: T.k, t: 0 };
      toast(`Onderzoek gestart: ${T.n} (${T.t}s).`);
    }
    sigs.upg = null;
    store.uiDirty = true;
    return;
  }
  if (t.dataset.ut) {
    // Alle gebouwen van deze soort verbeteren die je kunt betalen
    let n = 0;
    for (const b of G.bs.filter(x => x.type === t.dataset.ut && canUpg(x))) if (upgrade(b, true)) n++;
    toast(
      n ? `${n} × ${B[t.dataset.ut].n.toLowerCase()} verbeterd.` : 'Te weinig grondstoffen.',
      n ? 'good' : 'bad',
    );
  } else if (t.dataset.g === 'tools') upgradeTools();
  else if (t.dataset.g === 'arms') upgradeArms();
  else if (t.dataset.g === 'all') {
    let n = 0;
    for (const b of G.bs
      .filter(canUpg)
      .sort(
        (a, c) =>
          Object.values(upgCost(a)).reduce((x, y) => x + y, 0) -
          Object.values(upgCost(c)).reduce((x, y) => x + y, 0),
      ))
      if (upgrade(b, true)) n++;
    toast(
      n ? `${n} ${n === 1 ? 'gebouw' : 'gebouwen'} verbeterd.` : 'Te weinig grondstoffen.',
      n ? 'good' : 'bad',
    );
  }
  sigs.upg = null;
  store.uiDirty = true;
});
