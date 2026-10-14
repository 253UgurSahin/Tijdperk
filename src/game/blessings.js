// Zegeningen in het spel: wanneer je mag kiezen, welke kaarten er liggen en wat een keuze doet.
import { blessingOffer } from '../data/blessings.js';
import { applyBonusChange } from './bonus.js';
import { spawnUnit, spawnVillager } from './entities.js';
import { bestMerc, th } from './events.js';
import { G } from './state.js';

/*
 * G.blessings: de sleutels van de zegeningen die je koos (de bonussen telt game/bonus.js).
 * G.blessingQueue: keuzes die nog komen, als { age, at }. Vanaf speltijd `at` liggen de kaarten
 * van tijdperk `age` klaar. De interface (ui/blessings.js) laat ze zien als het scherm vrij is.
 */

/** Een nieuw tijdperk: er komt een keuze bij. */
export function earnBlessing() {
  G.blessingQueue.push({ age: G.age, at: G.t });
}

/** De keuze die nu klaarligt, of null als er (nog) niets te kiezen is. */
export function waitingBlessing() {
  const next = G && G.blessingQueue && G.blessingQueue[0];
  return next && G.t >= next.at ? next : null;
}

/** De kaarten voor de keuze die nu klaarligt. */
export function blessingChoices() {
  const next = waitingBlessing();
  if (!next) return [];
  return blessingOffer(G.seed, next.age, G.blessings, { peaceful: G.peaceful });
}

/** Kies zegening k uit de kaarten die nu klaarliggen. Geeft de zegening terug, of null. */
export function takeBlessing(k) {
  const blessing = blessingChoices().find(card => card.k === k);
  if (!blessing) return null;
  G.blessingQueue.shift();
  // Via het register: geeft de zegening meer (of minder) levens, dan verandert wat er staat mee
  applyBonusChange(() => G.blessings.push(blessing.k));
  if (blessing.oneoff) ONE_OFFS[blessing.oneoff]();
  return blessing;
}

/** Geen kaarten meer over? Dan vervalt deze keuze. */
export function skipBlessing() {
  G.blessingQueue.shift();
}

// Wat eenmalige zegeningen meteen doen (de namen staan bij `oneoff` in data/blessings.js)
export const ONE_OFFS = {
  villagers3() {
    const home = th();
    if (!home) return;
    for (let k = 0; k < 3; k++) spawnVillager(home.x + 0.5 + k * 0.6, home.y + 2.4);
  },
  soldiers3() {
    const home = th(),
      kind = bestMerc();
    if (!home || !kind) return;
    for (let i = 0; i < 3; i++) {
      const soldier = spawnUnit(kind, home.x + 1 + i * 0.6, home.y + 3);
      soldier.stance = G.stance;
    }
  },
};
