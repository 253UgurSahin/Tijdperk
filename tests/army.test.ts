// Tests voor de legerregels: rangen van veteranen, rollen, plekken in een formatie en opgeslagen groepen.
import { describe, expect, it } from 'vitest';
import {
  FORMATION_GAP,
  RANK_AT,
  arrivalPaces,
  bestVeteran,
  cleanGroups,
  closeTogether,
  formationGoals,
  formationSlots,
  killsToNextRank,
  rankFromKills,
  rankMul,
  rankName,
  roleWord,
  rowWidth,
  unitRole,
} from '../src/data/army';
import type { FormationUnit, Role } from '../src/data/army';
import { UNITS } from '../src/data/units';

describe('veteranen: rang uit overwinningen', () => {
  it('rang 1, 2 en 3 na 3, 8 en 15 overwinningen', () => {
    expect(RANK_AT).toEqual([3, 8, 15]);
    expect(rankFromKills(0)).toBe(0);
    expect(rankFromKills(2)).toBe(0);
    expect(rankFromKills(3)).toBe(1);
    expect(rankFromKills(7)).toBe(1);
    expect(rankFromKills(8)).toBe(2);
    expect(rankFromKills(14)).toBe(2);
    expect(rankFromKills(15)).toBe(3);
    expect(rankFromKills(200)).toBe(3);
    expect(rankFromKills(undefined)).toBe(0);
  });
  it('elke rang geeft 10% meer schade en levens', () => {
    expect(rankMul(0)).toBe(1);
    expect(rankMul(1)).toBeCloseTo(1.1);
    expect(rankMul(3)).toBeCloseTo(1.3);
  });
  it('namen en hoeveel er nog nodig zijn', () => {
    expect(rankName(0)).toBe('Rekruut');
    expect(rankName(1)).toBe('Veteraan');
    expect(rankName(3)).toBe('Held');
    expect(killsToNextRank(0)).toBe(3);
    expect(killsToNextRank(5)).toBe(3);
    expect(killsToNextRank(14)).toBe(1);
    expect(killsToNextRank(15)).toBe(null);
  });
});

describe('veteranen: de beste', () => {
  it('de soldaat met de meeste overwinningen, maar alleen met een rang', () => {
    const a = { kills: 4 },
      b = { kills: 9 },
      c = { kills: 2 },
      d = {};
    expect(bestVeteran([a, b, c, d])).toBe(b);
    expect(bestVeteran([c, d])).toBe(null);
    expect(bestVeteran([])).toBe(null);
  });
});

describe('formatie: samen oplopen', () => {
  it('alleen bij elkaar als iedereen binnen 6 tegels van het midden staat', () => {
    expect(closeTogether([{ x: 0, y: 0 }])).toBe(false);
    expect(
      closeTogether([
        { x: 0, y: 0 },
        { x: 3, y: 2 },
        { x: 1, y: 4 },
      ]),
    ).toBe(true);
    expect(
      closeTogether([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ]),
    ).toBe(false);
  });
  it('wie verder moet loopt sneller, zodat ze tegelijk aankomen', () => {
    // Een blijde (1,1) die 11 tegels loopt en twee speerdragers (2,2) die 13 en 5,5 tegels lopen
    const [siege, far, near] = arrivalPaces([
      { dist: 11, spd: 1.1 },
      { dist: 13, spd: 2.2 },
      { dist: 5.5, spd: 2.2 },
    ]);
    expect(siege).toBeCloseTo(1.1);
    expect(far).toBeCloseTo(1.3);
    expect(far).toBeGreaterThan(siege); // de voorhoede haalt het geschut in
    expect(near).toBeCloseTo(0.55);
    // Aankomsttijd is voor iedereen gelijk: 10 tellen
    expect(11 / siege).toBeCloseTo(10);
    expect(13 / far).toBeCloseTo(10);
  });
  it('nooit sneller dan je kunt, nooit trager dan de helft van de traagste', () => {
    const paces = arrivalPaces([
      { dist: 10, spd: 1 },
      { dist: 0.1, spd: 2 },
    ]);
    expect(paces[0]).toBeCloseTo(1);
    expect(paces[1]).toBeCloseTo(0.5);
    for (const p of arrivalPaces([
      { dist: 30, spd: 3 },
      { dist: 1, spd: 1 },
    ]))
      expect(p).toBeLessThanOrEqual(3);
  });
  it('staat iedereen al op zijn plek, dan gewoon volle snelheid (tempo 0)', () => {
    expect(
      arrivalPaces([
        { dist: 0, spd: 2 },
        { dist: 0, spd: 1 },
      ]),
    ).toEqual([0, 0]);
  });
});

describe('formatie: rollen', () => {
  it('vechters van dichtbij en pantser voorop, geschut achteraan, de rest schutters', () => {
    expect(unitRole(UNITS.spear)).toBe('front');
    expect(unitRole(UNITS.knight)).toBe('front');
    expect(unitRole(UNITS.tank)).toBe('front');
    expect(unitRole(UNITS.slinger)).toBe('ranged');
    expect(unitRole(UNITS.archer)).toBe('ranged');
    expect(unitRole(UNITS.drone)).toBe('ranged');
    expect(unitRole(UNITS.trebuchet)).toBe('siege');
    expect(unitRole(UNITS.bombard)).toBe('siege');
    expect(unitRole(UNITS.rocket)).toBe('siege');
  });
  it('namen van rollen bij één of meer', () => {
    expect(roleWord('ranged', 1)).toBe('schutter');
    expect(roleWord('ranged', 3)).toBe('schutters');
    expect(roleWord('front', 2)).toBe('voorhoede');
  });
  it('elke soldaat heeft een rol', () => {
    for (const k in UNITS) expect(['front', 'ranged', 'siege'], k).toContain(unitRole(UNITS[k]));
  });
});

describe('formatie: plekken', () => {
  const roles: Role[] = ['siege', 'ranged', 'front', 'front', 'ranged', 'front', 'ranged', 'siege'];
  it('rijen zijn niet te breed en niet te diep', () => {
    expect(rowWidth(1)).toBe(1);
    expect(rowWidth(2)).toBe(2);
    expect(rowWidth(8)).toBe(4);
    expect(rowWidth(20)).toBe(7);
  });
  it('voorhoede voor de schutters, schutters voor het geschut', () => {
    const slots = formationSlots(roles);
    expect(slots.front.length).toBe(3);
    expect(slots.ranged.length).toBe(3);
    expect(slots.siege.length).toBe(2);
    const lastFront = Math.max(...slots.front.map(s => s.back)),
      firstRanged = Math.min(...slots.ranged.map(s => s.back)),
      lastRanged = Math.max(...slots.ranged.map(s => s.back)),
      firstSiege = Math.min(...slots.siege.map(s => s.back));
    expect(lastFront).toBeLessThan(firstRanged);
    expect(lastRanged).toBeLessThan(firstSiege);
  });
  it('het midden van de formatie ligt op het doel, en niemand staat op dezelfde plek', () => {
    const slots = formationSlots(roles),
      all = [...slots.front, ...slots.ranged, ...slots.siege];
    const mid = all.reduce((sum, s) => sum + s.back, 0) / all.length;
    expect(mid).toBeCloseTo(0);
    for (let a = 0; a < all.length; a++)
      for (let b = a + 1; b < all.length; b++)
        expect(Math.hypot(all[a].side - all[b].side, all[a].back - all[b].back)).toBeGreaterThan(
          FORMATION_GAP - 1e-9,
        );
  });
  it('lopen naar rechts: voorhoede het verst naar rechts, geschut het verst naar links', () => {
    const units = roles.map((role, i) => ({ x: (i % 3) * 0.7, y: Math.floor(i / 3) * 0.7, role }));
    const goals = formationGoals(units, 20, 0.7);
    expect(goals.length).toBe(units.length);
    const xs = (role: Role) => goals.filter((_g, i) => units[i].role === role).map(g => g.x);
    expect(Math.min(...xs('front'))).toBeGreaterThan(Math.max(...xs('ranged')));
    expect(Math.min(...xs('ranged'))).toBeGreaterThan(Math.max(...xs('siege')));
    // Het midden van de formatie ligt (ongeveer) op het doel
    const cx = goals.reduce((sum, g) => sum + g.x, 0) / goals.length,
      cy = goals.reduce((sum, g) => sum + g.y, 0) / goals.length;
    expect(Math.abs(cx - 20)).toBeLessThan(0.5);
    expect(Math.abs(cy - 0.7)).toBeLessThan(0.5);
  });
  it('lopen naar beneden: de voorkant draait mee', () => {
    const units: FormationUnit[] = [
      { x: 10, y: 10, role: 'siege' },
      { x: 10.5, y: 10, role: 'front' },
      { x: 11, y: 10, role: 'ranged' },
    ];
    const [siege, front, ranged] = formationGoals(units, 10.5, 30);
    expect(front.y).toBeGreaterThan(ranged.y);
    expect(ranged.y).toBeGreaterThan(siege.y);
  });
  it('wie links loopt, krijgt in zijn rij ook een plek links', () => {
    const units: FormationUnit[] = [
      { x: 0, y: 5, role: 'front' },
      { x: 0, y: 0, role: 'front' },
    ];
    // Naar rechts lopen: opzij is dan de y-richting
    const [a, b] = formationGoals(units, 30, 2.5);
    expect(a.y).toBeGreaterThan(b.y);
  });
  it('een lege groep heeft geen plekken', () => {
    expect(formationGoals([], 3, 3)).toEqual([]);
  });
});

describe('groepen uit opslag', () => {
  it('alleen groep 1 tot 5 met nummers blijft over', () => {
    expect(cleanGroups(null)).toEqual({});
    expect(cleanGroups({ 1: [4, 5], 2: [], 6: [1], 3: ['x', 7], 4: 'kapot' })).toEqual({ 1: [4, 5], 3: [7] });
  });
});
