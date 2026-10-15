// Bovenbalk: dag, tijd en tijdperk.
import { store } from '../core/store';
import { TAU } from '../config';
import { B } from '../data/buildings';
import { basePower } from '../data/economy';
import { TECH } from '../data/tech';
import { powerDem, powerSup } from '../game/caches';
import { has } from '../game/economy';
import { popCap, popNow } from '../game/entities';
import { isMarching, isRaider } from '../game/military';
import { buildCost, chunkCost, lackText } from '../game/placement';
import { G, sel } from '../game/state';
import { isNight, raidNight, season } from '../game/time';
import { armsCost, armsUseful, canUpg, hasT, toolCost, upgCost } from '../game/upgrades';
import { costText } from './buildmenu';
import { coach } from './coach';
import { TOUCH } from './format';
import { fitToasts, renderQuick } from './hud';
import { updateTabs } from './panel';
import { updateResources } from './resources';
import { $ } from '../util/dom';

export function updateHeader() {
  updateResources();
  const cap = popCap(),
    pn = popNow();
  $('#popStat b').textContent = `${pn}/${cap}`;
  $('#popStat').classList.toggle(
    'bad',
    pn >= cap && G.bs.some(b => b.type !== 'townhall' && B[b.type].pop && b.done),
  );
  updateTabs();
  const ps = $('#powStat');
  ps.hidden = G.age < 5;
  if (!ps.hidden) {
    const supply = Math.round(powerSup);
    $('#powStat b').textContent = `${supply}/${powerDem}`;
    ps.classList.toggle('bad', powerDem > powerSup);
    ps.title = powerTip(supply);
  }
}
/** Uitleg bij het stroomgetal bovenaan, in gewone woorden (zie computeCaches in game/caches.ts). */
function powerTip(supply: number): string {
  const lines = [`Stroom: ${supply} geleverd, ${powerDem} nodig.`];
  const emergency = basePower(G.age);
  if (emergency) lines.push(`Het stamhuis levert altijd ${emergency} noodstroom; die telt mee.`);
  lines.push('Gebouwen die niets te doen hebben, gebruiken geen stroom en tellen niet mee.');
  if (powerDem > powerSup) lines.push('Te weinig stroom: gebouwen werken trager. Bouw een centrale.');
  return lines.join('\n');
}
export function updateWorldTop() {
  const h = Math.floor(G.clock),
    m = Math.floor((G.clock - h) * 6) * 10,
    part =
      G.clock < 6
        ? 'nacht'
        : G.clock < 12
          ? 'ochtend'
          : G.clock < 18
            ? 'middag'
            : G.clock < 21
              ? 'avond'
              : 'nacht';
  {
    const dt = `Dag ${G.day} · ${season().n}${G.rain ? ' ☂' : ''}`;
    const el = $('#dayTxt');
    if (el.textContent !== dt) el.textContent = dt;
  }
  const raidNow = G.foes.some(isRaider),
    // Soldaten van een rivaal onderweg: ze komen eraan, maar zijn nog niet in je land
    marchNow = !raidNow && G.foes.some(isMarching),
    t = $('#timeTxt');
  if (raidNow || marchNow) {
    t.textContent = raidNow ? 'Aanval gaande' : 'Aanval op komst';
    t.className = 'raid';
  } else {
    t.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${part}`;
    t.className = '';
  }
  drawDial($<HTMLCanvasElement>('#dial'), 68);
  const C = coach();
  store.coachAct = C.act || null;
  const prevTile = store.coachTile;
  store.coachTile = C.tile || null;
  if (prevTile !== store.coachTile) {
    sigs.cats = null;
    sigs.grid = null;
  }
  if ($('#modeTxt').textContent !== C.t) $('#modeTxt').textContent = C.t;
  if ($('#modeHint').textContent !== C.h) $('#modeHint').textContent = C.h;
  $('#step').classList.toggle('alarm', !!C.alarm);
  {
    // Zegt de stap zelf al wat je bouwt ("Bouw een hut."), dan is "Bouwen" genoeg op de knop
    const act = store.coachAct,
      named = !!act && !!act.b && C.t.toLowerCase().includes(B[act.b].n.toLowerCase()),
      label = !act ? '' : named ? 'Bouwen' : act.l,
      cb = $('#coachBtn');
    cb.hidden = !label || !!store.placing;
    if (cb.textContent !== label) cb.textContent = label;
    cb.title = act && act.l !== label ? act.l : '';
  }
  let txt = '',
    hint = '',
    cls = '';
  if (store.placing) {
    const d = B[store.placing],
      cost = buildCost(store.placing);
    txt = `${d.n} plaatsen`;
    hint =
      (has(cost) ? `Kost ${costText(cost)}. ` : `Nog ${lackText(cost)} nodig. `) +
      (d.wall || d.road
        ? TOUCH
          ? 'Tik op een vrij veld.'
          : 'Klik of sleep een lijn.'
        : TOUCH
          ? 'Tik op een vrije plek.'
          : 'Klik op een groen veld. Bomen en stenen worden opgeruimd.');
  } else if (store.expandMode) {
    txt = 'Gebied uitbreiden';
    hint = `Kies een gemarkeerd gebied aan de rand van je land. Kost ${costText(chunkCost())}.`;
  } else if (store.cmdMode) {
    txt = store.cmdMode === 'amove' ? 'Aanvalsmars' : 'Patrouille';
    hint =
      store.cmdMode === 'amove'
        ? 'Klik op een doel. Eenheden vechten onderweg.'
        : 'Klik op het eindpunt. Ze lopen heen en weer.';
    cls = 'army';
  } else if (store.demoMode) {
    txt = 'Sloopmodus';
    hint = 'Klik op een gebouw, muur of weg om het af te breken.';
    cls = 'army';
  } else if (sel.us.size) {
    txt = `${sel.us.size} ${sel.us.size === 1 ? 'eenheid' : 'eenheden'}`;
    hint = TOUCH
      ? 'Tik op de kaart om te lopen, op een vijand om aan te vallen.'
      : 'Rechtsklik om te lopen, of op een vijand om aan te vallen.';
    cls = 'army';
  } else if (sel.vs.size) {
    txt = `${sel.vs.size} ${sel.vs.size === 1 ? 'dorpeling' : 'dorpelingen'}`;
    hint = TOUCH ? 'Tik op een boom, akker of bouwplaats.' : 'Rechtsklik op een boom, akker of bouwplaats.';
  }
  const hb = $('#hintbar');
  hb.hidden = !txt;
  if (txt) {
    if ($('#hintTxt').textContent !== txt) $('#hintTxt').textContent = txt;
    if ($('#hintSub').textContent !== hint) $('#hintSub').textContent = hint;
    $('#modeDot').className = 'dot ' + cls;
    $('#cancelBtn').textContent = TOUCH ? 'Sluiten' : 'Annuleren';
  }
  renderQuick();
  fitToasts(); // er kan net een ander kaartje boven in beeld zijn gekomen: dan minder meldingen
  $('#expandBtn').classList.toggle('on', store.expandMode);
  $('#expandBtn').firstElementChild!.textContent = store.expandMode ? 'Klaar' : 'Uitbreiden';
  // Hoeveel gebieden je hebt staat in de uitleg bij de muis (niet meer als getal in het overzicht)
  const owned = G.unl.filter(Boolean).length;
  $('#expandBtn').title = `Gebied uitbreiden (E) · ${costText(chunkCost())} · je hebt ${owned} gebieden`;
  $('#raidflash').classList.toggle('on', raidNow);
  const dq = document.querySelector('#sidebtns [data-p="def"]'),
    uq = document.querySelector('#sidebtns [data-p="upg"]');
  if (dq) dq.classList.toggle('dot', raidNow || marchNow || (raidNight() && G.clock >= 12 && G.clock < 21));
  // Iets te verbeteren dat je kunt betalen: een rustig stipje in de kleur van het tijdperk
  // (rood is voor gevaar)
  if (uq)
    uq.classList.toggle(
      'hint',
      G.bs.some(b => canUpg(b) && has(upgCost(b))) ||
        (G.toolLvl < G.age && has(toolCost())) ||
        (armsUseful() && G.armsLvl < G.age && has(armsCost())) ||
        (!G.research && TECH.some(T => T.age <= G.age && !hasT(T.k) && has(T.cost))),
    );
}
function drawDial(c: HTMLCanvasElement, S: number) {
  const x = c.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  const r = S / 2 - 3;
  x.fillStyle = '#2f3d5e';
  x.beginPath();
  x.arc(0, 0, r, 0, TAU);
  x.fill();
  x.fillStyle = '#f0d68a';
  x.beginPath();
  x.moveTo(0, 0);
  x.arc(0, 0, r, (6.5 / 24) * TAU + Math.PI / 2, (18 / 24) * TAU + Math.PI / 2);
  x.closePath();
  x.fill();
  const a = (G.clock / 24) * TAU + Math.PI / 2,
    px = Math.cos(a) * r * 0.62,
    py = Math.sin(a) * r * 0.62;
  x.fillStyle = isNight() ? '#e8ecf4' : '#e0942f';
  x.beginPath();
  x.arc(px, py, r * 0.24, 0, TAU);
  x.fill();
  x.strokeStyle = 'rgba(43,37,32,.6)';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(0, 0, r, 0, TAU);
  x.stroke();
  x.setTransform(1, 0, 0, 1, 0, 0);
}

/** Laatst getekende versie per stuk interface; leegmaken dwingt opnieuw tekenen af. */
export const sigs: Record<string, string | null> = {};
export function setHTML(el: HTMLElement, key: string, sig: string, fn: () => string) {
  if (sigs[key] === sig) return;
  sigs[key] = sig;
  el.innerHTML = fn();
}
