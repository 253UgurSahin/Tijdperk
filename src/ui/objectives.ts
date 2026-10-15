// Doelen linksboven: wat je nodig hebt voor het volgende tijdperk, en hoe ver je bent met winnen
// (of met de uitdaging, met de klok erbij).
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGES, AGE_UP } from '../data/ages';
import { B } from '../data/buildings';
import { MODIFIER } from '../data/modifiers';
import { GATHER, RES } from '../data/resources';
import { MEDALS } from '../data/score';
import { GOAL_ICON, challengeMedal, clockText, type ScenarioDef } from '../data/scenarios';
import { avail } from '../game/caches';
import { CHAPTERS, built } from '../game/chapters';
import { popNow } from '../game/entities';
import { RIVAL, verb } from '../data/rivals';
import { theWonder } from '../data/wonders';
import { rbById } from '../game/rivals';
import { G, sel } from '../game/state';
import { rivalWonderRaces, rivalWonderSavings } from '../game/wonders';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { challengeStatus, type ChallengeStatus } from '../game/scenario';
import { victoryGoals } from '../game/victory';
import { measureHud } from '../main';
import { ageUp } from './age';
import { andJoin, lackList, placed } from './coach';
import { fmt, gem } from './format';
import { ico } from './glyphs';
import { setHTML, sigs } from './header';
import { setExpand, toast } from './hud';
import { togglePanel } from './panel';
import { $, isCompact } from '../util/dom';

export function renderChronicle() {
  renderGoalButton();
  const nx = AGE_UP[G.age + 1];
  const rows: string[] = [];
  let allReq = true,
    fix = '',
    total = 0,
    ready = 0;
  if (nx) {
    for (const n of nx.need) {
      const ok = built(n);
      allReq = allReq && ok;
      rows.push(
        `<span class="ck ${ok ? 'ok' : placed(n) ? 'busy' : ''}">${ok ? ico('✓') : ''}</span><span class="${ok ? 'done' : ''}">${B[n].n}</span><span class="v ${ok ? 'ok' : ''}">${ok ? 'klaar' : placed(n) ? 'bezig' : 'nodig'}</span>`,
      );
    }
    const pv = Math.min(1, popNow() / nx.pop);
    allReq = allReq && pv >= 1;
    rows.push(
      `<div class="rq"><span class="ri">${ico('☺')}</span><span>Inwoners</span><span class="v ${pv >= 1 ? 'ok' : ''}">${popNow()} / ${nx.pop}</span><div class="bar ${pv >= 1 ? '' : 'acc'}"><i style="width:${pv * 100}%"></i></div></div>`,
    );
    // Grondstoffen: wat nog ontbreekt krijgt een eigen regel, wat al genoeg is één regel samen
    const enough = [];
    for (const k in nx.cost) {
      const v = Math.min(1, G.res[k] / nx.cost[k]);
      allReq = allReq && v >= 1;
      if (v >= 1) enough.push(RES[k].n);
      else
        rows.push(
          `<div class="rq">${gem(k)}<span>${RES[k].n}</span><span class="v">${fmt(G.res[k])} / ${fmt(nx.cost[k])}</span><div class="bar acc"><i style="width:${v * 100}%"></i></div></div>`,
        );
      if (v < 1 && !fix && GATHER.includes(k) && !avail[k]) fix = k;
    }
    if (enough.length)
      rows.push(
        `<span class="ck ok">${ico('✓')}</span><span class="done">Genoeg ${andJoin(enough.map(n => n.toLowerCase()))}</span><span class="v ok">klaar</span>`,
      );
    // Hoeveel van de eisen al klaar zijn (gebouwen, inwoners, elke grondstof)
    total = nx.need.length + 1 + Object.keys(nx.cost).length;
    ready =
      nx.need.filter(built).length +
      (popNow() >= nx.pop ? 1 : 0) +
      Object.keys(nx.cost).filter(k => G.res[k] >= nx.cost[k]).length;
  }
  const miss = nx ? lackList(nx) : [];
  const goals = goalsHTML();
  const sig = JSON.stringify([G.age, rows, ready, allReq, G.won, fix, miss, goals, store.missionOpen]);
  setHTML($('#mission'), 'mission', sig, () => {
    if (!nx)
      return `${goals}<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Laatste tijdperk</span><i>${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><p class="why">${CHAPTERS[G.age].s}</p>${G.won ? '<p class="why">Je hebt gewonnen. Bouw gerust verder.</p>' : ''}</div>`;
    const A = AGES[G.age + 1];
    // Het vak "Winnen" boven het tijdperk, zodat alles over het volgende tijdperk bij elkaar blijft
    return `${goals}<button id="ageToggle" aria-expanded="${store.missionOpen}"><span class="oh">Naar de ${A.n.toLowerCase()}</span><i>${AGES[G.age].r} → ${A.r} ${store.missionOpen ? '▲' : '▼'}</i></button><div class="body"><div class="ages">${AGES.map((a, i) => `<i class="${i <= G.age ? 'done' : ''}" title="${a.n}"></i>`).join('')}</div><p class="why">${A.sub}</p><div class="rqsum"><span>${ready} van ${total} eisen klaar</span><div class="bar ${ready >= total ? '' : 'acc'}"><i style="width:${(ready / total) * 100}%"></i></div></div>
    <button class="primary" id="ageBtn" ${allReq ? '' : 'disabled'}>${allReq ? 'Ga naar de ' + A.n.toLowerCase() + ' →' : 'Nog ' + andJoin(miss) + ' nodig'}</button>
    ${fix ? `<button id="fixBtn">Gebied uitbreiden</button><p class="why">Er ligt nog geen ${RES[fix].n.toLowerCase()} binnen je grenzen.</p>` : ''}
    <div class="reqs">${rows.join('')}</div></div>`;
  });
  $('#mission').classList.toggle('closed', !store.missionOpen);
}
/** Zo win je: een klein vak met één korte regel per gekozen doel (zie data/victories.ts) en hoe ver je bent. */
function goalsHTML() {
  const challenge = challengeStatus();
  if (challenge) return challengeHTML(challenge);
  const rows = victoryGoals().map(({ v, text }) => {
    const won = G.won && G.wonBy === v.k;
    return `<div class="wg ${won ? 'ok' : ''}" title="${v.d}">${ico(v.g)}<span>${v.n}</span><small>${won ? 'gewonnen' : text}</small></div>`;
  });
  return `<div class="wingoals"><span class="wgl">Winnen</span><div class="wgrows">${rows.join('')}</div>${racesHTML()}</div>`;
}
/**
 * Bouwt een rivaal aan een wereldwonder? Dan staat dat hier, met hoe ver hij is: zo zie je de race.
 * Klik erop om naar de bouwplaats te gaan. Spaart hij ervoor (vanaf de helft), dan staat dat er ook al.
 */
function racesHTML() {
  const pct = (frac: number) => `${Math.floor(frac * 100)}%`;
  const races = rivalWonderRaces().map(({ k, rival, b, frac }) => {
    const who = RIVAL[rival.k];
    return `<button class="wrace" data-race="${b.id}" title="Bekijk de bouwplaats">${ico('★')}<span>${who.n} ${verb(who, 'bouwt', 'bouwen')} ${theWonder(k)}</span><b>${pct(frac)}</b></button>`;
  });
  const savings = rivalWonderSavings().map(({ k, rival, frac }) => {
    const who = RIVAL[rival.k];
    return `<div class="wrace saving" title="Zo vol is hun spaarpot. Bouw het wonder zelf eerst!">${ico('★')}<span>${who.n} ${verb(who, 'spaart', 'sparen')} voor ${theWonder(k)}</span><b>${pct(frac)}</b></div>`;
  });
  return races.join('') + savings.join('');
}
// Naar de bouwplaats van een rivaal, en die selecteren
function showRace(id: number) {
  const b = rbById.get(id);
  if (!b) return;
  centerOn(b.x + 1.5, b.y + 1.5);
  clearSel();
  sel.rb = b.id;
  sigs.ins = null;
  store.uiDirty = true;
}
/**
 * In een uitdaging: de naam, het doel met een balk, en de klok als er een tijdsgrens is.
 * De spelregels staan er klein onder (met uitleg als je de muis erop houdt).
 */
function challengeHTML({ def, goal, frac, short, left }: ChallengeStatus) {
  const done = G.won;
  // In een uitdaging is G.scenario er altijd
  const lost = G.over && G.scenario!.failed === 'time';
  const timer =
    left != null
      ? `<span class="${clockClass(left)}" title="Speltijd over">${ico('⌛')}${clockText(left)}</span>`
      : '';
  const state = done ? 'gehaald' : lost ? 'tijd om' : short;
  // Tik op een regel (of houd de muis erop) om te lezen wat hij doet
  const rules = def.modifiers
    .map(k => MODIFIER[k])
    .map(
      m =>
        `<span class="${m.hard ? 'hard' : 'help'}" title="${m.d}" data-rule="${m.k}" role="button" tabindex="0">${m.n}</span>`,
    )
    .join('');
  return `<div class="wingoals chgoals">
    <span class="wgl"><span>${def.n}</span>${timer}</span>
    <div class="wg ${done ? 'ok' : ''}" title="${def.story}">${ico(GOAL_ICON[def.goal.type])}<span>${goal}</span><small>${state}</small></div>
    <div class="bar ${done ? '' : 'acc'}"><i style="width:${Math.round(frac * 100)}%"></i></div>
    ${lossLineHTML(def)}
    ${rules ? `<div class="chrules">${rules}</div>` : ''}
  </div>`;
}

// De klok kleurt oranje bij 5 minuten en rood bij 1 minuut
const clockClass = (left: number) => `chclock ${left <= 60 ? 'bad' : left <= 300 ? 'warn' : ''}`;

/** Bij overleven: hoeveel je kwijt bent, en welke medaille je dan nog kunt halen. */
function lossLineHTML(def: ScenarioDef) {
  if (def.medals.by !== 'lost') return '';
  const lost = G.stats.lost || 0;
  const medal = MEDALS.find(m => m.k === challengeMedal(def.medals, { won: true, lost }));
  const reach = medal ? `${medal.n.toLowerCase()} nog haalbaar` : 'geen medaille meer';
  return `<small class="chlost">${lost ? `Verloren: ${lost}` : 'Nog niets verloren'} · ${reach}</small>`;
}

/**
 * Op een telefoon is de doelenkaart meestal dicht. Dan staat de klok van de uitdaging op de knop Doel,
 * zodat je altijd ziet hoeveel tijd je nog hebt.
 */
function renderGoalButton() {
  const btn = document.querySelector('#sidebtns [data-p="goal"]');
  if (!btn) return;
  const status = challengeStatus();
  const left = status ? status.left : null;
  let clock = btn.querySelector('.chclock');
  if (left == null) {
    if (clock) clock.remove();
    return;
  }
  if (!clock) {
    clock = document.createElement('span');
    btn.insertBefore(clock, btn.querySelector('i'));
  }
  if (clock.className !== clockClass(left)) clock.className = clockClass(left);
  if (clock.textContent !== clockText(left)) clock.textContent = clockText(left);
}
// Een spelregel aantikken: zeg wat hij doet
function explainRule(chip: HTMLElement) {
  // chip is gevonden met [data-rule], dus data-rule bestaat
  const m = MODIFIER[chip.dataset.rule!];
  if (m) toast(`${m.n}: ${m.d}.`);
}
$('#mission').addEventListener('keydown', e => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-rule]');
  if (chip && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    explainRule(chip);
  }
});
$('#mission').addEventListener('click', e => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-rule]');
  if (chip) {
    sfx('tick');
    explainRule(chip);
    return;
  }
  const t = (e.target as HTMLElement).closest('button');
  if (!t) return;
  if (t.dataset.race) {
    sfx('tick');
    showRace(+t.dataset.race);
    return;
  }
  if (t.id === 'ageBtn') ageUp();
  else if (t.id === 'fixBtn') {
    sfx('tick');
    setExpand(true);
    if (isCompact()) togglePanel();
  } else if (t.id === 'ageToggle') {
    sfx('tick');
    if (isCompact()) {
      document.body.classList.remove('showgoal');
      measureHud();
      return;
    }
    store.missionOpen = !store.missionOpen;
    sigs.mission = null;
    renderChronicle();
  }
});
