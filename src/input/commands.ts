import type { Building } from '../types';
import { sfx } from '../audio/sound';
import { bus } from '../core/bus';
import { W } from '../core/constants';
import { B } from '../data/buildings';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { UNITS } from '../data/units';
import { tryPlace } from './placement';
import { mouse } from './pointer';
import { bAtScreen, campAt, clearSel, foeAt, resetV, selUnits, selVills, unitAt, villAt } from './selection';
import { s2iso, s2t } from '../render/camera';
import { buyChunk, canBuyChunk } from '../sim/expand';
import { burst, fxRing } from '../sim/fx';
import { gain } from '../sim/rules';
import { G, bById, sel } from '../sim/state';
import { unhide, walkTo } from '../sim/villagers';
import { bmap, inb, isUnl, node, nodeVis, road, setBlk, walkable } from '../sim/world';
import { setExpand, toast } from '../ui/hud';
import { ui } from '../ui/state';

function command(X: number, Y: number, tx: number, ty: number) {
    const us = selUnits(), vs = selVills();
    let did = false;
    if (us.length) {
        const f = foeAt(X, Y), c = campAt(X, Y);
        if (f || c) {
            for (const u of us) {
                u.tgt = f || c!;
                u.order = 'attack';
                u.path = null;
            }
            fxRing(f ? f.x : c!.x + 1, f ? f.y : c!.y + 1, '#c0473b');
            toast(`${us.length} ${us.length === 1 ? 'eenheid valt' : 'eenheden vallen'} aan.`);
            did = true;
        }
        else {
            const n = us.length, cols = Math.ceil(Math.sqrt(n));
            us.forEach((u, k) => {
                u.tgt = null;
                u.order = 'move';
                u.path = null;
                u.gx = tx + ((k % cols) - (cols - 1) / 2) * .8;
                u.gy = ty + (Math.floor(k / cols) - (cols - 1) / 2) * .8;
            });
            fxRing(tx, ty, '#ffffff');
            did = true;
        }
    }
    if (vs.length) {
        const ix = Math.floor(tx), iy = Math.floor(ty), b = bAtScreen(X, Y);
        if (b && !b.done) {
            vs.forEach(v => {
                resetV(v);
                v.job = 'build';
                v.prefSite = b;
            });
            toast(`${vs.length} × naar de bouwplaats.`);
            did = true;
        }
        else if (b && b.type === 'farm') {
            vs.forEach(v => {
                resetV(v);
                v.job = 'food';
                v.keep = { k: 'farm', b };
            });
            toast(`${vs.length} × naar de akker.`);
            did = true;
        }
        else {
            const i = iy * W + ix;
            if (inb(ix, iy) && nodeVis(i) && !NODES[node[i]].pump && isUnl(ix, iy)) {
                const r = NODES[node[i]].res;
                vs.forEach(v => {
                    resetV(v);
                    v.job = r;
                    v.keep = { k: 'node', i };
                });
                toast(`${vs.length} × naar ${RES[r].n.toLowerCase()}.`);
                did = true;
            }
            else if (walkable(ix, iy)) {
                vs.forEach(v => {
                    resetV(v);
                    walkTo(v, ix, iy, 'hold');
                });
                did = true;
            }
        }
        if (did)
            fxRing(ix + .5, iy + .5, '#ffffff');
    }
    if (did)
        sfx('tick');
    bus.uiDirty = true;
    return did;
}
export function leftClick(sx: number, sy: number, shift: boolean) {
    const [X, Y] = s2iso(sx, sy), [tx, ty] = s2t(sx, sy), ix = Math.floor(tx), iy = Math.floor(ty);
    if (ui.expandMode) {
        const cx = ix >> 4, cy = iy >> 4;
        if (inb(ix, iy) && canBuyChunk(cx, cy))
            buyChunk(cx, cy);
        else
            toast('Kies een gemarkeerd gebied dat aan je land grenst.');
        return;
    }
    if (ui.placing) {
        tryPlace(shift);
        return;
    }
    if (ui.demoMode) {
        const b = bAtScreen(X, Y);
        if (b && b.type !== 'townhall') {
            demolish(b);
            sfx('boom');
        }
        else if (inb(ix, iy) && road[iy * W + ix]) {
            road[iy * W + ix] = 0;
            burst(ix + .5, iy + .5, '#8a7a62');
            sfx('tick');
        }
        else if (b)
            toast('Het stamhuis kun je niet afbreken.', 'bad');
        return;
    }
    if (ui.cmdMode && sel.us.size) {
        issueOrder(ui.cmdMode, tx, ty);
        return;
    }
    const u = unitAt(X, Y);
    if (u) {
        sfx('select');
        if (!shift)
            clearSel();
        sel.vs.clear();
        sel.b = null;
        if (sel.us.has(u.id) && shift)
            sel.us.delete(u.id);
        else
            sel.us.add(u.id);
        bus.uiDirty = true;
        return;
    }
    const v = villAt(X, Y);
    if (v) {
        sfx('select');
        if (!shift)
            clearSel();
        sel.us.clear();
        sel.b = null;
        if (sel.vs.has(v.id) && shift)
            sel.vs.delete(v.id);
        else
            sel.vs.add(v.id);
        bus.uiDirty = true;
        return;
    }
    if (sel.us.size && (foeAt(X, Y) || campAt(X, Y))) {
        command(X, Y, tx, ty);
        return;
    }
    if (sel.vs.size && inb(ix, iy)) {
        const b = bAtScreen(X, Y), i = iy * W + ix;
        if ((b && (!b.done || b.type === 'farm')) || (nodeVis(i) && !NODES[node[i]].pump && isUnl(ix, iy))) {
            command(X, Y, tx, ty);
            return;
        }
    }
    const b = bAtScreen(X, Y);
    if (b) {
        sfx('select');
        clearSel();
        sel.b = b.id;
        bus.uiDirty = true;
        return;
    }
    const c = campAt(X, Y);
    if (c) {
        clearSel();
        sel.camp = c.id;
        bus.uiDirty = true;
        return;
    }
    if (mouse.touch && (sel.us.size || sel.vs.size) && inb(ix, iy) && !nodeVis(iy * W + ix)) {
        command(X, Y, tx, ty);
        return;
    }
    if (inb(ix, iy) && nodeVis(iy * W + ix)) {
        clearSel();
        sel.node = iy * W + ix;
        bus.uiDirty = true;
        return;
    }
    if (!shift)
        clearSel();
    bus.uiDirty = true;
}
export function rightClick(sx: number, sy: number) {
    const [X, Y] = s2iso(sx, sy), [tx, ty] = s2t(sx, sy);
    if (ui.cmdMode) {
        ui.cmdMode = null;
        bus.uiDirty = true;
        return;
    }
    if (ui.demoMode) {
        ui.demoMode = false;
        bus.uiDirty = true;
        return;
    }
    if (ui.placing) {
        ui.placing = null;
        bus.uiDirty = true;
        return;
    }
    if (ui.expandMode) {
        setExpand(false);
        return;
    }
    if (sel.vs.size || sel.us.size) {
        command(X, Y, tx, ty);
        return;
    }
    const b = sel.b && bById.get(sel.b);
    if (b && B[b.type].train) {
        b.rally = { x: tx, y: ty };
        fxRing(tx, ty, '#ffffff');
        toast('Verzamelpunt gezet.');
        return;
    }
    clearSel();
    bus.uiDirty = true;
}
function issueOrder(mode: 'amove' | 'patrol', tx: number, ty: number) {
    const us = selUnits(), n = us.length, cols = Math.ceil(Math.sqrt(n));
    us.forEach((u, k) => {
        u.tgt = null;
        u.path = null;
        u.order = mode;
        u.px = u.x;
        u.py = u.y;
        u.gx = tx + ((k % cols) - (cols - 1) / 2) * .8;
        u.gy = ty + (Math.floor(k / cols) - (cols - 1) / 2) * .8;
    });
    fxRing(tx, ty, mode === 'amove' ? '#e3584a' : '#e2b92c');
    toast(mode === 'amove' ? `Aanvalsmars: ${n} ${n === 1 ? 'eenheid' : 'eenheden'} vechten onderweg.` : `Patrouille: ${n} ${n === 1 ? 'eenheid loopt' : 'eenheden lopen'} heen en weer.`);
    sfx('tick');
    ui.cmdMode = null;
    bus.uiDirty = true;
}
export function demolish(b: Building) {
    setBlk(b, false);
    const d = B[b.type], f = b.done ? .5 : .75;
    for (const k in d.cost)
        G.res[k] += Math.floor(d.cost[k] * f);
    b.q.forEach(k => gain(UNITS[k].cost));
    b.dead = true;
    for (let dy = 0; dy < d.size; dy++)
        for (let dx = 0; dx < d.size; dx++)
            bmap[(b.y + dy) * W + b.x + dx] = 0;
    G.bs = G.bs.filter(x => x !== b);
    bById.delete(b.id);
    if (sel.b === b.id)
        sel.b = null;
    for (const v of G.vs)
        if (v.hidden && v.shelter === b.id)
            unhide(v);
    if (!d.wall)
        toast(`${d.n} afgebroken.`);
    burst(b.x + .5, b.y + .5, '#8a7a62');
    ui.demolishArm = 0;
    bus.uiDirty = true;
}
