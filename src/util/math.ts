// Kleine rekenhulpjes.
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
// Afstand tussen twee punten. Met een wortel in plaats van Math.hypot: die is in browsers een stuk trager,
// en deze functie wordt elke speltik duizenden keren gebruikt (wie is het dichtst bij, ...).
export const dist = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx,
    dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};
