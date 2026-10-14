import { describe, expect, it } from 'vitest';
import { RES, RKEYS, GATHER } from '../src/data/resources.js';
import { B } from '../src/data/buildings.js';
import { UNITS } from '../src/data/units.js';
import { TECH } from '../src/data/tech.js';
import { AGES, AGE_UP } from '../src/data/ages.js';
import { NODES } from '../src/data/nodes.js';

const costKeys = c => Object.keys(c || {});

describe('speldata', () => {
  it('alle kosten gebruiken bestaande grondstoffen', () => {
    for (const [k, d] of Object.entries(B)) for (const r of costKeys(d.cost)) expect(RES[r], `${k}.${r}`).toBeTruthy();
    for (const [k, u] of Object.entries(UNITS)) for (const r of costKeys(u.cost)) expect(RES[r], `${k}.${r}`).toBeTruthy();
    for (const t of TECH) for (const r of costKeys(t.cost)) expect(RES[r], `${t.k}.${r}`).toBeTruthy();
  });

  it('niets kost een grondstof uit een later tijdperk', () => {
    for (const [k, d] of Object.entries(B)) for (const r of costKeys(d.cost)) expect(RES[r].age, `${k}.${r}`).toBeLessThanOrEqual(d.age);
    for (const [k, u] of Object.entries(UNITS)) for (const r of costKeys(u.cost)) expect(RES[r].age, `${k}.${r}`).toBeLessThanOrEqual(u.age);
  });

  it('eenheden komen uit een bestaand trainingsgebouw', () => {
    const trainers = new Set(Object.values(B).map(d => d.train).filter(Boolean));
    for (const [k, u] of Object.entries(UNITS)) expect(trainers.has(u.src), k).toBe(true);
  });

  it('elk tijdperk heeft een overgang met bestaande gebouwen', () => {
    expect(AGE_UP.length).toBe(AGES.length);
    for (const a of AGE_UP.slice(1)) for (const k of a.need) expect(B[k], k).toBeTruthy();
  });

  it('elke verzamelbare grondstof heeft een bron op de kaart', () => {
    for (const r of GATHER) expect(NODES.some(n => n && n.res === r), r).toBe(true);
    expect(RKEYS.length).toBe(Object.keys(RES).length);
  });
});
