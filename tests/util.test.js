import { describe, expect, it } from 'vitest';
import { mulberry32, fbm, hash2 } from '../src/util/random.js';
import { clamp, dist } from '../src/util/math.js';

describe('random', () => {
  it('mulberry32 is deterministisch per seed', () => {
    const a = mulberry32(42),
      b = mulberry32(42);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
  it('ruis blijft tussen 0 en 1', () => {
    for (let i = 0; i < 200; i++) {
      const v = fbm(i * 0.37, i * 0.11, 7),
        h = hash2(i, -i, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('math', () => {
  it('clamp en dist', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(dist(0, 0, 3, 4)).toBe(5);
  });
});
