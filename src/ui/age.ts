// Naar het volgende tijdperk gaan.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGES, AGE_UP } from '../data/ages';
import { B, ROADS } from '../data/buildings';
import { RES, RKEYS } from '../data/resources';
import { earnBlessing } from '../game/blessings';
import { bossAfterAgeUp } from '../game/bosses';
import { computeAvail } from '../game/caches';
import { CHAPTERS, built } from '../game/chapters';
import { has, pay } from '../game/economy';
import { popNow } from '../game/entities';
import { G } from '../game/state';
import { checkVictory } from '../game/victory';
import { canUpg, roadTier } from '../game/upgrades';
import { sigs } from './header';
import { screenEffect, showBanner, toast } from './hud';
import { buildResBar } from './resources';
import { ageTimeline } from './format';
import { $ } from '../util/dom';
import { retiredIn } from '../data/succession';
import { UNITS } from '../data/units';
import { startAgeCinematic } from '../render/cinematic';

// Naar het volgende tijdperk, als je alles hebt wat ervoor nodig is
export function ageUp() {
  const nx = AGE_UP[G.age + 1];
  if (!nx || !has(nx.cost) || popNow() < nx.pop || !nx.need.every(built)) return;
  pay(nx.cost);
  enterNextAge();
}

/**
 * Het volgende tijdperk begint: banner, fanfare, de camera zweeft even uit boven je stad (zie render/cinematic.ts),
 * een melding, en na de banner een nieuwe zegening.
 */
export function enterNextAge() {
  const wonBefore = G.won;
  G.age++;
  showBanner(
    `<div class="in"><div class="eyebrow">Hoofdstuk ${AGES[G.age].r}</div><div class="t">${AGES[G.age].n}</div><div class="y">${AGES[G.age].y} · ${CHAPTERS[G.age].t}</div></div>`,
  );
  const nr = RKEYS.filter(k => RES[k].age === G.age && !RES[k].cr).map(k => RES[k].n.toLowerCase());
  startAgeCinematic();
  screenEffect('age'); // een zachte gloed in de kleur van het nieuwe tijdperk rond de rand van het scherm
  const nu = G.bs.filter(canUpg).length;
  const old = retiredIn(G.age, G.people).map(k => (B[k] || UNITS[k]).n.toLowerCase());
  toast(
    `De ${AGES[G.age].n.toLowerCase()} breekt aan.${nr.length ? ` Ontdekt: ${nr.join(' en ')}.` : ''} Nieuwe verbeteringen: werktuigen, wapens${nu ? ` en ${nu} gebouwen` : ''}.${old.length ? ` Verouderd: ${old.join(', ')}.` : ''}`,
    'age',
  );
  computeAvail();
  onAgeChange();
  earnBlessing(); // het kiesvenster komt pas als de banner weg is (zie ui/blessings.ts)
  bossAfterAgeUp(); // de volgende aanval wordt geleid door een kampioen (zie game/bosses.ts)
  checkVictory(); // was dit tijdperk je doel (kort spel)? Dan meteen winnen
  // Win je hiermee, dan speelt alleen de overwinningsfanfare (zie celebrateWin): niet twee fanfares door elkaar
  const justWon = G.won && !wonBefore;
  if (!justWon) sfx('ageup');
  setTimeout(
    () =>
      document.querySelectorAll<HTMLElement>('#resbar .res').forEach(el => {
        if (RES[el.dataset.k!].age === G.age) {
          el.classList.add('new');
          setTimeout(() => el.classList.remove('new'), 3000);
        }
      }),
    60,
  );
}
export function onAgeChange() {
  store.curAge = G.age;
  document.body.dataset.age = String(G.age);
  const A = AGES[G.age];
  B.road.n = ROADS[roadTier()].n;
  B.road.cost = ROADS[roadTier()].cost;
  $('#locEyebrow').textContent = A.n;
  $('#ageNum').textContent = A.r;
  $('#ageLine').outerHTML = ageTimeline(G.age).replace('<ol ', '<ol id="ageLine" ');
  paintAgeColour(A.acc);
  buildResBar(true);
  sigs.cats = null;
  sigs.grid = null;
  sigs.ins = null;
  store.uiDirty = true;
}

// De kleur van het tijdperk kleurt de hele interface mee (CSS-variabele --acc).
// Daarop kiezen we donkere of lichte tekst, wat het best leesbaar is.
export function paintAgeColour(acc: string): void {
  const n = parseInt(acc.slice(1), 16);
  const lin = (c: number): number => ((c /= 255) <= 0.04 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const darkText = (lum + 0.05) / 0.07 > 1.05 / (lum + 0.05);
  const root = document.documentElement.style;
  root.setProperty('--acc', acc);
  root.setProperty('--on-acc', darkText ? '#2b2520' : '#fffaf2');
}
