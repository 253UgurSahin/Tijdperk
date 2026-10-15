// Gebouwniveaus, werktuigen en wapens verbeteren.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { AGES, AGE_MAT } from '../data/ages.js';
import { B } from '../data/buildings.js';
import { tradePrices } from '../data/resources.js';
import { add, mul } from './bonus.js';
import { has, pay } from './economy.js';
import { hasRule } from './mods.js';
import { floater, fxRing } from './fx.js';
import { G } from './state.js';
import { toast } from '../ui/hud.js';

export const roadTier = () => (G.age >= 6 ? 3 : G.age >= 3 ? 2 : 1);
export const hasT = k => !!(G && G.tech && G.tech[k]);
export const UPG_OK = k => {
  const d = B[k];
  return (
    k !== 'command' &&
    k !== 'stargate' &&
    !d.wonder &&
    !!(d.pop || d.def || d.conv || d.gen || d.pump || d.light || d.work || d.market || d.train)
  );
};
export const lvlOf = b => (b && b.lvl) || 0;
export const maxLvl = b => (UPG_OK(b.type) ? Math.max(0, G.age - B[b.type].age) : 0);
export const canUpg = b => b.done && lvlOf(b) < maxLvl(b);
// Het stamhuis groeit mee met je tijdperk, anders is het in latere tijdperken te snel gesloopt
// (en een bonus zoals die van de Piramide maakt het nog sterker)
const ageHp = b => (b.type === 'townhall' && G ? (1 + 0.3 * G.age) * mul('hall.hp') : 1);
// Torens (alles wat schiet, behalve het stamhuis) kunnen extra levens krijgen, zoals bij het Bergvolk
const towerHp = b => (B[b.type].def && b.type !== 'townhall' ? mul('tower.hp') : 1);
export const bMaxHp = (b, l = lvlOf(b)) =>
  B[b.type].hp * ageHp(b) * (1 + 0.35 * l) * mul('bld.hp') * towerHp(b);
export const bPop = b => {
  const p = B[b.type].pop;
  return p ? Math.round(p * (1 + 0.4 * lvlOf(b))) : 0;
};
export const bLight = b => {
  const l = B[b.type].light;
  return l ? l + lvlOf(b) + add('light') : 0;
};
export const bRate = b => 1 + 0.25 * lvlOf(b);
export const farmSlots = b => B.farm.work + lvlOf(b) + add('farm.slots');
/** Hoe lang onderzoek T duurt, in seconden. */
export const researchTime = T => T.t * mul('research.time');
/** Marktprijzen in goud voor 100 stuks van grondstof r, bij markt b. */
export const marketPrices = (b, r) => tradePrices(r, lvlOf(b), mul('market'));
export function upgCost(b) {
  const d = B[b.type],
    l = lvlOf(b) + 1,
    c = {};
  if (b.type === 'townhall') {
    c.food = 220 * l;
    c.wood = 200 * l;
    c.stone = 160 * l;
  } else for (const k in d.cost) c[k] = Math.round(d.cost[k] * 0.6 * l);
  const m = AGE_MAT[Math.min(AGE_MAT.length - 1, d.age + l)];
  if (m) for (const k in m) c[k] = (c[k] || 0) + m[k] * l;
  return c;
}
/*
 * Wat een verbetering oplevert, als regels [naam, nu, straks]. Zo zie je in het spel precies
 * wat je ervoor terugkrijgt. De formules zijn dezelfde als die het spel zelf gebruikt.
 */
const pct = x => Math.round(x * 100) + '%';
export function upgradeRows(b) {
  const d = B[b.type],
    l = lvlOf(b),
    n = l + 1,
    rows = [];
  if (d.pop) rows.push(['Inwoners', Math.round(d.pop * (1 + 0.4 * l)), Math.round(d.pop * (1 + 0.4 * n))]);
  if (d.def) {
    rows.push([
      'Schade per schot',
      Math.round(d.def.dmg * (1 + 0.4 * l)),
      Math.round(d.def.dmg * (1 + 0.4 * n)),
    ]);
    rows.push(['Bereik', d.def.r + 0.5 * l, d.def.r + 0.5 * n]);
  }
  if (d.conv || d.pump) rows.push(['Productiesnelheid', pct(1 + 0.25 * l), pct(1 + 0.25 * n)]);
  if (d.gen)
    rows.push(['Stroom', Math.round(d.gen.power * (1 + 0.25 * l)), Math.round(d.gen.power * (1 + 0.25 * n))]);
  if (d.light) rows.push(['Lichtstraal', d.light + l, d.light + n]);
  if (d.work) rows.push(['Plek voor boeren', farmSlots(b), farmSlots(b) + 1]);
  if (d.market) rows.push(['Marktprijzen', l ? `${l * 10}% beter` : 'gewoon', `${n * 10}% beter`]);
  if (d.train) rows.push(['Trainsnelheid', pct(1 + 0.2 * l), pct(1 + 0.2 * n)]);
  rows.push(['Levenspunten', Math.round(bMaxHp(b, l)), Math.round(bMaxHp(b, n))]);
  return rows;
}
/** Werktuigen: sneller verzamelen en meer dragen, voor al je dorpelingen. */
export const toolRows = () => [
  ['Verzamelsnelheid', pct(1 + 0.15 * G.toolLvl), pct(1 + 0.15 * (G.toolLvl + 1))],
  ['Draagvermogen', carryMax(), carryMax() + 2],
];
/** Wapens en pantser: je hele leger slaat harder en kan meer hebben. */
export const armsRows = () => [
  ['Schade leger', pct(armsMul()), pct(armsMul() + 0.15)],
  ['Levens leger', pct(armsMul()), pct(armsMul() + 0.15)],
];
export const toolCost = () => {
  const l = G.toolLvl + 1,
    c = { food: 150 * l, wood: 150 * l };
  const m = AGE_MAT[l];
  if (m) for (const k in m) c[k] = m[k] * l;
  return c;
};
export const armsCost = () => {
  const l = G.armsLvl + 1,
    c = { food: 120 * l, stone: 80 * l };
  const m = AGE_MAT[l];
  if (m) for (const k in m) c[k] = m[k] * l;
  return c;
};
export const armsMul = () => 1 + 0.15 * (G ? G.armsLvl : 0);
export const carryMax = () => G.carryCap + G.toolLvl * 2 + add('carry');
export function upgrade(b, silent) {
  if (!canUpg(b)) return false;
  const c = upgCost(b);
  if (!has(c)) {
    if (!silent) toast('Te weinig grondstoffen voor deze verbetering.', 'bad');
    return false;
  }
  pay(c);
  const old = bMaxHp(b);
  b.lvl = lvlOf(b) + 1;
  b.pop_t = G.t;
  if (!silent) sfx('upgrade');
  b.hp = Math.min(bMaxHp(b), b.hp + bMaxHp(b) - old);
  const s = B[b.type].size;
  fxRing(b.x + s / 2, b.y + s / 2, AGES[G.age].acc);
  if (!silent) floater(b.x + s / 2, b.y + s / 2, 'Niveau ' + (b.lvl + 1), '#ffffff');
  if (!silent) toast(`${B[b.type].n} verbeterd naar niveau ${b.lvl + 1}.`, 'good');
  store.uiDirty = true;
  return true;
}
export function upgradeTools() {
  if (G.toolLvl >= G.age) return;
  const c = toolCost();
  if (!has(c)) {
    toast('Te weinig grondstoffen.', 'bad');
    return;
  }
  pay(c);
  G.toolLvl++;
  sfx('upgrade');
  toast(
    `Betere werktuigen (niveau ${G.toolLvl + 1}): je dorpelingen verzamelen sneller en dragen meer.`,
    'good',
  );
  store.uiDirty = true;
}
/** Hebben wapens en pantser zin? Niet met de spelregel Geen leger: ze helpen alleen soldaten, geen torens. */
export const armsUseful = () => !hasRule('noArmy');

export function upgradeArms() {
  if (G.armsLvl >= G.age || !armsUseful()) return;
  const c = armsCost();
  if (!has(c)) {
    toast('Te weinig grondstoffen.', 'bad');
    return;
  }
  pay(c);
  const o = armsMul();
  G.armsLvl++;
  sfx('upgrade');
  const f = armsMul() / o;
  for (const u of G.us) {
    u.mhp *= f;
    u.hp *= f;
  }
  toast(`Wapens en pantser verbeterd (niveau ${G.armsLvl + 1}): je leger is sterker.`, 'good');
  store.uiDirty = true;
}
