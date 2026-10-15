// De vier moeilijkheden: hoe vaak en hoe zwaar aanvallen zijn, en waarmee je begint. Puur.

/*
 * Het nummer in de lijst is G.diff (0 = Vredig, 1 = Normaal, 2 = Zwaar, 3 = Meedogenloos).
 * - n: naam, d: korte uitleg voor het nieuw-spelscherm
 * - peaceful: geen aanvallen (de vredige modus staat meteen aan)
 * - everyNight: elke nacht een aanval in plaats van om de nacht
 * - raidSize: het aantal aanvallers gaat keer dit getal; raidMax: nooit meer aanvallers dan dit
 * - raidHp: aanvallers hebben zoveel keer meer levens
 * - start: grondstoffen bij het begin (je volk kan daar nog wat bij geven)
 * - score: je eindscore gaat keer dit getal
 */
export const DIFFICULTIES = [
  {
    n: 'Vredig',
    d: 'Geen aanvallen. Alleen bouwen.',
    peaceful: true,
    everyNight: false,
    raidSize: 1,
    raidMax: 30,
    raidHp: 1,
    start: { food: 200, wood: 160, stone: 60 },
    score: 0.5,
  },
  {
    n: 'Normaal',
    d: 'Om de nacht een aanval.',
    peaceful: false,
    everyNight: false,
    raidSize: 1,
    raidMax: 30,
    raidHp: 1,
    start: { food: 200, wood: 160, stone: 60 },
    score: 1,
  },
  {
    n: 'Zwaar',
    d: 'Elke nacht 1,4× zoveel vijanden. Minder voorraad.',
    peaceful: false,
    everyNight: true,
    raidSize: 1.4,
    raidMax: 30,
    raidHp: 1,
    start: { food: 150, wood: 120, stone: 40 },
    score: 1.5,
  },
  {
    n: 'Meedogenloos',
    d: 'Elke nacht 1,7× zoveel vijanden, en sterker. Weinig voorraad.',
    peaceful: false,
    everyNight: true,
    raidSize: 1.7,
    raidMax: 38,
    raidHp: 1.3,
    start: { food: 120, wood: 110, stone: 30 },
    score: 2,
  },
];

/** De standaardmoeilijkheid (Normaal). */
export const DEFAULT_DIFF = 1;

/** Een geldig moeilijkheidsnummer, of Normaal als het nummer niet bestaat. */
export const cleanDiff = d => (Number.isInteger(d) && DIFFICULTIES[d] ? d : DEFAULT_DIFF);

/** De moeilijkheid bij een nummer (met Normaal als het nummer niet bestaat). */
export const difficulty = d => DIFFICULTIES[cleanDiff(d)];
