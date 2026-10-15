// Tests voor het nieuw-spelscherm: zaadcodes, moeilijkheden, kaartsoorten en manieren om te winnen.
import { describe, expect, it } from 'vitest';
import { AGES } from '../src/data/ages.js';
import { DEFAULT_DIFF, DIFFICULTIES, cleanDiff, difficulty } from '../src/data/difficulty.js';
import { DEFAULT_MAP, MAP, MAPS, cleanMap } from '../src/data/maps.js';
import { DIFF_FACTOR, DIFF_NAMES } from '../src/data/score.js';
import {
  DEFAULT_VICTORIES,
  SELECTABLE_VICTORIES,
  SHORT_AGE,
  SURVIVE_NIGHTS,
  WONDER_GOAL,
  VICTORIES,
  VICTORY,
  cleanVictories,
  reachedVictory,
  victoryAllowed,
} from '../src/data/victories.js';
import {
  CODE_LEN,
  SEED_MAX,
  cleanCode,
  codeFromSeed,
  randomSeed,
  seedFromCode,
} from '../src/util/seedcode.js';

describe('zaadcodes', () => {
  it('code → seed → code geeft hetzelfde terug', () => {
    const seeds = [0, 1, 31, 32, 1023, 1024, 424242, SEED_MAX - 1, SEED_MAX, 999999999];
    for (let k = 0; k < 500; k++) seeds.push(Math.floor(Math.random() * 2 ** 30));
    for (const seed of seeds) {
      const code = codeFromSeed(seed);
      expect(code, String(seed)).toMatch(/^TP-[0-9A-Z]{4,6}$/);
      expect(seedFromCode(code), code).toBe(seed);
    }
  });

  it('nieuwe werelden hebben een code van vier tekens', () => {
    for (let k = 0; k < 200; k++) {
      const seed = randomSeed();
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThan(SEED_MAX);
      expect(codeFromSeed(seed)).toHaveLength(3 + CODE_LEN);
    }
    expect(randomSeed(() => 0)).toBe(1);
    expect(randomSeed(() => 0.999999)).toBeLessThan(SEED_MAX);
  });

  it('vergeeft kleine typfoutjes', () => {
    const seed = seedFromCode('TP-7K2Q');
    expect(seed).not.toBeNull();
    for (const typed of ['tp-7k2q', ' TP 7K2Q ', 'TP7K2Q', '7K2Q', '7k-2q'])
      expect(seedFromCode(typed), typed).toBe(seed);
    // O lijkt op 0, I en L lijken op 1
    expect(seedFromCode('TP-O1I0')).toBe(seedFromCode('TP-0110'));
    expect(seedFromCode('TP-L000')).toBe(seedFromCode('TP-1000'));
    // U lijkt op V: zo werken ook codes die op een woord lijken, zoals TP-HUIS
    expect(seedFromCode('TP-HUIS')).toBe(seedFromCode('TP-HV1S'));
    expect(cleanCode('tp-muur')).toBe('TP-MVVR');
    // Zonder streepje mag "TP" ook gewoon bij de code horen
    expect(seedFromCode('TPAB')).toBe(seedFromCode('TP-TPAB'));
    expect(cleanCode('tp 7k2q')).toBe('TP-7K2Q');
  });

  it('weigert wat geen code is', () => {
    for (const bad of ['', 'TP-', 'TP-7K2Q!', 'TP-ABCDEFG', 'hallo wereld', 'TP-7K2#', null, undefined])
      expect(seedFromCode(bad), String(bad)).toBeNull();
    expect(cleanCode('???')).toBeNull();
    // Een teken te weinig na "TP-" is fout, en niet stilletjes de code van een andere wereld
    for (const short of ['TP-7K2', 'TP-7K', 'tp 7k2', 'TP 7K']) expect(seedFromCode(short), short).toBeNull();
  });
});

describe('moeilijkheden', () => {
  it('vier moeilijkheden, van Vredig tot Meedogenloos', () => {
    expect(DIFFICULTIES.map(d => d.n)).toEqual(['Vredig', 'Normaal', 'Zwaar', 'Meedogenloos']);
    expect(DIFF_NAMES).toEqual(DIFFICULTIES.map(d => d.n));
    expect(DIFF_FACTOR).toEqual(DIFFICULTIES.map(d => d.score));
    expect(DIFFICULTIES[0].peaceful).toBe(true);
    expect(DIFFICULTIES.slice(1).every(d => !d.peaceful)).toBe(true);
  });

  it('elke stap is zwaarder: grotere en taaiere aanvallen, minder om mee te beginnen', () => {
    for (let i = 2; i < DIFFICULTIES.length; i++) {
      const easier = DIFFICULTIES[i - 1],
        harder = DIFFICULTIES[i];
      expect(harder.raidSize * harder.raidHp, harder.n).toBeGreaterThan(easier.raidSize * easier.raidHp);
      expect(harder.raidMax, harder.n).toBeGreaterThanOrEqual(easier.raidMax);
      for (const r of Object.keys(easier.start))
        expect(harder.start[r], `${harder.n}.${r}`).toBeLessThan(easier.start[r]);
      expect(harder.score, harder.n).toBeGreaterThan(easier.score);
    }
    expect(DIFFICULTIES[3].everyNight).toBe(true);
  });

  it('een onbekende moeilijkheid wordt Normaal', () => {
    expect(cleanDiff(3)).toBe(3);
    expect(cleanDiff(7)).toBe(DEFAULT_DIFF);
    expect(cleanDiff('2')).toBe(DEFAULT_DIFF);
    expect(cleanDiff(undefined)).toBe(DEFAULT_DIFF);
    expect(difficulty(-1)).toBe(DIFFICULTIES[DEFAULT_DIFF]);
  });
});

describe('kaartsoorten', () => {
  it('drie kaartsoorten met een naam, uitleg en instellingen', () => {
    expect(MAPS.map(m => m.k)).toEqual(['continent', 'islands', 'highlands']);
    for (const m of MAPS) {
      expect(m.n.length, m.k).toBeGreaterThan(3);
      expect(m.d.length, m.k).toBeGreaterThan(10);
      const { sea, shore, hill, peak } = m.gen.levels;
      expect(sea < shore && shore < hill && hill < peak && peak < 1, m.k).toBe(true);
    }
    expect(MAP[DEFAULT_MAP]).toBeTruthy();
    expect(cleanMap('mars')).toBe(DEFAULT_MAP);
    expect(cleanMap('islands')).toBe('islands');
  });
});

describe('manieren om te winnen', () => {
  // Feiten zoals game/victory.js ze verzamelt, met wat er voor deze test toe doet
  const facts = (over = {}) => ({
    age: 0,
    day: 1,
    stargate: false,
    stargateBusy: false,
    campsLeft: 6,
    wonders: 0,
    place: 'Ergens',
    ageName: AGES[0].n,
    ...over,
  });

  it('elke overwinning is compleet', () => {
    expect(new Set(VICTORIES.map(v => v.k)).size).toBe(VICTORIES.length);
    for (const v of VICTORIES) {
      expect(v.n.length, v.k).toBeGreaterThan(3);
      expect(v.d.length, v.k).toBeGreaterThan(8);
      expect(typeof v.frac, v.k).toBe('function');
      expect(typeof v.text(facts()), v.k).toBe('string');
      expect(v.end.title.length, v.k).toBeGreaterThan(3);
      expect(v.end.story(facts({ day: 12 })), v.k).toContain('Ergens');
    }
    // Gewone taal: "in 1 dag", niet "in 1 dagen"
    expect(VICTORY.age.end.story(facts({ day: 1 }))).toContain('in 1 dag.');
    expect(VICTORY.stargate.end.story(facts({ day: 40 }))).toContain('in 40 dagen.');
  });

  it('nu te kiezen: sterrenpoort, overleven, kort spel, verovering en wonderen', () => {
    expect(SELECTABLE_VICTORIES.map(v => v.k)).toEqual(['stargate', 'survive', 'age', 'conquest', 'wonders']);
    expect(VICTORY.conquest.soon).toBeFalsy();
    expect(VICTORY.wonders.soon).toBeFalsy();
    expect(DEFAULT_VICTORIES).toEqual(['stargate']);
    // Alleen de sterrenpoort telt als volledige overwinning voor prestaties
    expect(VICTORIES.filter(v => v.full).map(v => v.k)).toEqual(['stargate']);
  });

  it('verovering kan alleen met rivalen, en is gewonnen als ze allemaal verslagen zijn', () => {
    // Zonder rivalen valt verovering weg (en blijft er altijd een doel over)
    expect(cleanVictories(['conquest'])).toEqual(DEFAULT_VICTORIES);
    expect(cleanVictories(['conquest', 'age'], 0)).toEqual(['age']);
    expect(cleanVictories(['conquest', 'age'], 2)).toEqual(['age', 'conquest']);
    expect(victoryAllowed(VICTORY.conquest, 0)).toBe(false);
    expect(victoryAllowed(VICTORY.conquest, 1)).toBe(true);
    expect(reachedVictory(['conquest'], facts({ rivals: 2, rivalsBeaten: 1 }))).toBeNull();
    expect(reachedVictory(['conquest'], facts({ rivals: 2, rivalsBeaten: 2 }))).toBe('conquest');
    expect(VICTORY.conquest.text(facts({ rivals: 3, rivalsBeaten: 1 }))).toBe('1 van 3 verslagen');
    // Zonder rivalen win je er nooit mee
    expect(VICTORY.conquest.frac(facts({ rivals: 0, rivalsBeaten: 0 }))).toBe(0);
  });

  it('een gekozen lijst wordt netjes gemaakt, en is nooit leeg', () => {
    expect(cleanVictories(['age', 'stargate', 'age'])).toEqual(['stargate', 'age']);
    expect(cleanVictories(['conquest', 'onzin'])).toEqual(DEFAULT_VICTORIES);
    expect(cleanVictories(['conquest', 'wonders'])).toEqual(['wonders']);
    expect(cleanVictories([])).toEqual(DEFAULT_VICTORIES);
    expect(cleanVictories('stargate')).toEqual(DEFAULT_VICTORIES);
    expect(cleanVictories(['survive', 'onzin'])).toEqual(['survive']);
  });

  it('sterrenpoort: pas gewonnen als hij af is', () => {
    expect(reachedVictory(['stargate'], facts({ age: 8, stargateBusy: true }))).toBeNull();
    expect(reachedVictory(['stargate'], facts({ age: 8, stargate: true }))).toBe('stargate');
    expect(VICTORY.stargate.frac(facts({ age: 8 }))).toBeLessThan(1);
    expect(VICTORY.stargate.text(facts({ age: 8, stargateBusy: true }))).toBe('in aanbouw');
  });

  it(`wonderen: gewonnen met ${WONDER_GOAL} wereldwonderen tegelijk`, () => {
    expect(WONDER_GOAL).toBe(4);
    expect(reachedVictory(['wonders'], facts({ wonders: WONDER_GOAL - 1 }))).toBeNull();
    expect(reachedVictory(['wonders'], facts({ wonders: WONDER_GOAL }))).toBe('wonders');
    expect(VICTORY.wonders.text(facts({ wonders: 1 }))).toBe(`1 van ${WONDER_GOAL} wonderen`);
    // Geen volledige overwinning: de prestaties voor winnen horen bij de sterrenpoort
    expect(VICTORY.wonders.full).toBeFalsy();
  });

  it(`overleven: gewonnen na ${SURVIVE_NIGHTS} nachten`, () => {
    expect(reachedVictory(['survive'], facts({ day: SURVIVE_NIGHTS }))).toBeNull();
    expect(reachedVictory(['survive'], facts({ day: SURVIVE_NIGHTS + 1 }))).toBe('survive');
    expect(VICTORY.survive.text(facts({ day: 13 }))).toBe(`12 van ${SURVIVE_NIGHTS} nachten`);
  });

  it('kort spel: gewonnen in de Gouden Eeuw', () => {
    expect(AGES[SHORT_AGE].n).toBe('Gouden Eeuw');
    expect(reachedVictory(['age'], facts({ age: SHORT_AGE - 1 }))).toBeNull();
    expect(reachedVictory(['age'], facts({ age: SHORT_AGE }))).toBe('age');
    // Wat er nog over is, niet "tijdperk 1 van 5" (dat leest alsof het spel vijf tijdperken heeft)
    expect(VICTORY.age.text(facts({ age: SHORT_AGE - 1 }))).toBe('nog 1 tijdperk');
    expect(VICTORY.age.text(facts({ age: 0 }))).toBe(`nog ${SHORT_AGE} tijdperken`);
    // Niet gekozen = telt niet
    expect(reachedVictory(['stargate'], facts({ age: SHORT_AGE }))).toBeNull();
  });

  it('wie meerdere doelen kiest, wint met wat het eerst lukt', () => {
    const both = ['stargate', 'survive', 'age'];
    expect(reachedVictory(both, facts({ age: 2, day: 40 }))).toBe('survive');
    expect(reachedVictory(both, facts({ age: 4, day: 20 }))).toBe('age');
    expect(reachedVictory(both, facts({ age: 3, day: 20 }))).toBeNull();
  });

  it('voortgang ligt altijd tussen 0 en 1', () => {
    for (const v of VICTORIES)
      for (const f of [facts(), facts({ age: 8, day: 99, stargate: true, campsLeft: 0, wonders: 5 })]) {
        const frac = v.frac(f);
        expect(frac, v.k).toBeGreaterThanOrEqual(0);
        expect(frac, v.k).toBeLessThanOrEqual(1);
      }
  });
});
