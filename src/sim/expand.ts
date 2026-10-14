import type { Cost } from '../types';
import { bus, toast } from '../core/bus';
import { CN, CS, W } from '../core/constants';
import { NODES } from '../data/nodes';
import { computeAvail } from './caches';
import { fxRing } from './fx';
import { has, pay } from './rules';
import { G } from './state';
import { node } from './world';

export function chunkCost() {
    const m = 1 + G.bought * .55, c: Cost = { food: Math.round(80 * m), wood: Math.round(80 * m), stone: Math.round(40 * m) };
    if (G.age >= 2)
        c.gold = Math.round(12 * m);
    if (G.age >= 3)
        c.steel = Math.round(10 * m);
    return c;
}
export function canBuyChunk(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= CN || cy >= CN || G.unl[cy * CN + cx])
        return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const x = cx + dx, y = cy + dy;
        return x >= 0 && y >= 0 && x < CN && y < CN && G.unl[y * CN + x];
    });
}
export function buyChunk(cx: number, cy: number) {
    const c = chunkCost();
    if (!has(c)) {
        toast('Te weinig grondstoffen voor dit gebied.', 'bad');
        return;
    }
    pay(c);
    G.unl[cy * CN + cx] = 1;
    G.bought++;
    computeAvail();
    const found = new Set();
    for (let y = cy * CS; y < cy * CS + CS; y++)
        for (let x = cx * CS; x < cx * CS + CS; x++) {
            const n = node[y * W + x];
            if (n && NODES[n].age <= G.age && !['tree', 'bush', 'rock', 'sand'].includes(NODES[n].k))
                found.add(NODES[n].n.toLowerCase());
        }
    toast('Nieuw gebied ontgonnen' + (found.size ? `. Gevonden: ${[...found].join(', ')}.` : '.'), 'good');
    fxRing(cx * CS + 8, cy * CS + 8, '#ffffff');
    bus.uiDirty = true;
}
