import { describe, expect, it } from 'vitest';
import { SUCCESSOR, canMake, retiredAt, retiredIn } from '../src/data/succession';
import { B } from '../src/data/buildings';
import { UNITS } from '../src/data/units';
import { AGES } from '../src/data/ages';

const def = (k: string) => B[k] || UNITS[k];

describe('opvolging per tijdperk', () => {
  it('opvolgers bestaan, zijn van dezelfde soort en komen later', () => {
    for (const [k, n] of Object.entries(SUCCESSOR)) {
      expect(def(n), n).toBeTruthy();
      expect(!!B[k], k).toBe(!!B[n]);
      expect(def(n).age, `${k} → ${n}`).toBeGreaterThan(def(k).age);
    }
  });

  it('de hut verdwijnt in de bronstijd, het leemhuis komt erbij', () => {
    expect(canMake('hut', 0)).toBe(true);
    expect(canMake('hut', 1)).toBe(false);
    expect(canMake('house', 1)).toBe(true);
    expect(retiredIn(1)).toContain('hut');
  });

  it('in elk tijdperk blijft er een woning, een lichtbron en een kazerne-eenheid over', () => {
    for (let age = 0; age < AGES.length; age++) {
      expect(
        Object.keys(B).some(k => B[k].pop && !B[k].nobuild && canMake(k, age)),
        `woning ${age}`,
      ).toBe(true);
      expect(
        Object.keys(B).some(k => B[k].light && !B[k].gen && canMake(k, age)),
        `licht ${age}`,
      ).toBe(true);
      expect(
        Object.keys(UNITS).some(k => UNITS[k].src === 'barracks' && canMake(k, age)),
        `leger ${age}`,
      ).toBe(true);
    }
  });

  it('niet-opgevolgde zaken blijven altijd beschikbaar', () => {
    expect(retiredAt('gate')).toBe(Infinity);
    expect(canMake('gate', 5)).toBe(true);
  });
});
