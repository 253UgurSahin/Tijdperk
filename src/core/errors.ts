// Fouten opvangen: één fout mag het spel nooit stil laten vallen. Elke fout gaat naar de console (met wat
// er gebeurde), de speler ziet één melding, en bij een stortvloed aan fouten zetten we het spel op pauze.
import { store } from './store';

let shown = 0, // wanneer de speler voor het laatst een melding zag
  recent: number[] = []; // tijdstippen van de laatste fouten

/** Wordt door main.ts gezet: zo kunnen we het spel pauzeren en een melding tonen zonder kringimport. */
export const errorHooks: { pause?: () => void; toast?: (msg: string) => void } = {};

/** Meld een fout: loggen, één melding, en pauze als het blijft misgaan. `where` zegt in welk deel. */
export function reportError(where: string, e: unknown): void {
  console.error(`[Tijdperken] fout in ${where}:`, e);
  const now = performance.now();
  recent = recent.filter(t => now - t < 5000);
  recent.push(now);
  store.errors = (store.errors || 0) + 1;
  if (recent.length >= 30 && errorHooks.pause) {
    // Dertig fouten in vijf seconden: iets is echt kapot, dan liever stil dan een vastgelopen spel
    recent = [];
    errorHooks.pause();
    errorHooks.toast?.('Het spel is op pauze gezet na herhaalde fouten. Druk op spatie om verder te gaan.');
    return;
  }
  if (now - shown > 15000 && errorHooks.toast) {
    shown = now;
    errorHooks.toast('Er ging iets mis, maar het spel loopt door. Details staan in de console.');
  }
}

// Fouten buiten de spellus om (klikken, timers, beloftes) komen hier terecht
addEventListener('error', e => reportError('de pagina', e.error || e.message));
addEventListener('unhandledrejection', e => reportError('een belofte', e.reason));
