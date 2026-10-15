// Het bouwmenu (knoppenraster rechtsonder).
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { AGES } from '../data/ages.js';
import { SET } from '../core/settings.js';
import { B, BKEYS, CATS } from '../data/buildings.js';
import { RES } from '../data/resources.js';
import { UNITS } from '../data/units.js';
import { mul } from '../game/bonus.js';
import { has } from '../game/economy.js';
import { ruleAllowsBuilding } from '../game/mods.js';
import { buildCost, lackText } from '../game/placement.js';
import { G, sel } from '../game/state.js';
import { mouse } from '../input/input.js';
import { clearSel } from '../input/selection.js';
import { iconFor } from '../render/icons.js';
import { VW, worldEl } from '../render/scene.js';
import { costHTML, esc, hy } from './format.js';
import { setHTML, sigs } from './header.js';
import { toast } from './hud.js';
import { insHandler, selCmds, selCtx } from './inspector.js';
import { $ } from '../util/dom.js';
import { clamp } from '../util/math.js';
import { canMake } from '../data/succession.js';
import { wonderBlockedNote, wonderStatus } from '../game/wonders.js';
import { RIVAL } from '../data/rivals.js';
import { WONDER_CREW, rivalWonderTime, winBackText, wonderBuildTime } from '../data/wonders.js';
import { ico } from './glyphs.js';
import { CHARGE_NIGHTS } from '../data/finale.js';

export const costText = c =>
  Object.keys(c)
    .map(k => `${c[k]} ${RES[k].n.toLowerCase()}`)
    .join(', ');

// Bouwmenu
export function bShort(k) {
  const d = B[k];
  if (d.wonder) return d.perk;
  if (d.road) return 'Sneller lopen · sleep om aan te leggen';
  if (d.wall) return d.gate ? 'Eigen volk door, vijand niet' : `Muur · ${d.hp} leven · sleep een lijn`;
  if (d.pop) return `+${d.pop} inwoners`;
  // Een molen heeft niets nodig: die maakt vanzelf iets
  if (d.conv && !Object.keys(d.conv.in).length)
    return 'Maakt vanzelf ' + Object.keys(d.conv.out).map(r => RES[r].n.toLowerCase());
  if (d.conv)
    return (
      Object.keys(d.conv.in)
        .map(r => RES[r].n.toLowerCase())
        .join(' + ') +
      ' → ' +
      Object.keys(d.conv.out)
        .map(r => RES[r].n.toLowerCase())
        .join('')
    );
  if (d.gen)
    return `+${d.gen.power} stroom${
      d.gen.in
        ? ' uit ' +
          Object.keys(d.gen.in)
            .map(r => RES[r].n.toLowerCase())
            .join('')
        : ''
    }`;
  if (d.def) return `Schade ${d.def.dmg} · bereik ${d.def.r}${d.def.air ? ' · ook drones' : ''}`;
  if (d.train)
    return (
      'Traint ' +
      Object.keys(UNITS)
        .filter(u => UNITS[u].src === d.train && canMake(u, Math.max(G.age, d.age), G.people))
        .map(u => UNITS[u].n.toLowerCase())
        .join(', ')
    );
  if (d.light) return `Licht in de nacht · straal ${d.light}`;
  if (d.drop) return 'Inleverpunt voor grondstoffen';
  if (d.work) return 'Voedsel · plek voor 3 boeren';
  if (d.market) return 'Handel tegen goud';
  if (d.once) return '+30% verzamelsnelheid';
  if (d.pump) return 'Pompt olie op een bron';
  // Of de sterrenpoort laat winnen, hangt af van de doelen die je bij een nieuwe wereld koos.
  // In een uitdaging telt alleen het doel van de uitdaging.
  if (d.win && G.scenario) return 'In deze uitdaging win je met het doel van de uitdaging';
  if (d.win)
    return G.opts.victories.includes('stargate')
      ? `Laadt ${CHARGE_NIGHTS} nachten op; blijft hij heel, dan win je`
      : 'Winnen hiermee staat uit in deze wereld';
  return '';
}
function bDesc(k) {
  const d = B[k];
  return (d.desc ? d.desc + ' ' : '') + bShort(k) + (d.power ? ` · verbruikt ${d.power} stroom` : '');
}
const CATKEY = { home: 'Z', eco: 'X', light: 'C', mil: 'B', wonder: 'N' };
function renderCats() {
  const hc = store.coachTile && B[store.coachTile].cat;
  setHTML($('#cats'), 'cats', 'b' + store.tab + hc, () =>
    Object.keys(CATS)
      .map(
        k =>
          `<button role="tab" aria-selected="${k === store.tab}" data-t="${k}" class="${k === store.tab ? 'on' : ''} ${k === hc ? 'hint' : ''}" title="${CATS[k]} (sneltoets ${CATKEY[k]})">${CATS[k]}</button>`,
      )
      .join(''),
  );
}
export function setTab(k) {
  store.tab = k;
  sigs.cats = null;
  sigs.grid = null;
  renderCmd();
}
$('#cats').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]');
  if (!b) return;
  sfx('tick');
  setTab(b.dataset.t);
});
function renderBuilds() {
  // Wat in dit tabblad staat; zonder leger (spelregel) geen kazernes en andere trainingsgebouwen
  const inTab = k => !B[k].nobuild && B[k].cat === store.tab && ruleAllowsBuilding(k);
  const avail = BKEYS.filter(k => inTab(k) && canMake(k, G.age)),
    next = BKEYS.filter(k => inTab(k) && B[k].age === G.age + 1);
  // Wereldwonderen: hoe het ervoor staat (vrij, van jou, weg, of iemand bouwt eraan), zie game/wonders.js
  const wonder = {};
  for (const k of avail) if (B[k].wonder) wonder[k] = wonderStatus(k);
  const sig =
    'b' +
    store.tab +
    G.age +
    store.placing +
    store.coachTile +
    avail.map(k => (has(buildCost(k)) ? 1 : 0)).join('') +
    Object.values(wonder)
      .map(w => w.short + w.tone + w.rival)
      .join();
  setHTML(
    $('#cmdgrid'),
    'grid',
    sig,
    () =>
      avail
        .map(k => {
          const d = B[k];
          const w = wonder[k];
          // Een wonder dat al van iemand is, kun je niet meer neerzetten
          const owned = w && w.owner ? (w.owner === 'you' ? 'mine' : 'taken') : '';
          // Rechtsboven: hoe het ervoor staat, met het vaandel van de rivaal als het over hem gaat
          const flag = w && w.rival && RIVAL[w.rival] ? ico(RIVAL[w.rival].g) : '';
          const badge = w && w.short ? `<span class="wst ${w.tone}">${flag}${w.short}</span>` : '';
          // Bij wonderen geen "nieuw": daar staat rechtsboven al hoe het ervoor staat (en ze botsen anders)
          const isNew = d.age === G.age && G.age > 0 && !w;
          return `<button class="gb ${w ? 'wonder' : ''} ${owned} ${store.placing === k ? 'active' : ''} ${has(buildCost(k)) || owned ? '' : 'poor'} ${store.coachTile === k && store.placing !== k ? 'hint' : ''}" data-b="${k}" aria-pressed="${store.placing === k}" aria-label="${d.n}${w ? ', ' + w.text : ''}">${isNew ? '<span class="nw">nieuw</span>' : ''}${badge}<img src="${iconFor(k)}" alt=""><b>${hy(d.n)}</b></button>`;
        })
        .join('') +
      (next.length && G.age < AGES.length - 1
        ? next
            .map(
              k =>
                `<button class="gb locked" data-locked="${k}" aria-disabled="true" aria-label="${B[k].n}, vanaf de ${AGES[B[k].age].n.toLowerCase()}"><span class="lk">${AGES[B[k].age].r}</span><img src="${iconFor(k)}" alt=""><b>${hy(B[k].n)}</b></button>`,
            )
            .join('')
        : ''),
  );
}
export function renderCmd() {
  const before = sigs.grid;
  if (selCmds != null) {
    setHTML($('#cats'), 'cats', 'c' + selCtx, () => `<span class="ctx">${esc(selCtx)}</span>`);
    setHTML($('#cmdgrid'), 'grid', 'c' + selCmds, () => selCmds);
  } else {
    renderCats();
    renderBuilds();
  }
  // Nieuwe tegels: een tooltip van een oude tegel mag niet blijven hangen
  if (sigs.grid !== before && $('#hovertip').dataset.tile) hideTip();
}
function buildTileClick(c) {
  sfx('tick');
  if (c.dataset.locked) {
    toast(
      `${B[c.dataset.locked].n} wordt beschikbaar in de ${AGES[B[c.dataset.locked].age].n.toLowerCase()}.`,
    );
    return;
  }
  const k = c.dataset.b;
  // Een wereldwonder dat al van iemand is (of waar je al aan bouwt): zeg waarom het niet kan
  const blocked = B[k].wonder && wonderBlockedNote(k);
  if (blocked) {
    toast(blocked);
    return;
  }
  store.placing = store.placing === k ? null : k;
  store.expandMode = false;
  const keepV = [...sel.vs];
  clearSel();
  keepV.forEach(id => sel.vs.add(id));
  hideTip();
  if (store.placing && !has(buildCost(k)))
    toast(`Nog ${lackText(buildCost(k))} nodig. Je kunt alvast een plek zoeken.`);
  sigs.grid = null;
  store.uiDirty = true;
}
$('#cmdgrid').addEventListener('click', e => {
  const c = e.target.closest('.gb');
  if (c) {
    buildTileClick(c);
    return;
  }
  insHandler(e);
});
// Tooltip boven een tegel: de tip komt net boven de tegel, binnen het scherm
function showTileTip(tile, html) {
  if (!SET.tips) return;
  const tip = $('#hovertip'),
    r = tile.getBoundingClientRect(),
    w = worldEl.getBoundingClientRect();
  tip.className = '';
  tip.dataset.tile = 1; // zo laat hover.js deze tip staan als de muis niet boven de wereld is
  tip.innerHTML = html;
  tip.hidden = false;
  tip.style.left =
    clamp(r.left - w.left + r.width / 2 - tip.offsetWidth / 2, 8, VW - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.max(8, r.top - w.top - tip.offsetHeight - 10) + 'px';
}
$('#cmdgrid').addEventListener('pointerover', e => {
  if (mouse.touch) return;
  // Opdrachttegels (trainen, verbeteren, ...): naam, uitleg en de volledige kosten
  const cmd = e.target.closest('.cb');
  if (cmd) {
    const name = cmd.getAttribute('aria-label'),
      cost = cmd.querySelector('.cost');
    const why = cmd.dataset.tip && cmd.dataset.tip !== name ? `<span>${esc(cmd.dataset.tip)}</span>` : '';
    const full = cost ? cost.outerHTML.replace(' tight', '') : '';
    showTileTip(cmd, `<b>${esc(name)}</b>${why}${full}`);
    return;
  }
  const c = e.target.closest('.gb');
  if (!c) return;
  const k = c.dataset.b || c.dataset.locked,
    d = B[k],
    idx = [...document.querySelectorAll('#cmdgrid .gb[data-b]')].indexOf(c);
  const when = `<span>Beschikbaar in de ${AGES[d.age].n.toLowerCase()}.</span>`;
  const cost = buildCost(k);
  const lack = has(cost) ? '' : `<span class="lack">Nog ${lackText(cost)} nodig.</span>`;
  const key = idx >= 0 && idx < 9 ? `<span class="key">Sneltoets <kbd>${idx + 1}</kbd></span>` : '';
  if (d.wonder) {
    showTileTip(c, wonderTip(k, d.age > G.age ? when : costHTML(cost) + lack, key));
    return;
  }
  showTileTip(
    c,
    `<b>${d.n}</b><span>${esc(bDesc(k))}</span>${d.age > G.age ? when : costHTML(cost) + lack}${key}`,
  );
});
$('#cmdgrid').addEventListener('pointerout', e => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.gb,.cb')) hideTip();
});
// Tooltip bij een wereldwonder: wat het is, de bonus, de bouwtijd, hoe het ervoor staat en de kosten
function wonderTip(k, costPart, key) {
  const d = B[k],
    w = wonderStatus(k);
  const status = `<span class="wtip ${w.tone}">${ico('★')}${esc(w.text)}</span>`;
  // Van een rivaal: zeg erbij dat je het nog terug kunt krijgen
  const winBack = w.owner && w.owner !== 'you' ? `<span>${esc(winBackText(k, w.owner))}</span>` : '';
  // Bouwtijd in seconden, met je bouwbonussen erbij
  const secs = builders => Math.round(wonderBuildTime(k, builders) / mul('build.speed'));
  const time = `<span class="wtime">Bouwtijd: ${secs(WONDER_CREW)} s met ${WONDER_CREW} bouwers, ${secs(8)} s met 8. Een rivaal doet er ${rivalWonderTime(k)} s over.</span>`;
  const rest = w.owner ? '' : time + costPart + key;
  return `<b>${d.n}</b><span>${esc(d.desc)}</span><span class="wperk">Bonus: ${esc(d.perk)}.</span>${status}${winBack}${rest}`;
}
function hideTip() {
  delete $('#hovertip').dataset.tile;
  $('#hovertip').hidden = true;
}
