// Balken bovenaan het scherm: hoe vol en hoe heel de sterrenpoort is (de finale), en hoe het met een kampioen staat.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { bossForAge, bossName } from '../data/bosses';
import { chargeFrac, finaleText } from '../data/finale';
import { liveBoss } from '../game/bosses';
import { has } from '../game/economy';
import { finishedGate, gateHealth } from '../game/finale';
import { repairBuildings, repairCost } from '../game/repair';
import { G, sel } from '../game/state';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { costHTML, esc } from './format';
import { ico } from './glyphs';
import { setHTML } from './header';
import { showBanner, toast } from './hud';
import { $ } from '../util/dom';

// De balk van de finale: zolang de poort oplaadt, of als hij tijdens het opladen verwoest is
const showFinale = () => !!(G.finale && !G.finale.done);

// Onder de helft kleurt de levensbalk van de poort rood
const LOW_HP = 0.5;

/*
 * Eén balk: een knop met pictogram, kop, korte regel en de balk zelf. Klik erop om erheen te gaan.
 * De balk van de finale heeft daaronder nog een dunne levensbalk van de poort, en ernaast de knop Herstel.
 */
function barHTML(kind: string, glyph: string, label: string) {
  const finale = kind === 'finale';
  const hpBar = finale ? '<span class="tbb hp" title="Levens van de sterrenpoort"><i></i></span>' : '';
  const fix = finale
    ? `<button class="cb has-cost tbfix" data-fix="gate" hidden title="Herstel de sterrenpoort">
        <span class="g">${ico('✚')}</span><span class="l">Herstel</span><span class="c"></span>
      </button>`
    : '';
  return `<div class="topbar ${kind}">
    <button class="tbgo" data-go="${kind}" aria-label="${label}">
      <span class="tbi">${ico(glyph)}</span>
      <span class="tbm"><b></b><small></small><span class="tbb"><i></i></span>${hpBar}</span>
    </button>${fix}
  </div>`;
}

/** Elke verversing van de interface: de balken tonen, verbergen of bijwerken. */
export function renderTopBars() {
  const el = $('#topbars');
  if (!G) return;
  const finale = showFinale(),
    boss = liveBoss();
  // Alleen opnieuw opbouwen als er een balk bijkomt of weggaat; teksten en breedtes passen we zo aan
  setHTML(
    el,
    'topbars',
    `${finale}|${boss ? boss.id : ''}`,
    () =>
      (finale ? barHTML('finale', '✹', 'Ga naar de sterrenpoort') : '') +
      (boss ? barHTML('boss', '♛', 'Ga naar de kampioen') : ''),
  );
  // De balken staan er zeker: setHTML hierboven tekende ze (ze zitten in de handtekening)
  if (finale) renderFinaleBar(el.querySelector('.finale')!);
  if (boss) {
    // Een kampioen in het veld hoort altijd bij een tijdperk met een kampioen (zie makeBoss)
    const def = bossForAge(boss.boss)!;
    // De levens eerst: op een smal scherm valt het eind van de regel weg, en de rol is alleen sfeer
    const sub = `${whole(boss.hp)} / ${whole(boss.mhp)} levens · ${def.role}`;
    fill(el.querySelector('.boss')!, bossName(def), sub, boss.hp / boss.mhp);
  }
}

// De balk van de finale: hoe vol, hoe lang nog, hoe heel de poort is, en Herstel zodra hij schade heeft
// (de onderdelen van de balk staan er zeker in: zie barHTML)
function renderFinaleBar(bar: Element) {
  const rebuilding = G.bs.some(b => b.type === 'stargate' && !b.done);
  const { title, sub } = finaleText(G.finale, G.clock, rebuilding, G.peaceful);
  // In de vredige modus valt niemand aan: dan hoeven de levens van de poort er niet bij
  const health = G.peaceful ? null : gateHealth();
  const hpPercent = health ? Math.max(1, Math.round((health.hp / health.max) * 100)) : 0;
  const line = health ? `Poort ${hpPercent}% heel · ${lowerFirst(sub)}` : sub;
  fill(bar, title, line, chargeFrac(G.finale));
  // (deze balk is er alleen als er een finale is: zie showFinale)
  bar.classList.toggle('lost', !(G.finale!.need > 0));

  const hpBar = bar.querySelector<HTMLElement>('.tbb.hp')!,
    hpFrac = health ? health.hp / health.max : 0;
  hpBar.hidden = !health;
  hpBar.classList.toggle('low', hpFrac < LOW_HP);
  setWidth(hpBar.querySelector('i')!, hpFrac);

  // Herstel: alleen de poort, en alleen als hij schade heeft
  const gate = health && finishedGate();
  const cost = gate ? repairCost([gate]) : null;
  const fix = bar.querySelector<HTMLButtonElement>('.tbfix')!;
  fix.hidden = !cost;
  if (!cost) return;
  fix.disabled = !has(cost);
  // Alleen opnieuw tekenen als de prijs echt anders is (de knop blijft dan gewoon aan te klikken)
  const html = costHTML(cost, true);
  if (fix.dataset.cost !== html) {
    fix.dataset.cost = html;
    fix.querySelector('.c')!.innerHTML = html;
  }
}

// Een heel getal met punten, zoals 12.000 (niet afgekort tot 12.0k)
const whole = (n: number) => Math.max(0, Math.floor(n)).toLocaleString('nl-NL');

// "Houd nog 2 nachten stand" wordt "houd nog 2 nachten stand", voor midden in een zin
const lowerFirst = (text: string) => (text ? text[0].toLowerCase() + text.slice(1) : text);

// Tekst en breedte van één balk aanpassen, alleen als ze echt veranderd zijn (onderdelen: zie barHTML)
function fill(bar: Element, title: string, sub: string, frac: number) {
  const b = bar.querySelector('b')!,
    small = bar.querySelector('small')!;
  if (b.textContent !== title) b.textContent = title;
  if (small.textContent !== sub) small.textContent = sub;
  setWidth(bar.querySelector<HTMLElement>('.tbb i')!, frac);
}

function setWidth(fillEl: HTMLElement, frac: number) {
  const width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  if (fillEl.style.width !== width) fillEl.style.width = width;
}

/** De finale begint: een grote kaart met de regels, zoals bij een nieuw tijdperk, maar langer in beeld. */
export function showFinaleBanner(lines: string[]) {
  const items = lines.map(line => `<li>${esc(line)}</li>`).join('');
  showBanner(
    `<div class="in finale">
      <div class="eyebrow">De finale</div>
      <div class="t">De sterrenpoort laadt op</div>
      <ul class="rules">${items}</ul>
    </div>`,
    8000,
  );
}

$('#topbars').addEventListener('click', e => {
  if (!G) return;
  if ((e.target as HTMLElement).closest('[data-fix]')) {
    repairGate();
    return;
  }
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-go]');
  if (!button) return;
  if (button.dataset.go === 'boss') {
    const boss = liveBoss();
    if (boss) centerOn(boss.x, boss.y);
    return;
  }
  // De poort (of de bouwplaats van een nieuwe): erheen, en selecteren, zodat je ziet hoe hij ervoor staat
  const gate = G.bs.find(b => b.type === 'stargate');
  if (!gate) return;
  centerOn(gate.x + 1, gate.y + 1);
  clearSel();
  sel.b = gate.id;
  store.uiDirty = true;
});

// De knop Herstel op de balk: maakt alleen de sterrenpoort weer heel
function repairGate() {
  const gate = finishedGate();
  if (!gate || !repairBuildings([gate])) return;
  toast('De sterrenpoort is weer helemaal heel.', 'good');
  sfx('done');
  store.uiDirty = true;
}
