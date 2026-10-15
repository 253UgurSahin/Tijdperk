import type { Cost } from '../types';
// Betalen en ontvangen van grondstoffen.
import { G } from './state';

export function has(c: Cost, m = 1): boolean {
  for (const k in c) if (G.res[k] < c[k] * m) return false;
  return true;
}
export function pay(c: Cost) {
  for (const k in c) G.res[k] -= c[k];
}
export function gain(c: Cost) {
  for (const k in c) G.res[k] += c[k];
}
