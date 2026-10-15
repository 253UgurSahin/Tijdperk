// Gebouwen herstellen: wat het kost en het herstel zelf (de knop Herstel in Leger en op de balk van de finale).
import type { Building, Cost } from '../types';
import { has, pay } from './economy';
import { G } from './state';
import { bMaxHp } from './upgrades';

// Per ontbrekend levenspunt: zoveel hout en steen
const WOOD_PER_HP = 0.08;
const STONE_PER_HP = 0.05;

/** Wat het kost om deze gebouwen weer heel te maken, of null als ze al heel zijn. Standaard: alle gebouwen. */
export function repairCost(list: Building[] = G.bs): Cost | null {
  let missing = 0;
  for (const b of list) if (b.done) missing += bMaxHp(b) - b.hp;
  missing = Math.ceil(missing);
  if (missing < 1) return null;
  return { wood: Math.ceil(missing * WOOD_PER_HP), stone: Math.ceil(missing * STONE_PER_HP) };
}

/** Herstel deze gebouwen als je het kunt betalen. Geeft true als het gelukt is. */
export function repairBuildings(list: Building[] = G.bs): boolean {
  const cost = repairCost(list);
  if (!cost || !has(cost)) return false;
  pay(cost);
  for (const b of list) if (b.done) b.hp = bMaxHp(b);
  return true;
}
