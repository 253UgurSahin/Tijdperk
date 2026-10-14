import type { Building, Tile } from '../types';
import { sfx } from '../audio/sound';
import { bus } from '../core/bus';
import { W } from '../core/constants';
import { B } from '../data/buildings';
import { mouse } from './pointer';
import { resetV, selVills } from './selection';
import { placeBuilding } from '../sim/entities';
import { canPlace, lineTiles } from '../sim/placement';
import { pay, roadTier } from '../sim/rules';
import { road } from '../sim/world';
import { toast } from '../ui/hud';
import { ui } from '../ui/state';

export function ghostPos(): Tile {
    const s = B[ui.placing!].size;
    return [Math.floor(mouse.tx - s / 2 + .5), Math.floor(mouse.ty - s / 2 + .5)];
}
export function placeLine(a: Tile, b: Tile) {
    const d = B[ui.placing!];
    let n = 0, first: Building | null = null, why: string | null = null;
    for (const [x, y] of lineTiles(a, b)) {
        const err = canPlace(ui.placing!, x, y);
        if (err) {
            why = why || err;
            continue;
        }
        pay(d.cost);
        n++;
        if (d.road) {
            road[y * W + x] = roadTier();
        }
        else {
            const nb = placeBuilding(ui.placing!, x, y, false);
            first = first || nb;
        }
    }
    if (n) {
        sfx('place');
        if (first)
            for (const v of selVills()) {
                resetV(v);
                v.job = 'build';
                v.prefSite = first;
            }
        toast(d.road ? `${n} ${n === 1 ? 'stuk' : 'stukken'} ${d.n.toLowerCase()} aangelegd.` : `${n} × ${d.n.toLowerCase()} uitgezet.`);
    }
    else if (why)
        toast(why + '.', 'bad');
    bus.uiDirty = true;
}
export function tryPlace(keep?: boolean) {
    const [x, y] = ghostPos();
    if (B[ui.placing!].road || B[ui.placing!].wall) {
        placeLine([x, y], [x, y]);
        return;
    }
    const err = canPlace(ui.placing!, x, y);
    if (err) {
        toast(err + '.', 'bad');
        return;
    }
    pay(B[ui.placing!].cost);
    const b = placeBuilding(ui.placing!, x, y, false);
    sfx('place');
    for (const v of selVills()) {
        resetV(v);
        v.job = 'build';
        v.prefSite = b;
    }
    toast(`${B[ui.placing!].n} uitgezet. Dorpelingen komen het bouwen.`);
    if (!keep)
        ui.placing = null;
    bus.uiDirty = true;
}
