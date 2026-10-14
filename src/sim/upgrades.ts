import type { Building } from '../types';
import { bus, sfx, toast } from '../core/bus';
import { AGES } from '../data/ages';
import { B } from '../data/buildings';
import { floater, fxRing } from './fx';
import { armsCost, armsMul, bMaxHp, canUpg, has, lvlOf, pay, toolCost, upgCost } from './rules';
import { G } from './state';

export function upgrade(b: Building, silent?: boolean): boolean {
    if (!canUpg(b))
        return false;
    const c = upgCost(b);
    if (!has(c)) {
        if (!silent)
            toast('Te weinig grondstoffen voor deze verbetering.', 'bad');
        return false;
    }
    pay(c);
    const old = bMaxHp(b);
    b.lvl = lvlOf(b) + 1;
    b.pop_t = G.t;
    if (!silent)
        sfx('upgrade');
    b.hp = Math.min(bMaxHp(b), b.hp + bMaxHp(b) - old);
    const s = B[b.type].size;
    fxRing(b.x + s / 2, b.y + s / 2, AGES[G.age].acc);
    if (!silent)
        floater(b.x + s / 2, b.y + s / 2, 'Niveau ' + (b.lvl + 1), '#ffffff');
    if (!silent)
        toast(`${B[b.type].n} verbeterd naar niveau ${b.lvl + 1}.`, 'good');
    bus.uiDirty = true;
    return true;
}
export function upgradeTools() {
    if (G.toolLvl >= G.age)
        return;
    const c = toolCost();
    if (!has(c)) {
        toast('Te weinig grondstoffen.', 'bad');
        return;
    }
    pay(c);
    G.toolLvl++;
    sfx('upgrade');
    toast(`Betere werktuigen (niveau ${G.toolLvl + 1}): je volk verzamelt sneller en draagt meer.`, 'good');
    bus.uiDirty = true;
}
export function upgradeArms() {
    if (G.armsLvl >= G.age)
        return;
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
    bus.uiDirty = true;
}
