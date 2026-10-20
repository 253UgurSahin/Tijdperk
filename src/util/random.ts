// Toevalsgetallen en "ruis" waarmee de wereld wordt gegenereerd. Zelfde seed = zelfde wereld.
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s),
    b = hash2(xi + 1, yi, s),
    c = hash2(xi, yi + 1, s),
    d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, s: number): number {
  let t = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < 4; i++) {
    t += vnoise(x * f, y * f, s + i * 31) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return t / n;
}

/** Kies één uit een lijst, waarbij elk een eigen kans (gewicht) heeft. Lege lijst of alles 0: null. */
export function weightedPick<T>(list: T[], weightOf: (item: T) => number): T | null {
  const total = list.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= weightOf(item);
    if (roll < 0) return item;
  }
  return null;
}
