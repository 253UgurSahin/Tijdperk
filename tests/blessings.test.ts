// Tests voor de zegeningen: kloppen de gegevens, en zijn de kaarten eerlijk en voorspelbaar?
import type { BlessingDef, BlessingRules } from '../src/data/blessings';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGES } from '../src/data/ages';
import { BONUS_KEYS } from '../src/data/bonus';
import {
  BLESSING,
  BLESSINGS,
  BLESSING_CATS,
  OFFER_SIZE,
  blessingBonuses,
  blessingOffer,
} from '../src/data/blessings';

const SEEDS = [1, 42, 777, 123456, 987654321, 31337, 2024, 55];
const keysOf = (cards: BlessingDef[]) => cards.map(b => b.k);

// Speel een heel spel na: bij het begin en bij elk nieuw tijdperk de kaart op plek `pick`
function playThrough(seed: number, pick = 0, opts?: BlessingRules) {
  const taken = [],
    offers = [];
  for (let age = 0; age < AGES.length; age++) {
    const offer = blessingOffer(seed, age, taken, opts);
    offers.push({ age, offer, takenBefore: [...taken] });
    taken.push(offer[Math.min(pick, offer.length - 1)].k);
  }
  return { taken, offers };
}

describe('zegeningen: de gegevens', () => {
  it('er zijn er genoeg, elk met een unieke sleutel', () => {
    expect(BLESSINGS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BLESSINGS.map(b => b.k)).size).toBe(BLESSINGS.length);
    for (const b of BLESSINGS) expect(BLESSING[b.k]).toBe(b);
  });

  it('elke zegening heeft een naam, uitleg, pictogram en bekende soort', () => {
    for (const b of BLESSINGS) {
      expect(b.n.length, b.k).toBeGreaterThan(3);
      expect(b.d.length, b.k).toBeGreaterThan(10);
      expect(typeof b.g, b.k).toBe('string');
      expect(BLESSING_CATS[b.cat], b.k).toBeTruthy();
      if (b.minAge !== undefined) expect(b.minAge >= 0 && b.minAge < AGES.length, b.k).toBe(true);
    }
  });

  it('elke zegening gebruikt alleen bekende bonussleutels met een echt getal', () => {
    for (const b of BLESSINGS) {
      expect(b.bonus || b.oneoff, `${b.k} doet niets`).toBeTruthy();
      for (const [key, value] of Object.entries(b.bonus || {})) {
        expect(BONUS_KEYS[key], `${b.k}: ${key}`).toBeTruthy();
        expect(Number.isFinite(value) && value !== 0, `${b.k}: ${key}`).toBe(true);
      }
    }
  });

  // Wat de speler leest, moet kloppen met wat er echt gebeurt
  it('elk getal uit de bonus staat ook in de tekst', () => {
    for (const b of BLESSINGS)
      for (const [key, value] of Object.entries(b.bonus || {})) {
        const shown = BONUS_KEYS[key].flat
          ? String(value).replace('.', ',')
          : Math.round(Math.abs(value) * 100) + '%';
        expect(b.d, `${b.k}: ${key}`).toContain(shown);
      }
  });

  it('kaarten met een prijs hebben echt een nadeel (een bonus die de verkeerde kant op gaat)', () => {
    // Bij tijd en kosten is negatief goed; bij al het andere is negatief een nadeel
    const goodWhenLower = new Set(['research.time', 'chunk.cost', 'wall.cost', 'raid.size', 'raid.hp']);
    // Meer meteorieten is tweesnijdend: meer erts, maar ze slaan ook gebouwen kapot
    const doubleEdged = new Set(['meteor.rate']);
    const isDownside = (key: string, value: number) =>
      doubleEdged.has(key) || (goodWhenLower.has(key) ? value > 0 : value < 0);
    for (const b of BLESSINGS) {
      const downsides = Object.entries(b.bonus || {}).filter(([k, v]) => isDownside(k, v));
      expect(downsides.length > 0, b.k).toBe(!!b.risk);
    }
  });

  it('eenmalige zegeningen worden echt uitgevoerd in game/blessings.ts', () => {
    const code = readFileSync(new URL('../src/game/blessings.ts', import.meta.url), 'utf8');
    for (const b of BLESSINGS) if (b.oneoff) expect(code, b.k).toContain(`${b.oneoff}()`);
  });

  it('de bonussen van gekozen zegeningen worden gevonden, onbekende sleutels overgeslagen', () => {
    expect(blessingBonuses(undefined)).toEqual([]);
    expect(blessingBonuses(['harvest', 'bestaat-niet', 'walls'])).toEqual([
      BLESSING.harvest.bonus,
      BLESSING.walls.bonus,
    ]);
  });
});

describe('zegeningen: de keuze uit drie', () => {
  it('dezelfde seed en hetzelfde tijdperk geven dezelfde kaarten', () => {
    for (const seed of SEEDS)
      for (let age = 0; age < AGES.length; age++)
        expect(keysOf(blessingOffer(seed, age, []))).toEqual(keysOf(blessingOffer(seed, age, [])));
  });

  it('andere seeds of tijdperken geven meestal andere kaarten', () => {
    const offers = new Set();
    for (const seed of SEEDS)
      for (let age = 0; age < 3; age++) offers.add(keysOf(blessingOffer(seed, age)).join());
    expect(offers.size).toBeGreaterThan(SEEDS.length * 2);
  });

  it('in een heel spel krijg je steeds drie kaarten, en nooit iets wat je al hebt', () => {
    for (const seed of SEEDS)
      for (const pick of [0, 1, 2]) {
        const { taken, offers } = playThrough(seed, pick);
        expect(new Set(taken).size, `seed ${seed}`).toBe(AGES.length);
        for (const { offer, takenBefore } of offers) {
          expect(offer.length).toBe(OFFER_SIZE);
          expect(new Set(keysOf(offer)).size).toBe(OFFER_SIZE);
          for (const b of offer) expect(takenBefore, b.k).not.toContain(b.k);
        }
      }
  });

  it('kaarten komen pas in hun tijdperk', () => {
    for (const seed of SEEDS)
      for (const { age, offer } of playThrough(seed).offers)
        for (const b of offer) expect(b.minAge || 0, b.k).toBeLessThanOrEqual(age);
  });

  it('minstens één kaart gaat niet over economie, nooit drie van één soort, hooguit één met een prijs', () => {
    for (const seed of SEEDS)
      for (const pick of [0, 1, 2])
        for (const { offer } of playThrough(seed, pick).offers) {
          expect(offer.some(b => b.cat !== 'eco')).toBe(true);
          expect(new Set(offer.map(b => b.cat)).size).toBeGreaterThan(1);
          expect(offer.filter(b => b.risk).length).toBeLessThanOrEqual(1);
        }
  });

  it('wat je al koos verandert de andere kaarten zo min mogelijk', () => {
    // De volgorde hangt alleen van seed en tijdperk af: valt er één kaart weg, dan schuift de rest door
    const before = keysOf(blessingOffer(42, 2, []));
    const after = keysOf(blessingOffer(42, 2, [before[0]]));
    expect(after).not.toContain(before[0]);
    expect(after).toContain(before[1]);
  });

  it('in de vredige modus geen kaarten die alleen over aanvallen gaan', () => {
    for (const seed of SEEDS)
      for (const { offer } of playThrough(seed, 2, { peaceful: true }).offers)
        for (const b of offer) expect(b.raids, b.k).toBeFalsy();
  });
});
