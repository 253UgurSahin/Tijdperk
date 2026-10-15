// Alle soorten bonussen op één plek, met uitleg, en het optellen ervan. Puur, zodat het te testen is.
import type { Bonus } from '../types';

/*
 * Een bonus is een object zoals { 'army.dmg': 0.15 }: dat betekent 15% meer schade.
 * - Bonussen met dezelfde sleutel tellen op: 0.15 + 0.10 wordt 25% meer.
 * - Verschillende sleutels worden met elkaar vermenigvuldigd. Daarom hebben sommige dingen
 *   twee sleutels (zoals 'farm' en 'farm.plow'): zo blijven de oude getallen precies gelijk.
 * - Sleutels met `flat: true` zijn geen percentage maar een vast getal (tegels, levens, ...).
 * - Sleutels met `min` hebben een ondergrens: veel kortingen samen (volk, zegeningen, onderzoek)
 *   maken iets nooit gratis of meteen klaar. Zie limitTotal hieronder.
 * - Een positieve waarde maakt een getal groter, een negatieve kleiner. Bij tijd en kosten is
 *   kleiner juist goed: { 'chunk.cost': -0.25 } maakt nieuw gebied 25% goedkoper.
 *
 * `d` is een korte zin voor spelers: wat de bonus doet als hij goed voor je uitpakt.
 * Uitleg voor programmeurs staat in de opmerkingen ernaast.
 */
/** Uitleg bij één soort bonus (zie hierboven): `flat` = een vast getal, `min` = de ondergrens. */
export interface BonusKeyDef {
  d: string;
  flat?: boolean;
  min?: number;
}

/** Iets met (misschien) een `bonus`-veld, zoals een volk, een zegening of een wonder. */
export type BonusThing = object & { bonus?: Bonus };

/**
 * Wat bonusesIn aanneemt: één ding, een lijst dingen, of een object met dingen.
 * Een lijst of een object met dingen heeft zelf geen `bonus`.
 */
export type BonusThings =
  | BonusThing
  | ((BonusThing | null | undefined)[] & { bonus?: undefined })
  | (Record<string, BonusThing | null | undefined> & { bonus?: undefined });

export const BONUS_KEYS: Record<string, BonusKeyDef> = {
  // Verzamelen
  'gather.all': { d: 'Al het verzamelwerk gaat sneller' },
  'gather.food': { d: 'Voedsel verzamelen gaat sneller' }, // struiken, vis, wild en akkers
  'gather.wood': { d: 'Hout hakken gaat sneller' },
  'gather.mine': { d: 'Steen, erts en zand winnen gaat sneller' }, // alles behalve voedsel en hout
  'gather.rock': { d: 'Steen, ijzer en kolen winnen gaat sneller' }, // bovenop 'gather.mine'
  'winter.food': { d: 'In de winter minder verlies aan voedsel' }, // alleen in de winter, bovenop het seizoen
  carry: { d: 'Dorpelingen dragen meer per keer', flat: true },
  farm: { d: 'Akkers oogsten sneller' },
  'farm.plow': { d: 'Akkers oogsten sneller' }, // komt bovenop 'farm' (IJzeren ploeg)
  'farm.slots': { d: 'Meer boeren op elke akker', flat: true },

  // Bewegen
  'vill.speed': { d: 'Dorpelingen lopen sneller' },
  'army.speed': { d: 'Het leger beweegt sneller' },
  'move.all': { d: 'Iedereen beweegt sneller' }, // dorpelingen en leger, bovenop de twee hierboven
  road: { d: 'Wegen geven meer snelheid' },

  // Leger
  'army.dmg': { d: 'Het leger doet meer schade' },
  'robot.dmg': { d: 'Drones en exo-soldaten doen meer schade' }, // bovenop 'army.dmg'
  'army.hp': { d: 'Soldaten hebben meer levenspunten' },
  'train.speed': { d: 'Soldaten trainen sneller' }, // in kazernes en andere trainingsgebouwen
  heal: { d: 'Dorpelingen en leger genezen vanzelf', flat: true }, // levens per seconde; het leger krijgt het dubbele
  loot: { d: 'Meer buit uit veroverde kampen' },

  // Gebouwen en verdediging
  'bld.hp': { d: 'Gebouwen en muren hebben meer levenspunten' },
  'hall.hp': { d: 'Het stamhuis heeft meer levenspunten' }, // bovenop 'bld.hp'
  'build.speed': { d: 'Bouwen gaat sneller' },
  'wall.cost': { d: 'Muren en poorten zijn goedkoper', min: -0.75 }, // negatief = goedkoper
  'tower.dmg': { d: 'Torens en het stamhuis doen meer schade' },
  'tower.range': { d: 'Torens schieten verder', flat: true }, // in tegels, niet voor het stamhuis
  'tower.hp': { d: 'Torens hebben meer levenspunten' }, // niet voor het stamhuis; bovenop 'bld.hp'
  'laser.dmg': { d: 'Lasertorens doen meer schade' }, // bovenop 'tower.dmg'
  light: { d: 'Lichtbronnen schijnen verder', flat: true }, // in tegels
  pop: { d: 'Meer plek voor inwoners', flat: true },

  // Productie en stroom
  'conv.speed': { d: 'Fabrieken en oliepompen werken sneller' }, // alles wat grondstoffen omzet
  'mill.speed': { d: 'Windmolens en kruitmolens werken sneller' }, // bovenop 'conv.speed'
  power: { d: 'Centrales leveren meer stroom' },

  // Tijd en geld
  'research.time': { d: 'Onderzoek gaat sneller', min: -0.75 }, // negatief = sneller klaar
  'chunk.cost': { d: 'Nieuw gebied is goedkoper', min: -0.75 }, // negatief = goedkoper
  market: { d: 'Betere prijzen op de markt' }, // goedkoper kopen en meer krijgen voor verkopen
  'trader.rate': { d: 'Reizende handelaars komen vaker' }, // 1 = twee keer zo vaak
  'trader.daily': { d: 'Elke ochtend komt er een handelaar', flat: true }, // 1 = aan

  // Wereld en vijanden
  'meteor.rate': { d: 'Meteorieten vallen vaker' }, // 0.5 = anderhalf keer zo vaak
  'meteor.ore': { d: 'Meer erts rond een meteorietinslag' },
  'meteor.aim': { d: 'Meteorieten vallen in je eigen land, nooit op je gebouwen', flat: true }, // 1 = aan
  'storm.safe': { d: 'Stormen en stormvloeden doen geen schade', flat: true }, // 1 = aan: ze komen niet meer
  'raid.size': { d: 'Aanvallen zijn kleiner' }, // negatief = kleiner
  'raid.hp': { d: 'Aanvallers zijn zwakker' }, // levenspunten; negatief = zwakker
};

/**
 * Tel alle bonussen voor één sleutel op. `bonuses` is een lijst bonus-objecten.
 * Handig voor tests; het spel zelf gebruikt sumAll, dat alles in één keer telt.
 */
export function combine(bonuses: (Bonus | null | undefined)[], key: string): number {
  let sum = 0;
  for (const bonus of bonuses) if (bonus && bonus[key]) sum += bonus[key];
  return sum;
}

/** Tel alles in één keer op: geeft { sleutel: totaal } voor elke sleutel die voorkomt. */
export function sumAll(bonuses: (Bonus | null | undefined)[]): Bonus {
  const sums: Bonus = {};
  for (const bonus of bonuses) {
    if (!bonus) continue;
    for (const key in bonus) sums[key] = (sums[key] || 0) + bonus[key];
  }
  return sums;
}

/**
 * Het totaal voor één sleutel, maar nooit onder de ondergrens (`min`) van die sleutel.
 * Zo kost nieuw gebied altijd nog een kwart, en duurt onderzoek altijd nog een kwart van de tijd.
 */
export function limitTotal(key: string, total: number): number {
  const min = BONUS_KEYS[key] && BONUS_KEYS[key].min;
  return min != null && total < min ? min : total;
}

/**
 * Haal de bonussen uit iets met een `bonus`-veld: één ding, een lijst, of een object met dingen.
 * Zo kan een onderdeel (volk, zegeningen, wonderen) zijn spullen gewoon in G zetten.
 */
export function bonusesIn(things: BonusThings | null | undefined): Bonus[] {
  if (!things) return [];
  if (things.bonus) return [things.bonus];
  const list = Array.isArray(things) ? things : Object.values(things);
  return list.filter(thing => thing && thing.bonus).map(thing => thing.bonus);
}
