// Tests voor de opslagplekken (kaartjes, nieuwste plek, tijd in gewone taal) en het inpakken van kaartrijen.
import { describe, expect, it } from 'vitest';
import {
  AUTO_SLOT,
  MANUAL_SLOTS,
  SLOTS,
  cleanSlotIndex,
  cleanSlotMeta,
  filledCount,
  gameText,
  latestSlot,
  metaFromSave,
  replaceWarningText,
  sameGame,
  saveErrorText,
  savedAtText,
  slotLabel,
  slotName,
  slotSummary,
  slotTitle,
} from '../src/data/saveslots';
import type { SlotMeta } from '../src/data/saveslots';
import { PLACES } from '../src/data/names';
import { SCENARIOS } from '../src/data/scenarios';
import { fromBase64, packZeros, toBase64, unpackZeros } from '../src/util/pack';

// Een net kaartje om mee te testen (cleanSlotMeta geeft bij een object altijd een kaartje terug)
const meta = (over: Partial<SlotMeta> = {}): SlotMeta =>
  cleanSlotMeta({ place: 'Eikendal', people: 'friezen', age: 1, day: 12, at: 1000, ...over })!;

describe('opslagplekken', () => {
  it('één automatische en drie eigen plekken, met een naam', () => {
    expect(SLOTS).toEqual([AUTO_SLOT, ...MANUAL_SLOTS]);
    expect(MANUAL_SLOTS).toHaveLength(3);
    // In een zin: "Automatische opslag wissen?" en niet "Automatisch wissen?"
    expect(slotName(AUTO_SLOT)).toBe('Automatische opslag');
    expect(slotName('2')).toBe('Plek 2');
    expect(slotLabel(AUTO_SLOT)).toBe('automatisch');
    expect(slotLabel('2')).toBe('Plek 2');
  });

  it('een kaartje krijgt nette waarden, ook uit rommel', () => {
    expect(cleanSlotMeta(null)).toBe(null);
    expect(cleanSlotMeta('tekst')).toBe(null);
    const m = cleanSlotMeta({ place: 5, people: 'bestaatniet', age: 99, day: -3, at: 'gisteren' });
    expect(m).toEqual({
      place: '',
      challenge: '',
      people: 'friezen',
      age: 0,
      day: 1,
      at: 0,
      won: false,
      seed: null,
      map: 'continent',
      size: 256,
    });
  });

  it('de lijst heeft altijd alle plekken, leeg = null', () => {
    const index = cleanSlotIndex({ 2: meta(), onzin: meta() });
    expect(Object.keys(index).sort()).toEqual([...SLOTS].sort());
    expect(index[AUTO_SLOT]).toBe(null);
    expect(index['2']!.place).toBe('Eikendal');
    expect(filledCount(index)).toBe(1);
    expect(filledCount(cleanSlotIndex(undefined))).toBe(0);
  });

  it('"Verder spelen" kiest de nieuwste opslag', () => {
    expect(latestSlot(cleanSlotIndex({}))).toBe(null);
    const index = cleanSlotIndex({ auto: meta({ at: 500 }), 1: meta({ at: 900 }), 3: meta({ at: 700 }) });
    expect(latestSlot(index)).toBe('1');
    // Een oude opslag zonder tijd telt nog wel, als er niets anders is
    expect(latestSlot(cleanSlotIndex({ auto: meta({ at: 0 }) }))).toBe(AUTO_SLOT);
  });

  it('titel en samenvatting van een kaartje', () => {
    expect(slotTitle(meta())).toBe('Eikendal');
    expect(slotTitle(meta({ challenge: 'Lange winter' }))).toBe('Lange winter');
    expect(slotSummary(meta())).toBe('Friezen · Bronstijd · dag 12');
  });

  it('tijd van opslaan in gewone taal', () => {
    const now = new Date(2026, 9, 15, 14, 40).getTime();
    const at = (y: number, mo: number, d: number, h: number, mi: number) =>
      new Date(y, mo, d, h, mi).getTime();
    expect(savedAtText(0, now)).toBe('eerder opgeslagen');
    expect(savedAtText(now - 20 * 1000, now)).toBe('zojuist');
    expect(savedAtText(now - 5 * 60000, now)).toBe('5 min geleden');
    expect(savedAtText(at(2026, 9, 15, 9, 5), now)).toBe('vandaag 09:05');
    expect(savedAtText(at(2026, 9, 14, 22, 30), now)).toBe('gisteren 22:30');
    expect(savedAtText(at(2026, 9, 3, 18, 4), now)).toBe('3 okt 18:04');
    expect(savedAtText(at(2025, 11, 31, 18, 4), now)).toBe('31 dec 2025');
  });

  it('kaartje uit een hele opslag (de oude opslag verhuist zo naar de automatische plek)', () => {
    const save = { seed: 7, ages: 9, g: { people: 'norse', age: 4, day: 30, won: true } };
    expect(metaFromSave(save)).toEqual({
      place: PLACES[7 % PLACES.length],
      challenge: '',
      people: 'norse',
      age: 4,
      day: 30,
      at: 0,
      won: true,
      seed: 7,
      map: 'continent',
      size: 256,
    });
    // Opslag van vóór de negen tijdperken: tijdperk 2 van toen is nu tijdperk 3
    expect(metaFromSave({ seed: 1, g: { age: 2, day: 3 } })!.age).toBe(3);
    // Een uitdaging heet naar de uitdaging
    const challenge = SCENARIOS[0];
    expect(metaFromSave({ seed: 1, ages: 9, g: { scenario: { k: challenge.k } } })!.challenge).toBe(
      challenge.n,
    );
    expect(metaFromSave(null)!.day).toBe(1);
    // Kaartsoort en kaartgrootte komen mee uit de opslag
    const big = metaFromSave({ seed: 3, ages: 9, size: 384, g: { opts: { map: 'islands' } } })!;
    expect(big.map).toBe('islands');
    expect(big.size).toBe(384);
  });

  it('een duidelijke melding als opslaan niet lukt', () => {
    expect(saveErrorText('quota')).toMatch(/vol/);
    expect(saveErrorText('quota')).toMatch(/Laden/);
    // In het opslaanscherm zelf: wis daar een plek met de knop ✕
    expect(saveErrorText('quota', true)).toMatch(/vol/);
    expect(saveErrorText('quota', true)).toMatch(/✕/);
    expect(saveErrorText('quota', true)).not.toMatch(/Laden/);
    expect(saveErrorText('blocked')).toMatch(/lukt niet/);
    expect(saveErrorText('blocked', true)).toMatch(/lukt niet/);
  });

  it('hetzelfde spel herkennen aan wereld en uitdaging', () => {
    expect(sameGame(meta({ seed: 5, day: 3 }), meta({ seed: 5, day: 40 }))).toBe(true);
    expect(sameGame(meta({ seed: 5 }), meta({ seed: 6 }))).toBe(false);
    expect(sameGame(meta({ seed: 5 }), meta({ seed: 5, challenge: 'Lange winter' }))).toBe(false);
    // Een kaartje zonder wereld (van vóór dit veld) of een lege plek: niet zeker, dus nee
    expect(sameGame(meta(), meta())).toBe(false);
    expect(sameGame(null, meta({ seed: 5 }))).toBe(false);
    // Zelfde zaadcode, maar een andere kaartsoort of grootte: een andere wereld
    expect(sameGame(meta({ seed: 5 }), meta({ seed: 5, size: 384 }))).toBe(false);
    expect(sameGame(meta({ seed: 5 }), meta({ seed: 5, map: 'islands' }))).toBe(false);
    // Een kaartje van vóór de kaartgroottes was altijd een gewone wereld (256)
    expect(sameGame(cleanSlotMeta({ seed: 5 }), meta({ seed: 5, size: 256 }))).toBe(true);
  });

  it('het spel in een paar woorden, en de waarschuwing bij een nieuwe wereld', () => {
    expect(gameText(meta())).toBe('Eikendal, dag 12');
    expect(replaceWarningText(meta())).toMatch(/Eikendal, dag 12/);
    expect(replaceWarningText(meta())).toMatch(/Opslaan/);
  });
});

describe('kaartrijen inpakken', () => {
  it('nullen worden kort, en alles komt precies terug', () => {
    const bytes = new Uint8Array(70000);
    bytes[3] = 9;
    bytes[600] = 255;
    bytes.fill(4, 1000, 1300);
    const packed = packZeros(bytes);
    expect(packed.length).toBeLessThan(bytes.length / 50);
    expect(unpackZeros(packed, bytes.length)).toEqual(bytes);
  });

  it('ook losse nullen tussen andere getallen', () => {
    const bytes = Uint8Array.from([0, 1, 0, 0, 2, 0, 3, 0]);
    expect(unpackZeros(packZeros(bytes), bytes.length)).toEqual(bytes);
    expect(unpackZeros(packZeros(new Uint8Array(0)), 0)).toEqual(new Uint8Array(0));
  });

  it('base64 heen en terug', () => {
    const bytes = Uint8Array.from({ length: 70000 }, (_, i) => (i * 37) % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});
