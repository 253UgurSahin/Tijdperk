import type { Cost, Tile } from '../types';
import { W } from '../core/constants';
import { fmt } from '../core/util';
import { B } from '../data/buildings';
import { NI, NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { has, roadTier } from './rules';
import { G } from './state';
import { bmap, inb, isUnl, node, nodeVis, road, ter } from './world';

const CLEAR = new Set(['tree', 'bush', 'rock', 'sand']);
export function lackText(c: Cost): string {
    const m = Object.keys(c).filter(k => G.res[k] < c[k]).map(k => `${fmt(Math.ceil(c[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
    return m.length > 1 ? m.slice(0, -1).join(', ') + ' en ' + m[m.length - 1] : m[0] || '';
}
export function canPlace(type: string, x: number, y: number, skipCost?: boolean): string | null {
    const d = B[type];
    if (G.age < d.age)
        return 'Nog niet ontdekt';
    if (d.road) {
        if (!isUnl(x, y))
            return 'Buiten je gebied';
        const i = y * W + x;
        if (ter[i] === 1)
            return 'Hier is water';
        if (bmap[i])
            return 'Hier staat al iets';
        if (nodeVis(i))
            return NODES[node[i]].n + ' in de weg';
        if (road[i] >= roadTier())
            return 'Hier ligt al een weg';
        if (!skipCost && !has(d.cost))
            return 'Nog ' + lackText(d.cost) + ' nodig';
        return null;
    }
    for (let dy = 0; dy < d.size; dy++)
        for (let dx = 0; dx < d.size; dx++) {
            const xx = x + dx, yy = y + dy;
            if (!inb(xx, yy))
                return 'Buiten de kaart';
            if (!isUnl(xx, yy))
                return 'Buiten je gebied';
            const i = yy * W + xx;
            if (ter[i] === 1)
                return 'Hier is water';
            if (bmap[i])
                return 'Hier staat al iets';
            if (d.needNode) {
                if (node[i] !== NI.oil)
                    return 'Een oliepomp moet op een oliebron staan';
            }
            else if (nodeVis(i) && !CLEAR.has(NODES[node[i]].k))
                return NODES[node[i]].n + ' in de weg';
            if (G.camps.some(c => c.alive && xx >= c.x - 1 && xx <= c.x + 2 && yy >= c.y - 1 && yy <= c.y + 2))
                return 'Hier ligt een vijandelijk kamp';
        }
    if (type === 'command' && G.bs.some(b => b.type === 'command'))
        return 'Er kan maar één commandocentrum zijn';
    if (!skipCost && !has(d.cost))
        return 'Nog ' + lackText(d.cost) + ' nodig';
    if (d.wall && G.vs.some(v => !v.hidden && (v.x | 0) === x && (v.y | 0) === y))
        return 'Er staat iemand';
    return null;
}
export function lineTiles(a: Tile, b: Tile): Tile[] {
    const t: Tile[] = [];
    const sx = Math.sign(b[0] - a[0]) || 1, sy = Math.sign(b[1] - a[1]) || 1;
    for (let x = a[0]; x !== b[0] + sx; x += sx)
        t.push([x, a[1]]);
    for (let y = a[1] + sy; y !== b[1] + sy && a[1] !== b[1]; y += sy)
        t.push([b[0], y]);
    return t.slice(0, 60);
}
