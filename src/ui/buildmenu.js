// Het bouwmenu (knoppenraster rechtsonder).
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { AGES } from '../data/ages.js';
import { SET } from '../core/settings.js';
import { B, BKEYS, CATS } from '../data/buildings.js';
import { RES } from '../data/resources.js';
import { UNITS } from '../data/units.js';
import { has } from '../game/economy.js';
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

export const costText = c =>
  Object.keys(c)
    .map(k => `${c[k]} ${RES[k].n.toLowerCase()}`)
    .join(', ');

// Bouwmenu
export function bShort(k) {
  const d = B[k];
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
        .filter(u => UNITS[u].src === d.train && canMake(u, Math.max(G.age, d.age)))
        .map(u => UNITS[u].n.toLowerCase())
        .join(', ')
    );
  if (d.light) return `Licht in de nacht · straal ${d.light}`;
  if (d.drop) return 'Inleverpunt voor grondstoffen';
  if (d.work) return 'Voedsel · plek voor 3 boeren';
  if (d.market) return 'Handel tegen goud';
  if (d.once) return '+30% verzamelsnelheid';
  if (d.pump) return 'Pompt olie op een bron';
  if (d.win) return 'Voltooi je beschaving';
  return '';
}
function bDesc(k) {
  const d = B[k];
  return (d.desc ? d.desc + ' ' : '') + bShort(k) + (d.power ? ` · verbruikt ${d.power} stroom` : '');
}
const CATKEY = { home: 'Z', eco: 'X', light: 'C', mil: 'B' };
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
  const avail = BKEYS.filter(k => !B[k].nobuild && B[k].cat === store.tab && canMake(k, G.age)),
    next = BKEYS.filter(k => !B[k].nobuild && B[k].cat === store.tab && B[k].age === G.age + 1);
  const sig =
    'b' +
    store.tab +
    G.age +
    store.placing +
    store.coachTile +
    avail.map(k => (has(buildCost(k)) ? 1 : 0)).join('');
  setHTML(
    $('#cmdgrid'),
    'grid',
    sig,
    () =>
      avail
        .map(k => {
          const d = B[k];
          return `<button class="gb ${store.placing === k ? 'active' : ''} ${has(buildCost(k)) ? '' : 'poor'} ${store.coachTile === k && store.placing !== k ? 'hint' : ''}" data-b="${k}" aria-pressed="${store.placing === k}" aria-label="${d.n}">${d.age === G.age && G.age > 0 ? '<span class="nw">nieuw</span>' : ''}<img src="${iconFor(k)}" alt=""><b>${hy(d.n)}</b></button>`;
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
  showTileTip(
    c,
    `<b>${d.n}</b><span>${esc(bDesc(k))}</span>${d.age > G.age ? when : costHTML(cost) + lack}${key}`,
  );
});
$('#cmdgrid').addEventListener('pointerout', e => {
  if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.gb,.cb')) hideTip();
});
function hideTip() {
  delete $('#hovertip').dataset.tile;
  $('#hovertip').hidden = true;
}
