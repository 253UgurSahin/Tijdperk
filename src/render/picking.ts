import type * as THREE from 'three';
import type { Mobile } from '../types';
import { proj, pxu, rayAt } from './camera';

// ---- picking ----
export function nearScreen<T extends Mobile>(list: T[], X: number, Y: number, r: number, lift: (e: T) => number): T | null {
    let best: T | null = null, bd = Math.max(r, pxu() * .42);
    for (const e of list) {
        if (e.hidden || (e as { retreat?: boolean }).retreat)
            continue;
        const [sx, sy, sz] = proj(e.x, lift(e), e.y);
        if (sz > 1)
            continue;
        const d = Math.hypot(sx - X, sy - Y);
        if (d < bd) {
            bd = d;
            best = e;
        }
    }
    return best;
}
export function pickGroup(X: number, Y: number, grp: THREE.Object3D, key: string): number | null {
    const hits = rayAt(X, Y).intersectObjects(grp.children, true);
    for (const h of hits) {
        let o = h.object;
        if (o.userData[key] != null)
            return o.userData[key];
    }
    return null;
}
