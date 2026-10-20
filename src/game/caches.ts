// Tussenresultaten die elke halve seconde opnieuw worden berekend: licht, stroom, wie wat verzamelt,
// en hoeveel je van elke grondstof op voorraad wilt hebben.
import type { Building, BuildingDef, Cost } from '../types';
import { W } from '../config';
import { AGE_UP } from '../data/ages';
import { B } from '../data/buildings';
import { NEXT_VILLAGERS, VILLAGER_FOOD, basePower, plentyOf, wantedStock } from '../data/economy';
import { NI, NODES, RES_NODES } from '../data/nodes';
import { GATHER, RES, RKEYS } from '../data/resources';
import { popCap, popNow, trainCost } from './entities';
import { armyUpkeep } from './military';
import { G } from './state';
import { darkness } from './time';
import { mul } from './bonus';
import { bLight, bRate } from './upgrades';
import { dist } from '../util/math';
import { amt, claims, isUnl, node, nodeLists } from '../world/world';

/** Een centrale gaat aan of uit: de voorraad stroom meteen bijwerken, zodat de volgende centrale dat ook ziet. */
export const adjustPowerSup = (delta: number): void => {
  powerSup += delta;
  powerRatio = powerDem ? Math.min(1, powerSup / powerDem) : 1;
};

/** Lichtbronnen (plek, straal, warm of koud licht). */
export let lights: { x: number; y: number; r: number; warm: boolean }[] = [],
  powerRatio = 1,
  powerSup = 0,
  powerDem = 0,
  /** Wat er te verzamelen valt (1 of true), en hoeveel dorpelingen per grondstof werken. */
  avail: Record<string, number | boolean> = {},
  wr: Record<string, number> = {},
  /** Grondstoffen die gebouwen of soldaten nodig hebben (1 = nodig). */
  demand: Record<string, number> = {},
  /** Wat je nu spaart: de kosten van het volgende tijdperk (of in het laatste tijdperk de sterrenpoort). */
  goal: Cost = {},
  /** Zoveel verbruiken je werkende gebouwen per minuut; bij voedsel ook wat je volk en leger eten. */
  usePerMin: Record<string, number> = {},
  /** Hoeveel je van elke grondstof op voorraad wilt hebben (zie wantedStock in data/economy.ts). */
  wanted: Record<string, number> = {};
/** Hoeveel dorpelingen op weg zijn naar elke bouwplaats en akker (op id). */
export const siteCnt = new Map<number, number>(),
  farmCnt = new Map<number, number>();
/** Hoeveel stroom centrale b levert als hij draait. Alleen voor gebouwen met `gen` (een centrale). */
export const genPower = (b: Building): number => B[b.type].gen!.power * bRate(b) * mul('power');
/**
 * Gebruikt dit gebouw nu stroom? Niet als het niets te doen heeft: een fabriek of pomp die vanzelf pauzeert,
 * een pomp op een lege bron, of een kazerne of werkplaats zonder wachtrij.
 */
function needsPower(b: Building): boolean {
  const d = B[b.type];
  if (b.plenty) return false;
  if (d.train) return b.q.length > 0;
  if (d.pump) {
    const i = b.y * W + b.x;
    return node[i] === NI.oil && amt[i] > 0;
  }
  return true;
}
export function computeCaches(): void {
  powerSup = 0;
  powerDem = 0;
  let hall = false;
  for (const b of G.bs) {
    if (!b.done) continue;
    const d = B[b.type];
    if (b.type === 'townhall') hall = true;
    if (d.gen && b.on) {
      const pw = genPower(b);
      if (d.gen.solar) powerSup += pw * (darkness() > 0.3 ? 0.15 : 1);
      else if (b.run) powerSup += pw;
    }
    if (d.power && b.on && needsPower(b)) powerDem += d.power;
  }
  // Noodstroom: het stamhuis geeft vanaf de Industriële tijd altijd een beetje (zie data/economy.ts)
  if (hall) powerSup += basePower(G.age);
  powerRatio = powerDem ? Math.min(1, powerSup / powerDem) : 1;
  lights = [];
  for (const b of G.bs) {
    if (!b.done) continue;
    const d = B[b.type];
    if (!d.light) continue;
    if (d.power && powerRatio < 0.3) continue;
    if (d.gen && !d.gen.solar && !b.run) continue;
    lights.push({
      x: b.x + d.size / 2,
      y: b.y + d.size / 2,
      r: bLight(b),
      warm: b.type === 'campfire' || b.type === 'lantern' || (b.type === 'townhall' && G.age < 5),
    });
  }
  claims.fill(0);
  wr = {};
  siteCnt.clear();
  farmCnt.clear();
  for (const v of G.vs) {
    if (v.hidden) continue;
    const t = v.tgt;
    if (t) {
      if (t.k === 'node') claims[t.i] = Math.min(255, claims[t.i] + 1);
      else if (t.k === 'farm') farmCnt.set(t.b.id, (farmCnt.get(t.b.id) || 0) + 1);
      else if (t.k === 'site') siteCnt.set(t.b.id, (siteCnt.get(t.b.id) || 0) + 1);
    }
    if (v.res && (v.state === 'gather' || v.state === 'walk')) wr[v.res] = (wr[v.res] || 0) + 1;
  }
  demand = {};
  for (const b of G.bs) {
    if (!b.done || !b.on || b.plenty) continue;
    const d = B[b.type];
    const inp = d.conv ? d.conv.in : d.gen && d.gen.in;
    if (inp) for (const k in inp) demand[k] = 1;
  }
  if (G.us.length || G.bs.some(b => b.q.length)) demand.food = 1;
  computeStockNeeds();
}

/** Wat je nu spaart: de stap naar het volgende tijdperk, of in het laatste tijdperk de sterrenpoort. */
function goalCost(): Cost {
  const next = AGE_UP[G.age + 1];
  if (next) return next.cost;
  // Een uitdaging heeft geen keuze hoe je wint; anders telt de poort alleen als je daarmee wilt winnen
  const gateWins = !!G.scenario || G.opts.victories.includes('stargate');
  return gateWins && !G.bs.some(b => b.type === 'stargate') ? B.stargate.cost : {};
}

/**
 * Wat een fabriek of pomp maakt. Leeg bij gebouwen die niets verbruiken (zoals een windmolen):
 * die hoeven nooit te pauzeren, want stilstaan spaart dan niets.
 */
function productOf(d: BuildingDef): string[] {
  if (d.pump) return [d.pump.res];
  if (d.conv && Object.keys(d.conv.in).length) return Object.keys(d.conv.out);
  return [];
}

/** Voedsel voor de volgende paar dorpelingen die het stamhuis traint, zolang er plek voor ze is. */
function trainingFood(): number {
  if (!G.autoTrain && G.trainQ <= 0) return 0;
  const room = Math.max(0, popCap() - popNow());
  return Math.min(room, NEXT_VILLAGERS) * trainCost();
}

/**
 * Per grondstof: hoeveel je werkende gebouwen per minuut verbruiken, en hoeveel je op voorraad wilt hebben.
 * Daarna kijkt elke fabriek of pomp of er genoeg is van wat hij maakt: dan pauzeert hij vanzelf.
 */
function computeStockNeeds(): void {
  goal = goalCost();
  usePerMin = {};
  const use = (k: string, perMinute: number) => (usePerMin[k] = (usePerMin[k] || 0) + perMinute);
  // Centrales stoken alleen als de noodstroom van het stamhuis niet genoeg is
  const plantsBurn = powerDem > basePower(G.age);
  for (const b of G.bs) {
    if (!b.done || !b.on) continue;
    const d = B[b.type];
    if (d.conv && !b.plenty) {
      const speed = bRate(b) * mul('conv.speed');
      for (const k in d.conv.in) use(k, ((d.conv.in[k] * 60) / d.conv.t) * speed);
    }
    // Een centrale zonder zonlicht heeft altijd een stooktijd (t), zie data/buildings
    if (d.gen && d.gen.in && plantsBurn) for (const k in d.gen.in) use(k, (d.gen.in[k] * 60) / d.gen.t!);
  }
  // Voedsel: je volk en je leger eten elke minuut, en nieuwe dorpelingen kosten ook voedsel
  use('food', G.vs.length * VILLAGER_FOOD + armyUpkeep());
  wanted = {};
  for (const k of RKEYS) {
    const once = (goal[k] || 0) + (k === 'food' ? trainingFood() : 0);
    wanted[k] = wantedStock({ goal: once, perMinute: usePerMin[k] || 0, age: G.age });
  }
  // Genoeg van het product? Dan pauzeert de fabriek (met twee grenzen, zodat hij niet hapert)
  for (const b of G.bs) {
    const made = productOf(B[b.type]);
    b.plenty = made.length > 0 && made.every(k => plentyOf(G.res[k], wanted[k], !!b.plenty));
  }
}
export function computeAvail(): void {
  avail = {};
  for (const r of GATHER) {
    if (RES[r].age > G.age) continue;
    if (r === 'food' && G.bs.some(b => b.type === 'farm' && b.done)) {
      avail.food = 1;
      continue;
    }
    for (const t of RES_NODES[r]) {
      if (NODES[t].age > G.age) continue;
      const L = nodeLists[t];
      for (let j = 0; j < L.length; j++) {
        const i = L[j];
        if (node[i] === t && amt[i] > 0 && isUnl(i % W, (i / W) | 0)) {
          avail[r] = 1;
          break;
        }
      }
      if (avail[r]) break;
    }
  }
  // Olie pomp je op: is er een oliebron binnen je gebied? (de coach gebruikt dit)
  if (G.age >= RES.oil.age)
    avail.oil = nodeLists[NI.oil].some(i => node[i] === NI.oil && amt[i] > 0 && isUnl(i % W, (i / W) | 0));
}
export function litAt(x: number, y: number): boolean {
  for (const L of lights) if (dist(x, y, L.x, L.y) <= L.r - 0.3) return true;
  return false;
}
