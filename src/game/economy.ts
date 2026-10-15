import type { Building, Cost } from '../types';
// Betalen en ontvangen van grondstoffen, en uitleg voor de speler: waarom wacht een gebouw, wat is op?
import { W } from '../config';
import { AGE_UP } from '../data/ages';
import { B } from '../data/buildings';
import { basePower } from '../data/economy';
import { NI } from '../data/nodes';
import { GATHER, RES } from '../data/resources';
import { avail, goal, powerDem, powerRatio, powerSup, usePerMin, wanted } from './caches';
import { popCap, popNow } from './entities';
import { G } from './state';
import { darkness } from './time';
import { amt, node } from '../world/world';

export function has(c: Cost, m = 1): boolean {
  for (const k in c) if (G.res[k] < c[k] * m) return false;
  return true;
}
export function pay(c: Cost) {
  for (const k in c) G.res[k] -= c[k];
}
export function gain(c: Cost) {
  for (const k in c) G.res[k] += c[k];
}

/** "koper", "koper en tin": namen van grondstoffen in een zin. */
function resWords(keys: string[]): string {
  const names = keys.map(k => RES[k].n.toLowerCase());
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}` : names[0];
}

/** Uitleg bij te weinig stroom, of '' als er genoeg is. */
function powerReason(): string {
  if (powerRatio >= 1) return '';
  // Alleen de noodstroom van het stamhuis (zie data/economy.ts): genoeg om langzaam door te werken
  const emergency = basePower(G.age);
  if (emergency > 0 && powerSup <= emergency) return 'Weinig stroom: alleen noodstroom van het stamhuis';
  return powerRatio < 0.5 ? 'Te weinig stroom' : 'Werkt trager: te weinig stroom';
}

/**
 * Waarom wacht dit gebouw? Eén korte zin voor de speler, of '' als het gewoon werkt.
 * Alleen voor gebouwen die iets maken: fabrieken, pompen, centrales en kazernes. Bij de rest altijd ''.
 */
export function waitReason(b: Building): string {
  const d = B[b.type];
  if (!b.done || !(d.conv || d.pump || d.gen || d.train)) return '';
  if (!b.on) return 'Uitgezet door jou';
  if (d.gen) {
    if (d.gen.solar) return darkness() > 0.3 ? 'Het is donker: weinig zonnestroom' : '';
    if (b.run) return '';
    // Een centrale zonder zonlicht heeft altijd brandstof (in), zie data/buildings
    const fuel = d.gen.in!;
    const missing = Object.keys(fuel).filter(k => G.res[k] < fuel[k]);
    if (missing.length) return `Geen ${resWords(missing)}`;
    // Hij stookt alleen als de stroom echt nodig is (zie bUpdate in game/buildings.ts)
    return powerSup < powerDem ? '' : 'Stroom is nu niet nodig';
  }
  if (d.conv) {
    // Vanzelf gepauzeerd (zie game/caches.ts): er is genoeg van wat hij maakt
    if (b.plenty) return `Genoeg ${resWords(Object.keys(d.conv.out))} op voorraad`;
    const missing = Object.keys(d.conv.in).filter(k => G.res[k] < d.conv!.in[k]);
    if (b.starved && missing.length) return `Geen ${resWords(missing)}`;
    // Hij bewaart een grondstof voor het volgende tijdperk (zie keptForGoal in game/buildings.ts)
    if (b.saving) {
      const forWhat = AGE_UP[G.age + 1] ? 'het volgende tijdperk' : 'de sterrenpoort';
      return `${RES[b.saving].n} bewaard voor ${forWhat}`;
    }
    return d.power ? powerReason() : '';
  }
  if (d.pump) {
    const i = b.y * W + b.x;
    if (node[i] !== NI.oil || amt[i] <= 0) return 'De oliebron is leeg';
    if (b.plenty) return `Genoeg ${resWords([d.pump.res])} op voorraad`;
    return d.power ? powerReason() : '';
  }
  // Een kazerne of werkplaats: alleen als er iets in de wachtrij staat
  if (!b.q.length) return '';
  if (b.blocked || popNow() >= popCap()) return 'Geen plek: bouw meer woningen';
  return d.power ? powerReason() : '';
}

/**
 * Grondstoffen die je nu nodig hebt (voor het volgende tijdperk of voor je werkende gebouwen), maar die in je
 * eigen gebied op zijn: dan moet je uitbreiden. Voedsel niet, want akkers raken nooit leeg.
 * Olie telt ook mee: die pomp je op, maar een oliebron kan net zo goed leeg raken.
 */
export function missingResources(): string[] {
  const out: string[] = [];
  for (const r of [...GATHER, 'oil']) {
    if (r === 'food' || RES[r].age > G.age || avail[r]) continue;
    const forGoal = (goal[r] || 0) > G.res[r];
    const forBuildings = (usePerMin[r] || 0) > 0 && G.res[r] < (wanted[r] || 0);
    if (forGoal || forBuildings) out.push(r);
  }
  return out;
}
