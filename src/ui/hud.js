// Algemene HUD: meldingen, snelheid en knoppen.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { B } from '../data/buildings.js';
import { has } from '../game/economy.js';
import { th } from '../game/events.js';
import { isMarching, isRaider } from '../game/military.js';
import { buildCost, lackText } from '../game/placement.js';
import { G, bById, sel } from '../game/state.js';
import { selectArmy, selectIdle, zoomTo } from '../input/input.js';
import { clearSel } from '../input/selection.js';
import { centerOn } from '../render/camera.js';
import { cam } from '../render/scene.js';
import { ageUp } from './age.js';
import { setTab } from './buildmenu.js';
import { setHTML, sigs } from './header.js';
import { $, isCompact } from '../util/dom.js';
import { dist } from '../util/math.js';
import { togglePanel } from './panel.js';
import { ico } from './glyphs.js';

export let lastSpeed = 1,
  toastTimer = 0;
export function note(text, kind = '') {
  if (!G) return;
  G.log.unshift({
    d: G.day,
    t: text,
    k: kind,
    x: store.notePos ? store.notePos[0] : undefined,
    y: store.notePos ? store.notePos[1] : undefined,
    id: G.nid++,
  });
  store.notePos = null;
  G.log.length = Math.min(G.log.length, 40);
  store.uiDirty = true;
}
export function toast(msg, kind = '') {
  if (kind === 'bad') sfx('bad', 0.6);
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = kind), kind === 'bad' ? 5200 : 3400);
  note(msg, kind);
}
let bannerTimer = 0;
/** Een grote kaart midden in beeld (een nieuw tijdperk, de finale). Na `ms` milliseconden is hij weer weg. */
export function showBanner(html, ms = 4500) {
  const banner = $('#banner');
  banner.innerHTML = html;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), ms);
}
export function pulseRes(k) {
  const el = document.querySelector(`#resbar .res[data-k="${k}"]`);
  if (el) {
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 400);
  }
}
export function setSpeed(s) {
  if (s) lastSpeed = s;
  G.speed = s;
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === s));
  store.uiDirty = true;
}
$('#speed').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) setSpeed(+b.dataset.s);
});
export function setExpand(on) {
  store.expandMode = on;
  if (on) {
    store.placing = null;
    clearSel();
    if (cam.z > 0.42) zoomTo(0.38);
  }
  store.uiDirty = true;
}
$('#expandBtn').onclick = () => {
  sfx('tick');
  setExpand(!store.expandMode);
  if (isCompact()) document.body.classList.remove('showmap');
};
$('#coachBtn').onclick = () => {
  if (!store.coachAct) return;
  sfx('tick');
  const a = store.coachAct;
  if (a.b) {
    setTab(B[a.b].cat);
    store.placing = a.b;
    store.expandMode = false;
    clearSel();
    sigs.grid = null;
    if (!has(buildCost(a.b))) toast(`Nog ${lackText(buildCost(a.b))} nodig. Je kunt alvast een plek zoeken.`);
  } else if (a.k === 'expand') setExpand(true);
  else if (a.k === 'age') ageUp();
  else if (a.k === 'alarm') {
    // De dichtstbijzijnde aanvaller, of anders de dichtstbijzijnde soldaat van een rivaal die nog onderweg is
    const h = th(),
      near = (p, q) => dist(p.x, p.y, h.x, h.y) - dist(q.x, q.y, h.x, h.y),
      f = G.foes.filter(isRaider).sort(near)[0] || G.foes.filter(isMarching).sort(near)[0];
    if (f) centerOn(f.x, f.y);
  } else if (a.k === 'sel') {
    const b = bById.get(a.id);
    if (b) {
      clearSel();
      sel.b = b.id;
      centerOn(b.x + 1, b.y + 1);
    }
  }
  store.uiDirty = true;
};
$('#cancelBtn').onclick = () => {
  store.placing = null;
  store.cmdMode = null;
  store.demoMode = false;
  setExpand(false);
  clearSel();
  store.uiDirty = true;
};
// Op een telefoon: tik op de "volgende stap" om de uitleg en het tijdperk-doel te zien
$('#step').addEventListener('click', e => {
  if (isCompact() && !e.target.closest('button')) togglePanel('goal');
});
// Snelknoppen naast het inwonertal
export function renderQuick() {
  const idle = G.vs.filter(v => !v.hidden && v.state === 'idle').length,
    showIdle = idle >= 2 && G.t > 60;
  const sig = [showIdle && idle, G.us.length].join();
  setHTML(
    $('#quick'),
    'quick',
    sig,
    () =>
      (showIdle
        ? `<button class="pbtn" data-q="idle" title="Selecteer dorpelingen zonder werk (sneltoets I)"><i>${ico('☺')}</i>${idle}</button>`
        : '') +
      (G.us.length
        ? `<button class="pbtn" data-q="army" title="Selecteer het hele leger (sneltoets Q)"><i>${ico('⚔')}</i>${G.us.length}</button>`
        : ''),
  );
}
$('#quick').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  sfx('tick');
  if (t.dataset.q === 'idle') selectIdle();
  else if (t.dataset.q === 'army') selectArmy();
  store.uiDirty = true;
});
