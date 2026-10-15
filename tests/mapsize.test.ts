// Tests voor de kaartgrootte: de keuzes (Normaal, Groot, Enorm), oude opslag en uitdagingen, en setMapSize.
import { describe, expect, it } from 'vitest';
import { CN, CS, CX, CY, H, W, onMapSize, setMapSize } from '../src/config';
import { DEFAULT_SIZE, MAP_SIZES, NORMAL_SIZE, cleanMapSize, mapSizeName } from '../src/data/maps';
import { SCENARIOS, dailyWorld, startOptions } from '../src/data/scenarios';

describe('kaartgroottes', () => {
  it('drie groottes, van klein naar groot, met een naam en uitleg', () => {
    expect(MAP_SIZES.map(s => s.n)).toEqual([256, 384, 512]);
    expect(MAP_SIZES.map(s => s.name)).toEqual(['Normaal', 'Groot', 'Enorm']);
    for (const s of MAP_SIZES) {
      expect(s.d.length, s.name).toBeGreaterThan(10);
      // Een hele kaart bestaat uit hele gebieden
      expect(s.n % CS, s.name).toBe(0);
    }
    expect(mapSizeName(384)).toBe('Groot');
  });

  it('oude opslag en onbekende groottes worden de gewone; een nieuwe vrije wereld begint op Groot', () => {
    expect(NORMAL_SIZE).toBe(256);
    expect(DEFAULT_SIZE).toBe(384);
    expect(cleanMapSize(undefined)).toBe(NORMAL_SIZE);
    expect(cleanMapSize(512)).toBe(512);
    expect(cleanMapSize(1000)).toBe(NORMAL_SIZE);
    expect(cleanMapSize('384')).toBe(NORMAL_SIZE);
  });

  it('uitdagingen en de wereld van de dag zijn altijd even groot als vroeger (hun tijden passen daarbij)', () => {
    for (const s of SCENARIOS) expect(startOptions(s).size, s.k).toBe(NORMAL_SIZE);
    expect(startOptions(dailyWorld('2026-10-15')).size).toBe(NORMAL_SIZE);
  });
});

describe('setMapSize', () => {
  it('zet breedte, hoogte, midden en het aantal gebieden, en meldt het aan wie het wil weten', () => {
    let told = 0;
    onMapSize(() => told++);
    expect([W, H, CX, CY, CN]).toEqual([256, 256, 128, 128, 16]);
    setMapSize(512);
    expect([W, H, CX, CY, CN]).toEqual([512, 512, 256, 256, 32]);
    expect(told).toBe(1);
    // Dezelfde grootte nog eens: er verandert niets
    setMapSize(512);
    expect(told).toBe(1);
    setMapSize(256);
    expect([W, H, CX, CY, CN]).toEqual([256, 256, 128, 128, 16]);
    expect(told).toBe(2);
  });
});
