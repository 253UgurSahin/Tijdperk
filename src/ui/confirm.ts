// "Zeker? Klik nogmaals": één manier voor alles wat niet terug te draaien is (profiel wissen, oorlog
// verklaren, afbreken, nieuw spel). De tweede klik telt pas na 0,4 seconde, zodat een dubbelklik of een
// trillende vinger niet per ongeluk doorgaat, en hooguit 5 seconden lang.
const armedAt = new Map<string, number>();
const MIN = 400,
  MAX = 5000;

/** Geeft true bij een geldige tweede klik; anders "spant" het de vraag (en is het aan de aanroeper om dat te tonen). */
export function confirmTwice(key: string): boolean {
  const now = performance.now(),
    since = now - (armedAt.get(key) ?? -1e9);
  if (since > MIN && since < MAX) {
    armedAt.delete(key);
    return true;
  }
  if (since >= MAX || since < 0) armedAt.set(key, now);
  // (een klik binnen 0,4 s laat de vraag gewoon staan)
  return false;
}
/** Staat de vraag nog open? (voor het tekenen van "Zeker?") */
export const isArmed = (key: string): boolean => {
  const since = performance.now() - (armedAt.get(key) ?? -1e9);
  return since >= 0 && since < MAX;
};
/** De vraag intrekken (bijv. bij een andere selectie). */
export const disarm = (key: string): void => {
  armedAt.delete(key);
};
