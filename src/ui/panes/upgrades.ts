// Paneel "Verbeteren": werktuigen, wapens, gebouwen en uitvindingen. Eén korte regel per ding, met de
// kosten ernaast; wat het precies oplevert staat in de uitleg bij de muis.
import type { Building, Cost } from '../../types';
import { store } from '../../core/store';
import { sfx } from '../../audio/sound';
import { AGES } from '../../data/ages';
import { BLESSING } from '../../data/blessings';
import { B } from '../../data/buildings';
import { RES } from '../../data/resources';
import { TECH, TK } from '../../data/tech';
import { has, pay } from '../../game/economy';
import { G } from '../../game/state';
import {
  armsCost,
  armsRows,
  armsUseful,
  canUpg,
  hasT,
  lvlOf,
  researchTime,
  toolRows,
  upgradeRows,
  toolCost,
  upgCost,
  upgrade,
  upgradeArms,
  upgradeTools,
  roadTier,
} from '../../game/upgrades';
import { oldRoadCount, renewBuilding, renewCost, renewRoads, renewTarget, roadRenewCost } from '../../game/renew';
import { repairBuildings, repairCost } from '../../game/repair';
import { blessingListHTML } from '../blessings';
import { compareText, costHTML, esc, fmtShort } from '../format';
import { iconFor } from '../../render/icons';
import { ico } from '../glyphs';
import { setHTML, sigs } from '../header';
import { toast } from '../hud';
import { $ } from '../../util/dom';

// Volgende tijdperk als tekst, voor "volgende verbetering in de ..."
const nextAgeName = () => (AGES[G.age + 1] ? 'de ' + AGES[G.age + 1].n.toLowerCase() : 'een later tijdperk');

/** Wat er in één regel van het paneel staat. */
interface RowParts {
  /** De data-attributen van de knop (wat er gebeurt als je klikt). */
  data: string;
  /** Plaatje of pictogram vooraan. */
  pic: string;
  name: string;
  /** Een korte tweede regel, of leeg. */
  sub?: string;
  /** Rechts: de kosten (of een kort woord als het nu niet kan). */
  right: string;
  can: boolean;
  /** Uitleg bij de muis: wat het precies oplevert. */
  tip: string;
}
/** Eén regel: een knop met plaatje, naam, eventueel een korte uitleg, en rechts de kosten. */
function row({ data, pic, name, sub, right, can, tip }: RowParts): string {
  return `<button class="urow" ${data} ${can ? '' : 'disabled'} title="${esc(tip)}">${pic}<span class="un"><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span>${right}</button>`;
}
/** Werktuigen of wapens: geldt voor iedereen tegelijk. */
function globalRow(key: string, glyph: string, name: string, sub: string, level: number, rows: string) {
  const maxed = level >= G.age,
    cost = key === 'tools' ? toolCost() : armsCost();
  return row({
    data: `data-g="${key}"`,
    pic: `<span class="ug">${ico(glyph)}</span>`,
    name,
    sub: maxed ? `Volgende in ${nextAgeName()}` : sub,
    right: maxed ? '' : costHTML(cost, true),
    can: !maxed && has(cost),
    tip: maxed ? `Niveau ${level + 1}` : `Niveau ${level + 1} → ${level + 2}. ${rows}`,
  });
}

// Staat het lijstje met zegeningen open? null = nog niet aangeklikt: dan open bij één of twee zegeningen.
// Zonder zegeningen valt er niets te zien, en een lange lijst duwt later de verbeteringen uit beeld.
const BLESSINGS_OPEN_KEY = 'tijdperken-zegeningen-open';
let blessingsOpen: boolean | null = null;
try {
  const saved = localStorage.getItem(BLESSINGS_OPEN_KEY);
  if (saved) blessingsOpen = saved === 'open';
} catch {
  // geen opslag (bijv. privévenster): dan gewoon de standaard
}
const showBlessingList = () => blessingsOpen ?? (G.blessings.length > 0 && G.blessings.length <= 2);

/** Bovenaan: de zegeningen die je koos, in een uitklapblok met de pictogrammen alvast zichtbaar. */
function blessingsSection() {
  const icons = G.blessings
    .map(k => BLESSING[k])
    .filter(Boolean)
    .map(
      b => `<span class="bchip ${b.risk ? 'risk' : ''}" title="${esc(`${b.n}: ${b.d}`)}">${ico(b.g)}</span>`,
    )
    .join('');
  return `<details class="blessbox" ${showBlessingList() ? 'open' : ''}><summary class="usub">Zegeningen <span class="small">${G.blessings.length}</span><span class="bchips">${icons}</span></summary>${blessingListHTML()}</details>`;
}

/** Wat alle verbeteringen samen kosten (één niveau per gebouw). */
function totalUpgradeCost(list: Building[]): Cost {
  const total: Cost = {};
  for (const b of list) {
    const c = upgCost(b);
    for (const k in c) total[k] = (total[k] || 0) + c[k];
  }
  return total;
}
/** Wat je per grondstof tekortkomt voor deze kosten (alleen de grondstoffen waar je te weinig van hebt). */
function shortfall(c: Cost): Cost {
  const out: Cost = {};
  for (const k in c) if (G.res[k] < c[k]) out[k] = Math.ceil(c[k] - G.res[k]);
  return out;
}

/** Verouderde gebouwen die in hun opvolger vernieuwd kunnen worden, per opvolger. */
function renewList(): Building[] {
  return G.bs.filter(b => renewTarget(b) !== null);
}

export function renderUpgrades() {
  // Een verouderd gebouw dat vernieuwd kan worden, staat bij Vernieuwen (niet meer bij Verbeteren)
  const renew = renewList(),
    renewSet = new Set(renew),
    up = G.bs.filter(b => canUpg(b) && !renewSet.has(b)),
    aff = up.filter(b => has(upgCost(b))),
    renewAff = renew.filter(b => has(renewCost(renewTarget(b)!))),
    roadCost = roadRenewCost(),
    fixCost = repairCost();
  const sig = JSON.stringify([
    G.age,
    G.toolLvl,
    G.armsLvl,
    has(toolCost()),
    has(armsCost()),
    up.map(b => b.id + ':' + lvlOf(b)),
    aff.length,
    Object.values(shortfall(totalUpgradeCost(up))),
    renew.map(b => b.id),
    renewAff.length,
    roadCost && [Object.values(roadCost), has(roadCost)],
    fixCost && [Object.values(fixCost), has(fixCost)],
    Object.keys(G.tech),
    G.research && [G.research.k, Math.floor(G.research.t / 2)],
    TECH.map(T => (has(T.cost) ? 1 : 0)).join(''),
    G.blessings,
  ]);
  setHTML($('#upgrades'), 'upg', sig, () => {
    // 0. Zegeningen die je koos
    let h = blessingsSection();

    // 1. Werktuigen en wapens: gelden voor iedereen tegelijk
    h += `<div class="usub">Voor iedereen</div><div class="ulist">`;
    h += globalRow('tools', '⚒', 'Werktuigen', 'Sneller verzamelen', G.toolLvl, compareText(toolRows()));
    // Zonder leger (spelregel Geen leger) hebben wapens en pantser geen zin
    if (armsUseful())
      h += globalRow('arms', '⛨', 'Wapens en pantser', 'Sterker leger', G.armsLvl, compareText(armsRows()));
    h += '</div>';

    // 2. Gebouwen: per soort één regel; wat er beter wordt staat in de uitleg bij de muis.
    // Bovenaan "Alles verbeteren" met wat dat samen kost (één niveau per gebouw) en wat je daarvoor tekortkomt.
    const total = totalUpgradeCost(up),
      short = shortfall(total),
      allOk = up.length > 0 && !Object.keys(short).length;
    const allBtn = up.length
      ? `<button class="quiet" data-g="all" ${aff.length ? '' : 'disabled'} title="${esc(
          allOk
            ? `Verbeter alle ${up.length} gebouwen in één keer`
            : aff.length
              ? `Verbeter de ${aff.length} van ${up.length} gebouwen die je nu kunt betalen`
              : 'Je kunt nu geen enkele verbetering betalen',
        )}">Alles verbeteren${up.length > 1 ? ` (${aff.length}/${up.length})` : ''}</button>`
      : '';
    h += `<div class="usub">Gebouwen${allBtn}</div>`;
    if (!up.length)
      h += `<p class="small">Niets te verbeteren. Elk nieuw tijdperk geeft een niveau extra.</p>`;
    else {
      // Wat alles samen kost, en (rood) wat je daarvoor nog mist
      h += `<div class="utotal"><span>Alles samen</span>${costHTML(total, true)}${
        Object.keys(short).length
          ? `<span class="lack">tekort ${Object.keys(short)
              .map(k => `${fmtShort(short[k])} ${RES[k].n.toLowerCase()}`)
              .join(', ')}</span>`
          : `<span class="ok">${ico('✓')} genoeg</span>`
      }</div>`;
      const byType: Record<string, Building[]> = {};
      for (const b of up) (byType[b.type] = byType[b.type] || []).push(b);
      h += `<div class="ulist">${Object.entries(byType)
        .map(([k, list]) => {
          const b = list[0],
            level = lvlOf(b);
          return row({
            data: `data-ut="${k}"`,
            pic: `<img src="${iconFor(k)}" alt="">`,
            name: B[k].n + (list.length > 1 ? ` ×${list.length}` : ''),
            right: costHTML(upgCost(b), true),
            can: list.some(x => has(upgCost(x))),
            tip: `Niveau ${level + 1} → ${level + 2}. ${compareText(upgradeRows(b))}`,
          });
        })
        .join('')}</div>`;
    }

    // 2b. Vernieuwen: verouderde gebouwen naar hun opvolger, oude wegen naar de wegsoort van nu, en herstel
    h += `<div class="usub">Vernieuwen${
      renew.length > 1
        ? `<button class="quiet" data-g="renewall" ${renewAff.length ? '' : 'disabled'} title="Vernieuw alle verouderde gebouwen die je kunt betalen">Alles vernieuwen (${renewAff.length}/${renew.length})</button>`
        : ''
    }</div><div class="ulist">`;
    const byNext: Record<string, Building[]> = {};
    for (const b of renew) {
      const next = renewTarget(b)!;
      (byNext[b.type + '>' + next] = byNext[b.type + '>' + next] || []).push(b);
    }
    for (const [key, list] of Object.entries(byNext)) {
      const [from, next] = key.split('>'),
        cost = renewCost(next);
      h += row({
        data: `data-renew="${from}"`,
        pic: `<img src="${iconFor(next)}" alt="">`,
        name: `${B[from].n} → ${B[next].n}` + (list.length > 1 ? ` ×${list.length}` : ''),
        sub: 'Verouderd: op dezelfde plek vervangen',
        right: costHTML(cost, true),
        can: has(cost),
        tip: `${B[from].n} wordt ${B[next].n.toLowerCase()} (niveau 1, helemaal heel). ${B[next].desc || ''} Kost 70% van nieuw bouwen.`,
      });
    }
    if (roadCost) {
      const n = oldRoadCount(),
        tier = roadTier();
      h += row({
        data: 'data-g="roads"',
        pic: `<img src="${iconFor('road')}" alt="">`,
        name: `Wegen vernieuwen ×${n}`,
        sub: tier >= 3 ? 'Naar asfalt' : 'Naar klinkers',
        right: costHTML(roadCost, true),
        can: has(roadCost),
        tip: `Alle ${n} oude wegtegels in één keer naar de wegsoort van nu: sneller lopen voor iedereen.`,
      });
    }
    if (fixCost)
      h += row({
        data: 'data-g="repair"',
        pic: `<span class="ug">${ico('✚')}</span>`,
        name: 'Alles herstellen',
        sub: 'Beschadigde gebouwen weer heel',
        right: costHTML(fixCost, true),
        can: has(fixCost),
        tip: 'Herstel alle beschadigde gebouwen in één keer (hout en steen per ontbrekend levenspunt).',
      });
    if (!renew.length && !roadCost && !fixCost)
      h += `<p class="small">Niets verouderd en niets beschadigd.</p>`;
    h += '</div>';

    // 3. Uitvindingen: eerst wat nu kan, dan een blik vooruit en wat al klaar is
    const now = TECH.filter(T => T.age <= G.age && !hasT(T.k)),
      done = TECH.filter(T => hasT(T.k)),
      soon = TECH.filter(T => T.age === G.age + 1);
    h += `<div class="usub">Uitvindingen</div><div class="ulist">`;
    if (G.research) {
      const T = TK[G.research.k],
        left = Math.ceil(researchTime(T) - G.research.t);
      h += `<div class="urow busy" title="${esc(`${T.d} · nog ${left} seconden`)}"><span class="ug">${ico(T.g)}</span><span class="un"><b>${T.n}</b><span class="bar acc"><i style="width:${(G.research.t / researchTime(T)) * 100}%"></i></span></span><small class="state">bezig</small></div>`;
    }
    for (const T of now) {
      if (G.research && G.research.k === T.k) continue;
      h += row({
        data: `data-tech="${T.k}"`,
        pic: `<span class="ug">${ico(T.g)}</span>`,
        name: T.n,
        sub: T.d,
        right: costHTML(T.cost, true),
        can: !G.research && has(T.cost),
        tip: `${T.d} · ${Math.round(researchTime(T))} seconden onderzoek${G.research ? ' · eerst moet het andere onderzoek klaar zijn' : ''}`,
      });
    }
    h += '</div>';
    if (!now.length && !G.research) h += `<p class="small">Alles van dit tijdperk is uitgevonden.</p>`;
    if (soon.length) h += `<p class="small">In ${nextAgeName()}: ${soon.map(T => T.n).join(', ')}.</p>`;
    if (done.length) h += `<p class="small">${ico('✓')} Klaar: ${done.map(T => T.n).join(', ')}.</p>`;
    return h;
  });
}
$('#upgrades').addEventListener('click', e => {
  // Zegeningen open- of dichtklappen: onthouden voordat de browser het blok omzet
  const summary = (e.target as HTMLElement).closest('.blessbox > summary');
  if (summary) {
    // De ouder van deze summary is altijd het uitklapblok (details.blessbox)
    blessingsOpen = !(summary.parentElement as HTMLDetailsElement).open;
    try {
      localStorage.setItem(BLESSINGS_OPEN_KEY, blessingsOpen ? 'open' : 'dicht');
    } catch {
      // niet erg: dan staat het na herladen weer zoals standaard
    }
    sfx('tick');
    return;
  }
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  if (t.dataset.tech) {
    const T = TK[t.dataset.tech];
    if (!G.research && has(T.cost)) {
      pay(T.cost);
      G.research = { k: T.k, t: 0 };
      toast(`Onderzoek gestart: ${T.n} (${Math.round(researchTime(T))}s).`);
    }
    sigs.upg = null;
    store.uiDirty = true;
    return;
  }
  if (t.dataset.ut) {
    // Alle gebouwen van deze soort verbeteren die je kunt betalen
    let n = 0;
    for (const b of G.bs.filter(x => x.type === t.dataset.ut && canUpg(x))) if (upgrade(b, true)) n++;
    toast(
      n ? `${n} × ${B[t.dataset.ut].n.toLowerCase()} verbeterd.` : 'Te weinig grondstoffen.',
      n ? 'good' : 'bad',
    );
  } else if (t.dataset.renew) {
    // Alle verouderde gebouwen van deze soort vernieuwen die je kunt betalen
    let n = 0;
    for (const b of G.bs.filter(x => x.type === t.dataset.renew)) if (renewBuilding(b)) n++;
    toast(n ? `${n} × ${B[t.dataset.renew].n.toLowerCase()} vernieuwd.` : 'Te weinig grondstoffen.', n ? 'good' : 'bad');
    if (n) sfx('upgrade');
  } else if (t.dataset.g === 'renewall') {
    let n = 0;
    for (const b of renewList()) if (renewBuilding(b)) n++;
    toast(n ? `${n} ${n === 1 ? 'gebouw' : 'gebouwen'} vernieuwd.` : 'Te weinig grondstoffen.', n ? 'good' : 'bad');
    if (n) sfx('upgrade');
  } else if (t.dataset.g === 'roads') {
    const n = renewRoads();
    toast(n ? `${n} wegtegels vernieuwd.` : 'Te weinig grondstoffen.', n ? 'good' : 'bad');
    if (n) sfx('upgrade');
  } else if (t.dataset.g === 'repair') {
    const ok = repairBuildings();
    toast(ok ? 'Alle gebouwen hersteld.' : 'Te weinig grondstoffen.', ok ? 'good' : 'bad');
  } else if (t.dataset.g === 'tools') upgradeTools();
  else if (t.dataset.g === 'arms') upgradeArms();
  else if (t.dataset.g === 'all') {
    let n = 0;
    for (const b of G.bs
      .filter(canUpg)
      .sort(
        (a, c) =>
          Object.values(upgCost(a)).reduce((x, y) => x + y, 0) -
          Object.values(upgCost(c)).reduce((x, y) => x + y, 0),
      ))
      if (upgrade(b, true)) n++;
    toast(
      n ? `${n} ${n === 1 ? 'gebouw' : 'gebouwen'} verbeterd.` : 'Te weinig grondstoffen.',
      n ? 'good' : 'bad',
    );
  }
  sigs.upg = null;
  store.uiDirty = true;
});
