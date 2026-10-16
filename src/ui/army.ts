// Legerbesturing in beeld: de groepenbalk boven de onderbalk, rangstreepjes en een tip voor nieuwe spelers.
import type { Unit } from '../types';
import { store } from '../core/store';
import { markTip, tipSeen } from '../core/tips';
import { sfx } from '../audio/sound';
import {
  GROUP_KEYS,
  ROLE_ORDER,
  closeTogether,
  killsToNextRank,
  rankName,
  roleWord,
  unitRole,
} from '../data/army';
import { UNITS } from '../data/units';
import { groupMembers, pruneGroups, setGroup, unitRank } from '../game/army';
import { G, sel } from '../game/state';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { portrait } from '../render/icons';
import { TOUCH, esc } from './format';
import { toast } from './hud';
import { $ } from '../util/dom';

/* ---------- Groepen kiezen en maken (ook voor de sneltoetsen F1 tot F5, zie input/input.ts) ---------- */

// Is precies deze groep nu geselecteerd?
function isSelected(g: string): boolean {
  const { us, vs } = groupMembers(g);
  const all = us.length + vs.length;
  return (
    all > 0 &&
    all === sel.us.size + sel.vs.size &&
    us.every(u => sel.us.has(u.id)) &&
    vs.every(v => sel.vs.has(v.id))
  );
}

/** Ga met de camera naar het midden van groep g. */
export function centerOnGroup(g: string): void {
  const { us, vs } = groupMembers(g),
    all = [...us, ...vs];
  if (!all.length) return;
  centerOn(
    all.reduce((sum, e) => sum + e.x, 0) / all.length,
    all.reduce((sum, e) => sum + e.y, 0) / all.length,
  );
}

/**
 * Kies groep g. Is hij al gekozen, dan gaat de camera erheen (dus twee keer klikken = ernaartoe).
 * Met `add` (Shift) komt de groep bij wat je al had.
 */
export function selectGroup(g: string, add = false): void {
  const { us, vs } = groupMembers(g);
  if (!us.length && !vs.length) {
    toast(
      TOUCH
        ? `Groep ${g} is leeg. Selecteer eenheden en tik op +.`
        : `Groep ${g} is leeg. Selecteer eenheden en klik op + (of Ctrl+Shift+F${g}).`,
    );
    return;
  }
  if (!add && isSelected(g)) {
    centerOnGroup(g);
    return;
  }
  if (!add) clearSel();
  us.forEach(u => sel.us.add(u.id));
  vs.forEach(v => sel.vs.add(v.id));
  store.lastGroup = g;
  sfx('select');
  store.uiDirty = true;
}

/**
 * Maak van wat je nu geselecteerd hebt groep g (een oude groep g wordt vervangen).
 * Zonder selectie gebeurt er niets: zo gooi je een groep nooit per ongeluk weg.
 */
export function assignGroup(g: string): void {
  const ids = [...sel.us, ...sel.vs];
  const replaced = !!(G.groups[g] && G.groups[g].length);
  if (!ids.length) {
    toast(
      replaced
        ? `Selecteer eerst eenheden om groep ${g} te vervangen.`
        : `Selecteer eerst eenheden. Daarna maak je er groep ${g} van.`,
    );
    return;
  }
  setGroup(g, ids);
  markTip('groups'); // de speler weet nu hoe het werkt: de tip hoeft niet meer
  closeTip();
  const n = ids.length,
    how = TOUCH ? 'Tik erop' : `Klik erop of druk F${g}`;
  toast(
    `Groep ${g} ${replaced ? 'vervangen' : 'gemaakt'}: ${n} ${n === 1 ? 'eenheid' : 'eenheden'}. ${how} om ze te kiezen.`,
  );
  sfx('select');
  store.uiDirty = true;
}

/* ---------- De groepenbalk ---------- */

const bar = document.createElement('nav');
bar.id = 'groups';
bar.setAttribute('aria-label', 'Groepen');
bar.hidden = true;
// Vijf vaste knoppen: ze blijven bestaan (alleen de inhoud verandert), zodat een klik nooit verloren gaat
const tiles = GROUP_KEYS.map(g => {
  const b = document.createElement('button');
  b.className = 'grp';
  b.dataset.g = g;
  b.hidden = true;
  bar.appendChild(b);
  return b;
});
$('#sidebtns').after(bar);

/** Wat de groepenbalk over één groep laat zien (zie groupInfo). */
interface GroupInfo {
  g: string;
  /** Hoeveel er van elk soort zijn: 'u' + soort soldaat, of 'v' voor dorpelingen. */
  kinds: Record<string, number>;
  count: number;
  /** Het soort dat het meest voorkomt (voor het plaatje), of leeg. */
  main: string;
  /** Hoe gezond de groep is, in procent (in stapjes van 5). */
  health: number;
  /** Is precies deze groep gekozen, en vecht er iemand? */
  on: boolean;
  fight: boolean;
}

// Wat er in groep g zit: hoeveel, welk soort het meest (voor het plaatje), hoe gezond, en of ze vechten
function groupInfo(g: string): GroupInfo {
  const { us, vs } = groupMembers(g),
    all = [...us, ...vs];
  const kinds: Record<string, number> = {};
  for (const u of us) kinds['u' + u.k] = (kinds['u' + u.k] || 0) + 1;
  if (vs.length) kinds.v = vs.length;
  const main = Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a])[0] || '';
  const hp = all.reduce((sum, e) => sum + e.hp, 0),
    mhp = all.reduce((sum, e) => sum + e.mhp, 0);
  return {
    g,
    kinds,
    count: all.length,
    main,
    health: mhp ? Math.round((hp / mhp) * 20) * 5 : 0, // in stapjes van 5%
    on: isSelected(g),
    fight: us.some(u => u.tgt),
  };
}

// "4 × speerdrager, 2 × slingeraar"
function groupWords(info: GroupInfo): string {
  return Object.entries(info.kinds)
    .map(([k, n]) => `${n} × ${k === 'v' ? 'dorpeling' : UNITS[k.slice(1)].n.toLowerCase()}`)
    .join(', ');
}

function fillTile(b: HTMLButtonElement, info: GroupInfo, canAdd: boolean): void {
  const g = info.g;
  if (!info.count) {
    // Lege plek: alleen de eerste, en alleen als je iets geselecteerd hebt, om er een groep van te maken
    b.hidden = !canAdd;
    b.className = 'grp add';
    b.title = `Maak groep ${g} van je selectie${TOUCH ? '' : ` (Ctrl+Shift+F${g})`}`;
    b.setAttribute('aria-label', `Maak groep ${g} van je selectie`);
    const inner = `<span class="gn">${g}</span><span class="plus">+</span>`;
    if (b.dataset.sig !== inner) {
      b.dataset.sig = inner;
      b.innerHTML = inner;
    }
    return;
  }
  b.hidden = false;
  b.className = `grp${info.on ? ' on' : ''}${info.fight ? ' fight' : ''}`;
  const how = TOUCH
    ? 'Tik: kiezen · nog eens: ernaartoe · vasthouden: vervangen door je selectie'
    : `Klik of F${g}: kiezen · nog eens: ernaartoe · rechtsklik of Ctrl-klik: vervangen door je selectie`;
  const fighting = info.fight ? ' · in gevecht' : '';
  b.title = `Groep ${g}: ${groupWords(info)}${fighting}. ${how}`;
  const units = `${info.count} ${info.count === 1 ? 'eenheid' : 'eenheden'}`;
  b.setAttribute('aria-label', `Groep ${g}: ${units}${fighting}`);
  const img = info.main === 'v' ? portrait('v', 'auto') : portrait('u', info.main.slice(1));
  const tone = info.health < 35 ? 'bad' : info.health < 65 ? 'warn' : '';
  const inner =
    `<span class="gn">${g}</span><img src="${img}" alt=""><b>${info.count}</b>` +
    `<i class="ghp ${tone}"><i style="width:${info.health}%"></i></i>`;
  if (b.dataset.sig !== inner) {
    b.dataset.sig = inner;
    b.innerHTML = inner;
  }
}

/** De groepenbalk bijwerken (elke paar tellen, zie main.ts). */
export function renderGroups(): void {
  pruneGroups(); // is iedereen van een groep gesneuveld, dan is de groep ook weg
  const picked = sel.us.size + sel.vs.size > 0,
    infos = GROUP_KEYS.map(groupInfo);
  // Zichtbaar als er een groep is, of als je iemand hebt gekozen (dan kun je er een groep van maken)
  const show = infos.some(info => info.count) || picked;
  bar.hidden = !show;
  document.body.classList.toggle('hasgroups', show);
  // Eén knop + is genoeg (de eerste lege groep), niet een hele rij lege plekken
  const firstEmpty = infos.find(info => !info.count);
  if (show) infos.forEach((info, k) => fillTile(tiles[k], info, picked && info === firstEmpty));
  renderTip(show && sel.us.size >= 2);
}

// Lang vasthouden op een telefoon (een rechtsklik bestaat daar niet)
let holdTimer = 0,
  held = false,
  lastPointer = 'mouse';
// Elke groepsknop (.grp) heeft het nummer van zijn groep in data-g (zie tiles hierboven)
bar.addEventListener('pointerdown', e => {
  lastPointer = e.pointerType;
  const t = (e.target as HTMLElement).closest<HTMLElement>('.grp');
  held = false;
  clearTimeout(holdTimer);
  if (!t || e.pointerType === 'mouse' || t.classList.contains('add')) return;
  holdTimer = setTimeout(() => {
    held = true;
    assignGroup(t.dataset.g!);
  }, 550);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
  bar.addEventListener(type, () => clearTimeout(holdTimer));
bar.addEventListener('contextmenu', e => {
  e.preventDefault();
  const t = (e.target as HTMLElement).closest<HTMLElement>('.grp');
  if (t && lastPointer === 'mouse' && !t.classList.contains('add')) assignGroup(t.dataset.g!);
});
bar.addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.grp');
  if (!t) return;
  // Na lang vasthouden komt er nog een klik achteraan: die negeren we
  if (held) {
    held = false;
    return;
  }
  const g = t.dataset.g!;
  if (t.classList.contains('add') || e.ctrlKey || e.metaKey) assignGroup(g);
  else selectGroup(g, e.shiftKey);
});

/* ---------- Eenmalige tip: de eerste keer dat je twee of meer soldaten kiest ---------- */

const tip = document.createElement('div');
tip.id = 'armytip';
tip.className = 'hud';
tip.hidden = true;
tip.setAttribute('role', 'note');
bar.after(tip);
let tipOpen = false;

function renderTip(want: boolean): void {
  if (want && !tipOpen && !tipSeen('groups')) {
    tipOpen = true;
    markTip('groups'); // één keer is genoeg; de uitleg staat ook onder Uitleg in het menu
    const make = TOUCH ? 'Tik op <b>+</b>' : 'Klik op <b>+</b> (of Ctrl+Shift+F1)';
    const pick = TOUCH ? 'met één tik' : 'met één klik of F1';
    tip.innerHTML =
      `<b class="tt">Tip: maak er een groep van</b>` +
      `<p>${make} hieronder. Daarna kies je ze ${pick}.</p>` +
      `<p>Laat je ze lopen, dan gaan ze in formatie: voorhoede voor, schutters erachter, geschut achteraan.</p>` +
      `<button class="quiet" data-tip-close>Begrepen</button>`;
  }
  if (!want) tipOpen = false;
  tip.hidden = !tipOpen;
}
function closeTip(): void {
  tipOpen = false;
  tip.hidden = true;
}
tip.addEventListener('click', e => {
  if ((e.target as HTMLElement).closest('[data-tip-close]')) closeTip();
});

/* ---------- Rangen en formatie in het selectiepaneel en de tooltip ---------- */

/** Gouden streepjes voor een rang (1 tot 3), als klein plaatje. Rang 0: niets. */
export function chevronsHTML(rank: number): string {
  if (!rank) return '';
  let lines = '';
  for (let i = 0; i < rank; i++) lines += `<path d="M3 ${17 - i * 5}l6-4 6 4"/>`;
  return `<svg class="chev" viewBox="0 0 18 20" aria-hidden="true">${lines}</svg>`;
}

/** Eén regel over de rang van een soldaat: hoe ver hij is en wat het oplevert. */
export function rankLineHTML(u: Unit): string {
  const rank = unitRank(u),
    kills = u.kills || 0,
    next = killsToNextRank(kills);
  const won = `${kills} ${kills === 1 ? 'overwinning' : 'overwinningen'}`;
  const toGo = next == null ? 'hoogste rang' : `nog ${next} tot ${rankName(rank + 1).toLowerCase()}`;
  const gain = rank ? ` · +${rank * 10}% schade en leven` : '';
  return `<div class="rankline">${chevronsHTML(rank) || '<i class="dot"></i>'}<b>${rankName(rank)}</b><span>${won} · ${toGo}${gain}</span></div>`;
}

/** Korte tekst voor de tooltip, zoals "Veteraan · 4 overwinningen", of leeg voor een rekruut zonder. */
export function rankTip(u: Unit): string {
  const rank = unitRank(u),
    kills = u.kills || 0;
  if (!rank && !kills) return '';
  return `${rankName(rank)} · ${kills} ${kills === 1 ? 'overwinning' : 'overwinningen'} · `;
}

// Snelheid zoals de speler hem leest: 1,1 in plaats van 1.1
const speedText = (spd: number): string => String(spd).replace('.', ',');

// Lopen ze niet allemaal even snel? Zeg dan hoe snel de groep gaat en wie dat bepaalt, in cijfers.
// Staan ze ver uit elkaar, dan loopt ieder op eigen tempo (zie formationMove in game/army.ts).
function paceText(us: Unit[]): string {
  const speeds = us.map(u => UNITS[u.k].spd);
  const slow = Math.min(...speeds),
    fast = Math.max(...speeds);
  if (slow === fast) return '';
  if (!closeTogether(us)) return ' · verspreid: ieder op eigen tempo';
  const slowName = UNITS[us[speeds.indexOf(slow)].k].n.toLowerCase();
  return ` · tempo ${speedText(slow)} i.p.v. ${speedText(fast)} (traagste: ${esc(slowName)})`;
}

/** Bij twee of meer soldaten: hoe ze in formatie lopen, en hoeveel veteranen erbij zijn. */
export function formationLineHTML(us: Unit[]): string {
  if (us.length < 2) return '';
  const count = { front: 0, ranged: 0, siege: 0 };
  for (const u of us) count[unitRole(UNITS[u.k])]++;
  const parts = ROLE_ORDER.filter(role => count[role]).map(
    role => `<b>${count[role]}</b> ${roleWord(role, count[role])}`,
  );
  const vets = us.filter(u => unitRank(u) > 0).length;
  const vetText = vets ? ` · ${vets} ${vets === 1 ? 'veteraan' : 'veteranen'}` : '';
  return `<div class="formline"><span class="fl">Formatie</span>${parts.join(' · ')}${paceText(us)}${vetText}</div>`;
}
