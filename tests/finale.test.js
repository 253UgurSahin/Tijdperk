// Tests voor de finale (de sterrenpoort die oplaadt) en de kampioenen na elk nieuw tijdperk.
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT, emptyFacts, newAchievements } from '../src/data/achievements.js';
import { AGES } from '../src/data/ages.js';
import { BLESSING, blessingOffer, bossOffer } from '../src/data/blessings.js';
import { BOSSES, BOSS_DMG, BOSS_HP, bossForAge, bossName, cleanPendingBoss } from '../src/data/bosses.js';
import {
  CHARGE_NIGHTS,
  chargeFrac,
  chargeHours,
  chargePercent,
  cleanFinale,
  finaleText,
  nightsLeft,
  resetCharge,
  spreadOut,
} from '../src/data/finale.js';
import { FOES } from '../src/data/units.js';
import { VICTORY, reachedVictory } from '../src/data/victories.js';

describe('kampioenen: de gegevens', () => {
  it('elk tijdperk na de Steentijd heeft precies één kampioen', () => {
    expect(bossForAge(0)).toBeNull();
    for (let age = 1; age < AGES.length; age++) expect(bossForAge(age), AGES[age].n).toBeTruthy();
    expect(BOSSES.length).toBe(AGES.length - 1);
    expect(new Set(BOSSES.map(b => b.age)).size).toBe(BOSSES.length);
  });

  it('elke kampioen heeft een eigen naam, bijnaam en rol, en is een bestaande vijand', () => {
    expect(new Set(BOSSES.map(bossName)).size).toBe(BOSSES.length);
    for (const b of BOSSES) {
      expect(b.n.length, b.n).toBeGreaterThan(2);
      expect(b.title.length, b.n).toBeGreaterThan(3);
      expect(b.role.length, b.n).toBeGreaterThan(8);
      expect(FOES[b.foe], b.n).toBeTruthy();
      // Hij hoort bij zijn eigen tijdperk (of het tijdperk ervoor, nooit een latere vijand)
      expect(b.foe, b.n).toBeLessThanOrEqual(b.age);
    }
  });

  it('de eerste heet Grimnar de Verscheurder', () => {
    expect(bossName(bossForAge(1))).toBe('Grimnar de Verscheurder');
  });

  it('een kampioen is echt sterker: veel meer levens en meer schade', () => {
    expect(BOSS_HP).toBe(6);
    expect(BOSS_DMG).toBe(2);
  });

  it('opslag van de kampioen die nog komt: rommel en oude opslag geven null', () => {
    expect(cleanPendingBoss({ age: 3 })).toEqual({ age: 3 });
    expect(cleanPendingBoss({ age: 3, extra: 1 })).toEqual({ age: 3 });
    for (const bad of [null, undefined, 3, 'x', {}, { age: 0 }, { age: 99 }])
      expect(cleanPendingBoss(bad)).toBeNull();
  });
});

describe('kampioenen: de beloning', () => {
  it('na een kampioen liggen er geen kaarten die je bij de gewone keuze al zag, net zo voorspelbaar', () => {
    // Een heel spel nagespeeld: elk tijdperk de gewone keuze (de eerste kaart), dan de beloning van de kampioen
    for (let seed = 1; seed <= 300; seed++) {
      const history = [];
      for (let age = 1; age < AGES.length; age++) {
        const normal = blessingOffer(seed, age, history).map(b => b.k);
        if (!normal.length) break;
        history.push(normal[(seed + age) % normal.length]);
        const reward = bossOffer(seed, age, history).map(b => b.k);
        expect(reward).toEqual(bossOffer(seed, age, history).map(b => b.k));
        expect(reward.length, `seed ${seed}, tijdperk ${age}`).toBe(3);
        for (const k of reward) expect(normal, `seed ${seed}, tijdperk ${age}`).not.toContain(k);
        history.push(reward[0]);
      }
    }
  });

  it('wat je al koos, komt ook bij de beloning niet terug', () => {
    const taken = blessingOffer(5, 2).map(b => b.k);
    const reward = bossOffer(5, 2, taken).map(b => b.k);
    expect(reward.length).toBe(3);
    for (const k of reward) expect(taken).not.toContain(k);
  });

  it('zijn bijna alle kaarten al gezien, dan komt er toch een volle beloning', () => {
    // Alles gekozen behalve vijf kaarten: dan mogen eerder getoonde kaarten terugkomen
    const all = Object.keys(BLESSING);
    const history = all.slice(0, all.length - 5);
    const reward = bossOffer(9, 8, history).map(b => b.k);
    expect(reward.length).toBe(3);
    for (const k of reward) expect(history).not.toContain(k);
  });

  it('prestaties voor kampioenen', () => {
    expect(ACHIEVEMENT.boss1).toBeTruthy();
    expect(ACHIEVEMENT.bosses4).toBeTruthy();
    expect(newAchievements({ ...emptyFacts(), bosses: 0 })).not.toContain('boss1');
    expect(newAchievements({ ...emptyFacts(), bosses: 1 })).toContain('boss1');
    expect(newAchievements({ ...emptyFacts(), bosses: 3 })).not.toContain('bosses4');
    expect(newAchievements({ ...emptyFacts(), bosses: 4 })).toContain('bosses4');
  });
});

describe('finale: opladen', () => {
  it('laadt op tot de ochtend na twee hele nachten', () => {
    expect(CHARGE_NIGHTS).toBe(2);
    // Om 12 uur af: vannacht en morgennacht, open overmorgen om 6 uur = 42 uur
    expect(chargeHours(12)).toBe(42);
    // Om 5 uur 's ochtends af: de nacht is bijna voorbij en telt niet mee
    expect(chargeHours(5)).toBe(49);
    // Om 22 uur af: deze nacht is al bezig en telt niet mee
    expect(chargeHours(22)).toBe(56);
    // Hoe laat ook: het eindigt altijd om 6 uur 's ochtends
    for (let clock = 0; clock < 24; clock += 0.5) expect((clock + chargeHours(clock)) % 24).toBeCloseTo(6);
  });

  it('nachten die nog komen: aan het begin twee, in de laatste nacht één', () => {
    expect(nightsLeft(12, chargeHours(12), 0)).toBe(2);
    // Om 22 uur af: deze nacht was al bezig en telt niet, dus nog steeds twee
    expect(nightsLeft(22, chargeHours(22), 0)).toBe(2);
    // In de laatste nacht (al lang aan het opladen): nog 1
    expect(nightsLeft(23, 7, 40)).toBe(1);
    expect(nightsLeft(3, 3, 50)).toBe(1);
    expect(nightsLeft(12, 0, 42)).toBe(0);
    // Een hele finale doorlopen, uur voor uur: het aantal nachten loopt van 2 naar 0 en nooit omhoog
    for (const start of [0, 5, 12, 20.5, 21, 22, 23.5]) {
      const need = chargeHours(start);
      expect(nightsLeft(start, need, 0), `start ${start}`).toBe(2);
      let before = 2;
      for (let h = 0; h <= need; h += 0.25) {
        const now = nightsLeft((start + h) % 24, need - h, h);
        expect(now, `start ${start}, na ${h} uur`).toBeLessThanOrEqual(before);
        before = now;
      }
      expect(before).toBe(0);
    }
  });

  it('lading als breuk en als percentage', () => {
    expect(chargeFrac(null)).toBe(0);
    expect(chargeFrac({ hours: 21, need: 42 })).toBe(0.5);
    expect(chargeFrac({ hours: 99, need: 42 })).toBe(1);
    expect(chargeFrac({ hours: 0, need: 0, done: true })).toBe(1);
    expect(chargePercent(0.374)).toBe(37);
    expect(chargePercent(0.999)).toBe(99); // pas 100% als hij echt vol is
    expect(chargePercent(1)).toBe(100);
  });

  it('de tekst van de balk bovenaan', () => {
    // Om 12 uur af en nu 37% verder: het is half vier 's nachts, in de eerste van twee nachten
    const f = { hours: 0.37 * 42, need: 42, done: false };
    expect(finaleText(f, 3.5).title).toBe('Sterrenpoort laadt op: 37%');
    expect(finaleText(f, 3.5).sub).toContain('2 nachten');
    expect(finaleText({ hours: 40, need: 42 }, 4).sub).toContain('1 nacht');
    expect(finaleText({ hours: 0, need: 0 }, 12).title).toBe('Sterrenpoort verwoest');
    expect(finaleText({ hours: 0, need: 0 }, 12, true).sub).toContain('in aanbouw');
  });

  it('in de vredige modus hoef je niet stand te houden: de poort gaat gewoon open', () => {
    const f = { hours: 0.37 * 42, need: 42, done: false };
    expect(finaleText(f, 3.5, false, true).title).toBe('Sterrenpoort laadt op: 37%');
    expect(finaleText(f, 3.5, false, true).sub).toBe('Open over 2 nachten, bij zonsopgang');
    expect(finaleText({ hours: 40, need: 42 }, 4, false, true).sub).toBe('Open bij de volgende zonsopgang');
    for (const clock of [3.5, 12, 23])
      expect(finaleText(f, clock, false, true).sub).not.toMatch(/stand|houd/i);
  });

  it('een verwoeste poort verliest zijn lading', () => {
    const f = { hours: 30, need: 42, rivalsCalled: true, done: false, resets: 0 };
    resetCharge(f);
    expect(f).toMatchObject({ hours: 0, need: 0, rivalsCalled: true });
    expect(chargeFrac(f)).toBe(0);
    expect(finaleText(f, 12).title).toBe('Sterrenpoort verwoest');
  });

  it('opslag: oude opslag heeft geen finale, rommel wordt netjes', () => {
    expect(cleanFinale(undefined)).toBeNull();
    expect(cleanFinale('x')).toBeNull();
    expect(cleanFinale({ hours: 3, need: 42, rivalsCalled: 1, resets: 1 })).toEqual({
      hours: 3,
      need: 42,
      rivalsCalled: true,
      done: false,
      resets: 1,
    });
    expect(cleanFinale({ hours: -5, need: 'veel' })).toMatchObject({ hours: 0, need: 0 });
  });

  it('aanvallen uit drie richtingen liggen ver uit elkaar', () => {
    // Een vierkante rand van 40 bij 40 tegels
    const edge = [];
    for (let i = 0; i < 40; i++) edge.push([i, 0], [i, 39], [0, i], [39, i]);
    const picks = spreadOut(edge, 3, 0);
    expect(picks.length).toBe(3);
    for (let a = 0; a < 3; a++)
      for (let b = a + 1; b < 3; b++)
        expect(Math.hypot(picks[a][0] - picks[b][0], picks[a][1] - picks[b][1])).toBeGreaterThan(25);
    expect(spreadOut(edge, 1, 5)).toEqual([edge[5]]);
    expect(spreadOut([], 3)).toEqual([]);
    expect(spreadOut([[4, 4]], 3)).toEqual([[4, 4]]); // maar één plek: dan één groep
  });
});

describe('finale: winnen met de sterrenpoort', () => {
  const facts = (over = {}) => ({ age: 8, day: 50, stargate: false, stargateBusy: true, ...over });

  it('een afgebouwde poort is nog niet genoeg: hij moet opgeladen zijn', () => {
    expect(reachedVictory(['stargate'], facts({ charging: true, charge: 0.99 }))).toBeNull();
    expect(VICTORY.stargate.frac(facts({ charging: true, charge: 0.99 }))).toBeLessThan(1);
    expect(reachedVictory(['stargate'], facts({ stargate: true, charge: 1 }))).toBe('stargate');
  });

  it('de doelenkaart laat zien hoe vol hij is', () => {
    expect(VICTORY.stargate.text(facts({ charging: true, charge: 0.37 }))).toBe('laadt op: 37%');
    expect(VICTORY.stargate.text(facts())).toBe('in aanbouw');
    // Opladen telt mee voor de voortgang
    expect(VICTORY.stargate.frac(facts({ charging: true, charge: 0.5 }))).toBeGreaterThan(
      VICTORY.stargate.frac(facts()),
    );
  });
});
