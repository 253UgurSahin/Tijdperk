// Uitlegtips die je maar één keer ziet. Welke je al zag, onthoudt de browser (ook na een nieuw spel).
const TKEY = 'tijdperken-tips';

// De browseropslag lezen we maar één keer. Werkt die opslag niet (privévenster), dan onthouden we het
// alleen zolang het spel openstaat: zo komt een tip toch niet steeds terug.
function readSeen(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(TKEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}
const seen = new Set(readSeen());

/** Heb je deze tip al eens gezien? */
export const tipSeen = (k: string): boolean => seen.has(k);

/** Onthoud dat je deze tip gezien hebt. */
export function markTip(k: string): void {
  if (seen.has(k)) return;
  seen.add(k);
  try {
    localStorage.setItem(TKEY, JSON.stringify([...seen]));
  } catch (e) {}
}
