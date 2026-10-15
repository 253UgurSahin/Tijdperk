// Vaste getallen: hoe groot de kaart is, hoe lang een dag duurt, enz.
export const CS = 16, // een gebied is CS bij CS tegels
  DAYLEN = 200,
  TW = 32,
  TH = 16,
  TAU = Math.PI * 2,
  R2 = Math.SQRT2;

// De kaartgrootte verschilt per spel (zie MAP_SIZES in data/maps.ts). Daarom zijn dit geen vaste getallen:
// setMapSize zet ze, vlak voordat een nieuwe of geladen wereld gemaakt wordt.
export let W = 256, // kaartbreedte in tegels
  H = 256, // kaarthoogte in tegels
  CX = W / 2, // midden van de kaart: hier begint je stam
  CY = H / 2,
  CN = W / CS; // zoveel gebieden in de breedte (en in de hoogte)

// Onderdelen die iets ter grootte van de kaart bewaren (rijen, plaatjes) melden zich hier aan.
// Krijgt de kaart een andere grootte, dan maken ze dat opnieuw.
const sizeListeners: (() => void)[] = [];

/** Laat `fn` draaien zodra de kaart een andere grootte krijgt. */
export function onMapSize(fn: () => void): void {
  sizeListeners.push(fn);
}

/** Zet de kaartgrootte: n bij n tegels. Doet niets als de kaart al zo groot is. */
export function setMapSize(n: number): void {
  if (n === W && n === H) return;
  W = H = n;
  CX = W / 2;
  CY = H / 2;
  CN = W / CS;
  for (const fn of sizeListeners) fn();
}
