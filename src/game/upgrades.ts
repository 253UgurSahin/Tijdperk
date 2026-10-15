import type { Building, Cost } from '../types';
// Gebouwniveaus, werktuigen en wapens verbeteren.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { AGES, AGE_MAT } from '../data/ages';
import { B } from '../data/buildings';
import { has, pay } from './economy';
import { floater, fxRing } from './fx';
import { G } from './state';
import { toast } from '../ui/hud';

export const roadTier = () => (G.age >= 6 ? 3 : G.age >= 3 ? 2 : 1);
export const hasT = (k: string): boolean => !!(G && G.tech && G.tech[k]);
export const UPG_OK = (k: string): boolean => {
  const d = B[k];
  return (
    k !== 'command' &&
    k !== 'stargate' &&
    !!(d.pop || d.def || d.conv || d.gen || d.pump || d.light || d.work || d.market || d.train)
  );
};
export const lvlOf = (b: Building | null | undefined): number => (b && b.lvl) || 0;
export const maxLvl = (b: Building): number => (UPG_OK(b.type) ? Math.max(0, G.age - B[b.type].age) : 0);
export const canUpg = (b: Building): boolean => b.done && lvlOf(b) < maxLvl(b);
export const bMaxHp = (b: Building): number => B[b.type].hp * (1 + 0.35 * lvlOf(b)) * (hasT('masonry') ? 1.25 : 1);
export const bPop = (b: Building): number => {
  const p = B[b.type].pop;
  return p ? Math.round(p * (1 + 0.4 * lvlOf(b))) : 0;
};
export const bLight = (b: Building): number => {
  const l = B[b.type].light;
  return l ? l + lvlOf(b) + (hasT('fire') ? 1.5 : 0) : 0;
};
export const bRate = (b: Building): number => 1 + 0.25 * lvlOf(b);
export const farmSlots = (b: Building): number => B.farm.work! + lvlOf(b) + (hasT('agri') ? 1 : 0);
export function upgCost(b: Building): Cost {
  const d = B[b.type],
    l = lvlOf(b) + 1,
    c: Cost = {};
  if (b.type === 'townhall') {
    c.food = 220 * l;
    c.wood = 200 * l;
    c.stone = 160 * l;
  } else for (const k in d.cost) c[k] = Math.round(d.cost[k] * 0.6 * l);
  const m = AGE_MAT[Math.min(AGE_MAT.length - 1, d.age + l)];
  if (m) for (const k in m) c[k] = (c[k] || 0) + m[k] * l;
  return c;
}
export function upgEffect(k: string, l: number): string {
  const d = B[k],
    p = [];
  if (d.pop) p.push(`${Math.round(d.pop * (1 + 0.4 * l))} inwoners`);
  if (d.def) p.push(`schade ${Math.round(d.def.dmg * (1 + 0.4 * l))}, bereik ${d.def.r + 0.5 * l}`);
  if (d.conv || d.pump) p.push(`${Math.round(25 * l)}% sneller`);
  if (d.gen) p.push(`${Math.round(d.gen.power * (1 + 0.25 * l))} stroom`);
  if (d.light) p.push(`lichtstraal ${d.light + l}`);
  if (d.work) p.push(`${B.farm.work! + l} boeren`);
  if (d.market) p.push('betere prijzen');
  if (d.train) p.push(`${Math.round(20 * l)}% sneller trainen`);
  p.push(`${Math.round(35 * l)}% sterker`);
  return p.join(' · ');
}
export const toolCost = () => {
  const l = G.toolLvl + 1,
    c: Cost = { food: 150 * l, wood: 150 * l };
  const m = AGE_MAT[l];
  if (m) for (const k in m) c[k] = m[k] * l;
  return c;
};
export const armsCost = () => {
  const l = G.armsLvl + 1,
    c: Cost = { food: 120 * l, stone: 80 * l };
  const m = AGE_MAT[l];
  if (m) for (const k in m) c[k] = m[k] * l;
  return c;
};
export const armsMul = () => 1 + 0.15 * (G ? G.armsLvl : 0);
export const carryMax = () => G.carryCap + G.toolLvl * 2;
export function upgrade(b: Building, silent?: boolean): boolean {
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
  toast(`Betere werktuigen (niveau ${G.toolLvl + 1}): je volk verzamelt sneller en draagt meer.`, 'good');
  store.uiDirty = true;
}
export function upgradeArms() {
  if (G.armsLvl >= G.age) return;
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
