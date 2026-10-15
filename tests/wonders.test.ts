// Tests voor de wereldwonderen: één per tijdperk, kloppende kosten en bonussen, en de teksten over de race.
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT, AGE_BUILDINGS, emptyFacts, newAchievements } from '../src/data/achievements';
import { AGES } from '../src/data/ages';
import { BONUS_KEYS } from '../src/data/bonus';
import { B, CATS } from '../src/data/buildings';
import { RES } from '../src/data/resources';
import { PERSONALITIES, PERSONALITY, ageUpValue, costValue, rivalCanBuild } from '../src/data/rivals';
import { gameScore } from '../src/data/score';
import { canMake } from '../src/data/succession';
import {
  RIVAL_BUILD_FACTOR,
  TheWonder,
  WONDERS,
  WONDER_CREW,
  cleanWonders,
  nextFreeWonder,
  ownWonders,
  rivalWonderTime,
  theWonder,
  winBackText,
  wonderBonuses,
  wonderBuildRate,
  wonderBuildTime,
  wonderStartDay,
  wonderStatusText,
} from '../src/data/wonders';

const LAST = AGES.length - 1;

describe('wonderen: gegevens', () => {
  it('precies één wonder per tijdperk, van oud naar nieuw', () => {
    expect(WONDERS.length).toBe(AGES.length);
    WONDERS.forEach((k, age) => expect(B[k].age, k).toBe(age));
  });

  it('elk wonder is 3 bij 3, heeft een eigen categorie, veel leven en een lange bouwtijd', () => {
    expect(CATS.wonder).toBe('Wonderen');
    for (const k of WONDERS) {
      const d = B[k];
      expect(d.size, k).toBe(3);
      expect(d.cat, k).toBe('wonder');
      expect(d.hp, k).toBeGreaterThanOrEqual(2000);
      expect(d.bt, k).toBeGreaterThanOrEqual(120);
      expect(d.bt, k).toBeLessThanOrEqual(180);
      expect(['de', 'het'], k).toContain(d.article);
      expect(d.desc.length, k).toBeGreaterThan(20);
      // Geen gebouw dat je kunt verbeteren of dat iets traint, verdedigt of maakt
      for (const key of ['pop', 'def', 'conv', 'gen', 'train', 'light', 'win', 'nobuild'])
        expect(d[key], `${k}.${key}`).toBeFalsy();
    }
  });

  it('een wonder kost ongeveer drie keer de stap naar het volgende tijdperk', () => {
    for (const k of WONDERS) {
      const age = B[k].age;
      const ratio = costValue(B[k].cost) / ageUpValue(Math.min(age + 1, LAST));
      expect(ratio, k).toBeGreaterThan(2.5);
      expect(ratio, k).toBeLessThan(3.5);
      // Alleen grondstoffen die je in dat tijdperk al hebt
      for (const r of Object.keys(B[k].cost)) expect(RES[r].age, `${k}.${r}`).toBeLessThanOrEqual(age);
    }
  });

  it('een wonder raakt nooit verouderd: oudere wonderen kun je later nog bouwen', () => {
    for (const k of WONDERS)
      for (let age = B[k].age; age <= LAST; age++) expect(canMake(k, age), k).toBe(true);
  });

  it('elke bonus gebruikt bestaande sleutels, en de tekst noemt dezelfde getallen', () => {
    for (const k of WONDERS) {
      const { bonus, perk } = B[k];
      expect(Object.keys(bonus).length, k).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(bonus)) {
        expect(BONUS_KEYS[key], `${k}: ${key}`).toBeTruthy();
        expect(Number.isFinite(value) && value !== 0, `${k}: ${key}`).toBe(true);
        if (BONUS_KEYS[key].flat) continue; // aan/uit-bonussen hebben geen getal in de tekst
        const shown = value === 1 ? 'twee keer' : Math.round(Math.abs(value) * 100) + '%';
        expect(perk, `${k}: ${key}`).toContain(shown);
      }
    }
  });

  it('de wonderen uit de opdracht geven wat ze beloven', () => {
    expect(B.dolmen.bonus['gather.food']).toBe(0.15);
    expect(B.pyramid.bonus['hall.hp']).toBe(0.5);
    expect(B.colosseum.bonus['army.hp']).toBe(0.1);
    expect(B.cathedral.bonus['research.time']).toBe(-0.25);
    expect(B.eastindia.bonus['trader.daily']).toBe(1);
    expect(B.eiffel.bonus.power).toBe(0.2);
    expect(B.deltaworks.bonus['storm.safe']).toBe(1);
    expect(B.deltaworks.bonus.farm).toBe(0.25);
    expect(B.spacestation.bonus['meteor.rate']).toBeGreaterThan(0);
  });

  it('namen met lidwoord, ook met een hoofdletter', () => {
    expect(theWonder('dolmen')).toBe('het Hunebed');
    expect(theWonder('pyramid')).toBe('de Piramide');
    expect(TheWonder('eastindia')).toBe('Het Oost-Indisch Huis');
  });
});

describe('wonderen: wie heeft wat', () => {
  const wonders = {
    dolmen: { by: 'you', day: 4 },
    pyramid: { by: 'wolven', day: 9 },
    eiffel: { by: 'you', day: 30 },
  };

  it('alleen jouw wonderen geven jou hun bonus', () => {
    expect(ownWonders(wonders)).toEqual(['dolmen', 'eiffel']);
    expect(wonderBonuses(wonders)).toEqual([B.dolmen.bonus, B.eiffel.bonus]);
    expect(wonderBonuses({})).toEqual([]);
    expect(wonderBonuses(undefined)).toEqual([]);
  });

  it('opslag wordt netjes gemaakt: oude opslag heeft geen wonderen, rommel valt weg', () => {
    expect(cleanWonders(undefined)).toEqual({});
    expect(cleanWonders('kapot')).toEqual({});
    expect(cleanWonders(wonders)).toEqual(wonders);
    const messy = {
      dolmen: { by: 'you' },
      hut: { by: 'you', day: 2 },
      pyramid: { day: 3 },
      eiffel: { by: '', day: 1 },
    };
    expect(cleanWonders(messy)).toEqual({ dolmen: { by: 'you', day: 1 } });
  });

  it('een Bouwer wil het oudste wonder dat nog vrij is en bij zijn tijdperk past', () => {
    expect(nextFreeWonder(0, new Set())).toBe('dolmen');
    expect(nextFreeWonder(0, new Set(['dolmen']))).toBeNull();
    expect(nextFreeWonder(3, new Set(['dolmen', 'colosseum']))).toBe('pyramid');
    expect(nextFreeWonder(LAST, new Set(WONDERS))).toBeNull();
  });

  it('alleen de Bouwer spaart voor wonderen; in de gewone bouwlijsten staan ze niet', () => {
    expect(PERSONALITY.bouwer.wonders).toBeGreaterThan(0);
    expect(PERSONALITY.bouwer.d).toContain('wonderen');
    for (const p of PERSONALITIES) if (p.k !== 'bouwer') expect(p.wonders, p.k).toBe(0);
    for (const k of WONDERS) expect(rivalCanBuild(k), k).toBe(false);
  });

  it('een rivaal bouwt langzamer dan jij met een gewone ploeg, zodat je tijd hebt om te reageren', () => {
    expect(RIVAL_BUILD_FACTOR).toBeGreaterThan(1);
    for (const k of WONDERS) {
      expect(rivalWonderTime(k), k).toBeGreaterThan(wonderBuildTime(k));
      expect(rivalWonderTime(k), k).toBeLessThanOrEqual(wonderBuildTime(k) * 2);
    }
  });

  it('met een gewone ploeg duurt een wonder 2 tot 3 minuten; meer bouwers helpen, maar steeds minder', () => {
    for (const k of WONDERS) {
      expect(wonderBuildTime(k), k).toBe(B[k].bt);
      expect(wonderBuildTime(k), k).toBeGreaterThanOrEqual(120);
      expect(wonderBuildTime(k), k).toBeLessThanOrEqual(180);
    }
    expect(wonderBuildTime('dolmen', 1)).toBe(208);
    expect(wonderBuildTime('dolmen', 8)).toBe(73);
    // Wat elke bouwer per seconde doet, keer het aantal bouwers, is de snelheid van de hele ploeg
    const speed = n => n * wonderBuildRate(n);
    expect(speed(WONDER_CREW)).toBeCloseTo(1);
    expect(speed(8)).toBeGreaterThan(speed(3));
    expect(speed(8) - speed(7)).toBeLessThan(speed(2) - speed(1));
    expect(wonderBuildRate(0)).toBe(wonderBuildRate(1));
  });

  it('een rivaal spaart pas vanaf dag 10 voor het Hunebed, en later voor nieuwere wonderen', () => {
    expect(wonderStartDay('dolmen')).toBe(10);
    for (let i = 1; i < WONDERS.length; i++)
      expect(wonderStartDay(WONDERS[i])).toBeGreaterThan(wonderStartDay(WONDERS[i - 1]));
  });
});

describe('wonderen: de race in woorden', () => {
  it('vrij, van jou of bezet (en hoe je het terugkrijgt)', () => {
    expect(wonderStatusText(null, [])).toEqual({ text: 'Nog vrij', short: '', tone: '', rival: null });
    expect(wonderStatusText('you', [])).toMatchObject({ text: 'Van jou', tone: 'good' });
    expect(wonderStatusText('wolven', [])).toMatchObject({
      text: 'Al gebouwd door Het Wolvenvolk',
      short: 'bezet',
      tone: 'bad',
      rival: 'wolven',
    });
    expect(winBackText('dolmen', 'wolven')).toBe(
      'Verwoest het, of versla Het Wolvenvolk: dan is het weer te krijgen.',
    );
    expect(winBackText('deltaworks', 'zout')).toBe(
      'Verwoest ze, of versla De Zoutkoningen: dan zijn ze weer te krijgen.',
    );
  });

  it('wie eraan bouwt, met hoe ver ze zijn en wiens voortgang het is', () => {
    expect(wonderStatusText(null, [{ by: 'wolven', frac: 0.4 }])).toEqual({
      text: 'Wordt gebouwd door Het Wolvenvolk (40%)',
      short: '40%',
      tone: 'warn',
      rival: 'wolven',
    });
    expect(wonderStatusText(null, [{ by: 'you', frac: 0.255 }])).toMatchObject({
      text: 'Jij bouwt eraan: 25%',
      short: 'jij 25%',
      tone: '',
    });
    // Een race: de rivaal die het verst is, telt
    const race = wonderStatusText(null, [
      { by: 'you', frac: 0.3 },
      { by: 'zout', frac: 0.1 },
      { by: 'wolven', frac: 0.62 },
    ]);
    expect(race.text).toBe('Race: Het Wolvenvolk 62%, jij 30%');
    expect(race.tone).toBe('warn');
    expect(race.rival).toBe('wolven');
  });

  it('een rivaal die ervoor spaart, zie je al voordat hij begint', () => {
    expect(wonderStatusText(null, [], [{ by: 'zout', frac: 0.7 }])).toEqual({
      text: 'Nog vrij, maar De Zoutkoningen sparen ervoor: 70%',
      short: 'spaart',
      tone: 'warn',
      rival: 'zout',
    });
    const both = wonderStatusText(null, [{ by: 'you', frac: 0.2 }], [{ by: 'wolven', frac: 0.55 }]);
    expect(both.text).toBe('Jij bouwt eraan: 20%. Het Wolvenvolk spaart ervoor: 55%');
    expect(both.tone).toBe('warn');
  });
});

describe('wonderen: prestaties, score en de prestatie Bouwmeester', () => {
  it('vier prestaties voor wonderen', () => {
    const f = changes => ({ ...emptyFacts(), ...changes });
    expect(newAchievements(f({ wondersBuilt: 1, wonders: 1 }))).toContain('wonder1');
    expect(newAchievements(f({ wonders: 4 }))).toContain('wonders4');
    expect(newAchievements(f({ wonders: 3 }))).not.toContain('wonders4');
    expect(newAchievements(f({ wonderRaces: 1 }))).toContain('wonder_race');
    expect(newAchievements(f({ wondersTaken: 1 }))).toContain('wonder_taken');
    for (const k of ['wonder1', 'wonders4', 'wonder_race', 'wonder_taken'])
      expect(ACHIEVEMENT[k], k).toBeTruthy();
  });

  it('elk wonder is 500 punten waard', () => {
    expect(gameScore({ wonders: 3 }).rows.find(r => r.k === 'wonders').pts).toBe(1500);
  });

  it('wonderen tellen niet mee voor "alle gebouwen van een tijdperk" (een rivaal kan ze afpakken)', () => {
    for (const k of WONDERS) expect(AGE_BUILDINGS.flat(), k).not.toContain(k);
  });
});
