// Tests voor de economie- en legerregels: gewenste voorraad, wie wat gaat halen, pauzerende fabrieken,
// noodstroom, wat soldaten eten en hoe aanvallen zich aanpassen aan je leger.
import { describe, expect, it } from 'vitest';
import { AGES } from '../src/data/ages';
import { B } from '../src/data/buildings';
import {
  BASE_POWER_AGE,
  PLENTY_PAUSE,
  PLENTY_RESUME,
  STOCK_MINUTES,
  basePower,
  gatherPull,
  plentyOf,
  reserveFor,
  wantedStock,
} from '../src/data/economy';
import { NORMAL_POWER, RAID_MATCH_MAX, RAID_MATCH_MIN, raidMatch } from '../src/data/difficulty';
import { UNITS, foodUpkeep } from '../src/data/units';

describe('gewenste voorraad', () => {
  it('is wat het volgende tijdperk kost, plus een paar minuten verbruik, plus een buffer', () => {
    expect(wantedStock({ goal: 800, perMinute: 50, age: 5 })).toBe(800 + 50 * STOCK_MINUTES + reserveFor(5));
    expect(wantedStock({ goal: 0, perMinute: 0, age: 0 })).toBe(reserveFor(0));
  });
  it('de buffer groeit met elk tijdperk en is nooit leeg', () => {
    expect(reserveFor(0)).toBeGreaterThan(0);
    for (let a = 1; a < AGES.length; a++) expect(reserveFor(a)).toBeGreaterThan(reserveFor(a - 1));
  });
});

describe('wie wat gaat halen', () => {
  it('een groter tekort trekt meer dorpelingen', () => {
    const empty = gatherPull(0, 1000, 1),
      half = gatherPull(500, 1000, 1),
      enough = gatherPull(1000, 1000, 1);
    expect(empty).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(enough);
    // Twee keer zo groot tekort: ongeveer twee keer zo veel trek
    expect(gatherPull(0, 1000, 1) / gatherPull(500, 1000, 1)).toBeGreaterThan(1.7);
  });
  it('ver boven de gewenste voorraad bijna niets, maar nooit minder dan niets', () => {
    const far = gatherPull(100000, 1000, 1);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(gatherPull(0, 1000, 1) / 50);
  });
  it('is alles ruim genoeg, dan verdelen ze zich rustig, met een kleine voorkeur voor wat net genoeg is', () => {
    const bitMore = gatherPull(2000, 1000, 1),
      lotMore = gatherPull(5000, 1000, 1);
    expect(bitMore).toBeGreaterThan(lotMore);
    expect(lotMore).toBeGreaterThan(0);
    // Een miljoen of honderdduizend: allebei veel te veel, dus even veel (niet iedereen naar hetzelfde)
    expect(gatherPull(1000000, 1000, 1)).toBe(gatherPull(100000, 1000, 1));
  });
  it('de vaste voorkeur (BASEW) telt mee', () => {
    expect(gatherPull(0, 1000, 1.5)).toBeCloseTo(1.5 * gatherPull(0, 1000, 1));
  });
  it('werkt ook zonder gewenste voorraad of met een rare voorraad', () => {
    expect(Number.isFinite(gatherPull(100, 0, 1))).toBe(true);
    expect(gatherPull(-5, 100, 1)).toBe(gatherPull(0, 100, 1));
  });
});

describe('fabrieken pauzeren als er genoeg is', () => {
  it('twee grenzen: pauzeren bij veel, weer aan bij minder', () => {
    expect(PLENTY_PAUSE).toBeGreaterThan(PLENTY_RESUME);
    expect(PLENTY_RESUME).toBeGreaterThan(1);
    const wanted = 400;
    expect(plentyOf(wanted * PLENTY_PAUSE, wanted, false)).toBe(true);
    expect(plentyOf(wanted * PLENTY_PAUSE - 1, wanted, false)).toBe(false);
    // Tussen de twee grenzen blijft hij zoals hij was: zo springt hij niet steeds aan en uit
    const between = wanted * ((PLENTY_PAUSE + PLENTY_RESUME) / 2);
    expect(plentyOf(between, wanted, false)).toBe(false);
    expect(plentyOf(between, wanted, true)).toBe(true);
    expect(plentyOf(wanted * PLENTY_RESUME - 1, wanted, true)).toBe(false);
  });
});

describe('noodstroom van het stamhuis', () => {
  it('pas vanaf de Industriële tijd', () => {
    expect(AGES[BASE_POWER_AGE].n).toBe('Industriële tijd');
    for (let a = 0; a < BASE_POWER_AGE; a++) expect(basePower(a)).toBe(0);
    for (let a = BASE_POWER_AGE; a < AGES.length; a++) expect(basePower(a)).toBeGreaterThan(0);
  });
  it('genoeg om één oliepomp en één raffinaderij langzaam te laten draaien', () => {
    const pumpAndRefinery = B.oilpump.power! + B.refinery.power!;
    expect(basePower(BASE_POWER_AGE)).toBeGreaterThanOrEqual(pumpAndRefinery / 2);
    expect(basePower(BASE_POWER_AGE)).toBeLessThan(pumpAndRefinery);
  });
});

describe('soldaten eten voedsel', () => {
  it('latere en zwaardere soldaten eten meer', () => {
    expect(foodUpkeep(UNITS.rifle)).toBeGreaterThan(foodUpkeep(UNITS.spear));
    expect(foodUpkeep(UNITS.plasma)).toBeGreaterThan(foodUpkeep(UNITS.rifle));
    // Een tank (pantser) eet meer dan een soldaat uit hetzelfde tijdperk
    expect(foodUpkeep(UNITS.tank)).toBeGreaterThan(foodUpkeep(UNITS.soldier));
    for (const [k, u] of Object.entries(UNITS)) expect(foodUpkeep(u), k).toBeGreaterThan(0);
  });
  it('een leger van 30 in de Industriële tijd kost 15 tot 25% van een gewone voedselopbrengst', () => {
    // Gemeten in het spel: 15 boeren halen in de Industriële tijd samen ±1500 voedsel per minuut
    const normalIncome = 1500;
    const army = 30 * foodUpkeep(UNITS.rifle);
    expect(army).toBeGreaterThanOrEqual(0.15 * normalIncome);
    expect(army).toBeLessThanOrEqual(0.25 * normalIncome);
  });
});

describe('aanvallen passen zich aan bij je leger', () => {
  it('een normaal leger krijgt de gewone aanval', () => {
    for (let a = 0; a < AGES.length; a++) {
      const m = raidMatch(NORMAL_POWER[a], a, 10);
      expect(m.size).toBeCloseTo(1);
      expect(m.hp).toBeCloseTo(1);
    }
  });
  it('een sterker leger krijgt grotere en taaiere aanvallen, maar niet eindeloos', () => {
    const normal = raidMatch(NORMAL_POWER[5], 5, 10),
      strong = raidMatch(NORMAL_POWER[5] * 2, 5, 10),
      huge = raidMatch(NORMAL_POWER[5] * 50, 5, 10);
    expect(strong.size).toBeGreaterThan(normal.size);
    expect(strong.hp).toBeGreaterThan(normal.hp);
    expect(huge.size).toBeCloseTo(Math.sqrt(RAID_MATCH_MAX));
    expect(huge.hp).toBeCloseTo(Math.sqrt(RAID_MATCH_MAX));
  });
  it('een zwak leger krijgt iets kleinere aanvallen, maar niet minder dan het minimum', () => {
    const none = raidMatch(0, 5, 10);
    expect(none.size).toBeCloseTo(Math.sqrt(RAID_MATCH_MIN));
    expect(none.size).toBeLessThan(1);
  });
  it('de eerste aanval van een spel blijft zoals hij was; daarna groeit het verschil rustig', () => {
    expect(raidMatch(NORMAL_POWER[0] * 50, 0, 1).size).toBe(1);
    expect(raidMatch(0, 0, 1).size).toBe(1);
    const second = raidMatch(NORMAL_POWER[3] * 50, 3, 2).size,
      later = raidMatch(NORMAL_POWER[3] * 50, 3, 9).size;
    expect(second).toBeGreaterThan(1);
    expect(later).toBeGreaterThan(second);
  });
  it('een normaal leger wordt sterker in elk tijdperk, voor elk tijdperk één getal', () => {
    expect(NORMAL_POWER).toHaveLength(AGES.length);
    for (let a = 1; a < AGES.length; a++) expect(NORMAL_POWER[a]).toBeGreaterThan(NORMAL_POWER[a - 1]);
  });
});
