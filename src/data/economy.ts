// Rekenregels voor de economie, zonder spelstand: hoeveel je van een grondstof wilt hebben, wie wat gaat
// halen, wanneer een fabriek pauzeert en hoeveel noodstroom het stamhuis geeft. Puur, dus te testen.

/** Zoveel minuten verbruik wil je op voorraad: van fabrieken, centrales en wat je volk en leger eten. */
export const STOCK_MINUTES = 3;

/** Zoveel voedsel eet één dorpeling per minuut. */
export const VILLAGER_FOOD = 3;
/** Zolang er plek is, houd je voedsel klaar voor zoveel nieuwe dorpelingen (die het stamhuis traint). */
export const NEXT_VILLAGERS = 5;

/** Een kleine buffer voor gebouwen, soldaten en verbeteringen. Groeit met elk tijdperk. */
export const reserveFor = (age: number): number => 100 + 50 * age;

/** Wat bepaalt hoeveel je van één grondstof op voorraad wilt hebben (zie wantedStock). */
export interface StockNeed {
  /**
   * Eenmalig nodig: voor het volgende tijdperk (in het laatste tijdperk: de sterrenpoort),
   * en bij voedsel ook voor de volgende paar nieuwe dorpelingen.
   */
  goal: number;
  /** Zoveel verbruiken je werkende gebouwen per minuut; bij voedsel ook wat je volk en leger eten. */
  perMinute: number;
  /** Je tijdperk (voor de buffer). */
  age: number;
}

/** De gewenste voorraad: wat het volgende tijdperk kost, plus een paar minuten verbruik, plus een buffer. */
export const wantedStock = ({ goal, perMinute, age }: StockNeed): number =>
  goal + perMinute * STOCK_MINUTES + reserveFor(age);

// Hoe hard een tekort dorpelingen trekt, en hoeveel zin er overblijft als er al genoeg is
const SHORTAGE_PULL = 6;
const KEEP_BUSY = 0.25;
// Boven zoveel keer de gewenste voorraad maakt "nog meer" niet meer uit: dan verdelen ze zich gelijk
const FILL_CAP = 4;

/**
 * Hoe graag dorpelingen een grondstof gaan halen. `base` is de vaste voorkeur (BASEW in data/resources.ts).
 * Onder de gewenste voorraad: meer naarmate het tekort groter is. Erboven: veel minder, en ver erboven
 * bijna niets. Is alles ruim genoeg, dan verdelen ze zich rustig over alles, met een kleine voorkeur voor
 * wat net genoeg is: zo staan niet alle dorpelingen bij hetzelfde.
 */
export function gatherPull(stock: number, wanted: number, base: number): number {
  const fill = Math.max(0, stock) / Math.max(1, wanted); // 1 = precies genoeg
  const shortage = Math.max(0, 1 - fill);
  return base * (shortage * SHORTAGE_PULL + KEEP_BUSY / Math.min(FILL_CAP, Math.max(1, fill)));
}

/**
 * Een fabriek pauzeert vanzelf als er zoveel keer de gewenste voorraad van zijn product is,
 * en gaat pas weer aan onder de lagere grens. Twee grenzen, zodat hij niet steeds aan en uit springt.
 */
export const PLENTY_PAUSE = 3;
export const PLENTY_RESUME = 2;

/** Is er genoeg van een product? `pausedNow`: pauzeert de fabriek nu al (dan geldt de lagere grens). */
export const plentyOf = (stock: number, wanted: number, pausedNow: boolean): boolean =>
  stock >= wanted * (pausedNow ? PLENTY_RESUME : PLENTY_PAUSE);

/**
 * Noodstroom: vanaf de Industriële tijd geeft het stamhuis altijd een beetje stroom. Genoeg om één
 * oliepomp (3) en één raffinaderij (5) langzaam te laten draaien: zo komt olie → brandstof → stroom
 * altijd weer op gang.
 */
export const BASE_POWER = 5;
export const BASE_POWER_AGE = 5;
export const basePower = (age: number): number => (age >= BASE_POWER_AGE ? BASE_POWER : 0);
