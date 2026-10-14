import type { Building, Cost } from '../types';
import { AGE_MAT } from '../data/ages';
import { B } from '../data/buildings';
import { G } from './state';

export const built = (k: string): boolean => G.bs.some(b => b.type === k && b.done);
export const roadTier = () => G.age >= 4 ? 3 : G.age >= 2 ? 2 : 1;
export const hasT = (k: string): boolean => !!(G && G.tech && G.tech[k]);
export const UPG_OK = (k: string): boolean => {
    const d = B[k];
    return k !== 'command' && !!(d.pop || d.def || d.conv || d.gen || d.pump || d.light || d.work || d.market || d.train);
};
export const lvlOf = (b: Building | null | undefined): number => b && b.lvl || 0;
export const maxLvl = (b: Building): number => UPG_OK(b.type) ? Math.max(0, G.age - B[b.type].age) : 0;
export const canUpg = (b: Building): boolean => b.done && lvlOf(b) < maxLvl(b);
export const bMaxHp = (b: Building): number => B[b.type].hp * (1 + .35 * lvlOf(b)) * (hasT('masonry') ? 1.25 : 1);
export const bPop = (b: Building): number => {
    const p = B[b.type].pop;
    return p ? Math.round(p * (1 + .4 * lvlOf(b))) : 0;
};
export const bLight = (b: Building): number => {
    const l = B[b.type].light;
    return l ? l + lvlOf(b) + (hasT('fire') ? 1.5 : 0) : 0;
};
export const bRate = (b: Building): number => 1 + .25 * lvlOf(b);
export const farmSlots = (b: Building): number => B.farm.work! + lvlOf(b) + (hasT('agri') ? 1 : 0);
export function upgCost(b: Building): Cost {
    const d = B[b.type], l = lvlOf(b) + 1, c: Cost = {};
    if (b.type === 'townhall') {
        c.food = 220 * l;
        c.wood = 200 * l;
        c.stone = 160 * l;
    }
    else
        for (const k in d.cost)
            c[k] = Math.round(d.cost[k] * .6 * l);
    const m = AGE_MAT[Math.min(5, d.age + l)];
    if (m)
        for (const k in m)
            c[k] = (c[k] || 0) + m[k] * l;
    return c;
}
export function upgEffect(k: string, l: number): string {
    const d = B[k], p = [];
    if (d.pop)
        p.push(`${Math.round(d.pop * (1 + .4 * l))} inwoners`);
    if (d.def)
        p.push(`schade ${Math.round(d.def.dmg * (1 + .4 * l))}, bereik ${d.def.r + .5 * l}`);
    if (d.conv || d.pump)
        p.push(`${Math.round(25 * l)}% sneller`);
    if (d.gen)
        p.push(`${Math.round(d.gen.power * (1 + .25 * l))} stroom`);
    if (d.light)
        p.push(`lichtstraal ${d.light + l}`);
    if (d.work)
        p.push(`${B.farm.work! + l} boeren`);
    if (d.market)
        p.push('betere prijzen');
    if (d.train)
        p.push(`${Math.round(20 * l)}% sneller trainen`);
    p.push(`${Math.round(35 * l)}% sterker`);
    return p.join(' · ');
}
export const toolCost = () => {
    const l = G.toolLvl + 1, c: Cost = { food: 150 * l, wood: 150 * l };
    const m = AGE_MAT[l];
    if (m)
        for (const k in m)
            c[k] = m[k] * l;
    return c;
};
export const armsCost = () => {
    const l = G.armsLvl + 1, c: Cost = { food: 120 * l, stone: 80 * l };
    const m = AGE_MAT[l];
    if (m)
        for (const k in m)
            c[k] = m[k] * l;
    return c;
};
export const armsMul = () => 1 + .15 * (G ? G.armsLvl : 0);
export const carryMax = () => G.carryCap + G.toolLvl * 2;
export function has(c: Cost, m = 1): boolean {
    for (const k in c)
        if (G.res[k] < c[k] * m)
            return false;
    return true;
}
export function pay(c: Cost) {
    for (const k in c)
        G.res[k] -= c[k];
}
export function gain(c: Cost) {
    for (const k in c)
        G.res[k] += c[k];
}
