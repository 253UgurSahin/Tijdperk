// Uitzoeken waar je op klikt.
import type { Mobile } from '../types';
import type * as T3 from 'three';
import { proj, pxu, rayAt } from './camera';

/** Een figuur dat je kunt aanklikken (alleen vijanden kunnen zich terugtrekken). */
type Clickable = Mobile & { retreat?: boolean };
export function nearScreen<T extends Clickable>(
  list: T[],
  X: number,
  Y: number,
  r: number,
  lift: (e: T) => number,
): T | null {
  let best: T | null = null,
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
