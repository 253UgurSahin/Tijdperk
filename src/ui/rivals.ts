// Rivalen in de interface: het overzicht in het paneel Leger, de kaart bij een selectie en de tooltips.
import type { Foe, Rival, RivalBuilding } from '../types';
import { store } from '../core/store';
import { AGES } from '../data/ages';
import { B } from '../data/buildings';
import { PERSONALITY, RIVAL, armyToAttack, strengthWord, verb, type RivalDef } from '../data/rivals';
import { theWonder } from '../data/wonders';
import { canMake } from '../data/succession';
import { UNITS } from '../data/units';
import {
  confirmSurprise,
  rivalAttackDay,
  rivalPower,
  surpriseArmed,
  surpriseTarget,
  surpriseText,
  yourPower,
} from '../game/diplomacy';
import { isDead } from '../game/military';
import { G, sel } from '../game/state';
import {
  arrivalHour,
  clockText,
  orderRivalAttack,
  rbById,
  rivalArmy,
  rivalById,
  rivalHall,
  rivalWonderSaving,
} from '../game/rivals';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { iconFor } from '../render/icons';
import { esc } from './format';
import { ico } from './glyphs';
import { setHTML, sigs } from './header';
import { toast } from './hud';
import { pactIconsHTML, relChipHTML, relationWords, showDiplomacy } from './diplomacy';
import type { InspectorParts } from './inspector';
import { bannerHTML } from './peoples';
import { $ } from '../util/dom';
import { dist } from '../util/math';

// ---- Sterkte en status ----

/** Zwakker, gelijk of sterker dan jij (een sleutel: zie de woorden hieronder). De sterkte telt in game/diplomacy.ts. */
export const rivalStrength = (r: Rival): string => strengthWord(rivalPower(r), yourPower());
// De sterkte in woorden: kort in de lijst, als hele zin op de kaart. De sleutel blijft de CSS-klasse.
const STRENGTH_SHORT: Record<string, string> = {
  zwakker: 'zwakker',
  gelijk: 'even sterk',
  sterker: 'sterker',
};
const STRENGTH_LONG: Record<string, string> = {
  zwakker: 'zwakker dan jij',
  gelijk: 'even sterk als jij',
  sterker: 'sterker dan jij',
};

// "1 soldaat", "3 soldaten"
const soldiersText = (n: number) => `${n} ${n === 1 ? 'soldaat' : 'soldaten'}`;

/** Wat een rivaal nu doet: een paar woorden, en een toon voor de kleur ('good', 'bad', 'warn' of ''). */
interface RivalStatus {
  text: string;
  tone: string;
}

/** Wat een rivaal nu doet, in een paar woorden, met een toon voor de kleur (bad = gevaar). */
export function rivalStatus(r: Rival): RivalStatus {
  if (r.dead) return { text: `Verslagen op dag ${r.deadDay}`, tone: 'good' };
  const army = rivalArmy(r);
  const raiding = army.filter(f => f.mode === 'raid').length;
  const marching = army.filter(f => f.mode === 'march');
  if (raiding) return { text: `Valt aan met ${soldiersText(raiding + marching.length)}`, tone: 'bad' };
  if (marching.length) {
    const when = clockText(arrivalHour(marching));
    return { text: `Onderweg naar jou: ${soldiersText(marching.length)}, rond ${when}`, tone: 'bad' };
  }
  if (G.peaceful) return { text: 'Vredige modus: valt niet aan', tone: '' };
  if (r.ally) return { text: 'Bondgenoot: valt niet aan', tone: 'good' };
  // Wanneer ze weer kunnen aanvallen, hangt af van de relatie (zie game/diplomacy.ts)
  const first = rivalAttackDay(r);
  if (G.day < first) return { text: `Aanval niet vóór dag ${first}`, tone: '' };
  // Ze vallen pas aan als er genoeg soldaten thuis zijn (dezelfde regel als in game/rivals.ts)
  const home = army.filter(f => f.mode === 'home').length;
  const need = armyToAttack(r.age, r.attacks, r.p, G.diff);
  if (home < need) return { text: `Bouwt een leger op: ${home} van ${need} soldaten`, tone: '' };
  return { text: 'Klaar om aan te vallen (overdag)', tone: 'warn' };
}

// Naam, karakter en tijdperk op één regel
const subLine = (r: Rival) => `${PERSONALITY[r.p].n} · ${AGES[r.age].n}`;

/**
 * Het wereldwonder waar een rivaal aan bouwt of voor spaart (vanaf de helft),
 * of hoeveel wonderen hij al heeft, in een paar woorden (of leeg).
 */
function rivalWonderLine(r: Rival) {
  if (r.dead) return '';
  const site = r.bs.find(b => B[b.type].wonder && !b.done);
  if (site) return `Bouwt ${theWonder(site.type)}: ${Math.floor((site.prog / site.bt) * 100)}%`;
  const saving = rivalWonderSaving(r);
  if (saving) return `Spaart voor ${theWonder(saving.k)}: ${Math.floor(saving.frac * 100)}%`;
  const owned = r.bs.filter(b => B[b.type].wonder && b.done).length;
  return owned ? `${owned} ${owned === 1 ? 'wereldwonder' : 'wereldwonderen'}` : '';
}

// Wat een soldaat van een rivaal nu doet, in een paar woorden
const DOING: Record<string, string> = {
  home: 'op wacht',
  march: 'onderweg naar jou',
  raid: 'valt aan',
  return: 'gaat naar huis',
  help: 'helpt jou',
};

// ---- Tooltips bij de muis ----

/** Tooltip bij een soldaat van een rivaal. */
export function rivalUnitTip(f: Foe) {
  const r = rivalById(f.rival);
  if (!r) return '';
  // Een soldaat van een rivaal heeft altijd een soort (uk) en een mode: zie spawnRivalUnit in game/rivals.ts
  const title = `${UNITS[f.uk!].n} · ${RIVAL[r.k].n}`;
  const line = `${relationWords(r)} · ${DOING[f.mode] || 'valt aan'} · ${Math.ceil(f.hp)} leven`;
  return `<b>${title}</b><span>${line}</span>`;
}
/** Tooltip bij een gebouw van een rivaal. */
export function rivalBuildingTip(b: RivalBuilding) {
  const r = rivalById(b.rival);
  if (!r) return '';
  const title = `${B[b.type].n} · ${RIVAL[r.k].n}`;
  // Bij een wereldwonder in aanbouw: hoe ver ze zijn
  const busy = B[b.type].wonder && !b.done ? ` · wonder ${Math.floor((b.prog / b.bt) * 100)}% gebouwd` : '';
  const line = `${relationWords(r)} · ${Math.ceil(b.hp)}/${Math.round(b.mhp)} leven${busy}`;
  return `<b>${title}</b><span>${line}</span>`;
}
/** Tooltip boven het land van een rivaal. */
export function rivalLandTip(id: number) {
  const r = rivalById(id);
  if (!r) return '';
  return `<b>Land van ${RIVAL[r.k].n}</b><span>${relationWords(r)} · verwoest hun stamhuis om het te veroveren</span>`;
}

// ---- Overzicht in het paneel Leger ----

/** De lijst met rivalen in het paneel Leger (alleen als er rivalen zijn). */
export function renderRivals() {
  const box = $('#rivals'),
    head = $('#rivSect');
  const list = (G && G.rivals) || [];
  box.hidden = head.hidden = !list.length;
  if (!list.length) return;
  const rows = list.map(r => ({
    r,
    status: rivalStatus(r),
    power: r.dead ? '' : rivalStrength(r),
    wonder: rivalWonderLine(r),
  }));
  const sig = JSON.stringify(
    rows.map(({ r, status, power, wonder }) => [
      r.age,
      r.dead,
      rivalArmy(r).length,
      status.text,
      power,
      wonder,
      Math.round(r.rel),
      r.ally,
      r.atWar,
      !!r.trade,
    ]),
  );
  const left = list.filter(r => !r.dead).length;
  // De kop eindigt met een <span> voor dit getal (zie index.html)
  $('#rivLeft').textContent = left ? `${left} van ${list.length} over` : 'allemaal verslagen';
  // De knop naar het venster Diplomatie staat in de kop, zodat je hem meteen ziet (zie ui/diplomacy.ts)
  $('#diploBtn').hidden = !left;
  setHTML(box, 'rivals', sig, () => rows.map(rowHTML).join(''));
}

/** Eén regel in de lijst met rivalen (zie renderRivals). */
interface RivalRow {
  r: Rival;
  status: RivalStatus;
  power: string;
  wonder: string;
}

function rowHTML({ r, status, power, wonder }: RivalRow) {
  const info = RIVAL[r.k],
    n = rivalArmy(r).length;
  const army = r.dead ? '' : ` · ${soldiersText(n)}`;
  const tip = r.dead ? '' : 'Bekijk hun stad';
  const chip = power
    ? `<span class="rivpow ${power}" title="Leger en torens vergeleken met de jouwe">${STRENGTH_SHORT[power]}</span>`
    : '';
  return `<button class="rivrow ${r.dead ? 'dead' : ''}" data-rival="${r.id}" title="${tip}">
    ${bannerHTML(info, 'sm')}
    <span class="rivtxt">
      <b>${esc(info.n)}</b>
      <small>${subLine(r)}${army}</small>
      <small class="rivstat ${status.tone}">${status.text}</small>
      ${wonder ? `<small class="rivwonder">${ico('★')}${wonder}</small>` : ''}
      ${r.dead ? '' : `<span class="rivrel" title="Open Diplomatie">${relChipHTML(r)}${pactIconsHTML(r)}</span>`}
    </span>
    ${chip}
  </button>`;
}

$('#diploBtn').addEventListener('click', () => showDiplomacy());

$('#rivals').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-rival]');
  if (!t) return;
  // Gevonden met [data-rival], dus het nummer staat erop
  const r = rivalById(+t.dataset.rival!);
  if (!r || r.dead) return;
  // Een klik op de relatie opent het venster Diplomatie bij deze rivaal; de rest van de rij toont hun stad
  if (e.target.closest('.rivrel')) showDiplomacy(r.id);
  else showRival(r);
});

/** Camera naar de stad van een rivaal, en hem selecteren. */
export function showRival(r: Rival) {
  centerOn(r.x + 1, r.y + 1);
  clearSel();
  sel.rival = r.id;
  sigs.ins = null;
  store.uiDirty = true;
}

// ---- Selectie: een gebouw van een rivaal, of de rivaal zelf ----

// Uitleg onder het stamhuis van een rivaal
const HALL_NOTE =
  'Verwoest dit stamhuis en ze zijn verslagen. Hun land en een flinke buit worden dan van jou.';

// Jouw beste geschut tegen gebouwen dat je nu kunt maken (zoals de blijde), of null
function yourSiege() {
  const keys = Object.keys(UNITS)
    .filter(k => UNITS[k].bonus?.vs === 'camp' && canMake(k, G.age, G.people))
    .sort((a, b) => UNITS[b].age - UNITS[a].age);
  return keys.length ? UNITS[keys[0]] : null;
}

// De soldaat waarop je klikte, als hij nog meedoet en van deze rivaal is (ook een helper die jou helpt)
function clickedSoldier(r: Rival) {
  const f = sel.rivalUnit && G.foes.find(o => o.id === sel.rivalUnit);
  return f && f.rival === r.id && !isDead(f) ? f : null;
}

// Aantallen, sterkte en wat ze doen: onderaan beide kaarten
function factsHTML(r: Rival, army: number, status: RivalStatus, power: string) {
  const buildings = r.bs.length;
  const danger = status.tone === 'bad' || status.tone === 'warn' ? 'warn' : '';
  return `<div class="rivfacts">
      <span>${soldiersText(army)}</span>
      <span>${buildings} ${buildings === 1 ? 'gebouw' : 'gebouwen'}</span>
      <span class="rivpow ${power}">${STRENGTH_LONG[power]}</span>
      ${relChipHTML(r)}${pactIconsHTML(r)}
    </div>
    <div class="statline ${danger}"><i class="dot"></i>${status.text}</div>`;
}

/**
 * De kaart in het selectiepaneel als je iets van een rivaal hebt aangeklikt, of null.
 * `ui` zijn de bouwstenen van het selectiepaneel (zie ui/inspector.ts): head, hpl, CB en im.
 */
export function rivalSelection({ head, hpl, CB, im }: InspectorParts) {
  const b = sel.rb && rbById.get(sel.rb);
  const r = b ? rivalById(b.rival) : sel.rival && rivalById(sel.rival);
  if (!r || r.dead) {
    sel.rb = null;
    sel.rival = null;
    sel.rivalUnit = null;
    return null;
  }
  const info = RIVAL[r.k],
    soldiers = G.us.length,
    army = rivalArmy(r).length;
  const status = rivalStatus(r),
    power = rivalStrength(r);
  const facts = factsHTML(r, army, status, power);
  // Alles wat op de kaart staat, zit in de handtekening: verandert iets, dan tekent de kaart opnieuw
  const shared = `${soldiers}|${status.text}|${power}|${army}|${r.bs.length}|${r.age}|${Math.round(r.rel)}|${r.ally}|${r.atWar}|${!!r.trade}`;
  // Zonder oorlog is aanvallen een verrassingsaanval: zeg wat dat kost, en vraag om een tweede klik
  // (zie confirmSurprise in game/diplomacy.ts)
  const surprise = r.atWar ? '' : ` Let op: ${surpriseText(r)} Je klikt dan twee keer.`;
  const armed = surpriseArmed(r);
  const sure = 'Zeker? Klik nog eens';
  const diplo = CB('data-riv="diplo"', '⚭', 'Diplomatie', {
    tip: 'Relatie, geschenken, handel, verbond, oorlog en vrede',
  });

  if (b) {
    const d = B[b.type],
      hall = b.type === 'townhall',
      siege = yourSiege();
    // yourSiege kiest alleen soldaten met een bonus tegen gebouwen, dus bonus bestaat
    const siegeNote = siege
      ? ` Een ${siege.n.toLowerCase()} doet ${siege.bonus!.mul}× schade tegen gebouwen.`
      : '';
    const note = hall ? HALL_NOTE : d.wonder ? wonderNote(b, info) : `Gebouw van ${esc(info.n)}.${siegeNote}`;
    // Het pictogram van het gebouw, met hun vaandel ervoor: zo zie je meteen dat het niet van jou is
    const portrait = im(iconFor(b.type)) + bannerHTML(info, 'rivbadge');
    const attack = CB('data-riv="attack"', '⚔', armed ? sure : `Leger (${soldiers}) valt aan`, {
      dis: !soldiers,
      danger: !r.atWar,
      tip: `Stuur al je soldaten naar dit gebouw.${surprise}`,
    });
    const look = CB('data-riv="go"', '◎', 'Bekijk', { tip: 'Camera naar dit gebouw' });
    const toHall = hall
      ? ''
      : CB('data-riv="hall"', '⌂', 'Hun stamhuis', { tip: 'Camera naar hun stamhuis' });
    return {
      ctx: info.n,
      cmds: attack + look + toHall + diplo,
      sig: `rb${b.id}|${Math.round(b.hp)}|${b.done}|${Math.floor(b.prog)}|${G.age}|${shared}`,
      html:
        head(portrait, d.n, `${esc(info.n)} · ${subLine(r)}`) +
        hpl(b.hp / b.mhp, `${Math.ceil(b.hp)}/${Math.round(b.mhp)}`, 'bad') +
        (d.wonder && !b.done
          ? hpl(b.prog / b.bt, `${Math.floor((b.prog / b.bt) * 100)}% gebouwd`, 'warn')
          : '') +
        `<p class="small rivnote">${note}</p>` +
        facts,
    };
  }

  // De rivaal zelf. Klikte je op een van hun soldaten, dan kun je ook die ene aanvallen.
  const unit = clickedSoldier(r);
  // Een helper van je bondgenoot val je niet aan
  const attackUnit =
    unit && !unit.helper
      ? CB('data-riv="unit"', '⚔', armed && surpriseTarget(unit) ? sure : `Val soldaat aan (${soldiers})`, {
          dis: !soldiers,
          danger: !r.atWar,
          tip: `Al je soldaten vallen deze soldaat aan.${surprise}`,
        })
      : '';
  const look = CB('data-riv="go"', '◎', 'Bekijk stad', { tip: 'Camera naar hun stamhuis' });
  const attackHall = CB('data-riv="attack"', '⚔', armed ? sure : `Leger (${soldiers}) naar stad`, {
    dis: !soldiers || !rivalHall(r),
    danger: !r.atWar,
    tip: `Al je soldaten lopen naar hun stad en vallen het stamhuis aan.${surprise}`,
  });
  // (een soldaat van een rivaal heeft altijd een soort en een mode)
  const unitLine = unit
    ? `<p class="small rivnote"><b>${UNITS[unit.uk!].n}</b> · ${DOING[unit.mode!] || 'valt aan'}</p>` +
      hpl(unit.hp / unit.mhp, `${Math.ceil(unit.hp)}/${Math.round(unit.mhp)}`, 'bad')
    : '';
  const unitSig = unit ? `${unit.id}:${Math.ceil(unit.hp)}:${unit.mode}` : '';
  return {
    ctx: info.n,
    cmds: attackUnit + look + attackHall + diplo,
    sig: `rv${r.id}|${unitSig}|${shared}`,
    html:
      head(bannerHTML(info), esc(info.n), subLine(r)) +
      `<p class="small rivnote">${PERSONALITY[r.p].d}</p>` +
      unitLine +
      facts,
  };
}

// Uitleg bij een wereldwonder van een rivaal (of de bouwplaats ervan): wat je ertegen kunt doen
function wonderNote(b: RivalBuilding, info: RivalDef) {
  const d = B[b.type];
  if (!b.done)
    return `${esc(info.n)} ${verb(info, 'bouwt', 'bouwen')} hier ${theWonder(b.type)}. Sloop de bouwplaats, dan is het wonder weer vrij.`;
  // Elk wonder heeft een korte uitleg van zijn bonus (perk), zie data/buildings.ts
  const perk = d.perk![0].toLowerCase() + d.perk!.slice(1);
  return `Wereldwonder van ${esc(info.n)}. Verwoest je het, dan is het weer vrij. Versla je ${esc(info.n)}, dan wordt het van jou, met de bonus: ${esc(perk)}.`;
}

// Het midden van je leger (voor "zoveel tegels lopen")
function armyCentre() {
  const n = G.us.length || 1;
  const x = G.us.reduce((sum, u) => sum + u.x, 0) / n,
    y = G.us.reduce((sum, u) => sum + u.y, 0) / n;
  return { x, y };
}

// Je hele leger op een gebouw van een rivaal af, met een melding hoe ver het moet lopen
function sendArmy(r: Rival, target: RivalBuilding) {
  if (!G.us.length) return;
  // Zonder oorlog: eerst een waarschuwing, pas de tweede klik valt aan
  if (surpriseTarget(target) && !confirmSurprise(r)) return;
  orderRivalAttack(G.us, target);
  const s = B[target.type].size / 2,
    from = armyCentre();
  const tiles = Math.round(dist(from.x, from.y, target.x + s, target.y + s));
  toast(`Je leger (${G.us.length}) loopt ${tiles} tegels naar ${RIVAL[r.k].n}.`, 'good');
}

// Je hele leger op de soldaat waarop je klikte
function attackSoldier(r: Rival) {
  const f = clickedSoldier(r),
    n = G.us.length;
  if (!f || f.helper || !n) return;
  if (surpriseTarget(f) && !confirmSurprise(r)) return;
  for (const u of G.us) {
    u.tgt = f;
    u.order = 'attack';
    u.path = null;
  }
  const who = n === 1 ? '1 soldaat valt' : `${n} soldaten vallen`;
  // (een soldaat van een rivaal heeft altijd een soort)
  toast(`${who} de ${UNITS[f.uk!].n.toLowerCase()} van ${RIVAL[r.k].n} aan.`, 'good');
}

/** Een knop in het selectiepaneel voor een rivaal. Geeft true als de klik hier is afgehandeld. */
export function rivalCommand(t: HTMLElement) {
  const action = t.dataset.riv;
  if (!action) return false;
  const b = sel.rb && rbById.get(sel.rb);
  const r = b ? rivalById(b.rival) : rivalById(sel.rival);
  if (!r) return true;
  const target = b || rivalHall(r);
  if (action === 'go' && target) {
    const s = B[target.type].size / 2;
    centerOn(target.x + s, target.y + s);
  } else if (action === 'hall') {
    const hall = rivalHall(r);
    if (hall) {
      centerOn(hall.x + 1, hall.y + 1);
      sel.rb = hall.id;
    }
  } else if (action === 'attack' && target) sendArmy(r, target);
  else if (action === 'unit') attackSoldier(r);
  else if (action === 'diplo') showDiplomacy(r.id);
  sigs.ins = null;
  store.uiDirty = true;
  return true;
}
