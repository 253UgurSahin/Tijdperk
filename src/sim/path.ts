import type { Mobile, Path, Tile } from '../types';
import { H, W } from '../core/constants';
import { clamp } from '../core/util';
import { hasT } from './rules';
import { foeWalk, freeWalk, road, ter, walkable } from './world';

const gS = new Float32Array(W * H), came = new Int32Array(W * H), stp = new Uint32Array(W * H), cls = new Uint32Array(W * H);
let stamp = 0;
export function findPath(sx: number, sy: number, tx: number, ty: number, free: boolean | 2): Path | null {
    sx = clamp(sx, 0, W - 1);
    sy = clamp(sy, 0, H - 1);
    tx = clamp(tx, 0, W - 1);
    ty = clamp(ty, 0, H - 1);
    const ok0 = free === 2 ? foeWalk : free ? freeWalk : walkable, goalI = ty * W + tx, ok = (x: number, y: number) => ok0(x, y) || (free && x === tx && y === ty && ter[goalI] !== 1);
    if (sx === tx && sy === ty)
        return [];
    if (!ok(tx, ty))
        return null;
    stamp++;
    const heap: [number, number][] = [];
    const push = (f: number, i: number) => {
        heap.push([f, i]);
        let k = heap.length - 1;
        while (k > 0) {
            const p = (k - 1) >> 1;
            if (heap[p][0] <= heap[k][0])
                break;
            [heap[p], heap[k]] = [heap[k], heap[p]];
            k = p;
        }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop()!;
        if (heap.length) {
            heap[0] = last;
            let k = 0;
            for (;;) {
                const l = 2 * k + 1, r = l + 1;
                let m = k;
                if (l < heap.length && heap[l][0] < heap[m][0])
                    m = l;
                if (r < heap.length && heap[r][0] < heap[m][0])
                    m = r;
                if (m === k)
                    break;
                [heap[m], heap[k]] = [heap[k], heap[m]];
                k = m;
            }
        }
        return top;
    };
    const hz = (x: number, y: number) => {
        const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
        return dx + dy - .586 * Math.min(dx, dy);
    };
    const st = sy * W + sx, goal = ty * W + tx;
    gS[st] = 0;
    stp[st] = stamp;
    came[st] = -1;
    push(hz(sx, sy), st);
    let exp = 0;
    while (heap.length) {
        const c = pop()[1];
        if (c === goal) {
            const path: Tile[] = [];
            let k = goal;
            while (k !== st && k >= 0) {
                path.push([k % W, (k / W) | 0]);
                k = came[k];
            }
            return path.reverse();
        }
        if (cls[c] === stamp)
            continue;
        cls[c] = stamp;
        if (++exp > 9000)
            return null;
        const cx = c % W, cy = (c / W) | 0;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy)
                    continue;
                const nx = cx + dx, ny = cy + dy;
                if (!ok(nx, ny))
                    continue;
                if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy)))
                    continue;
                const ni = ny * W + nx, ng = gS[c] + (dx && dy ? 1.414 : 1);
                if (stp[ni] !== stamp || ng < gS[ni]) {
                    stp[ni] = stamp;
                    gS[ni] = ng;
                    came[ni] = c;
                    push(ng + hz(nx, ny), ni);
                }
            }
    }
    return null;
}
export function follow(e: Mobile, dt: number, spd: number): boolean {
    if (!e.path || !e.path.length)
        return true;
    const rt = road[(e.y | 0) * W + (e.x | 0)];
    if (rt)
        spd *= 1 + (.22 + rt * .12) * (hasT('rail') ? 1.4 : 1);
    const p = e.path[0], tx = p[0] + .5, ty = p[1] + .5, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), st = spd * dt;
    if (d <= st) {
        e.x = tx;
        e.y = ty;
        e.path.shift();
        return !e.path.length;
    }
    e.x += dx / d * st;
    e.y += dy / d * st;
    return false;
}
