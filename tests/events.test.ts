// Tests voor de gebeurtenissen: kloppen de gegevens, zijn de keuzes eerlijk, en werkt opslaan netjes?
import type { EventChoice, EventDef, EventRules } from '../src/data/events';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGES } from '../src/data/ages';
import { BONUS_KEYS } from '../src/data/bonus';
import {
  EVENT,
  EVENTS,
  EVENT_NEEDS,
  TEXT_WORDS,
  allowedChoices,
  amountsFor,
  buffEffect,
  buffMood,
  choiceMood,
  choiceNeeds,
  choiceProblem,
  cleanActiveEvent,
  cleanBuffs,
  cleanEventsSeen,
  cleanFollowups,
  defaultChoice,
  eventAllowed,
  eventWeight,
  fillText,
  hasDownside,
  inAge,
  oreFor,
  perAge,
} from '../src/data/events';
import { RES } from '../src/data/resources';
import { FOES } from '../src/data/units';
import { ico } from '../src/ui/glyphs';

const ALL_AGES = AGES.map((_, i) => i);
const RANDOM = EVENTS.filter(e => !e.chain);
const CHAINS = EVENTS.filter(e => e.chain);
// Alle mogelijke combinaties van vredige modus, Geen leger en Gesloten grenzen
const RULE_SETS: EventRules[] = [];
for (const peaceful of [false, true])
  for (const noArmy of [false, true])
    for (const noTrade of [false, true]) RULE_SETS.push({ peaceful, noArmy, noTrade });

// Wat een keuze mag bevatten; een tikfout in de gegevens valt zo meteen op
const CHOICE_FIELDS: (keyof EventChoice)[] = [
  'l',
  'd',
  'cost',
  'gain',
  'lose',
  'villagers',
  'units',
  'sendUnits',
  'buff',
  'raid',
  'foes',
  'damage',
  'burn',
  'meteor',
  'follow',
];
const EFFECTS = CHOICE_FIELDS.filter(f => f !== 'l' && f !== 'd');

const NOTHING_TEXT = 'Er gebeurt niets.';
const followKeys = (follow: { k: string | string[] }) => (Array.isArray(follow.k) ? follow.k : [follow.k]);

// In welke tijdperken een gebeurtenis kan komen. Een vervolg: in de tijdperken van wat ervoor kwam.
function agesOf(def: EventDef, seen = new Set<string>()): number[] {
  if (!def.chain) return ALL_AGES.filter(age => inAge(def, age));
  if (seen.has(def.k)) return [];
  seen.add(def.k);
  const parents = EVENTS.filter(p => p.choices.some(c => c.follow && followKeys(c.follow).includes(def.k)));
  return [...new Set(parents.flatMap(p => agesOf(p, seen)))];
}

describe('gebeurtenissen: de gegevens', () => {
  it('er zijn er genoeg, elk met een unieke sleutel', () => {
    expect(RANDOM.length).toBeGreaterThanOrEqual(30);
    expect(RANDOM.filter(e => e.ages).length).toBeGreaterThanOrEqual(28);
    expect(new Set(EVENTS.map(e => e.k)).size).toBe(EVENTS.length);
    for (const e of EVENTS) expect(EVENT[e.k]).toBe(e);
  });

  it('elk tijdperk heeft minstens drie eigen gebeurtenissen, en genoeg om uit te kiezen', () => {
    for (const age of ALL_AGES) {
      expect(RANDOM.filter(e => e.ages && inAge(e, age)).length, AGES[age].n).toBeGreaterThanOrEqual(3);
      expect(RANDOM.filter(e => inAge(e, age)).length, AGES[age].n).toBeGreaterThanOrEqual(14);
    }
  });

  it('elke gebeurtenis heeft een naam, pictogram, verhaal en twee of drie keuzes', () => {
    for (const e of EVENTS) {
      expect(e.n.length, e.k).toBeGreaterThan(3);
      expect(ico(e.g), e.k).toContain('<svg');
      expect(e.x.length, e.k).toBeGreaterThan(15);
      expect(e.choices.length >= 2 && e.choices.length <= 3, e.k).toBe(true);
      for (const c of e.choices) {
        expect(c.l.length, e.k).toBeGreaterThan(1);
        expect(c.d.length, `${e.k}: ${c.l}`).toBeGreaterThan(5);
        for (const field of Object.keys(c)) expect(CHOICE_FIELDS, `${e.k}: ${field}`).toContain(field);
      }
    }
  });

  it('tijdperken, voorwaarden en ingevulde woorden bestaan', () => {
    for (const e of EVENTS) {
      if (e.ages) {
        const [from, to] = e.ages;
        expect(from >= 0 && from <= to && to < AGES.length, e.k).toBe(true);
      }
      for (const need of e.need || []) expect(EVENT_NEEDS[need], `${e.k}: ${need}`).toBeTruthy();
      for (const [, word] of e.x.matchAll(/\{(\w+)\}/g)) expect(TEXT_WORDS, e.k).toContain(word);
    }
  });

  it('de keuze die vanzelf gebeurt is gratis, en vraagt geen leger of handel', () => {
    for (const e of EVENTS) {
      const c = e.choices[defaultChoice(e)];
      expect(c.cost, e.k).toBeUndefined();
      expect(c.sendUnits, e.k).toBeUndefined();
      expect(choiceNeeds(c).army, e.k).toBe(false);
      expect(choiceNeeds(c).trade, e.k).toBe(false);
    }
  });

  it('elke keuze behalve de laatste doet echt iets; hooguit één keuze doet niets', () => {
    for (const e of EVENTS) {
      const doesSomething = (c: EventChoice) => EFFECTS.some(f => c[f] !== undefined);
      e.choices.slice(0, -1).forEach(c => expect(doesSomething(c), `${e.k}: ${c.l}`).toBe(true));
      expect(e.choices.filter(c => !doesSomething(c)).length, e.k).toBeLessThanOrEqual(1);
    }
  });

  it('kosten, opbrengst en verlies bestaan al in elk tijdperk waarin de gebeurtenis komt', () => {
    for (const e of EVENTS) {
      const ages = agesOf(e);
      expect(ages.length, `${e.k} komt nooit`).toBeGreaterThan(0);
      for (const age of ages)
        for (const c of e.choices)
          for (const field of ['cost', 'gain', 'lose'] as const) {
            const amounts = amountsFor(c[field], age);
            if (!amounts) continue;
            for (const [r, n] of Object.entries(amounts)) {
              const where = `${e.k}: ${c.l} (${field}, tijdperk ${age})`;
              expect(RES[r], where).toBeTruthy();
              expect(RES[r].age, where).toBeLessThanOrEqual(age);
              expect(Number.isInteger(n) && n > 0, where).toBe(true);
            }
          }
    }
  });

  it('tijdelijke bonussen gebruiken bekende sleutels, en de tekst noemt de echte getallen', () => {
    for (const e of EVENTS)
      for (const c of e.choices) {
        if (!c.buff) continue;
        const where = `${e.k}: ${c.l}`;
        expect(Number.isInteger(c.buff.days) && c.buff.days > 0, where).toBe(true);
        expect(c.d, where).toContain(`${c.buff.days} dag`);
        for (const [key, value] of Object.entries(c.buff.bonus)) {
          expect(BONUS_KEYS[key], `${where}: ${key}`).toBeTruthy();
          expect(Number.isFinite(value) && value !== 0, `${where}: ${key}`).toBe(true);
          const shown = BONUS_KEYS[key].flat ? String(value) : Math.round(Math.abs(value) * 100) + '%';
          // 100% meer mag ook gewoon "2 keer zo vaak" heten
          const ok = c.d.includes(shown) || (value === 1 && c.d.includes('2 keer zo'));
          expect(ok, `${where}: ${key}`).toBe(true);
        }
      }
  });

  it('elke tijdelijke bonus heeft een kort effect voor op het plaatje', () => {
    for (const e of EVENTS)
      for (const c of e.choices) {
        if (!c.buff) continue;
        const effect = buffEffect(c.d);
        expect(effect, `${e.k}: ${c.l}`).toMatch(/\d/);
        expect(effect.length, `${e.k}: ${c.l}`).toBeLessThanOrEqual(60);
      }
  });

  it('de tekst noemt ook mensen, soldaten, vijanden, schade, aanvallen en vervolgen', () => {
    for (const e of EVENTS)
      for (const c of e.choices) {
        const where = `${e.k}: ${c.l}`;
        if (c.villagers) expect(c.d, where).toContain(`${Math.abs(c.villagers)} dorpeling`);
        if (c.units) expect(c.d, where).toContain(`${c.units} solda`);
        if (c.sendUnits) expect(c.d, where).toContain(`${c.sendUnits} solda`);
        if (c.foes) expect(c.d, where).toContain(`${c.foes.n} `);
        if (c.damage) expect(c.d, where).toContain(`${c.damage} gebouw`);
        if (c.raid) expect(c.d, where).toContain('aanval');
        if (c.follow) expect(c.d, where).toContain(`${c.follow.days} dag`);
      }
  });

  it('vijanden bestaan', () => {
    for (const e of EVENTS)
      for (const c of e.choices)
        if (c.foes) {
          expect(Number.isInteger(c.foes.n) && c.foes.n > 0, e.k).toBe(true);
          expect(FOES[c.foes.type], e.k).toBeTruthy();
        }
  });
});

describe('gebeurtenissen: vervolgen', () => {
  it('elk vervolg bestaat en komt alleen na een keuze', () => {
    for (const e of EVENTS)
      for (const c of e.choices) {
        if (!c.follow) continue;
        for (const k of followKeys(c.follow)) {
          expect(EVENT[k], `${e.k} → ${k}`).toBeTruthy();
          expect(EVENT[k].chain, `${e.k} → ${k}`).toBe(true);
        }
        expect(Number.isInteger(c.follow.days) && c.follow.days >= 1, e.k).toBe(true);
        // Een vervolg komt altijd: een belofte als "over 2 dagen weet je het" klopt dus
        expect(Object.keys(c.follow).sort(), e.k).toEqual(['days', 'k']);
      }
  });

  it('elk vervolg is bereikbaar vanuit een gewone gebeurtenis', () => {
    expect(CHAINS.length).toBeGreaterThanOrEqual(8);
    for (const e of CHAINS) {
      expect(e.ages, e.k).toBeUndefined();
      expect(agesOf(e).length, e.k).toBeGreaterThan(0);
    }
  });

  it('er zijn ketens waarin het vervolg afhangt van je keuze', () => {
    // Bijvoorbeeld de reiziger: onderdak geven geeft een ander vervolg dan hem laten meewerken
    const traveler = EVENT.traveler.choices.map(c => c.follow && followKeys(c.follow).join());
    expect(new Set(traveler.filter(Boolean)).size).toBe(2);
    // Laat je hem meewerken, dan blijkt hij een dief of juist eerlijk
    // Meewerken is de tweede keuze; die heeft zeker een vervolg
    expect(followKeys(EVENT.traveler.choices[1].follow!).sort()).toEqual(['travelerHonest', 'travelerThief']);
  });
});

describe('gebeurtenissen: spelregels en vredige modus', () => {
  it('in de vredige modus zijn er geen keuzes met aanvallen of vijanden', () => {
    for (const e of EVENTS) {
      if (!eventAllowed(e, { peaceful: true })) continue;
      for (const i of allowedChoices(e, { peaceful: true })) {
        const c = e.choices[i];
        expect(!c.raid && !c.foes, `${e.k}: ${c.l}`).toBe(true);
      }
    }
  });

  it('zonder leger geen soldaten, met gesloten grenzen geen handel', () => {
    for (const e of EVENTS) {
      for (const i of allowedChoices(e, { noArmy: true })) expect(e.choices[i].units, e.k).toBeFalsy();
      if (e.trade) expect(eventAllowed(e, { noTrade: true }), e.k).toBe(false);
    }
  });

  it('met elke combinatie van regels is er in elk tijdperk genoeg te beleven', () => {
    for (const rules of RULE_SETS)
      for (const age of ALL_AGES) {
        const pool = RANDOM.filter(e => inAge(e, age) && eventAllowed(e, rules));
        expect(pool.length, `${JSON.stringify(rules)} tijdperk ${age}`).toBeGreaterThanOrEqual(8);
      }
  });

  it('een gebeurtenis komt alleen als er echt iets te kiezen is', () => {
    for (const rules of RULE_SETS)
      for (const e of EVENTS) {
        if (!eventAllowed(e, rules)) continue;
        const options = allowedChoices(e, rules);
        expect(options.length, e.k).toBeGreaterThanOrEqual(2);
        expect(options, e.k).toContain(defaultChoice(e));
      }
  });

  it('handel komt vaker als handelaars vaker komen (zoals bij de Hanze), eigen tijdperk vaker dan algemeen', () => {
    expect(eventWeight(EVENT.eastShip, 2)).toBe(2 * eventWeight(EVENT.eastShip, 1));
    expect(eventWeight(EVENT.druid, 2)).toBe(eventWeight(EVENT.druid, 1));
    expect(eventWeight(EVENT.druid)).toBeGreaterThan(eventWeight(EVENT.feast));
  });
});

describe('gebeurtenissen: hulpjes', () => {
  it('bedragen groeien mee met het tijdperk', () => {
    expect(perAge({ food: [60, 20] })(0)).toEqual({ food: 60 });
    expect(perAge({ food: [60, 20], wood: [10, 5] })(2)).toEqual({ food: 100, wood: 20 });
    expect(amountsFor(undefined, 3)).toBeNull();
    expect(amountsFor({ gold: 5 }, 3)).toEqual({ gold: 5 });
  });

  it('het nieuwste erts per tijdperk', () => {
    expect(oreFor(0)).toBe('stone');
    expect(oreFor(2)).toBe('iron');
    expect(oreFor(3)).toBe('gold');
    expect(oreFor(8)).toBe('starmetal');
  });

  it('zegt waarom je een keuze niet kunt maken', () => {
    const choice = { cost: { gold: 100, food: 50 } };
    expect(choiceProblem(choice, 3, { res: { gold: 100, food: 50 }, units: 0 })).toBe('');
    expect(choiceProblem(choice, 3, { res: { gold: 10, food: 50 }, units: 0 })).toBe('Te weinig goud');
    expect(choiceProblem(choice, 3, { res: { gold: 10, food: 0 }, units: 0 })).toBe(
      'Te weinig goud en voedsel',
    );
    expect(choiceProblem({ sendUnits: 3 }, 3, { res: {}, units: 1 })).toBe('Je hebt 3 soldaten nodig (nu 1)');
    expect(choiceProblem({ sendUnits: 3 }, 3, { res: {}, units: 3 })).toBe('');
  });

  it('weet of een keuze goed of slecht nieuws is', () => {
    expect(buffMood({ farm: 0.3 })).toBe('good');
    expect(buffMood({ 'research.time': -0.3 })).toBe('good');
    expect(buffMood({ 'chunk.cost': 0.3 })).toBe('bad');
    expect(buffMood({ farm: 0.3, 'conv.speed': -0.15 })).toBe('mixed');
    expect(choiceMood({ villagers: 3 })).toBe('good');
    expect(choiceMood({ villagers: -2 })).toBe('bad');
    expect(choiceMood({ villagers: -1, gain: { food: 1 } })).toBe('');
  });

  it('weet of een keuze een nadeel heeft (dan staat er geen "gratis" bij)', () => {
    expect(hasDownside({ d: NOTHING_TEXT })).toBe(false);
    expect(hasDownside({ villagers: 2 })).toBe(false);
    expect(hasDownside({ buff: { bonus: { farm: 0.3 }, days: 2 } })).toBe(false);
    expect(hasDownside({ lose: { food: 300 } })).toBe(true);
    expect(hasDownside({ villagers: -1 })).toBe(true);
    expect(hasDownside({ raid: true })).toBe(true);
    expect(hasDownside({ burn: true, buff: { bonus: { farm: 0.3 }, days: 2 } })).toBe(true);
    expect(hasDownside({ buff: { bonus: { farm: 0.3, 'conv.speed': -0.15 }, days: 2 } })).toBe(true);
  });

  it('haalt het korte effect uit de uitleg van een bonus', () => {
    expect(buffEffect('2 dagen: verzamelen 20% trager, maar niemand sterft')).toBe('verzamelen 20% trager');
    expect(buffEffect('1 dag: fabrieken 50% trager, daarna is het weer goed')).toBe('fabrieken 50% trager');
    expect(buffEffect('4 dagen: bouwen 40% sneller, maar onderzoek 20% trager')).toBe(
      'bouwen 40% sneller, maar onderzoek 20% trager',
    );
    expect(buffEffect('Goud, maar 3 dagen: akkers 25% trager')).toBe('akkers 25% trager');
    expect(buffEffect('Al het verzamelwerk 25% sneller')).toBe('');
  });

  it('vult woorden in de tekst in', () => {
    expect(fillText('Hallo {plaats}, {onbekend}', { plaats: 'Dorp' })).toBe('Hallo Dorp, {onbekend}');
  });
});

describe('gebeurtenissen: opslaan en laden', () => {
  it('tijdelijke bonussen: onbekende of kapotte vallen weg', () => {
    const good = { k: 'feast', n: 'Oogstfeest', g: '⚘', d: '', bonus: { 'gather.all': 0.25 }, until: 500 };
    expect(
      cleanBuffs([good, { bonus: { bestaatniet: 1 }, until: 5 }, { bonus: {}, until: 5 }, null]),
    ).toEqual([good]);
    expect(cleanBuffs(undefined)).toEqual([]);
  });

  it('vervolgen, geziene gebeurtenissen en het open kaartje', () => {
    expect(cleanFollowups([{ k: 'tulipFever', day: 5 }, { k: 'weg', day: 3 }, { k: 'shipRich' }])).toEqual([
      { k: 'tulipFever', day: 5 },
    ]);
    expect(cleanFollowups('kapot')).toEqual([]);
    expect(cleanEventsSeen(['feast', 'weg', 'storm'])).toEqual(['feast', 'storm']);
    expect(cleanEventsSeen(Array(80).fill('feast')).length).toBe(60);
    const ev = { k: 'storm', until: 100, text: 'Storm' };
    expect(cleanActiveEvent(ev)).toBe(ev);
    expect(cleanActiveEvent({ k: 'weg', until: 1, text: '' })).toBeNull();
    expect(cleanActiveEvent(null)).toBeNull();
  });
});

describe('gebeurtenissen: het spel voert alles uit', () => {
  const code = readFileSync(new URL('../src/game/events.ts', import.meta.url), 'utf8');
  it('elk soort effect wordt uitgevoerd in game/events.ts', () => {
    for (const effect of EFFECTS) expect(code, effect).toContain(`choice.${effect}`);
  });
  it('elke voorwaarde wordt nagekeken in game/events.ts', () => {
    for (const need of Object.keys(EVENT_NEEDS))
      expect(code, need).toMatch(new RegExp(`\\b${need}: \\(\\) =>`));
  });
});
