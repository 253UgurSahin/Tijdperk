// Tests voor prestaties, score en profiel: kloppen de gegevens, de som en het bijhouden van records?
import { describe, expect, it } from 'vitest';
import { addAchievement, addPeople, addResult, emptyProfile, normalizeProfile } from '../src/core/profile.js';
import {
  ACHIEVEMENT,
  ACHIEVEMENTS,
  ACHIEVEMENT_CATS,
  AGE_BUILDINGS,
  emptyFacts,
  fullAge,
  newAchievements,
} from '../src/data/achievements.js';
import { AGES } from '../src/data/ages.js';
import { B } from '../src/data/buildings.js';
import { PEOPLE, PEOPLES, isPeopleUnlocked } from '../src/data/peoples.js';
import { DIFF_FACTOR, DIFF_NAMES, MEDALS, gameScore, medalFor } from '../src/data/score.js';
import { ico } from '../src/ui/glyphs.js';

const facts = changes => ({ ...emptyFacts(), ...changes });

describe('prestaties: gegevens', () => {
  it('rond de 35 prestaties, elk met een eigen sleutel, naam, uitleg en groep', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(45);
    expect(new Set(ACHIEVEMENTS.map(a => a.k)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.k, a.k).toMatch(/^[a-z0-9_]+$/);
      expect(ACHIEVEMENT[a.k]).toBe(a);
      expect(a.n.length, a.k).toBeGreaterThan(3);
      expect(a.d.length, a.k).toBeGreaterThan(5);
      expect(ACHIEVEMENT_CATS[a.cat], a.k).toBeTruthy();
      expect(typeof a.when, a.k).toBe('function');
    }
  });

  it('elke prestatie heeft een pictogram: een tijdperk, een volk of een bekend teken', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.age != null) expect(AGES[a.age], a.k).toBeTruthy();
      else if (a.people) expect(PEOPLE[a.people], a.k).toBeTruthy();
      else expect(ico(a.g), a.k).toContain('<svg');
    }
  });

  it('elk tijdperk na de Steentijd is een prestatie', () => {
    for (let age = 1; age < AGES.length; age++) {
      const a = ACHIEVEMENT['age' + age];
      expect(a, 'age' + age).toBeTruthy();
      expect(a.when(facts({ age }))).toBe(true);
      expect(a.when(facts({ age: age - 1 }))).toBe(false);
    }
  });

  it('elk volk heeft een prestatie om mee te winnen', () => {
    for (const p of PEOPLES) {
      const a = ACHIEVEMENT[`win_${p.k}`];
      expect(a, p.k).toBeTruthy();
      expect(a.when(facts({ won: true, people: p.k }))).toBe(true);
      expect(a.when(facts({ won: false, people: p.k }))).toBe(false);
    }
  });

  it('elk volk op slot wordt vrijgespeeld door een prestatie die bestaat', () => {
    for (const p of PEOPLES.filter(p => p.locked)) {
      const a = ACHIEVEMENT[p.locked.by];
      expect(a, p.k).toBeTruthy();
      expect(a.unlocks && a.unlocks.people, p.k).toBe(p.k);
    }
    // En andersom: een prestatie speelt alleen een volk vrij dat op slot zit, met die prestatie
    for (const a of ACHIEVEMENTS.filter(a => a.unlocks)) {
      const people = PEOPLE[a.unlocks.people];
      expect(people && people.locked && people.locked.by, a.k).toBe(a.k);
    }
  });

  it('er zijn geheime prestaties, maar niet te veel', () => {
    const hidden = ACHIEVEMENTS.filter(a => a.hidden);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.length).toBeLessThan(ACHIEVEMENTS.length / 4);
  });
});

describe('prestaties: wanneer haal je ze?', () => {
  it('een leeg spel levert niets op', () => {
    expect(newAchievements(emptyFacts(), {})).toEqual([]);
  });

  it('de Industriële tijd bereiken geeft alle tijdperken tot en met die', () => {
    expect(newAchievements(facts({ age: 5, day: 30 }), {})).toEqual(['age1', 'age2', 'age3', 'age4', 'age5']);
  });

  it('wat je al hebt, krijg je niet nog een keer', () => {
    expect(newAchievements(facts({ age: 2 }), { age1: 123 })).toEqual(['age2']);
  });

  it('winnen met het laatste volk geeft ook "Alle volken"', () => {
    const have = {};
    for (const p of PEOPLES.slice(0, -1)) have[`win_${p.k}`] = 1;
    const last = PEOPLES[PEOPLES.length - 1].k;
    const earned = newAchievements(facts({ won: true, people: last, builtWalls: true, day: 80 }), have);
    expect(earned).toContain(`win_${last}`);
    expect(earned).toContain('win_all');
    expect(earned).toContain('win');
    expect(earned).not.toContain('win_fast');
    expect(earned).not.toContain('win_walls');
  });

  it('winnen op Zwaar telt niet als de vredige modus aan staat', () => {
    expect(ACHIEVEMENT.win_hard.when(facts({ won: true, diff: 2 }))).toBe(true);
    expect(ACHIEVEMENT.win_hard.when(facts({ won: true, diff: 2, peaceful: true }))).toBe(false);
    expect(ACHIEVEMENT.win_hard.when(facts({ won: true, diff: 1 }))).toBe(false);
  });

  it('alle kampen veroverd telt pas als er kampen waren en er geen meer over zijn', () => {
    expect(ACHIEVEMENT.camps_all.when(facts({ camps: 6, campsLeft: 0 }))).toBe(true);
    expect(ACHIEVEMENT.camps_all.when(facts({ camps: 5, campsLeft: 1 }))).toBe(false);
    expect(ACHIEVEMENT.camps_all.when(facts({ camps: 0, campsLeft: 0 }))).toBe(false);
  });

  it('de Middeleeuwen binnen 12 dagen is een geheime prestatie', () => {
    expect(newAchievements(facts({ age: 3, day: 12 }), {})).toContain('swift');
    expect(newAchievements(facts({ age: 3, day: 13 }), {})).not.toContain('swift');
  });

  it('verliezen geeft de geheime troostprijs', () => {
    expect(newAchievements(facts({ lost: true }), {})).toEqual(['fallen']);
  });
});

describe('prestaties: alle gebouwen van een tijdperk', () => {
  it('elke bouwbare soort staat bij precies één tijdperk; stamhuis en paden niet', () => {
    const all = AGE_BUILDINGS.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain('townhall');
    expect(all).not.toContain('road');
    for (const k of all) expect(AGE_BUILDINGS[B[k].age], k).toContain(k);
  });

  it('fullAge geeft het hoogste complete tijdperk', () => {
    expect(fullAge([])).toBe(-1);
    expect(fullAge(AGE_BUILDINGS[0])).toBe(0);
    expect(fullAge([...AGE_BUILDINGS[0], ...AGE_BUILDINGS[3]])).toBe(3);
    // Eén gebouw te weinig: dan telt dat tijdperk niet
    expect(fullAge(AGE_BUILDINGS[3].slice(1))).toBe(-1);
    expect(fullAge(new Set(AGE_BUILDINGS[4]))).toBe(4);
  });
});

describe('score', () => {
  it('rekent tijdperk, kampen, vijanden en dagen mee', () => {
    const s = gameScore({ age: 8, camps: 6, kills: 300, days: 60, diff: 1 });
    // 8×1000 + 6×200 + 300×5 − 60×15
    expect(s.sum).toBe(8000 + 1200 + 1500 - 900);
    expect(s.total).toBe(9800);
    expect(s.factor).toBe(1);
    expect(s.medal.k).toBe('zilver');
    expect(s.rows.map(r => r.k)).toEqual(['age', 'wonders', 'camps', 'kills', 'days']);
    expect(s.rows.find(r => r.k === 'days').pts).toBe(-900);
  });

  it('wonderen tellen 500 punten', () => {
    expect(gameScore({ wonders: 2 }).total).toBe(1000);
  });

  it('gaat nooit onder 0', () => {
    const s = gameScore({ age: 0, days: 50 });
    // De echte som staat er ook bij, zodat het eindscherm kan uitleggen waarom het 0 is
    expect(s.raw).toBe(-750);
    expect(s.sum).toBe(0);
    expect(s.total).toBe(0);
    expect(s.medal).toBe(null);
  });

  it('moeilijkheid vermenigvuldigt de score', () => {
    const base = { age: 4, camps: 2, kills: 40, days: 20 };
    const normal = gameScore({ ...base, diff: 1 }).total;
    expect(gameScore({ ...base, diff: 0 }).total).toBe(Math.round(normal * DIFF_FACTOR[0]));
    expect(gameScore({ ...base, diff: 2 }).total).toBe(Math.round(normal * DIFF_FACTOR[2]));
    expect(DIFF_FACTOR[0]).toBeLessThan(DIFF_FACTOR[1]);
    expect(DIFF_FACTOR[1]).toBeLessThan(DIFF_FACTOR[2]);
    expect(DIFF_NAMES.length).toBe(DIFF_FACTOR.length);
  });

  it('medailles: brons, zilver en goud op volgorde', () => {
    expect(MEDALS.map(m => m.k)).toEqual(['goud', 'zilver', 'brons']);
    expect(medalFor(0)).toBe(null);
    expect(medalFor(MEDALS[2].min - 1)).toBe(null);
    expect(medalFor(MEDALS[2].min).k).toBe('brons');
    expect(medalFor(MEDALS[1].min).k).toBe('zilver');
    expect(medalFor(MEDALS[0].min + 5000).k).toBe('goud');
  });

  it('een snelle overwinning met kampen is goud, een vroeg verlies hooguit brons', () => {
    expect(gameScore({ age: 8, camps: 6, kills: 400, days: 40 }).medal.k).toBe('goud');
    const early = gameScore({ age: 3, camps: 2, kills: 50, days: 20 });
    expect(['brons', undefined]).toContain(early.medal && early.medal.k);
  });
});

describe('profiel', () => {
  it('een kapot of leeg profiel wordt een leeg profiel', () => {
    expect(normalizeProfile(null)).toEqual(emptyProfile());
    expect(normalizeProfile('onzin')).toEqual(emptyProfile());
    const p = normalizeProfile({ games: 'drie', achievements: [], best: { score: 500 }, recent: 4 });
    expect(p.games).toBe(0);
    expect(p.achievements).toEqual({});
    expect(p.best.score).toBe(500);
    expect(p.best.perPeople).toEqual({});
    expect(p.recent).toEqual([]);
  });

  it('een goed profiel blijft zoals het was', () => {
    const p = emptyProfile();
    p.games = 3;
    p.wins = 1;
    p.achievements.age1 = 1000;
    p.unlockedPeoples.push('bergvolk');
    expect(normalizeProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('een prestatie en een volk tellen maar één keer', () => {
    const p = emptyProfile();
    expect(addAchievement(p, 'age1', 5)).toBe(true);
    expect(addAchievement(p, 'age1', 9)).toBe(false);
    expect(p.achievements.age1).toBe(5);
    expect(addPeople(p, 'nomaden')).toBe(true);
    expect(addPeople(p, 'nomaden')).toBe(false);
    expect(p.unlockedPeoples).toEqual(['nomaden']);
  });

  it('een vrijgespeeld volk in het profiel is te kiezen', () => {
    const p = emptyProfile();
    expect(isPeopleUnlocked('nomaden', p)).toBe(false);
    addPeople(p, 'nomaden');
    expect(isPeopleUnlocked('nomaden', p)).toBe(true);
    // Met alleen de prestatie (zonder lijst) ook
    expect(isPeopleUnlocked('bergvolk', { achievements: { age3: 1 } })).toBe(true);
  });

  it('houdt beste scores, overwinningen en de laatste spellen bij', () => {
    const p = emptyProfile();
    const game = { score: 4000, medal: 'brons', won: false, age: 4, day: 30, people: 'hanze', diff: 1 };
    expect(addResult(p, game, 1)).toBe(true);
    expect(addResult(p, { ...game, score: 3000, people: 'norse', diff: 2 }, 2)).toBe(false);
    expect(addResult(p, { ...game, score: 12000, won: true }, 3)).toBe(true);
    expect(p.best.score).toBe(12000);
    expect(p.best.perPeople).toEqual({ hanze: 12000, norse: 3000 });
    expect(p.best.perDiff).toEqual({ 1: 12000, 2: 3000 });
    expect(p.wins).toBe(1);
    expect(p.recent.map(g => g.at)).toEqual([3, 2, 1]);
    for (let i = 0; i < 20; i++) addResult(p, game);
    expect(p.recent.length).toBeLessThanOrEqual(10);
  });
});
