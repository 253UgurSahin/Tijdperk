// Balanstests: kan elk tijdperk gehaald worden, en werken de rol-bonussen van eenheden?
import type { Cost } from '../src/types';
import { describe, expect, it } from 'vitest';
import { AGES, AGE_MAT, AGE_UP } from '../src/data/ages';
import { B } from '../src/data/buildings';
import { NODES } from '../src/data/nodes';
import { tradePrices } from '../src/data/resources';
import { canMake } from '../src/data/succession';
import { TECH } from '../src/data/tech';
import { FOES, UNITS, bonusMul } from '../src/data/units';

/** Welke grondstoffen kun je in tijdperk `age` krijgen? Verzamelen, oppompen of in een fabriek maken. */
function obtainable(age: number) {
  const have = new Set<string>();
  for (const n of NODES) if (n && n.age <= age && !n.pump) have.add(n.res);
  for (const [k, d] of Object.entries(B))
    if (d.pump && canMake(k, age) && NODES.some(n => n && n.pump && n.age <= age)) have.add(d.pump.res);
  // Fabrieken herhalen tot er niets nieuws meer bij komt (brons → ... → chips)
  let grew = true;
  while (grew) {
    grew = false;
    for (const [k, d] of Object.entries(B)) {
      if (!d.conv || !canMake(k, age)) continue;
      if (!Object.keys(d.conv.in).every(r => have.has(r))) continue;
      for (const r of Object.keys(d.conv.out))
        if (!have.has(r)) {
          have.add(r);
          grew = true;
        }
    }
  }
  return have;
}

const missing = (cost: Cost, age: number) => Object.keys(cost).filter(r => !obtainable(age).has(r));

describe('elk tijdperk is haalbaar', () => {
  it('de stap naar elk tijdperk kost alleen wat je al kunt krijgen', () => {
    for (let a = 1; a < AGES.length; a++) {
      // Alleen AGE_UP[0] is leeg: de Steentijd heb je al bij het begin
      const up = AGE_UP[a]!;
      expect(missing(up.cost, a - 1), `naar ${AGES[a].n}`).toEqual([]);
      for (const k of up.need) {
        expect(canMake(k, a - 1), `${k} bouwbaar vóór ${AGES[a].n}`).toBe(true);
        expect(missing(B[k].cost, a - 1), `${k} betaalbaar vóór ${AGES[a].n}`).toEqual([]);
      }
    }
  });

  it('elk gebouw, elke eenheid en elk onderzoek is te betalen in zijn eigen tijdperk', () => {
    for (const [k, d] of Object.entries(B)) expect(missing(d.cost, d.age), k).toEqual([]);
    for (const [k, u] of Object.entries(UNITS)) expect(missing(u.cost, u.age), k).toEqual([]);
    for (const t of TECH) expect(missing(t.cost, t.age), t.k).toEqual([]);
  });

  it('verbeteringsmateriaal bestaat op het moment dat je het nodig hebt', () => {
    // Alleen AGE_MAT[0] is leeg
    for (let a = 1; a < AGE_MAT.length; a++) expect(missing(AGE_MAT[a]!, a), `AGE_MAT[${a}]`).toEqual([]);
  });

  it('sterrenmetaal ligt op de kaart (en valt uit meteorieten)', () => {
    expect(obtainable(AGES.length - 1).has('starmetal')).toBe(true);
    expect(obtainable(AGES.length - 2).has('starmetal')).toBe(false);
  });

  it('elke eenheid heeft in zijn tijdperk een gebouw dat hem traint', () => {
    for (const [k, u] of Object.entries(UNITS)) {
      const src = Object.entries(B).find(([bk, d]) => d.train === u.src && canMake(bk, u.age));
      expect(src, k).toBeTruthy();
    }
  });

  it('elk volgend tijdperk vraagt meer inwoners', () => {
    for (let a = 2; a < AGES.length; a++)
      expect(AGE_UP[a]!.pop, AGES[a].n).toBeGreaterThan(AGE_UP[a - 1]!.pop);
  });
});

describe('rol-bonussen', () => {
  const ruiter = { kind: 'f', ride: true };
  const voetvolk = { kind: 'f' };
  const kamp = { kind: 'c' };

  it('pieken doen dubbele schade tegen ruiters, en gewone schade tegen de rest', () => {
    expect(bonusMul(UNITS.pikeman, ruiter)).toBe(2);
    expect(bonusMul(UNITS.pikeman, voetvolk)).toBe(1);
  });

  it('geschut is sterk tegen kampen', () => {
    expect(bonusMul(UNITS.trebuchet, kamp)).toBeGreaterThan(1);
    expect(bonusMul(UNITS.bombard, voetvolk)).toBe(1);
  });

  it('eenheden zonder bonus en zonder doel geven 1', () => {
    expect(bonusMul(UNITS.archer, ruiter)).toBe(1);
    expect(bonusMul(UNITS.pikeman, null)).toBe(1);
  });

  it('elke bonus heeft een uitleg en richt zich op iets dat bestaat', () => {
    const tags = new Set(['camp', 'ride', 'proj', 'big', 'air']);
    for (const [k, u] of Object.entries(UNITS)) {
      if (!u.bonus) continue;
      expect(tags.has(u.bonus.vs), k).toBe(true);
      expect(u.bonus.mul, k).toBeGreaterThan(1);
      expect(u.bonus.d, k).toBeTruthy();
    }
    // Er zijn ook echt ruiters om tegen te vechten
    expect(FOES.some(f => f.ride)).toBe(true);
  });

  it('elk tijdperk vanaf de Middeleeuwen heeft een eenheid met een duidelijke rol', () => {
    for (let a = 3; a < AGES.length; a++) {
      const roles = Object.keys(UNITS).filter(k => canMake(k, a) && UNITS[k].bonus);
      expect(roles.length, AGES[a].n).toBeGreaterThan(0);
    }
  });
});

describe('markt', () => {
  it('zonder bonus blijven de prijzen gelijk', () => {
    expect(tradePrices('food', 0, 1)).toEqual({ buy: 20, sell: 8 });
    expect(tradePrices('iron', 2, 1)).toEqual({ buy: 32, sell: 21 });
  });

  // Hanze plus de zegening Handelsgeest (en hoge marktniveaus) mogen geen gratis goud geven
  it('verkopen levert nooit meer op dan kopen kost, ook met veel marktbonussen', () => {
    const maxLevel = AGES.length - 1 - B.market.age;
    for (const r of ['food', 'wood', 'stone', 'copper', 'iron', 'coal'])
      for (let level = 0; level <= maxLevel; level++)
        for (let marketMul = 1; marketMul <= 3; marketMul += 0.05) {
          const { buy, sell } = tradePrices(r, level, marketMul);
          expect(sell, `${r} niveau ${level} bonus ${marketMul.toFixed(2)}`).toBeLessThan(buy);
        }
  });
});
