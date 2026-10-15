// Kaartjes voor gebeurtenissen (met keuzes), de tijdelijke bonussen daarvan en handelsaanbiedingen.
import type { Buff, Followup, GameEvent } from '../types';
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import {
  CHOICE_TIME,
  EVENT,
  allowedChoices,
  amountsFor,
  buffEffect,
  buffMood,
  choiceProblem,
  defaultChoice,
  hasDownside,
  type EventDef,
} from '../data/events';
import { RES } from '../data/resources';
import { has, pay } from '../game/economy';
import { answerRivalOffer } from '../game/diplomacy';
import { dayLength, eventRules, haveNow, resolveEvent } from '../game/events';
import { G } from '../game/state';
import { costHTML, esc, fmt, gem } from './format';
import { setHTML, sigs } from './header';
import { note, pulseRes, toast } from './hud';
import { $ } from '../util/dom';
import { ico } from './glyphs';
import { rivalOfferHTML } from './diplomacy';

/** Het gebeurteniskaartje en het rijtje tijdelijke bonussen eronder. */
export function renderEvent() {
  renderEventCard();
  renderBuffs();
}

function renderEventCard() {
  const ev = G.event,
    el = $('#event');
  const def = ev && EVENT[ev.k];
  if (!def) {
    el.hidden = true;
    sigs.ev = null;
    return;
  }
  el.hidden = false;
  const options = allowedChoices(def, eventRules());
  const problems = options.map(i => choiceProblem(def.choices[i], G.age, haveNow()));
  const left = Math.max(0, Math.ceil(ev.until - G.t));
  const sig = [ev.k, ev.until, G.age, options, problems, Math.floor(left / 3)].join('|');
  setHTML(el, 'ev', sig, () => {
    const choices = options.map((i, n) => choiceHTML(def, i, problems[n], i === defaultChoice(def), left));
    const timeBar = `<div class="bar acc"><i style="width:${(left / CHOICE_TIME) * 100}%"></i></div>`;
    return [cardHeader(def, ev), `<div class="ch">${choices.join('')}</div>`, timeBar].join('');
  });
}

// Bovenaan het kaartje: pictogram, "Gebeurtenis" of "Vervolg op: ...", de naam en het verhaal
function cardHeader(def: EventDef, ev: GameEvent) {
  const from = EVENT[ev.from];
  const kicker = from ? `Vervolg op: ${from.n}` : 'Gebeurtenis';
  return [
    '<div class="eh">',
    `<div class="ic">${ico(def.g)}</div>`,
    '<div>',
    `<span class="ek">${esc(kicker)}</span>`,
    `<b>${esc(def.n)}</b>`,
    `<p>${esc(ev.text)}</p>`,
    '</div>',
    '</div>',
  ].join('');
}

// Eén keuze: naam en kosten bovenaan, daaronder wat je krijgt of kwijtraakt en wat er gebeurt.
function choiceHTML(def: EventDef, i: number, problem: string, isDefault: boolean, left: number) {
  const choice = def.choices[i];
  const cost = amountsFor(choice.cost, G.age);
  const gain = amountsFor(choice.gain, G.age) || {};
  const lose = amountsFor(choice.lose, G.age) || {};
  const changes = [
    ...Object.entries(gain).map(([r, n]) => changeChip(r, `+${fmt(n)}`, 'up')),
    ...Object.entries(lose).map(([r, n]) => changeChip(r, `−${fmt(n)}`, 'down')),
  ].join('');
  // "gratis" alleen als de keuze niets kost en ook geen nadeel heeft
  let price = '';
  if (cost) price = costHTML(cost);
  else if (!hasDownside(choice)) price = '<span class="free">gratis</span>';
  const why = problem ? `<span class="why">${esc(problem)}</span>` : '';
  const auto = isDefault ? `<span class="auto">Gebeurt vanzelf over ${left} s</span>` : '';
  return [
    `<button class="evc${isDefault ? ' def' : ''}" data-ev="${i}" ${problem ? 'disabled' : ''}>`,
    `<span class="el"><b>${esc(choice.l)}</b>${price}</span>`,
    `<span class="ed">${changes}${esc(choice.d)}</span>`,
    why,
    auto,
    '</button>',
  ].join('');
}

// Een fiche met wat je krijgt (groen, 'up') of kwijtraakt (rood, 'down')
function changeChip(r: string, amount: string, direction: string) {
  return `<span class="dlt ${direction}" title="${RES[r].n}">${gem(r)}${amount}</span>`;
}

$('#event').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  // Elke knop op het kaartje is een keuze met data-ev
  resolveEvent(+t.dataset.ev!);
});

// Hoe lang een tijdelijke bonus nog duurt, in dagen of (op de laatste dag) in uren
function timeLeft(until: number) {
  const days = (until - G.t) / dayLength();
  if (days >= 1.5) return `nog ${Math.round(days)} dagen`;
  if (days >= 1) return 'nog 1 dag';
  return `nog ${Math.max(1, Math.ceil(days * 24))} uur`;
}

// Wanneer een vervolg komt: vandaag, morgen of op dag zoveel
function whenComing(day: number) {
  if (day <= G.day) return 'vandaag';
  return day === G.day + 1 ? 'morgen' : `dag ${day}`;
}

/** Tijdelijke bonussen (en vervolgen die nog komen) als kleine plaatjes onder de kaartjes. */
function renderBuffs() {
  const el = $('#buffs');
  const buffs = G.buffs || [],
    coming = G.followups || [];
  if (!buffs.length && !coming.length) {
    el.hidden = true;
    sigs.buffs = null;
    return;
  }
  el.hidden = false;
  const times = buffs.map(b => timeLeft(b.until));
  const sig = [buffs.map((b, n) => b.k + times[n]), coming.map(f => f.k + f.day), G.day].join('|');
  setHTML(el, 'buffs', sig, () => {
    const active = buffs.map((b, n) => buffPill(b, n, times[n]));
    const soon = coming.map((f, n) => followPill(f, n));
    return active.concat(soon).join('');
  });
}

// Een lopende bonus: wat je koos, wat het doet en hoe lang nog. Tik erop voor de hele uitleg.
function buffPill(b: Buff, n: number, left: string) {
  const effect = buffEffect(b.d) || b.d;
  return [
    `<button type="button" class="buff ${buffMood(b.bonus)}" data-buff="${n}">`,
    ico(b.g),
    `<b>${esc(b.l || b.n)}</b>`,
    `<span>${esc(effect)}</span>`,
    `<i>${left}</i>`,
    '</button>',
  ].join('');
}

// Een vervolg dat nog komt: alleen de naam van de eerdere gebeurtenis, zodat de verrassing blijft
function followPill(f: Followup, n: number) {
  const from = EVENT[f.from];
  return [
    `<button type="button" class="buff soon" data-follow="${n}">`,
    ico('⌛'),
    `<b>Vervolg: ${esc(from ? from.n : 'een gebeurtenis')}</b>`,
    `<i>${whenComing(f.day)}</i>`,
    '</button>',
  ].join('');
}

// Tikken op een plaatje laat de hele uitleg zien (ook op een telefoon, waar zweven niet kan)
$('#buffs').addEventListener('click', e => {
  const pill = (e.target as HTMLElement).closest('button');
  if (!pill) return;
  // Het nummer in de lijst (als tekst op de knop); zonder nummer vind je niets
  const b = G.buffs[Number(pill.dataset.buff)],
    f = G.followups[Number(pill.dataset.follow)];
  if (b) toast(`${b.n}, je koos: ${b.l || b.n}. ${b.d} (${timeLeft(b.until)})`);
  else if (f) {
    const from = EVENT[f.from];
    toast(`Er komt nog een vervolg op ${from ? from.n : 'een gebeurtenis'} (${whenComing(f.day)}).`);
  }
});

export function renderOffer() {
  const o = G.offer,
    el = $('#offer');
  if (!o) {
    el.hidden = true;
    sigs.offer = null;
    return;
  }
  el.hidden = false;
  const canPay = !o.give || has({ [o.give]: o.price });
  const sig = 'o' + o.until + canPay + Math.floor((o.until - G.t) / 5) + (o.from || '');
  // Een bericht van een rivaal heeft een eigen kaartje (zie ui/diplomacy.ts)
  if (o.from) {
    setHTML(el, 'offer', sig, () => rivalOfferHTML(o));
    return;
  }
  setHTML(el, 'offer', sig, () => {
    const deal = `${gem(o.want)} ${o.amt} ${RES[o.want].n} voor ${gem(o.give)} ${o.price} ${RES[o.give].n}`;
    const timeBar = `<div class="bar acc"><i style="width:${((o.until - G.t) / 70) * 100}%"></i></div>`;
    return [
      `<div class="ic">${ico('⚖')}</div>`,
      `<div class="t"><b>Reizende handelaar</b>${deal}${timeBar}</div>`,
      `<button class="primary" data-o="ok" ${canPay ? '' : 'disabled'}>Ruil</button>`,
      `<button class="quiet" data-o="no" aria-label="Afslaan">${ico('✕')}</button>`,
    ].join('');
  });
}
$('#offer').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled || !G.offer) return;
  const o = G.offer;
  // Een bericht van een rivaal: ja of nee (zie game/diplomacy.ts)
  if (o.from) {
    answerRivalOffer(t.dataset.o === 'ok');
    return;
  }
  if (t.dataset.o === 'ok') {
    pay({ [o.give]: o.price });
    G.res[o.want] += o.amt;
    pulseRes(o.want);
    toast(`Geruild: ${o.amt} ${RES[o.want].n.toLowerCase()} ontvangen.`, 'good');
    sfx('upgrade');
  } else note('Aanbod van de handelaar afgeslagen.');
  G.offer = null;
  sigs.offer = null;
  store.uiDirty = true;
});
