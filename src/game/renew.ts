// Vernieuwen: een verouderd gebouw (hut, wachttoren, kampvuur, ...) op dezelfde plek omzetten in zijn opvolger
// (leemhuis, bronzen toren, lantaarn, ...), en oude wegen in één keer naar de wegsoort van nu brengen.
import type { Building, Cost } from '../types';
import { H, W } from '../config';
import { B } from '../data/buildings';
import { NI, NODES } from '../data/nodes';
import { SUCCESSOR, canMake } from '../data/succession';
import { computeAvail, computeCaches } from './caches';
import { has, pay } from './economy';
import { fxRing } from './fx';
import { buildCost } from './placement';
import { G } from './state';
import { bMaxHp, roadTier } from './upgrades';
import { TER, bmap, isUnl, node, road, setBlk, ter } from '../world/world';

// Vernieuwen kost minder dan nieuw bouwen: het oude gebouw is er al (zelfde korting als bij afbreken)
const RENEW_DISCOUNT = 0.7;
// Wat er onder een groter gebouw weg mag: losse dingen, geen ertsaders
const CLEAR = new Set(['tree', 'bush', 'rock', 'sand']);

/** De opvolger waarin dit gebouw vernieuwd kan worden (bestaat al in dit tijdperk), of null. */
export function renewTarget(b: Building): string | null {
  if (!b.done || canMake(b.type, G.age)) return null; // nog gewoon van deze tijd: niets te vernieuwen
  // Volg de keten van opvolgers (hut → leemhuis → stenen huis → ...) tot wat je nu kunt bouwen
  let next = SUCCESSOR[b.type];
  for (let guard = 0; next && B[next] && !canMake(next, G.age) && guard < 12; guard++) next = SUCCESSOR[next];
  if (!next || !B[next] || !canMake(next, G.age)) return null;
  return renewFits(b, next) ? next : null;
}

/** Past de opvolger op deze plek? Groter dan het oude gebouw: dan moeten de extra tegels vrij zijn. */
export function renewFits(b: Building, next: string): boolean {
  const s0 = B[b.type].size,
    s1 = B[next].size;
  if (s1 <= s0) return true;
  for (let dy = 0; dy < s1; dy++)
    for (let dx = 0; dx < s1; dx++) {
      if (dx < s0 && dy < s0) continue; // de eigen tegels
      const x = b.x + dx,
        y = b.y + dy;
      if (x >= W || y >= H || !isUnl(x, y)) return false;
      const i = y * W + x;
      if (ter[i] === TER.WATER || ter[i] === TER.ROCK || bmap[i] || road[i]) return false;
      if (node[i] && !CLEAR.has(NODES[node[i]].k)) return false;
    }
  return true;
}

/** Wat vernieuwen kost: de prijs van de opvolger met korting. */
export function renewCost(next: string): Cost {
  const c = buildCost(next),
    out: Cost = {};
  for (const k in c) out[k] = Math.round(c[k] * RENEW_DISCOUNT);
  return out;
}

/** Vernieuw dit gebouw naar zijn opvolger. Geeft true als het gelukt is. */
export function renewBuilding(b: Building): boolean {
  const next = renewTarget(b);
  if (!next) return false;
  const cost = renewCost(next);
  if (!has(cost)) return false;
  pay(cost);
  const s0 = B[b.type].size,
    s1 = B[next].size;
  setBlk(b, false);
  // Het gebouw zelf blijft hetzelfde object (nummer, groepen, verzamelpunt): alleen de soort verandert
  b.type = next;
  b.lvl = 0;
  b.hp = bMaxHp(b);
  b.pop_t = G.t; // even opveren (zie render/sync.ts)
  if (!B[next].train) b.q = [];
  // Een groter gebouw neemt zijn nieuwe tegels in (losse bomen en stenen gaan weg)
  if (s1 > s0)
    for (let dy = 0; dy < s1; dy++)
      for (let dx = 0; dx < s1; dx++) {
        const i = (b.y + dy) * W + b.x + dx;
        bmap[i] = b.id;
        if (node[i] && node[i] !== NI.oil) node[i] = 0;
      }
  setBlk(b, true);
  fxRing(b.x + s1 / 2, b.y + s1 / 2, '#ffe6a8');
  computeCaches();
  computeAvail();
  return true;
}

/** Alle wegtegels die ouder zijn dan de wegsoort van nu. */
export const oldRoadCount = (): number => {
  const t = roadTier();
  let n = 0;
  for (let i = 0; i < road.length; i++) if (road[i] && road[i] < t) n++;
  return n;
};
/** Wat het kost om alle oude wegen te vernieuwen (de prijs van een wegtegel per tegel). */
export function roadRenewCost(): Cost | null {
  const n = oldRoadCount();
  if (!n) return null;
  const per = buildCost('road'),
    out: Cost = {};
  for (const k in per) out[k] = per[k] * n;
  return out;
}
/** Alle oude wegen naar de wegsoort van nu. Geeft hoeveel tegels er vernieuwd zijn (0 als het niet lukte). */
export function renewRoads(): number {
  const cost = roadRenewCost();
  if (!cost || !has(cost)) return 0;
  pay(cost);
  const t = roadTier();
  let n = 0;
  for (let i = 0; i < road.length; i++)
    if (road[i] && road[i] < t) {
      road[i] = t;
      n++;
    }
  return n;
}
