// Tests voor de volken: kloppen de gegevens, de eigen soldaat, het slot en de teksten?
import type { PeopleDef } from '../src/data/peoples';
import { describe, expect, it } from 'vitest';
import { AGES } from '../src/data/ages';
import { BONUS_KEYS } from '../src/data/bonus';
import {
  DEFAULT_PEOPLE,
  PEOPLE,
  PEOPLES,
  isPeopleUnlocked,
  lockText,
  peopleBonuses,
  startLine,
} from '../src/data/peoples';
import { RES } from '../src/data/resources';
import { canMake, fitsPeople, retiredAt, retiredIn } from '../src/data/succession';
import { UNITS } from '../src/data/units';

/** Een volk met een eigen soldaat: dan staat `unique` er zeker. */
type PeopleWithUnique = PeopleDef & Required<Pick<PeopleDef, 'unique'>>;
/** Een volk op slot: dan staat `locked` er zeker. */
type LockedPeople = PeopleDef & Required<Pick<PeopleDef, 'locked'>>;

describe('volken: gegevens', () => {
  it('zes volken met elk een eigen sleutel, naam, vlag, motto en 2 tot 3 voordelen', () => {
    expect(PEOPLES.length).toBe(6);
    expect(new Set(PEOPLES.map(p => p.k)).size).toBe(6);
    for (const p of PEOPLES) {
      expect(PEOPLE[p.k], p.k).toBe(p);
      expect(p.n, p.k).toBeTruthy();
      expect(p.c, p.k).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.g, p.k).toBeTruthy();
      expect(p.motto.length, p.k).toBeGreaterThan(5);
      expect(p.d.length, p.k).toBeGreaterThanOrEqual(2);
      expect(p.d.length, p.k).toBeLessThanOrEqual(3);
    }
  });

  it('het standaardvolk bestaat en is vrij te kiezen', () => {
    expect(PEOPLE[DEFAULT_PEOPLE]).toBeTruthy();
    expect(PEOPLE[DEFAULT_PEOPLE].locked).toBeFalsy();
  });

  it('bonussen gebruiken bestaande sleutels met een echt getal', () => {
    for (const p of PEOPLES)
      for (const [key, value] of Object.entries(p.bonus)) {
        expect(BONUS_KEYS[key], `${p.k}: ${key}`).toBeTruthy();
        expect(Number.isFinite(value) && value !== 0, `${p.k}: ${key}`).toBe(true);
      }
  });

  // De tekst voor spelers en de echte getallen moeten hetzelfde zeggen
  it('elk getal uit de bonus staat ook in de tekst van het volk', () => {
    for (const p of PEOPLES) {
      const text = [...p.d, startLine(p.k)].join(' · ');
      for (const [key, value] of Object.entries(p.bonus)) {
        // 0.2 wordt '20%', een vast getal blijft een getal; 1 extra keer mag ook '2 keer zo vaak' heten
        const shown = BONUS_KEYS[key].flat
          ? [String(value).replace('.', ',')]
          : [Math.round(Math.abs(value) * 100) + '%', `${1 + value} keer`];
        expect(
          shown.some(s => text.includes(s)),
          `${p.k}: ${key} (${shown.join(' of ')})`,
        ).toBe(true);
      }
    }
  });

  it('het startvoordeel gebruikt grondstoffen uit de steentijd', () => {
    for (const p of PEOPLES) {
      for (const [r, n] of Object.entries(p.start.res || {})) {
        expect(RES[r], `${p.k}: ${r}`).toBeTruthy();
        expect(RES[r].age, `${p.k}: ${r}`).toBe(0);
        expect(n, `${p.k}: ${r}`).toBeGreaterThan(0);
      }
    }
    expect(startLine('friezen')).toBe('Start: +80 voedsel');
    expect(startLine('nomaden')).toBe('Start: +2 dorpelingen');
    expect(startLine('sterrenkijkers')).toBe('');
  });

  it('peopleBonuses geeft de bonus van een volk, en niets voor een onbekend volk', () => {
    expect(peopleBonuses('norse')).toEqual([PEOPLE.norse.bonus]);
    expect(peopleBonuses('bestaatniet')).toEqual([]);
    expect(peopleBonuses(undefined)).toEqual([]);
  });
});

describe('volken: eigen soldaat', () => {
  it('de eigen soldaat bestaat, hoort bij het volk en vervangt een soldaat van dezelfde soort', () => {
    // De filter houdt alleen volken met een eigen soldaat over
    const withUnique = PEOPLES.filter(p => p.unique) as PeopleWithUnique[];
    expect(withUnique.length).toBeGreaterThan(0);
    for (const p of withUnique) {
      const own = UNITS[p.unique.unit],
        old = UNITS[p.unique.replaces];
      expect(own, p.unique.unit).toBeTruthy();
      expect(old, p.unique.replaces).toBeTruthy();
      expect(own.people, p.unique.unit).toBe(p.k);
      expect(own.src).toBe(old.src);
      expect(own.age).toBe(old.age);
      expect(retiredAt(p.unique.unit)).toBe(retiredAt(p.unique.replaces));
      expect(p.d.join(' '), p.k).toContain(own.n);
    }
  });

  it('elke soldaat van één volk staat bij dat volk als eigen soldaat', () => {
    for (const [k, u] of Object.entries(UNITS)) {
      if (!u.people) continue;
      expect(PEOPLE[u.people], k).toBeTruthy();
      // Dit volk heeft zeker een eigen soldaat (dat test deze regel)
      expect(PEOPLE[u.people].unique!.unit, k).toBe(k);
    }
  });

  // De uitleg bij de Berserker noemt getallen; die moeten kloppen met de echte waarden
  it('de uitleg bij de Berserker klopt met zijn getallen', () => {
    const own = UNITS.berserker,
      old = UNITS.swordsman;
    const shown = (n: number) => String(n).replace('.', ',');
    expect(own.note).toContain(`elke ${shown(own.rate)} s`);
    expect(own.note).toContain(`elke ${shown(old.rate)} s`);
    expect(own.note).toContain(`${own.hp} tegen ${old.hp}`);
    expect(own.rate).toBeLessThan(old.rate);
    expect(own.spd).toBeGreaterThan(old.spd);
    expect(own.hp).toBeLessThan(old.hp);
  });

  it('Noormannen trainen een Berserker in plaats van een zwaardvechter', () => {
    expect(canMake('berserker', 2, 'norse')).toBe(true);
    expect(canMake('swordsman', 2, 'norse')).toBe(false);
    expect(canMake('berserker', 2, 'friezen')).toBe(false);
    expect(canMake('swordsman', 2, 'friezen')).toBe(true);
    // Zonder volk (oude code, tests): gewoon de zwaardvechter
    expect(canMake('berserker', 2)).toBe(false);
    expect(canMake('swordsman', 2)).toBe(true);
    // Allebei te vroeg in de bronstijd en verouderd in de Gouden Eeuw
    expect(canMake('berserker', 1, 'norse')).toBe(false);
    expect(canMake('berserker', 4, 'norse')).toBe(false);
    expect(fitsPeople('pikeman', 'norse')).toBe(true);
  });

  it('bij een nieuw tijdperk noemt het spel alleen soldaten van je eigen volk als verouderd', () => {
    expect(retiredIn(4, 'norse')).toContain('berserker');
    expect(retiredIn(4, 'norse')).not.toContain('swordsman');
    expect(retiredIn(4, 'friezen')).toContain('swordsman');
    expect(retiredIn(4, 'friezen')).not.toContain('berserker');
  });

  it('elk volk kan in elk tijdperk iets in de kazerne trainen', () => {
    for (const p of PEOPLES)
      for (let age = 0; age < AGES.length; age++)
        expect(
          Object.keys(UNITS).some(k => UNITS[k].src === 'barracks' && canMake(k, age, p.k)),
          `${p.k} in ${AGES[age].n}`,
        ).toBe(true);
  });
});

describe('volken: op slot', () => {
  const free = PEOPLES.filter(p => !p.locked);
  // De filter houdt alleen volken op slot over
  const locked = PEOPLES.filter(p => p.locked) as LockedPeople[];

  it('de eerste drie zijn vrij, de laatste drie zitten op slot', () => {
    expect(free.map(p => p.k)).toEqual(PEOPLES.slice(0, 3).map(p => p.k));
    expect(locked.map(p => p.k)).toEqual(PEOPLES.slice(3).map(p => p.k));
  });

  it('elk slot noemt een prestatie (sleutel) en zegt in gewone taal wat je moet doen', () => {
    for (const p of locked) {
      expect(p.locked.by, p.k).toMatch(/^[a-z0-9_]+$/);
      expect(p.locked.text.length, p.k).toBeGreaterThan(5);
    }
    // Elke prestatie speelt maar één volk vrij
    expect(new Set(locked.map(p => p.locked.by)).size).toBe(locked.length);
  });

  it('zonder profiel zijn alleen de vrije volken te kiezen', () => {
    for (const p of free) expect(isPeopleUnlocked(p.k), p.k).toBe(true);
    for (const p of locked) {
      expect(isPeopleUnlocked(p.k), p.k).toBe(false);
      expect(isPeopleUnlocked(p.k, {}), p.k).toBe(false);
      expect(isPeopleUnlocked(p.k, null), p.k).toBe(false);
      expect(lockText(p.k), p.k).toBe(p.locked.text);
    }
    expect(isPeopleUnlocked('bestaatniet')).toBe(false);
  });

  it('met de juiste prestatie in het profiel gaat het slot eraf', () => {
    for (const p of locked) {
      const profile = { achievements: { [p.locked.by]: true } };
      expect(isPeopleUnlocked(p.k, profile), p.k).toBe(true);
      expect(lockText(p.k, profile), p.k).toBe('');
      // Een andere prestatie helpt niet
      expect(isPeopleUnlocked(p.k, { achievements: { iets_anders: true } }), p.k).toBe(false);
    }
  });
});
