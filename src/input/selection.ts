import type { Building, Camp, Mobile, Villager } from '../types';
import { bus } from '../core/bus';
import { W } from '../core/constants';
import { B } from '../data/buildings';
import { UNITS } from '../data/units';
import { proj, s2t } from '../render/camera';
import { nearScreen, pickGroup } from '../render/picking';
import { BG3, CG3 } from '../render/sync';
import { G, bById, sel } from '../sim/state';
import { bmap, inb } from '../sim/world';
import { ui } from '../ui/state';

export const selVills = () => G.vs.filter(v => sel.vs.has(v.id));
export const selUnits = () => G.us.filter(u => sel.us.has(u.id));
export function resetV(v: Villager) {
    if (v.hidden) {
        v.hidden = false;
        const b = bById.get(v.shelter!);
        if (b) {
            v.x = b.x + .5;
            v.y = b.y + B[b.type].size + .2;
        }
    }
    v.tgt = null;
    v.path = null;
    v.state = 'idle';
    v.wait = 0;
    v.prefSite = null;
    v.keep = null;
}
const LIFT = (e: Mobile): number => e.kind === 'u' ? (UNITS[e.k].fly ? 1 : .35) : e.kind === 'f' ? (e.air ? 1 : .35) : .35;
export const villAt = (X: number, Y: number) => nearScreen(G.vs, X, Y, 16, LIFT);
export const unitAt = (X: number, Y: number) => nearScreen(G.us, X, Y, 16, LIFT);
export const foeAt = (X: number, Y: number) => nearScreen(G.foes, X, Y, 18, LIFT);
export function campAt(X: number, Y: number): Camp | undefined {
    const id = pickGroup(X, Y, CG3, 'camp');
    if (id != null)
        return G.camps.find(c => c.id === id && c.alive);
    const [tx, ty] = s2t(X, Y);
    return G.camps.find(c => c.alive && tx >= c.x - .6 && tx <= c.x + 2.6 && ty >= c.y - .6 && ty <= c.y + 2.6);
}
export function bAtScreen(X: number, Y: number): Building | null {
    const id = pickGroup(X, Y, BG3, 'bid');
    if (id != null) {
        const b = bById.get(id);
        if (b)
            return b;
    }
    const [tx, ty] = s2t(X, Y), ix = Math.floor(tx), iy = Math.floor(ty);
    if (!inb(ix, iy))
        return null;
    return bById.get(bmap[iy * W + ix]) || null;
}
export function clearSel() {
    sel.vs.clear();
    sel.us.clear();
    sel.b = null;
    sel.camp = null;
    sel.node = -1;
    ui.demolishArm = 0;
}
export function boxSelect(x0: number, y0: number, x1: number, y1: number) {
    const a = Math.min(x0, x1), b = Math.min(y0, y1), c = Math.max(x0, x1), d = Math.max(y0, y1);
    const inBox = (e: Mobile) => {
        const [sx, sy] = proj(e.x, .3, e.y);
        return sx >= a && sx <= c && sy >= b && sy <= d;
    };
    const us = G.us.filter(inBox);
    clearSel();
    if (us.length)
        us.forEach(u => sel.us.add(u.id));
    else
        G.vs.filter(v => !v.hidden && inBox(v)).forEach(v => sel.vs.add(v.id));
    bus.uiDirty = true;
}
