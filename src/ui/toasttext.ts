// Korte meldingen: een lange melding wordt in beeld ingekort tot de eerste zin, en dezelfde melding vlak
// na elkaar telt op. (De hele tekst blijft in het Logboek staan.)

/** Tot zo veel tekens blijft een melding heel; een langere wordt ingekort tot de eerste zin. */
export const SHORT_TOAST = 72;

/**
 * De korte versie van een melding. Een korte melding blijft heel. Van een lange blijft de eerste zin over:
 * "De avond valt. Buiten het licht ..." wordt "De avond valt.". Een heel korte eerste zin (zoals
 * "Aanval!") blijft aan de volgende vast zitten, anders zegt hij te weinig.
 */
export function shortToast(text: string): string {
  if (text.length <= SHORT_TOAST) return text;
  const first = /^(.{12,}?[.!?])\s+\S/.exec(text);
  return first ? first[1] : text;
}

/** Een regel met hoe vaak hij vlak na elkaar kwam. */
export interface Repeated<T> {
  entry: T;
  count: number;
}

/** Dezelfde regels vlak na elkaar (zelfde dag, zelfde tekst) worden één regel met een aantal: "3× ...". */
export function groupRepeats<T extends { d: number; t: string }>(list: T[]): Repeated<T>[] {
  const out: Repeated<T>[] = [];
  for (const entry of list) {
    const last = out[out.length - 1];
    if (last && last.entry.d === entry.d && last.entry.t === entry.t) last.count++;
    else out.push({ entry, count: 1 });
  }
  return out;
}
