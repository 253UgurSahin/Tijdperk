// Algemene HUD: meldingen, snelheid en knoppen.
import type { Foe } from '../types';
import { store } from '../core/store';
import { SET } from '../core/settings';
import { sfx } from '../audio/sound';
import { B } from '../data/buildings';
import { has } from '../game/economy';
import { th } from '../game/events';
import { isMarching, isRaider } from '../game/military';
import { buildCost, lackText } from '../game/placement';
import { G, bById, sel } from '../game/state';
import { selectIdle, zoomTo } from '../input/input';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { cam } from '../render/scene';
import { ageUp } from './age';
import { setTab } from './buildmenu';
import { setHTML, sigs } from './header';
import { $, isCompact } from '../util/dom';
import { dist } from '../util/math';
import { togglePanel } from './panel';
import { ico } from './glyphs';
import { shortToast } from './toasttext';

export let lastSpeed = 1;
export function note(text: string, kind = '') {
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
// Meldingen bovenin: hooguit twee tegelijk, en op een telefoon of naast een ander kaartje maar één (zie
// fitToasts). Komt dezelfde melding nog eens, dan telt hij op ("2× ...") in plaats van een nieuwe strook.
// Na een paar tellen zijn ze weg; alles blijft in het Logboek staan.
const MAX_TOASTS = 2;
/** Hoe lang een melding blijft staan (in ms): slecht nieuws en een nieuw tijdperk het langst. */
const toastTime = (kind: string): number => (kind === 'bad' || kind === 'age' ? 6000 : kind ? 4000 : 3500);
/** Eén melding in beeld: de korte tekst, de soort, hoe vaak hij kwam, en de klok die hem weer weghaalt. */
interface ShownToast {
  el: HTMLElement;
  text: string;
  kind: string;
  count: number;
  timer: number;
}
/** De meldingen in beeld, de oudste eerst (net als op het scherm: de nieuwste staat onderaan). */
const shownToasts: ShownToast[] = [];
function dropToast(shown: ShownToast) {
  clearTimeout(shown.timer);
  shown.el.remove();
  const i = shownToasts.indexOf(shown);
  if (i >= 0) shownToasts.splice(i, 1);
}
function newToast(text: string): ShownToast {
  const shown: ShownToast = { el: document.createElement('div'), text, kind: '', count: 0, timer: 0 };
  shown.el.addEventListener('click', () => dropToast(shown)); // tik erop: meteen weg
  return shown;
}
export function toast(msg: string, kind = '') {
  if (kind === 'bad') sfx('bad', 0.6);
  note(msg, kind);
  // In beeld alleen de eerste zin; de hele tekst staat in het Logboek (en bij de muis)
  const text = shortToast(msg);
  const shown = shownToasts.find(s => s.text === text) || newToast(text);
  shown.count++;
  shown.kind = kind;
  shown.el.className = 'tst ' + kind;
  shown.el.textContent = (shown.count > 1 ? shown.count + '× ' : '') + text;
  shown.el.title = text === msg ? '' : msg;
  clearTimeout(shown.timer);
  shown.timer = setTimeout(() => dropToast(shown), toastTime(kind));
  // De nieuwste melding (ook een die nog eens kwam) staat onderaan
  const i = shownToasts.indexOf(shown);
  if (i >= 0) shownToasts.splice(i, 1);
  shownToasts.push(shown);
  $('#toast').append(shown.el);
  fitToasts();
}
/** Ligt er al een ander kaartje boven in beeld: een prestatie, een gebeurtenis of een aanbod? */
const otherCardShown = (): boolean =>
  !!document.querySelector('#achv .achpop, #event:not([hidden]), #offer:not([hidden])');
/**
 * Niet te veel meldingen tegelijk: twee, of één op een telefoon en naast een ander kaartje. Te veel? Dan
 * gaat de oudste weg, maar slecht nieuws (zoals een aanval) blijft zo lang mogelijk staan.
 * (Ook elke verversing, want een kaartje kan later nog verschijnen.)
 */
export function fitToasts() {
  const room = isCompact() || otherCardShown() ? 1 : MAX_TOASTS;
  while (shownToasts.length > room)
    dropToast(shownToasts.find(s => s.kind !== 'bad' && s.kind !== 'age') || shownToasts[0]);
}
let bannerTimer = 0;
/** Een grote kaart midden in beeld (een nieuw tijdperk, de finale). Na `ms` milliseconden is hij weer weg. */
export function showBanner(html: string, ms = 4500) {
  const banner = $('#banner');
  banner.innerHTML = html;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (banner.hidden = true), ms);
}
/** Een effect over het hele scherm (zie styles/juice.css). */
type ScreenEffect = 'age' | 'win' | 'hurt';
/**
 * Een effect over het hele scherm: 'age' (gloed van een nieuw tijdperk), 'win' (gouden gloed) of 'hurt'
 * (rode rand als je stamhuis geraakt wordt).
 */
export function screenEffect(kind: ScreenEffect) {
  const el = $('#screenfx');
  el.className = '';
  void el.offsetWidth; // zo begint de animatie opnieuw, ook als dezelfde net nog liep
  el.className = kind;
}
let hallHitAt = 0;
/** Je stamhuis wordt geraakt: een rode flits aan de rand en (als dat aan staat) een klein schokje. */
export function hallHit() {
  const now = performance.now();
  if (now - hallHitAt < 1200) return; // niet bij elke pijl opnieuw: hooguit één flits per 1,2 seconde
  hallHitAt = now;
  screenEffect('hurt');
  if (SET.shake) store.shake = Math.max(store.shake, 0.15);
}
/**
 * Er komt een grondstof binnen. De strook bovenaan knippert daar niet meer bij (bij elke levering was dat
 * te onrustig); het nieuwe getal staat er vanzelf.
 */
export function pulseRes(_k: string) {}
export function setSpeed(s: number) {
  if (s) lastSpeed = s;
  G.speed = s;
  document
    .querySelectorAll<HTMLElement>('#speed button')
    .forEach(b => b.classList.toggle('on', +b.dataset.s! === s));
  store.uiDirty = true;
}
$('#speed').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('button');
  if (b) setSpeed(+b.dataset.s!);
});
export function setExpand(on: boolean) {
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
    // (het stamhuis staat er zolang je speelt)
    const h = th()!,
      near = (p: Foe, q: Foe) => dist(p.x, p.y, h.x, h.y) - dist(q.x, q.y, h.x, h.y),
      f = G.foes.filter(isRaider).sort(near)[0] || G.foes.filter(isMarching).sort(near)[0];
    if (f) centerOn(f.x, f.y);
  } else if (a.k === 'sel') {
    const b = bById.get(a.id!);
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
// De volgende stap staat er in één regel. Klik erop: op de computer klapt de uitleg open, op een
// telefoon opent het doel met alles erover.
function setStepOpen(open: boolean) {
  $('#objectives').classList.toggle('stepopen', open);
  $('#stepTxt').setAttribute('aria-expanded', String(open));
  $('#stepTxt .caret').innerHTML = ico(open ? '⌃' : '⌄');
}
setStepOpen(false);
$('#step').addEventListener('click', e => {
  const onTitle = (e.target as HTMLElement).closest('#stepTxt');
  if (onTitle) sfx('tick');
  if (isCompact()) {
    if (onTitle || !(e.target as HTMLElement).closest('button')) togglePanel('goal');
  } else if (onTitle) setStepOpen(!$('#objectives').classList.contains('stepopen'));
});
// Snelknop naast het inwonertal: alleen als er dorpelingen zonder werk zijn. (Het hele leger kiezen kan
// met Q, in het paneel Leger of in het overzicht onderin.)
export function renderQuick() {
  const idle = G.vs.filter(v => !v.hidden && v.state === 'idle').length,
    showIdle = idle >= 2 && G.t > 60;
  setHTML($('#quick'), 'quick', String(showIdle && idle), () =>
    showIdle
      ? `<button class="pbtn" data-q="idle" title="${idle} dorpelingen zonder werk: klik om ze te kiezen (sneltoets I)"><i>${ico('☺')}</i>${idle}</button>`
      : '',
  );
}
$('#quick').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t) return;
  sfx('tick');
  if (t.dataset.q === 'idle') selectIdle();
  store.uiDirty = true;
});
