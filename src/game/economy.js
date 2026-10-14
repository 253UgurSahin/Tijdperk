// Betalen en ontvangen van grondstoffen.
import { G } from './state.js';

export function has(c, m = 1) {
  for (const k in c) if (G.res[k] < c[k] * m) return false;
  return true;
}
export function pay(c) {
  for (const k in c) G.res[k] -= c[k];
}
export function gain(c) {
  for (const k in c) G.res[k] += c[k];
}
