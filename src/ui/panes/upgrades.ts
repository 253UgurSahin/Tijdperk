// Paneel "Verbeteren": werktuigen, wapens, gebouwen en uitvindingen, steeds met wat het oplevert.
import type { Building, Cost } from '../../types';
import { store } from '../../core/store';
import { sfx } from '../../audio/sound';
import { AGES } from '../../data/ages';
import { BLESSING } from '../../data/blessings';
import { B } from '../../data/buildings';
import { TECH, TK } from '../../data/tech';
import { has, pay } from '../../game/economy';
import { G } from '../../game/state';
import {
  armsCost,
  armsRows,
  armsUseful,
  canUpg,
  hasT,
  lvlOf,
  researchTime,
  toolRows,
  upgradeRows,
  toolCost,
  upgCost,
  upgrade,
  upgradeArms,
  upgradeTools,
} from '../../game/upgrades';
import { blessingListHTML } from '../blessings';
import { compareHTML, compareText, costHTML, esc, type CompareRow } from '../format';
import { iconFor } from '../../render/icons';
import { ico } from '../glyphs';
import { setHTML, sigs } from '../header';
import { toast } from '../hud';
import { $ } from '../../util/dom';

// Volgende tijdperk als tekst, voor "volgende verbetering in de ..."
const nextAgeName = () => (AGES[G.age + 1] ? 'de ' + AGES[G.age + 1].n.toLowerCase() : 'een later tijdperk');

/** Eén blok: titel, uitleg, vergelijking nu → straks, kosten en knop. */
function block(
  key: string,
  title: string,
  level: number,
  about: string,
  rows: CompareRow[],
  cost: Cost,
  maxed: boolean,
) {
  const can = !maxed && has(cost);
  return `<div class="ublock ${can ? 'can' : ''}"><div class="ut"><b>${title}</b><span>niveau ${level + 1}</span></div><p>${about}</p>${
    maxed
      ? `<div class="why">Volgende verbetering in ${nextAgeName()}.</div>`
      : `${compareHTML(rows)}<div class="upf">${costHTML(cost)}<button class="primary" data-g="${key}" ${can ? '' : 'disabled'}>Verbeteren</button></div>`
  }</div>`;
}

// Staat het lijstje met zegeningen open? null = nog niet aangeklikt: dan open bij weinig zegeningen,
// zodat een lange lijst later in het spel de verbeteringen niet uit beeld duwt.
const BLESSINGS_OPEN_KEY = 'tijdperken-zegeningen-open';
let blessingsOpen: boolean | null = null;
try {
  const saved = localStorage.getItem(BLESSINGS_OPEN_KEY);
  if (saved) blessingsOpen = saved === 'open';
} catch {
  // geen opslag (bijv. privévenster): dan gewoon de standaard
}
const showBlessingList = () => blessingsOpen ?? G.blessings.length <= 2;

/** Bovenaan: de zegeningen die je koos, in een uitklapblok met de pictogrammen alvast zichtbaar. */
function blessingsSection() {
  const icons = G.blessings
    .map(k => BLESSING[k])
    .filter(Boolean)
    .map(
      b => `<span class="bchip ${b.risk ? 'risk' : ''}" title="${esc(`${b.n}: ${b.d}`)}">${ico(b.g)}</span>`,
    )
    .join('');
  return `<details class="blessbox" ${showBlessingList() ? 'open' : ''}><summary class="usub">Zegeningen <span class="small">${G.blessings.length}</span><span class="bchips">${icons}</span></summary>${blessingListHTML()}</details>`;
}

export function renderUpgrades() {
  const up = G.bs.filter(canUpg),
    aff = up.filter(b => has(upgCost(b))),
    techOpen = TECH.filter(T => T.age <= G.age && !hasT(T.k)).length,
    armsOpen = armsUseful() ? G.age - G.armsLvl : 0,
    open = up.length + (G.age - G.toolLvl) + armsOpen + techOpen;
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
    G.blessings,
  ]);
  setHTML($('#upgrades'), 'upg', sig, () => {
    // 0. Zegeningen die je koos
    let h = blessingsSection();

    // 1. Werktuigen en wapens: gelden voor iedereen tegelijk
    h += block(
      'tools',
      `${ico('⚒')} Werktuigen`,
      G.toolLvl,
      'Al je dorpelingen verzamelen sneller en dragen meer per keer.',
      toolRows(),
      toolCost(),
      G.toolLvl >= G.age,
    );
    // Zonder leger (spelregel Geen leger) hebben wapens en pantser geen zin
    if (armsUseful())
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
      const byType: Record<string, Building[]> = {};
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
      h += `<div class="ublock can"><div class="ut"><b>${ico(T.g)} ${T.n}</b><span>bezig · ${Math.ceil(researchTime(T) - G.research.t)}s</span></div><p>${T.d}</p><div class="bar acc"><i style="width:${(G.research.t / researchTime(T)) * 100}%"></i></div></div>`;
    }
    for (const T of now) {
      if (G.research && G.research.k === T.k) continue;
      const can = !G.research && has(T.cost);
      h += `<button class="tech ${can ? '' : ''}" data-tech="${T.k}" ${can ? '' : 'disabled'} title="${esc(T.d)}"><span class="g">${ico(T.g)}</span><b>${T.n}</b><span class="d">${T.d} · ${Math.round(researchTime(T))}s</span>${costHTML(T.cost)}</button>`;
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
  // Zegeningen open- of dichtklappen: onthouden voordat de browser het blok omzet
  const summary = (e.target as HTMLElement).closest('.blessbox > summary');
  if (summary) {
    // De ouder van deze summary is altijd het uitklapblok (details.blessbox)
    blessingsOpen = !(summary.parentElement as HTMLDetailsElement).open;
    try {
      localStorage.setItem(BLESSINGS_OPEN_KEY, blessingsOpen ? 'open' : 'dicht');
    } catch {
      // niet erg: dan staat het na herladen weer zoals standaard
    }
    sfx('tick');
    return;
  }
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  if (t.dataset.tech) {
    const T = TK[t.dataset.tech];
    if (!G.research && has(T.cost)) {
      pay(T.cost);
      G.research = { k: T.k, t: 0 };
      toast(`Onderzoek gestart: ${T.n} (${Math.round(researchTime(T))}s).`);
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
