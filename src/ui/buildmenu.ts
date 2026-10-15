import type { Cost } from '../types';
// Het bouwmenu (knoppenraster rechtsonder).
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGES } from '../data/ages';
import { B, BKEYS, CATS } from '../data/buildings';
import { RES } from '../data/resources';
import { UNITS } from '../data/units';
import { has } from '../game/economy';
import { lackText } from '../game/placement';
import { G, sel } from '../game/state';
import { mouse } from '../input/input';
import { clearSel } from '../input/selection';
import { iconFor } from '../render/icons';
import { VW, worldEl } from '../render/scene';
import { costHTML, esc, hy } from './format';
import { setHTML, sigs } from './header';
import { toast } from './hud';
import { insHandler, selCmds, selCtx } from './inspector';
import { $ } from '../util/dom';
import { clamp } from '../util/math';
import { canMake } from '../data/succession';

export const costText = (c: Cost): string =>
  Object.keys(c)
    .map(k => `${c[k]} ${RES[k].n.toLowerCase()}`)
    .join(', ');

// Bouwmenu
export function bShort(k: string): string {
  const d = B[k];
  if (d.road) return 'Sneller lopen · sleep om aan te leggen';
  if (d.wall) return d.gate ? 'Eigen volk door, vijand niet' : `Muur · ${d.hp} leven · sleep een lijn`;
  if (d.pop) return `+${d.pop} inwoners`;
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
        .filter(u => UNITS[u].src === d.train && UNITS[u].age <= Math.max(G.age, d.age))
        .map(u => UNITS[u].n.toLowerCase())
        .slice(-2)
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
function bDesc(k: string): string {
  const d = B[k];
  return (d.desc ? d.desc + ' ' : '') + bShort(k) + (d.power ? ` · verbruikt ${d.power} stroom` : '');
}
const CATKEY: Record<string, string> = { home: 'Z', eco: 'X', light: 'C', mil: 'B' };
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
export function setTab(k: string) {
  store.tab = k;
  sigs.cats = null;
  sigs.grid = null;
  renderCmd();
}
$('#cats').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-t]');
  if (!b) return;
  sfx('tick');
  setTab(b.dataset.t!);
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
    avail.map(k => (has(B[k].cost) ? 1 : 0)).join('');
  setHTML(
    $('#cmdgrid'),
    'grid',
    sig,
    () =>
      avail
        .map(k => {
          const d = B[k];
          return `<button class="gb ${store.placing === k ? 'active' : ''} ${has(d.cost) ? '' : 'poor'} ${store.coachTile === k && store.placing !== k ? 'hint' : ''}" data-b="${k}" aria-pressed="${store.placing === k}" aria-label="${d.n}">${d.age === G.age && G.age > 0 ? '<span class="nw">nieuw</span>' : ''}<img src="${iconFor(k)}" alt=""><b>${hy(d.n)}</b></button>`;
        })
        .join('') +
      (next.length && G.age < 5
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
  if (selCmds != null) {
    setHTML($('#cats'), 'cats', 'c' + selCtx, () => `<span class="ctx">${esc(selCtx)}</span>`);
    setHTML($('#cmdgrid'), 'grid', 'c' + selCmds, () => selCmds!);
    return;
  }
  renderCats();
  renderBuilds();
}
function buildTileClick(c: HTMLElement) {
  sfx('tick');
  if (c.dataset.locked) {
    toast(
      `${B[c.dataset.locked].n} wordt beschikbaar in de ${AGES[B[c.dataset.locked].age].n.toLowerCase()}.`,
    );
    return;
  }
  const k = c.dataset.b!;
  store.placing = store.placing === k ? null : k;
  store.expandMode = false;
  const keepV = [...sel.vs];
  clearSel();
  keepV.forEach(id => sel.vs.add(id));
  hideTip();
  if (store.placing && !has(B[k].cost))
    toast(`Nog ${lackText(B[k].cost)} nodig. Je kunt alvast een plek zoeken.`);
  sigs.grid = null;
  store.uiDirty = true;
}
$('#cmdgrid').addEventListener('click', e => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('.gb');
  if (c) {
    buildTileClick(c);
    return;
  }
  insHandler(e);
});
$('#cmdgrid').addEventListener('pointerover', e => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('.gb');
  if (!c || mouse.touch) return;
  const k = c.dataset.b || c.dataset.locked!,
    d = B[k],
    r = c.getBoundingClientRect(),
    tip = $('#hovertip'),
    idx = [...document.querySelectorAll('#cmdgrid .gb[data-b]')].indexOf(c);
  tip.className = '';
  tip.innerHTML = `<b>${d.n}</b><span>${esc(bDesc(k))}</span>${d.age > G.age ? `<span>Beschikbaar in de ${AGES[d.age].n.toLowerCase()}.</span>` : costHTML(d.cost) + (has(d.cost) ? '' : `<span>Nog ${lackText(d.cost)} nodig.</span>`)}${idx >= 0 && idx < 9 ? `<span class="key">Sneltoets ${idx + 1}</span>` : ''}`;
  tip.hidden = false;
  const w = worldEl.getBoundingClientRect();
  tip.style.left = clamp(r.left - w.left + r.width / 2 - 135, 8, VW - 280) + 'px';
  tip.style.top = Math.max(8, r.top - w.top - tip.offsetHeight - 10) + 'px';
});
$('#cmdgrid').addEventListener('pointerout', e => {
  const to = e.relatedTarget as Element | null;
  if (!to || !to.closest || !to.closest('.gb')) hideTip();
});
function hideTip() {
  $('#hovertip').hidden = true;
}
