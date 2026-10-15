// Tooltip als je met de muis over iets in de wereld beweegt.
import { store } from '../core/store';
import { W } from '../config';
import { B } from '../data/buildings';
import { bossForAge, bossName } from '../data/bosses';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { FOES, UNITS } from '../data/units';
import { canPlace, ghostPos } from '../game/placement';
import { sel } from '../game/state';
import { CUR } from '../input/cursors';
import { drag, mouse } from '../input/input';
import { bAtScreen, campAt, foeAt, rbAt, unitAt, villAt } from '../input/selection';
import { ownerAt } from '../game/rivals';
import { rivalBuildingTip, rivalLandTip, rivalUnitTip } from './rivals';
import { VH, VW, cv } from '../render/scene';
import { bShort } from './buildmenu';
import { chevronsHTML, rankTip } from './army';
import { unitRank } from '../game/army';
import { esc, fmt } from './format';
import { $ } from '../util/dom';
import { SET } from '../core/settings';
import { clamp } from '../util/math';
import { amt, inb, isUnl, node, nodeVis } from '../world/world';

// Tooltip voor je eigen soldaat: naam met rangstreepjes, daaronder rang, leven en of hij vecht
function ownUnitTip(u) {
  const name = UNITS[u.k].n + chevronsHTML(unitRank(u));
  const health = `${Math.ceil(u.hp)}/${Math.round(u.mhp)} leven`;
  const doing = u.tgt ? 'in gevecht' : 'paraat';
  return `<b>${name}</b><span>${rankTip(u)}${health} · ${doing}</span>`;
}

// Tooltip bij de muis
export function updateHover() {
  const tip = $('#hovertip');
  if (!(drag && drag.mode === 'pan')) {
    if (store.placing) cv.style.cursor = CUR.build;
    else if (store.demoMode) cv.style.cursor = CUR.demo;
    else if (store.cmdMode) cv.style.cursor = CUR.atk;
  }
  if (store.placing && mouse.in && !mouse.touch && !(drag && drag.mode === 'pan')) {
    const [gx, gy] = ghostPos(),
      err = canPlace(store.placing, gx, gy);
    tip.className = err ? 'bad' : 'ok';
    tip.innerHTML = err ? `<b>${err}</b>` : `<b>${B[store.placing].n}</b><span>Klik om te bouwen</span>`;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = clamp(mouse.sx + 18, 8, VW - r.width - 8) + 'px';
    tip.style.top = clamp(mouse.sy + 20, 8, VH - r.height - 8) + 'px';
    return;
  }
  if (tip.className) tip.className = '';
  // Uitleg bij de muis uitgezet in de instellingen (meldingen bij het bouwen blijven wel)
  if (!SET.tips) {
    tip.hidden = true;
    return;
  }
  if (mouse.in && tip.dataset.tile) delete tip.dataset.tile;
  if (
    !mouse.in ||
    drag ||
    mouse.touch ||
    store.placing ||
    store.expandMode ||
    store.demoMode ||
    store.cmdMode
  ) {
    if (!tip.dataset.res && !tip.dataset.tile) tip.hidden = true;
    if (!mouse.in || mouse.touch) store.hover = null;
    return;
  }
  if (!mouse.moved) return;
  mouse.moved = false;
  const X = mouse.X,
    Y = mouse.Y,
    ix = Math.floor(mouse.tx),
    iy = Math.floor(mouse.ty);
  let h: string | null = null;
  const f = foeAt(X, Y),
    u = unitAt(X, Y),
    v = villAt(X, Y),
    c = campAt(X, Y),
    b = bAtScreen(X, Y),
    rb = !b && rbAt(X, Y); // gebouw van een rivaal
  const enemy = f || c || rb;
  cv.style.cursor = sel.us.size && enemy ? CUR.atk : u || v || b || c || rb ? CUR.hand : CUR.def;
  // Wat onder de muis staat krijgt een omlijning (zie render.ts)
  const hit = f || u || v || c || b || rb;
  store.hover = hit ? { kind: hit.kind, id: hit.id } : null;
  if (f && f.rival) h = rivalUnitTip(f);
  else if (f && f.boss) {
    // Een kampioen: zijn naam, en wat hem verslaan oplevert (f.boss is altijd een tijdperk met een kampioen)
    const boss = bossForAge(f.boss)!;
    h = `<b>${bossName(boss)}</b><span>Kampioen · ${fmt(f.hp)}/${fmt(f.mhp)} leven · verslaan = extra zegening</span>`;
  } else if (f)
    h = `<b>${FOES[f.type].n.replace(/en$|s$/, '')}</b><span>Vijand · ${Math.ceil(f.hp)} levenspunten</span>`;
  else if (u) h = ownUnitTip(u);
  else if (v)
    h = `<b>${esc(v.name)}</b><span>${v.job === 'auto' ? 'Automatisch' : v.job === 'build' ? 'Bouwer' : RES[v.job].n}${v.carry.amt ? ` · draagt ${v.carry.amt}` : ''}</span>`;
  else if (c) h = `<b>Vijandelijk kamp</b><span>Niveau ${c.tier + 1} · klik om te bekijken</span>`;
  else if (rb) h = rivalBuildingTip(rb);
  else if (b) {
    const d = B[b.type];
    h = `<b>${d.n}</b><span>${b.done ? bShort(b.type) : 'In aanbouw · ' + Math.floor((b.prog / b.bt) * 100) + '%'}</span>`;
  } else if (inb(ix, iy)) {
    const i = iy * W + ix;
    if (nodeVis(i)) {
      const N = NODES[node[i]];
      h = `<b>${N.n}</b><span>${fmt(amt[i])} ${RES[N.res].n.toLowerCase()}${isUnl(ix, iy) ? '' : ' · buiten je land'}</span>`;
    } else if (ownerAt(ix, iy)) h = rivalLandTip(ownerAt(ix, iy));
    else if (!isUnl(ix, iy)) h = `<b>Onontgonnen land</b><span>Breid je gebied uit om hier te bouwen</span>`;
  }
  if (!h) {
    tip.hidden = true;
    return;
  }
  tip.innerHTML = h;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = clamp(mouse.sx + 16, 8, VW - r.width - 8) + 'px';
  tip.style.top = clamp(mouse.sy + 18, 8, VH - r.height - 60) + 'px';
}
