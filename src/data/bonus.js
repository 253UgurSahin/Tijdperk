// Alle soorten bonussen op één plek, met uitleg, en het optellen ervan. Puur, zodat het te testen is.

/*
 * Een bonus is een object zoals { 'army.dmg': 0.15 }: dat betekent 15% meer schade.
 * - Bonussen met dezelfde sleutel tellen op: 0.15 + 0.10 wordt 25% meer.
 * - Verschillende sleutels worden met elkaar vermenigvuldigd. Daarom hebben sommige dingen
 *   twee sleutels (zoals 'farm' en 'farm.plow'): zo blijven de oude getallen precies gelijk.
 * - Sleutels met `flat: true` zijn geen percentage maar een vast getal (tegels, levens, ...).
 * - Een positieve waarde maakt een getal groter, een negatieve kleiner. Bij tijd en kosten is
 *   kleiner juist goed: { 'chunk.cost': -0.25 } maakt nieuw gebied 25% goedkoper.
 *
 * `d` is een korte zin voor spelers: wat de bonus doet als hij goed voor je uitpakt.
 * Uitleg voor programmeurs staat in de opmerkingen ernaast.
 */
export const BONUS_KEYS = {
  // Verzamelen
  'gather.all': { d: 'Al het verzamelwerk gaat sneller' },
  'gather.food': { d: 'Voedsel verzamelen gaat sneller' }, // struiken, vis, wild en akkers
  'gather.wood': { d: 'Hout hakken gaat sneller' },
  'gather.mine': { d: 'Steen, erts en zand winnen gaat sneller' }, // alles behalve voedsel en hout
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
  heal: { d: 'Volk en leger genezen vanzelf', flat: true }, // levens per seconde; het leger krijgt het dubbele
  loot: { d: 'Meer buit uit veroverde kampen' },

  // Gebouwen en verdediging
  'bld.hp': { d: 'Gebouwen en muren hebben meer levenspunten' },
  'build.speed': { d: 'Bouwen gaat sneller' },
  'wall.cost': { d: 'Muren en poorten zijn goedkoper' }, // negatief = goedkoper
  'tower.dmg': { d: 'Torens en het stamhuis doen meer schade' },
  'tower.range': { d: 'Torens schieten verder', flat: true }, // in tegels, niet voor het stamhuis
  'laser.dmg': { d: 'Lasertorens doen meer schade' }, // bovenop 'tower.dmg'
  light: { d: 'Lichtbronnen schijnen verder', flat: true }, // in tegels
  pop: { d: 'Meer plek voor inwoners', flat: true },

  // Productie en stroom
  'conv.speed': { d: 'Fabrieken en oliepompen werken sneller' }, // alles wat grondstoffen omzet
  'mill.speed': { d: 'Windmolens en kruitmolens werken sneller' }, // bovenop 'conv.speed'
  power: { d: 'Centrales leveren meer stroom' },

  // Tijd en geld
  'research.time': { d: 'Onderzoek gaat sneller' }, // negatief = sneller klaar
  'chunk.cost': { d: 'Nieuw gebied is goedkoper' }, // negatief = goedkoper
  market: { d: 'Betere prijzen op de markt' }, // goedkoper kopen en meer krijgen voor verkopen

  // Wereld en vijanden
  'meteor.rate': { d: 'Meteorieten vallen vaker' }, // 0.5 = anderhalf keer zo vaak
  'meteor.ore': { d: 'Meer erts rond een meteorietinslag' },
  'raid.size': { d: 'Aanvallen zijn kleiner' }, // negatief = kleiner
  'raid.hp': { d: 'Aanvallers zijn zwakker' }, // levenspunten; negatief = zwakker
};

/**
 * Tel alle bonussen voor één sleutel op. `bonuses` is een lijst bonus-objecten.
 * Handig voor tests; het spel zelf gebruikt sumAll, dat alles in één keer telt.
 */
export function combine(bonuses, key) {
  let sum = 0;
  for (const bonus of bonuses) if (bonus && bonus[key]) sum += bonus[key];
  return sum;
}

/** Tel alles in één keer op: geeft { sleutel: totaal } voor elke sleutel die voorkomt. */
export function sumAll(bonuses) {
  const sums = {};
  for (const bonus of bonuses) {
    if (!bonus) continue;
    for (const key in bonus) sums[key] = (sums[key] || 0) + bonus[key];
  }
  return sums;
}

/**
 * Haal de bonussen uit iets met een `bonus`-veld: één ding, een lijst, of een object met dingen.
 * Zo kan een later onderdeel (volk, zegeningen, wonderen) zijn spullen gewoon in G zetten.
 */
export function bonusesIn(things) {
  if (!things) return [];
  if (things.bonus) return [things.bonus];
  const list = Array.isArray(things) ? things : Object.values(things);
  return list.filter(thing => thing && thing.bonus).map(thing => thing.bonus);
}
