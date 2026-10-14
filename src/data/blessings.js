// Zegeningen: bij het begin en bij elk nieuw tijdperk kies je er één uit drie. Puur, zodat het te testen is.
import { mulberry32 } from '../util/random.js';

/*
 * Elke zegening:
 * - k: vaste sleutel (wordt opgeslagen), n: naam, g: pictogram (zie ui/glyphs.js)
 * - cat: soort kaart: 'eco' (economie), 'army' (leger), 'def' (verdediging), 'grow' (uitbreiden)
 * - d: wat hij doet, in gewone taal en met dezelfde getallen als in `bonus`
 * - bonus: sleutels uit src/data/bonus.js; geldt de rest van het spel
 * - minAge: pas te kiezen vanaf dit tijdperk (bijv. als de gebouwen er pas dan zijn)
 * - risk: true als er ook een nadeel aan zit
 * - raids: true als hij alleen iets doet als er aanvallen zijn (niet in de vredige modus)
 * - oneoff: iets dat één keer meteen gebeurt; dat doet src/game/blessings.js
 */
export const BLESSINGS = [
  // Economie
  {
    k: 'harvest',
    n: 'Vruchtbare grond',
    g: '⚘',
    cat: 'eco',
    d: 'Akkers oogsten 25% sneller',
    bonus: { farm: 0.25 },
  },
  {
    k: 'hunters',
    n: 'Jagers en vissers',
    g: '⋈',
    cat: 'eco',
    d: 'Voedsel verzamelen gaat 20% sneller',
    bonus: { 'gather.food': 0.2 },
  },
  {
    k: 'lumber',
    n: 'Houthakkers',
    g: '♣',
    cat: 'eco',
    d: 'Hout hakken gaat 30% sneller',
    bonus: { 'gather.wood': 0.3 },
  },
  {
    k: 'miners',
    n: 'Mijnwerkers',
    g: '⛏',
    cat: 'eco',
    d: 'Steen en erts hakken gaat 25% sneller',
    bonus: { 'gather.mine': 0.25 },
  },
  {
    k: 'baskets',
    n: 'Grote manden',
    g: '◡',
    cat: 'eco',
    d: 'Dorpelingen dragen 4 meer per keer',
    bonus: { carry: 4 },
  },
  {
    k: 'plots',
    n: 'Ruime akkers',
    g: '▤',
    cat: 'eco',
    d: 'Op elke akker kan 1 boer extra werken',
    bonus: { 'farm.slots': 1 },
  },
  {
    k: 'builders',
    n: 'Snelle bouwers',
    g: '⚒',
    cat: 'eco',
    d: 'Bouwen gaat 35% sneller',
    bonus: { 'build.speed': 0.35 },
  },
  {
    k: 'scholars',
    n: 'Wijze ouden',
    g: '✎',
    cat: 'eco',
    d: 'Onderzoek duurt 25% korter',
    bonus: { 'research.time': -0.25 },
  },
  {
    k: 'workshops',
    n: 'Werkplaatsen',
    g: '⚙',
    cat: 'eco',
    d: 'Gieterijen, molens, fabrieken en pompen werken 20% sneller',
    bonus: { 'conv.speed': 0.2 },
    minAge: 1, // de eerste gieterij komt in de bronstijd
  },
  {
    k: 'traders',
    n: 'Handelsgeest',
    g: '⚖',
    cat: 'eco',
    d: 'Op de markt 25% betere prijzen',
    bonus: { market: 0.25 },
    minAge: 3, // de markt komt in tijdperk 4
  },
  {
    k: 'millers',
    n: 'Molenaars',
    g: '✣',
    cat: 'eco',
    d: 'Windmolens en kruitmolens werken 40% sneller',
    bonus: { 'mill.speed': 0.4 },
    minAge: 4,
  },
  {
    k: 'dynamo',
    n: 'Sterke stroom',
    g: 'ϟ',
    cat: 'eco',
    d: 'Centrales leveren 30% meer stroom',
    bonus: { power: 0.3 },
    minAge: 5,
  },

  // Leger
  {
    k: 'warriors',
    n: 'Strijdlust',
    g: '⚔',
    cat: 'army',
    d: 'Je leger doet 15% meer schade',
    bonus: { 'army.dmg': 0.15 },
  },
  {
    k: 'armour',
    n: 'Taaie soldaten',
    g: '♥',
    cat: 'army',
    d: 'Soldaten hebben 20% meer levens',
    bonus: { 'army.hp': 0.2 },
  },
  {
    k: 'drill',
    n: 'Drilmeester',
    g: '↻',
    cat: 'army',
    d: 'Soldaten trainen 30% sneller',
    bonus: { 'train.speed': 0.3 },
  },
  {
    k: 'march',
    n: 'Snelle mars',
    g: '➜',
    cat: 'army',
    d: 'Je leger loopt 20% sneller',
    bonus: { 'army.speed': 0.2 },
  },
  {
    k: 'plunder',
    n: 'Plunderaars',
    g: '⛁',
    cat: 'army',
    d: 'Veroverde kampen geven 50% meer buit',
    bonus: { loot: 0.5 },
  },
  {
    k: 'healers',
    n: 'Heelmeesters',
    g: '✚',
    cat: 'army',
    d: 'Volk geneest 1 levenspunt per seconde, leger 2',
    bonus: { heal: 1 },
  },
  {
    k: 'recruits',
    n: 'Vrijwilligers',
    g: '⚑',
    cat: 'army',
    d: '3 soldaten sluiten zich meteen aan, met plek voor 3 inwoners extra',
    bonus: { pop: 3 },
    oneoff: 'soldiers3',
  },
  {
    k: 'machines',
    n: 'Machinegeest',
    g: '✈',
    cat: 'army',
    d: 'Drones en exo-soldaten doen 30% meer schade',
    bonus: { 'robot.dmg': 0.3 },
    minAge: 7,
  },

  // Verdediging
  {
    k: 'walls',
    n: 'Stevige muren',
    g: '▦',
    cat: 'def',
    d: 'Gebouwen en muren hebben 25% meer levens',
    bonus: { 'bld.hp': 0.25 },
  },
  {
    k: 'cheapwalls',
    n: 'Muurbouwers',
    g: '⛀',
    cat: 'def',
    d: 'Muren en poorten kosten 40% minder',
    bonus: { 'wall.cost': -0.4 },
  },
  {
    k: 'watchmen',
    n: 'Scherpe wachters',
    g: '➶',
    cat: 'def',
    d: 'Torens schieten 1 tegel verder en doen 15% meer schade',
    bonus: { 'tower.range': 1, 'tower.dmg': 0.15 },
  },
  {
    k: 'calm',
    n: 'Rustige buren',
    g: '☉',
    cat: 'def',
    d: 'Aanvallen zijn 20% kleiner',
    bonus: { 'raid.size': -0.2 },
    raids: true,
  },
  {
    k: 'weakfoes',
    n: 'Zwakke vijand',
    g: '⛨',
    cat: 'def',
    d: 'Aanvallers hebben 15% minder levens',
    bonus: { 'raid.hp': -0.15 },
    raids: true,
  },
  {
    k: 'lasers',
    n: 'Gebundeld licht',
    g: '◎',
    cat: 'def',
    d: 'Lasertorens doen 30% meer schade',
    bonus: { 'laser.dmg': 0.3 },
    minAge: 7,
  },

  // Uitbreiden
  {
    k: 'settlers',
    n: 'Nieuwe kolonisten',
    g: '☺',
    cat: 'grow',
    d: '3 dorpelingen komen erbij, met plek voor 3 inwoners extra',
    bonus: { pop: 3 },
    oneoff: 'villagers3',
  },
  {
    k: 'roomy',
    n: 'Ruime huizen',
    g: '⌂',
    cat: 'grow',
    d: 'Plek voor 6 inwoners extra',
    bonus: { pop: 6 },
  },
  {
    k: 'explorers',
    n: 'Verkenners',
    g: '⬚',
    cat: 'grow',
    d: 'Nieuw gebied kost 30% minder',
    bonus: { 'chunk.cost': -0.3 },
  },
  {
    k: 'roads',
    n: 'Wegenbouwers',
    g: '═',
    cat: 'grow',
    d: 'Wegen geven 40% meer snelheid',
    bonus: { road: 0.4 },
  },
  {
    k: 'beacons',
    n: 'Wachtvuren',
    g: '✹',
    cat: 'grow',
    d: "Vuren en lampen schijnen 2 tegels verder, zodat er 's nachts meer gewerkt wordt",
    bonus: { light: 2 },
  },

  // Met een prijs: een groot voordeel, maar ook een nadeel
  {
    k: 'bounty',
    n: 'Overvloed',
    g: '⚘',
    cat: 'eco',
    risk: true,
    d: 'Akkers oogsten 40% sneller, maar gebouwen hebben 20% minder levens',
    bonus: { farm: 0.4, 'bld.hp': -0.2 },
  },
  {
    k: 'haste',
    n: 'Haastwerk',
    g: '⚒',
    cat: 'eco',
    risk: true,
    d: 'Bouwen gaat 50% sneller, maar gebouwen hebben 15% minder levens',
    bonus: { 'build.speed': 0.5, 'bld.hp': -0.15 },
  },
  {
    k: 'bookworms',
    n: 'Boekenwurmen',
    g: '✎',
    cat: 'eco',
    risk: true,
    d: 'Onderzoek duurt 40% korter, maar verzamelen gaat 10% trager',
    bonus: { 'research.time': -0.4, 'gather.all': -0.1 },
  },
  {
    k: 'bloodlust',
    n: 'Bloeddorst',
    g: '⚔',
    cat: 'army',
    risk: true,
    d: 'Je leger doet 30% meer schade, maar heeft 20% minder levens',
    bonus: { 'army.dmg': 0.3, 'army.hp': -0.2 },
  },
  {
    k: 'openborders',
    n: 'Open grenzen',
    g: '⬚',
    cat: 'grow',
    risk: true,
    d: 'Nieuw gebied kost 50% minder, maar aanvallen zijn 20% groter',
    bonus: { 'chunk.cost': -0.5, 'raid.size': 0.2 },
    raids: true,
  },
  {
    k: 'starcall',
    n: 'Sterrenroep',
    g: '☄',
    cat: 'grow',
    risk: true,
    d: 'Meteorieten vallen 2 keer zo vaak (100% vaker) en geven 40% meer erts, maar raken soms je gebouwen',
    bonus: { 'meteor.rate': 1, 'meteor.ore': 0.4 },
  },
];

/** Zegening opzoeken op sleutel: BLESSING.harvest */
export const BLESSING = {};
BLESSINGS.forEach(b => (BLESSING[b.k] = b));

/** Namen van de soorten, voor op de kaart. */
export const BLESSING_CATS = {
  eco: 'Economie',
  army: 'Leger',
  def: 'Verdediging',
  grow: 'Uitbreiden',
};

/** Hoeveel kaarten je te zien krijgt. */
export const OFFER_SIZE = 3;

/** De eerste zegening kies je na zoveel seconden spelen: eerst even rondkijken in je nieuwe wereld. */
export const FIRST_BLESSING_AT = 60;

/** De bonussen van de zegeningen die je hebt (G.blessings bewaart alleen de sleutels). */
export const blessingBonuses = keys =>
  (keys || [])
    .map(k => BLESSING[k])
    .filter(b => b && b.bonus)
    .map(b => b.bonus);

// Schud een lijst met een vaste reeks toevalsgetallen (Fisher-Yates)
function shuffled(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * De kaarten waaruit je kiest. Dezelfde seed en hetzelfde tijdperk geven dezelfde volgorde,
 * zodat een wereld opnieuw spelen ook dezelfde keuzes geeft. Wat je al hebt, komt niet terug.
 * Regels: hooguit één kaart met een prijs, en niet drie van dezelfde soort (dus ook nooit alleen
 * economie).
 */
export function blessingOffer(seed, age, taken = [], { peaceful = false } = {}) {
  // De volgorde hangt alleen af van seed en tijdperk; wat je al koos, valt er daarna pas uit
  const random = mulberry32((seed | 0) + (age + 1) * 7919);
  const pool = shuffled(BLESSINGS, random).filter(
    b => (b.minAge || 0) <= age && !taken.includes(b.k) && !(peaceful && b.raids),
  );

  const picks = [];
  for (const b of pool) {
    if (picks.length === OFFER_SIZE) break;
    if (b.risk && picks.some(p => p.risk)) continue;
    picks.push(b);
  }
  // Te weinig over door de regel van één prijs? Vul dan aan met wat er nog is.
  for (const b of pool) {
    if (picks.length === OFFER_SIZE) break;
    if (!picks.includes(b)) picks.push(b);
  }

  // Allemaal dezelfde soort (bijv. alleen economie)? Ruil de laatste kaart voor een andere soort.
  const sameKind = picks.length > 1 && picks.every(p => p.cat === picks[0].cat);
  if (sameKind) {
    const rest = picks.slice(0, -1);
    const other = pool.find(b => b.cat !== picks[0].cat && !(b.risk && rest.some(p => p.risk)));
    if (other) picks[picks.length - 1] = other;
  }
  return picks;
}
