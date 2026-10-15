// Tests voor het bonusregister: optellen, en kloppen alle sleutels in de data en de code?
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BONUS_KEYS, bonusesIn, combine, limitTotal, sumAll } from '../src/data/bonus.js';
import { TECH, TK } from '../src/data/tech.js';

describe('bonussen optellen', () => {
  it('combine telt alle waarden voor één sleutel op', () => {
    const list = [{ 'army.dmg': 0.15 }, { 'army.dmg': 0.1, farm: 0.2 }, { farm: 0.3 }];
    expect(combine(list, 'army.dmg')).toBeCloseTo(0.25);
    expect(combine(list, 'farm')).toBeCloseTo(0.5);
  });

  it('combine geeft 0 zonder bonussen en slaat lege plekken over', () => {
    expect(combine([], 'farm')).toBe(0);
    expect(combine([null, undefined, {}], 'farm')).toBe(0);
    expect(combine([{ farm: 0.2 }], 'light')).toBe(0);
  });

  it('negatieve bonussen trekken af', () => {
    expect(combine([{ 'chunk.cost': -0.25 }, { 'chunk.cost': 0.1 }], 'chunk.cost')).toBeCloseTo(-0.15);
  });

  it('sumAll telt alles per sleutel op, net als combine', () => {
    const list = [{ farm: 0.2, light: 1.5 }, null, { farm: 0.25 }];
    const sums = sumAll(list);
    expect(sums).toEqual({ farm: combine(list, 'farm'), light: 1.5 });
  });

  it('bonusesIn haalt het bonus-veld uit één ding, een lijst of een object', () => {
    const a = { bonus: { farm: 0.1 } },
      b = { bonus: { light: 1 } },
      leeg = { n: 'zonder bonus' };
    expect(bonusesIn(undefined)).toEqual([]);
    expect(bonusesIn(a)).toEqual([a.bonus]);
    expect(bonusesIn([a, leeg, null, b])).toEqual([a.bonus, b.bonus]);
    expect(bonusesIn({ x: a, y: b, z: leeg })).toEqual([a.bonus, b.bonus]);
  });
});

describe('ondergrens voor kortingen', () => {
  it('veel kortingen samen gaan niet onder de ondergrens', () => {
    expect(limitTotal('research.time', -0.95)).toBe(-0.75);
    expect(limitTotal('chunk.cost', -1.35)).toBe(-0.75);
    expect(limitTotal('chunk.cost', -0.3)).toBe(-0.3);
  });

  it('sleutels zonder ondergrens blijven gewoon zoals ze zijn', () => {
    expect(limitTotal('farm', 5)).toBe(5);
    expect(limitTotal('raid.size', -2)).toBe(-2);
    expect(limitTotal('bestaatniet', -3)).toBe(-3);
  });

  it('elke ondergrens is een korting tussen 0% en 100%', () => {
    for (const [key, info] of Object.entries(BONUS_KEYS))
      if (info.min != null) {
        expect(info.min, key).toBeLessThan(0);
        expect(info.min, key).toBeGreaterThan(-1);
      }
  });
});

describe('bonussleutels', () => {
  it('elke sleutel heeft een korte Nederlandse uitleg', () => {
    for (const [key, info] of Object.entries(BONUS_KEYS)) {
      expect(typeof info.d, key).toBe('string');
      expect(info.d.length, key).toBeGreaterThan(5);
    }
  });

  it('onderzoek gebruikt alleen bestaande sleutels met een echt getal', () => {
    for (const T of TECH) {
      if (!T.bonus) continue;
      for (const [key, value] of Object.entries(T.bonus)) {
        expect(BONUS_KEYS[key], `${T.k}: ${key}`).toBeTruthy();
        expect(Number.isFinite(value) && value !== 0, `${T.k}: ${key}`).toBe(true);
      }
    }
  });

  // De tekst voor spelers en de echte getallen moeten hetzelfde zeggen
  it('elk getal uit de bonus staat ook in de tekst van het onderzoek', () => {
    for (const T of TECH) {
      if (!T.bonus) continue;
      for (const [key, value] of Object.entries(T.bonus)) {
        // 0.25 wordt '25%'; een vast getal zoals 1.5 wordt '1,5'
        const shown = BONUS_KEYS[key].flat
          ? String(value).replace('.', ',')
          : Math.round(Math.abs(value) * 100) + '%';
        expect(T.d, `${T.k}: ${key}`).toContain(shown);
      }
    }
  });

  // Alle bestanden die het register gebruiken, en de sleutels die ze opvragen met mul('...') of add('...')
  const usedKeys = new Set();
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.js')) {
        const code = readFileSync(path, 'utf8');
        if (!/from '[./]*(game\/)?bonus\.js'/.test(code)) continue;
        for (const m of code.matchAll(/(?<![.\w])(?:mul|add)\('([^']+)'\)/g)) usedKeys.add(m[1]);
      }
    }
  };
  walk(new URL('../src', import.meta.url).pathname);

  it('de code vraagt alleen sleutels op die in de lijst staan', () => {
    expect(usedKeys.size).toBeGreaterThan(10);
    for (const key of usedKeys) expect(BONUS_KEYS[key], key).toBeTruthy();
  });

  it('elke sleutel in de lijst doet ook echt iets in het spel', () => {
    for (const key of Object.keys(BONUS_KEYS)) expect(usedKeys.has(key), key).toBe(true);
  });
});

describe('onderzoek via het register geeft dezelfde getallen als vroeger', () => {
  // [onderzoek, sleutel, oude vermenigvuldiger of oude vaste waarde]
  const OLD = [
    ['agri', 'farm', 1.2],
    ['ironplow', 'farm.plow', 1.25],
    ['automation', 'gather.all', 1.25],
    ['wheel', 'vill.speed', 1.15],
    ['radio', 'army.speed', 1.2],
    ['antigrav', 'move.all', 1.25],
    ['rail', 'road', 1.4],
    ['forging', 'army.dmg', 1.15],
    ['swarm', 'robot.dmg', 1.3],
    ['swarm', 'laser.dmg', 1.3],
    ['ballistics', 'tower.dmg', 1.2],
    ['masonry', 'bld.hp', 1.25],
    ['windpower', 'mill.speed', 1.5],
    ['steam', 'conv.speed', 1.25],
    ['electric', 'power', 1.25],
    ['charts', 'chunk.cost', 0.75],
    ['starcharts', 'meteor.ore', 1.4],
  ];
  const FLAT = [
    ['agri', 'farm.slots', 1],
    ['fire', 'light', 1.5],
    ['ballistics', 'tower.range', 1],
    ['medicine', 'heal', 1],
  ];

  it('percentages', () => {
    for (const [k, key, old] of OLD) expect(1 + combine([TK[k].bonus], key), `${k}: ${key}`).toBe(old);
  });

  it('vaste waarden', () => {
    for (const [k, key, old] of FLAT) {
      expect(BONUS_KEYS[key].flat, key).toBe(true);
      expect(combine([TK[k].bonus], key), `${k}: ${key}`).toBe(old);
    }
  });

  it('sterrenkaarten: meteorieten vallen anderhalf keer zo vaak (wachttijd 0,6 → 0,4)', () => {
    expect(0.6 / (1 + combine([TK.starcharts.bonus], 'meteor.rate'))).toBeCloseTo(0.4, 12);
  });

  it('elk van deze onderzoeken heeft zijn sleutel voor zich alleen', () => {
    // Vroeger werden ze vermenigvuldigd: (1 + a) × (1 + b). Delen ze een sleutel, dan wordt het
    // optellen (1 + a + b) en verandert het getal.
    for (const [, key] of [...OLD, ...FLAT]) {
      const givers = TECH.filter(T => T.bonus && key in T.bonus);
      expect(givers.length, key).toBe(1);
    }
  });
});
