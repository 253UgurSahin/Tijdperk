import { describe, expect, it } from 'vitest';
import { SHORT_TOAST, groupRepeats, shortToast } from '../src/ui/toasttext';

describe('korte meldingen', () => {
  it('een korte melding blijft heel', () => {
    expect(shortToast('Kanonbatterij is klaar')).toBe('Kanonbatterij is klaar');
    expect(shortToast('Nieuw gebied ontgonnen. Gevonden: koper, tin.')).toBe(
      'Nieuw gebied ontgonnen. Gevonden: koper, tin.',
    );
  });
  it('van een lange melding blijft de eerste zin over', () => {
    const avond =
      'De avond valt. Buiten het licht gaan dorpelingen naar huis. Kampvuren houden ze aan het werk.';
    expect(avond.length).toBeGreaterThan(SHORT_TOAST);
    expect(shortToast(avond)).toBe('De avond valt.');
    expect(
      shortToast('Onderzoek klaar: Stoommachine. Fabrieken werken sneller en verbruiken minder kolen.'),
    ).toBe('Onderzoek klaar: Stoommachine.');
  });
  it('een heel korte eerste zin blijft aan de volgende vast', () => {
    const aanval = 'Aanval! 6 × musketiers uit het noorden, met een kampioen voorop. Houd je torens klaar!';
    expect(shortToast(aanval)).toBe('Aanval! 6 × musketiers uit het noorden, met een kampioen voorop.');
  });
  it('een punt in een getal is geen einde van een zin', () => {
    const tekst = 'Je hebt nu 1.500 hout en 2.000 steen op voorraad, genoeg voor een flink stuk muur erbij';
    expect(shortToast(tekst)).toBe(tekst);
  });
});

describe('Logboek: dezelfde regels samen', () => {
  it('telt dezelfde regel vlak na elkaar op, maar niet op een andere dag', () => {
    const log = [
      { d: 3, t: 'Kanonbatterij is klaar' },
      { d: 3, t: 'Kanonbatterij is klaar' },
      { d: 3, t: 'Hut is klaar' },
      { d: 2, t: 'Hut is klaar' },
    ];
    expect(groupRepeats(log).map(r => [r.entry.t, r.count])).toEqual([
      ['Kanonbatterij is klaar', 2],
      ['Hut is klaar', 1],
      ['Hut is klaar', 1],
    ]);
  });
});
