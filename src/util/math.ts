// Kleine rekenhulpjes.
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
