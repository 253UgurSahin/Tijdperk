import type { Building } from '../types';
import { CN, H, TAU, W } from '../core/constants';
import { dist, fbm, mulberry32 } from '../core/util';
import { B } from '../data/buildings';
import { NI, NODES } from '../data/nodes';
import { G } from './state';

/** Terrain per tile: 0 grass, 1 water, 2 sand, 3 salt flat. */
export let ter!: Uint8Array;
/** Resource node type per tile (index into NODES) and amount left. */
export let node!: Uint8Array;
export let amt!: Uint16Array;
/** Building id per tile. */
export let bmap!: Int32Array;
/** Tiles per node type, for fast searches. */
export let nodeLists!: number[][];
/** Time until which a node counts as unreachable, and villagers heading to each node. */
export let unreach!: Float32Array;
export let claims!: Uint8Array;
/** Walls: 1 = blocked, 2 = gate. */
let blk!: Uint8Array;
/** Road tier per tile. */
export let road!: Uint8Array;
export function genWorld(seed: number) {
    ter = new Uint8Array(W * H);
    blk = new Uint8Array(W * H);
    road = new Uint8Array(W * H);
    node = new Uint8Array(W * H);
    amt = new Uint16Array(W * H);
    bmap = new Int32Array(W * H);
    unreach = new Float32Array(W * H);
    claims = new Uint8Array(W * H);
    const R = mulberry32(seed), s = seed % 9973, cx = W / 2, cy = H / 2, elev = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const i = y * W + x, d = dist(x, y, cx, cy);
            let e = fbm(x / 24, y / 24, s);
            if (d < 12)
                e = Math.max(e, .5 + (12 - d) * .01);
            elev[i] = e;
            ter[i] = e < .35 ? 1 : e < .39 ? 2 : 0;
            if (ter[i] === 0 && d > 30 && fbm(x / 30, y / 30, s + 50) > .68)
                ter[i] = 2;
        }
    const blob = (bx: number, by: number, r: number, k: string, dens: number) => {
        const t = NI[k];
        for (let y = Math.floor(by - r - 1); y <= by + r + 1; y++)
            for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x++) {
                if (x < 0 || y < 0 || x >= W || y >= H)
                    continue;
                const i = y * W + x;
                if (ter[i] === 1 || dist(x, y, bx, by) > r || R() > dens)
                    continue;
                if (k === 'lithium')
                    ter[i] = 3;
                node[i] = t;
            }
    };
    for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
            const i = y * W + x, d = dist(x, y, cx, cy);
            if (ter[i] !== 0)
                continue;
            if (d > 4 && fbm(x / 10, y / 10, s + 100) > .6 && R() < .75) {
                node[i] = NI.tree;
                continue;
            }
            if (d > 3 && fbm(x / 7, y / 7, s + 200) > .72 && R() < .45) {
                node[i] = NI.bush;
                continue;
            }
            if (d > 4 && fbm(x / 9, y / 9, s + 300) > .71 && R() < .55)
                node[i] = NI.rock;
        }
    blob(cx - 10, cy - 6, 4, 'tree', .8);
    blob(cx + 9, cy + 7, 3, 'tree', .75);
    blob(cx + 6, cy - 8, 2.3, 'bush', .7);
    blob(cx - 7, cy + 8, 2.3, 'rock', .75);
    blob(cx - 2, cy + 12, 1.8, 'bush', .6);
    const ORE: [string, number, [number, number], [number, number], number][] = [['copper', 5, [9, 13], [9, 45], 2], ['tin', 4, [11, 15], [12, 48], 1.8], ['iron', 5, [15, 21], [15, 55], 2.2], ['gold', 3, [21, 28], [22, 58], 1.6], ['coal', 5, [17, 25], [17, 58], 2.3], ['oil', 5, [20, 30], [20, 60], 1.5], ['lithium', 3, [26, 34], [26, 60], 2.2]];
    for (const [k, n, r0, r1, sz] of ORE)
        for (let j = 0; j < n; j++) {
            const rr = j === 0 ? r0 : r1, r = rr[0] + R() * (rr[1] - rr[0]), a = R() * TAU;
            blob(cx + Math.cos(a) * r, cy + Math.sin(a) * r, sz * (.8 + R() * .5), k, .72);
        }
    for (let i = 0; i < W * H; i++)
        if (ter[i] === 2 && !node[i] && R() < .45)
            node[i] = NI.sand;
    for (let y = cy - 3; y <= cy + 3; y++)
        for (let x = cx - 3; x <= cx + 3; x++)
            node[y * W + x] = 0;
    for (let i = 0; i < W * H; i++)
        if (node[i]) {
            const a = NODES[node[i]].amt;
            amt[i] = Math.round(a[0] + R() * (a[1] - a[0]));
        }
}
export function buildLists() {
    nodeLists = NODES.map(() => []);
    for (let i = 0; i < W * H; i++)
        if (node[i])
            nodeLists[node[i]].push(i);
}
export const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
export const isUnl = (x: number, y: number): boolean => inb(x, y) && G.unl[(y >> 4) * CN + (x >> 4)] === 1;
export const walkable = (x: number, y: number): boolean => isUnl(x, y) && ter[y * W + x] !== 1 && blk[y * W + x] !== 1;
export const freeWalk = (x: number, y: number): boolean => inb(x, y) && ter[y * W + x] !== 1 && blk[y * W + x] !== 1;
export const foeWalk = (x: number, y: number): boolean => inb(x, y) && ter[y * W + x] !== 1 && !blk[y * W + x];
export function setBlk(b: Building, on: boolean) {
    const d = B[b.type];
    if (!d.wall)
        return;
    for (let dy = 0; dy < d.size; dy++)
        for (let dx = 0; dx < d.size; dx++)
            blk[(b.y + dy) * W + b.x + dx] = on ? (d.gate ? 2 : 1) : 0;
}
export function nearestWall(x: number, y: number): Building | null {
    let best = null, bd = 1e9;
    for (const b of G.bs) {
        if (!b.done || !B[b.type].wall)
            continue;
        const d = dist(x, y, b.x + .5, b.y + .5);
        if (d < bd) {
            bd = d;
            best = b;
        }
    }
    return best;
}
export const nodeVis = (i: number): boolean => !!node[i] && NODES[node[i]].age <= G.age;
