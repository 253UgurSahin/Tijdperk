// Tests voor uitdagingen: spelregels, de wereld van de dag, medailles en wat er in het profiel komt.
import type { GameRecord } from '../src/types';
import type { ScenarioMedals, ScenarioPlan } from '../src/data/scenarios';
import { describe, expect, it } from 'vitest';
import { addChallengeResult, emptyProfile, normalizeProfile } from '../src/core/profile';
import { AGES } from '../src/data/ages';
import { BONUS_KEYS } from '../src/data/bonus';
import { BLESSINGS, blessingOffer } from '../src/data/blessings';
import { B } from '../src/data/buildings';
import { DIFFICULTIES } from '../src/data/difficulty';
import { MAP } from '../src/data/maps';
import {
  MODIFIER,
  MODIFIERS,
  cleanMods,
  modifierBonuses,
  modsHaveRule,
  seasonIndex,
} from '../src/data/modifiers';
import { PEOPLE } from '../src/data/peoples';
import { RES } from '../src/data/resources';
import { CHALLENGE_POINTS, gameScore } from '../src/data/score';
import {
  DAILY,
  DAILY_PLANS,
  GOAL_ICON,
  SCENARIO,
  SCENARIOS,
  betterMedal,
  challengeMedal,
  challengeMinutes,
  cleanScenarioState,
  clockText,
  dailyWorld,
  dateKey,
  goalProgress,
  goalText,
  medalRuleText,
  scenarioDef,
  startOptions,
  textSeed,
} from '../src/data/scenarios';
import { SEED_MAX } from '../src/util/seedcode';

/** Een uitdaging of een plan voor de wereld van de dag; alleen een uitdaging heeft een sleutel (k). */
type AnyPlan = ScenarioPlan & { k?: string };

// Elke dag van een jaar als "2026-01-01", "2026-01-02", ...
const yearOfDates = () => {
  const dates = [];
  for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1))
    dates.push(dateKey(d));
  return dates;
};

describe('spelregels', () => {
  it('elke regel heeft een sleutel, naam, uitleg en iets dat hij doet', () => {
    expect(MODIFIERS.length).toBeGreaterThanOrEqual(10);
    for (const m of MODIFIERS) {
      expect(MODIFIER[m.k], m.k).toBe(m);
      expect(m.n.length, m.k).toBeGreaterThan(2);
      expect(m.d.length, m.k).toBeGreaterThan(10);
      expect(m.d.endsWith('.'), `${m.k}: geen punt aan het eind (de interface zet hem erachter)`).toBe(false);
      expect(typeof m.hard, m.k).toBe('boolean');
      expect(m.bonus || m.rule, `${m.k} doet niets`).toBeTruthy();
      for (const key of Object.keys(m.bonus || {})) expect(BONUS_KEYS[key], `${m.k}: ${key}`).toBeTruthy();
    }
    // Er zijn regels die het moeilijker maken én regels die helpen (voor de wereld van de dag)
    expect(MODIFIERS.some(m => m.hard)).toBe(true);
    expect(MODIFIERS.some(m => !m.hard)).toBe(true);
  });

  it('opruimen: alleen bestaande regels, elk één keer', () => {
    expect(cleanMods(['longWinter', 'bestaatniet', 'longWinter', 'noArmy'])).toEqual([
      'longWinter',
      'noArmy',
    ]);
    expect(cleanMods(undefined)).toEqual([]);
    expect(cleanMods('noArmy')).toEqual([]);
  });

  it('bonussen en vlaggen komen uit de regels', () => {
    expect(modifierBonuses(['bigRaids', 'longWinter'])).toEqual([{ 'raid.size': 0.5 }]);
    expect(modsHaveRule(['noArmy'], 'noArmy')).toBe(true);
    expect(modsHaveRule(['bigRaids'], 'noArmy')).toBe(false);
    expect(modsHaveRule(null, 'noArmy')).toBe(false);
    // Gesloten grenzen is een echte regel: geen handelaars, ook niet bij een volk dat ze vaker laat komen
    expect(modsHaveRule(['noTrade'], 'noTrade')).toBe(true);
    // Gesloten grenzen heeft wel bonussen, alleen deze niet
    expect(MODIFIER.noTrade.bonus!['trader.rate']).toBeUndefined();
  });

  it('seizoenen: gewoon 4 dagen elk, met Lange winter 6 dagen winter', () => {
    const normal = Array.from({ length: 16 }, (_, i) => seasonIndex(i + 1));
    expect(normal).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
    expect(seasonIndex(17)).toBe(0); // een nieuw jaar
    const long = Array.from({ length: 12 }, (_, i) => seasonIndex(i + 1, true));
    expect(long).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3]);
    expect(seasonIndex(13, true)).toBe(0);
  });

  it('zonder leger zijn er geen legerkaarten bij de zegeningen', () => {
    const army = new Set(BLESSINGS.filter(b => b.cat === 'army').map(b => b.k));
    for (let seed = 1; seed < 60; seed++)
      for (let age = 0; age < AGES.length; age++) {
        const cards = blessingOffer(seed, age, [], { noArmy: true });
        expect(cards.length).toBe(3);
        expect(cards.some(card => army.has(card.k))).toBe(false);
      }
  });
});

describe('uitdagingen', () => {
  it('ongeveer tien uitdagingen met een geldig doel, begin en verhaal', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10);
    const seeds = new Set();
    for (const s of SCENARIOS) {
      expect(SCENARIO[s.k], s.k).toBe(s);
      expect(s.k).not.toBe(DAILY);
      // Twee zinnen
      expect(s.story.split(/[.!?](\s|$)/).filter(t => t && t.trim()).length, s.k).toBe(2);
      expect(GOAL_ICON[s.goal.type], s.k).toBeTruthy();
      expect(goalText(s.goal).length, s.k).toBeGreaterThan(5);
      expect(AGES[s.startAge], s.k).toBeTruthy();
      expect(DIFFICULTIES[s.diff], s.k).toBeTruthy();
      expect(MAP[s.map], s.k).toBeTruthy();
      expect(cleanMods(s.modifiers), s.k).toEqual(s.modifiers);
      expect(s.seed).toBeGreaterThan(0);
      expect(s.seed).toBeLessThan(SEED_MAX);
      seeds.add(s.seed);
      // Een vast volk moet iedereen hebben (niet op slot)
      if (s.people) expect(PEOPLE[s.people] && !PEOPLE[s.people].locked, s.k).toBe(true);
      for (const r of Object.keys(s.startRes || {})) {
        expect(RES[r], `${s.k}: ${r}`).toBeTruthy();
        expect(RES[r].age, `${s.k}: ${r} bestaat al bij het begin`).toBeLessThanOrEqual(s.startAge);
      }
      // Een doel dat nog te halen is
      if (s.goal.type === 'age') {
        expect(s.goal.value, s.k).toBeGreaterThan(s.startAge);
        expect(s.goal.value, s.k).toBeLessThan(AGES.length);
      }
      if (s.goal.type === 'build') expect(B[s.goal.value], s.k).toBeTruthy();
      // Geen leger en toch kampen veroveren kan niet
      for (const k of s.modifiers) expect(MODIFIER[k].not || [], `${s.k}: ${k}`).not.toContain(s.goal.type);
    }
    expect(seeds.size, 'elke uitdaging een eigen wereld').toBe(SCENARIOS.length);
  });

  it('elke uitdaging duurt tussen de 20 en 45 minuten', () => {
    for (const s of SCENARIOS) {
      const minutes = challengeMinutes(s);
      expect(minutes, s.k).toBeGreaterThanOrEqual(20);
      expect(minutes, s.k).toBeLessThanOrEqual(45);
    }
  });

  it('medaillegrenzen lopen netjes op: goud strenger dan zilver, zilver strenger dan brons', () => {
    for (const s of [...SCENARIOS, ...DAILY_PLANS] as AnyPlan[]) {
      const m = s.medals;
      const name = s.k || goalText(s.goal);
      expect(['time', 'lost'], name).toContain(m.by);
      expect(m.goud, name).toBeLessThan(m.zilver);
      expect(m.zilver, name).toBeLessThan(m.brons);
      expect(m.goud, name).toBeGreaterThanOrEqual(0);
      // Met een tijdsgrens: brons is precies op tijd, dus wie het haalt, krijgt altijd een medaille
      if (m.by === 'time') expect(m.brons, name).toBe(s.timeLimit);
      else expect(s.goal.type, name).toBe('survive');
    }
  });

  it('de medaille hoort bij de tijd of het verlies', () => {
    const time: ScenarioMedals = { by: 'time', goud: 600, zilver: 900, brons: 1200 };
    expect(challengeMedal(time, { won: true, time: 500 })).toBe('goud');
    expect(challengeMedal(time, { won: true, time: 600 })).toBe('goud');
    expect(challengeMedal(time, { won: true, time: 601 })).toBe('zilver');
    expect(challengeMedal(time, { won: true, time: 1200 })).toBe('brons');
    expect(challengeMedal(time, { won: true, time: 1300 })).toBe('');
    expect(challengeMedal(time, { won: false, time: 100 })).toBe('');
    const lost: ScenarioMedals = { by: 'lost', goud: 0, zilver: 3, brons: 8 };
    expect(challengeMedal(lost, { won: true, time: 99999, lost: 0 })).toBe('goud');
    expect(challengeMedal(lost, { won: true, lost: 3 })).toBe('zilver');
    expect(challengeMedal(lost, { won: true, lost: 8 })).toBe('brons');
    expect(challengeMedal(lost, { won: true, lost: 9 })).toBe('');
    expect(betterMedal('brons', 'goud')).toBe('goud');
    expect(betterMedal('', 'zilver')).toBe('zilver');
    expect(betterMedal('zilver', '')).toBe('zilver');
    expect(medalRuleText(time, 'goud')).toBe('binnen 10 min');
    expect(medalRuleText(lost, 'goud')).toBe('niets verloren');
    expect(medalRuleText(lost, 'brons')).toBe('hoogstens 8 verloren');
  });

  it('voortgang naar het doel', () => {
    const f = { age: 2, startAge: 1, day: 6, pop: 12, camps: 1, built: ['farm'], placed: ['farm', 'market'] };
    expect(goalProgress({ type: 'age', value: 3 }, f)).toEqual({ frac: 0.5, text: 'nog 1 tijdperk' });
    expect(goalProgress({ type: 'age', value: 2 }, f).frac).toBe(1);
    expect(goalProgress({ type: 'survive', value: 10 }, f)).toEqual({
      frac: 0.5,
      text: '5 van 10 nachten',
      short: '5/10',
    });
    expect(goalProgress({ type: 'pop', value: 24 }, f)).toMatchObject({
      frac: 0.5,
      text: '12 van 24 inwoners',
    });
    expect(goalProgress({ type: 'camps', value: 2 }, f).frac).toBe(0.5);
    expect(goalProgress({ type: 'build', value: 'farm' }, f).frac).toBe(1);
    expect(goalProgress({ type: 'build', value: 'market' }, f).text).toBe('in aanbouw');
    expect(goalProgress({ type: 'build', value: 'stargate' }, f).frac).toBe(0);
    expect(goalText({ type: 'age', value: 1 })).toBe('Bereik de Bronstijd');
    expect(goalText({ type: 'age', value: 8 })).toBe('Bereik het Sterrentijdperk');
    expect(clockText(754)).toBe('12:34');
    expect(clockText(5)).toBe('0:05');
  });

  it('beginnen: de uitdaging bepaalt wereld en regels, je eigen volk alleen als er geen vast volk is', () => {
    const islands = startOptions(SCENARIO.islands, 'hanze');
    expect(islands).toMatchObject({ people: 'norse', map: 'islands', scenario: { k: 'islands', date: '' } });
    expect(startOptions(SCENARIO.siege, 'hanze').people).toBe('hanze');
    expect(startOptions(SCENARIO.siege, 'hanze').mods).toEqual(['bigRaids']);
    expect(scenarioDef('siege')).toBe(SCENARIO.siege);
    expect(scenarioDef({ k: 'siege' })).toBe(SCENARIO.siege);
    expect(scenarioDef({ k: 'bestaatniet' })).toBeNull();
    expect(scenarioDef(null)).toBeNull();
  });

  it('opslag van een uitdaging wordt netjes, en wat niet klopt wordt een gewoon spel', () => {
    expect(cleanScenarioState(null)).toBeNull();
    expect(cleanScenarioState({ k: 'bestaatniet' })).toBeNull();
    expect(cleanScenarioState({ k: DAILY, date: 'gisteren' })).toBeNull();
    expect(cleanScenarioState({ k: 'siege', doneAt: 'x', failed: 'boem', date: '2026-01-01' })).toEqual({
      k: 'siege',
      date: '',
      doneAt: null,
      failed: '',
      warned: 0,
    });
    const daily = { k: DAILY, date: '2026-10-15', doneAt: 1234, failed: '', warned: 60 };
    expect(cleanScenarioState(JSON.parse(JSON.stringify(daily)))).toEqual(daily);
  });
});

describe('wereld van de dag', () => {
  it('dezelfde datum geeft altijd dezelfde wereld', () => {
    for (const date of ['2026-10-15', '2026-01-01', '2027-02-28']) {
      const a = dailyWorld(date);
      const b = dailyWorld(date);
      expect(b).toEqual(a);
      expect(scenarioDef({ k: DAILY, date })).toEqual(a);
      expect(textSeed('dag:' + date)).toBe(a.seed);
    }
  });

  it('de datum is die van je eigen klok', () => {
    expect(dateKey(new Date(2026, 9, 15, 23, 59))).toBe('2026-10-15');
    expect(dateKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('elke dag: een geldige wereld met twee regels, één moeilijk en één die helpt', () => {
    const seeds = new Set();
    const goals = new Set();
    for (const date of yearOfDates()) {
      const d = dailyWorld(date);
      expect(d.k).toBe(DAILY);
      expect(d.date).toBe(date);
      expect(d.seed).toBeGreaterThan(0);
      expect(d.seed).toBeLessThan(SEED_MAX);
      expect(MAP[d.map], date).toBeTruthy();
      // De wereld van de dag kiest altijd een volk (zie dailyWorld)
      expect(PEOPLE[d.people!] && !PEOPLE[d.people!].locked, date).toBe(true);
      expect(d.startAge).toBe(0);
      expect(d.modifiers).toHaveLength(2);
      const [hard, help] = d.modifiers.map(k => MODIFIER[k]);
      expect(hard.hard && !help.hard, date).toBe(true);
      for (const m of [hard, help]) expect(m.not || [], `${date}: ${m.k}`).not.toContain(d.goal.type);
      // De hulp heft de moeilijke regel niet op: geen bonus op dezelfde sleutel
      const shared = Object.keys(help.bonus || {}).filter(key => key in (hard.bonus || {}));
      expect(shared, `${date}: ${hard.k} + ${help.k}`).toEqual([]);
      // Het volk heft de moeilijke regel ook niet op (zoals de Hanze bij Gesloten grenzen)
      const folk = Object.keys(PEOPLE[d.people!].bonus || {}).filter(key => key in (hard.bonus || {}));
      expect(folk, `${date}: ${hard.k} + ${d.people}`).toEqual([]);
      const minutes = challengeMinutes(d);
      expect(minutes, date).toBeGreaterThanOrEqual(20);
      expect(minutes, date).toBeLessThanOrEqual(45);
      seeds.add(d.seed);
      goals.add(d.goal.type);
    }
    // Elke dag een andere wereld, en over een jaar komt elk soort doel voor
    expect(seeds.size).toBeGreaterThan(360);
    expect(goals.size).toBe(DAILY_PLANS.length);
  });
});

describe('score in een uitdaging', () => {
  it('punten voor het doel en de medaille komen erbij', () => {
    const base = { age: 1, kills: 10, days: 6 };
    const plain = gameScore(base);
    expect(plain.rows.map(r => r.k)).not.toContain('goal');
    const gold = gameScore({ ...base, challenge: { won: true, medal: 'goud' } });
    expect(gold.total).toBe(plain.total + CHALLENGE_POINTS.goal + CHALLENGE_POINTS.goud);
    // De regels voor medaille en doel staan er zeker (dat testen deze regels ook)
    expect(gold.rows.find(r => r.k === 'medal')!.n).toBe('Medaille goud');
    // Niet gehaald: een regel met 0 voor het doel, en geen medaille
    const failed = gameScore({ ...base, challenge: { won: false, medal: '' } });
    expect(failed.total).toBe(plain.total);
    expect(failed.rows.find(r => r.k === 'goal')!.pts).toBe(0);
    expect(failed.rows.some(r => r.k === 'medal')).toBe(false);
    // Een betere medaille geeft meer punten
    expect(CHALLENGE_POINTS.goud).toBeGreaterThan(CHALLENGE_POINTS.zilver);
    expect(CHALLENGE_POINTS.zilver).toBeGreaterThan(CHALLENGE_POINTS.brons);
  });
});

describe('profiel', () => {
  // Een gewonnen spel met alleen de gegevens die hier tellen
  const won = { score: 4000, won: true, age: 2, day: 9, people: 'friezen', diff: 1 } as GameRecord;

  it('een uitdaging bewaart de beste medaille en tijd, niet de beste score per volk', () => {
    const p = emptyProfile();
    expect(addChallengeResult(p, { ...won, scenario: 'bronze', medal: 'brons', value: 1400 }, 1)).toBe(true);
    expect(p.scenarios.bronze).toEqual({ medal: 'brons', best: 1400, wins: 1 });
    expect(p.best.score).toBe(0);
    expect(p.wins).toBe(1);
    expect(p.recent[0].scenario).toBe('bronze');
    // Sneller: nieuw record, betere medaille
    expect(addChallengeResult(p, { ...won, scenario: 'bronze', medal: 'zilver', value: 1000 }, 2)).toBe(true);
    // Langzamer: geen record, en je houdt zilver
    expect(addChallengeResult(p, { ...won, scenario: 'bronze', medal: 'brons', value: 1450 }, 3)).toBe(false);
    expect(p.scenarios.bronze).toEqual({ medal: 'zilver', best: 1000, wins: 3 });
    // Niet gehaald: verandert niets aan medaille of tijd
    const lost = { ...won, won: false, scenario: 'bronze', medal: '', value: 1500 };
    expect(addChallengeResult(p, lost, 4)).toBe(false);
    expect(p.scenarios.bronze).toEqual({ medal: 'zilver', best: 1000, wins: 3 });
    expect(p.wins).toBe(3);
  });

  it('de wereld van de dag bewaart de beste score per dag, en alleen de laatste dagen', () => {
    const p = emptyProfile();
    const day = (date: string, score: number, medal = 'brons') => ({
      ...won,
      score,
      medal,
      scenario: DAILY,
      date,
    });
    expect(addChallengeResult(p, day('2026-10-15', 3000), 1)).toBe(true);
    expect(addChallengeResult(p, day('2026-10-15', 2000, 'goud'), 2)).toBe(false);
    expect(p.daily['2026-10-15']).toEqual({ score: 3000, medal: 'goud', won: true });
    expect(addChallengeResult(p, day('2026-10-15', 3500), 3)).toBe(true);
    expect(p.daily['2026-10-15'].score).toBe(3500);
    // Een hogere score met een slechtere medaille: je houdt de beste medaille van die dag
    expect(p.daily['2026-10-15'].medal).toBe('goud');
    expect(addChallengeResult(p, { ...day('2026-10-15', 4000, ''), won: false }, 4)).toBe(true);
    expect(p.daily['2026-10-15']).toEqual({ score: 4000, medal: 'goud', won: true });
    for (const date of yearOfDates().slice(0, 40)) addChallengeResult(p, day(date, 100));
    expect(Object.keys(p.daily).length).toBe(30);
    expect(p.daily['2026-10-15']).toBeTruthy(); // de nieuwste dag blijft
    expect(p.daily['2026-01-01']).toBeUndefined(); // de oudste valt eraf
  });

  it('een oud profiel zonder uitdagingen laadt gewoon, en een nieuw blijft heel', () => {
    const old = normalizeProfile({ games: 3, achievements: {} });
    expect(old.scenarios).toEqual({});
    expect(old.daily).toEqual({});
    const p = emptyProfile();
    addChallengeResult(p, { ...won, scenario: 'siege', medal: 'goud', value: 0 }, 1);
    addChallengeResult(p, { ...won, scenario: DAILY, date: '2026-10-15', medal: '' }, 2);
    expect(normalizeProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});
