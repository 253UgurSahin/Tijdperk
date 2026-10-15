import type { Mobile } from '../types';
// Uitzoeken waar je op klikt.
import { proj, pxu, rayAt } from './camera';

export function nearScreen<T extends Mobile>(list: T[], X: number, Y: number, r: number, lift: (e: T) => number): T | null {
  let best = null,
    bd = Math.max(r, pxu() * 0.42);
  for (const e of list) {
    if (e.hidden || e.retreat) continue;
    const [sx, sy, sz] = proj(e.x, lift(e), e.y);
    if (sz > 1) continue;
    const d = Math.hypot(sx - X, sy - Y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
export function pickGroup(X: number, Y: number, grp: T3.Object3D, key: string): number | null {
  const hits = rayAt(X, Y).intersectObjects(grp.children, true);
  for (const h of hits) {
    let o = h.object;
    if (o.userData[key] != null) return o.userData[key];
  }
  return null;
}
