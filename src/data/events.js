// Gebeurtenissen: wat er kan gebeuren, welke keuzes je hebt en wat elke keuze doet. Puur, zodat het te testen is.
import { BONUS_KEYS } from './bonus.js';
import { GATHER, RES } from './resources.js';

/*
 * Elke gebeurtenis:
 * - k: vaste sleutel (wordt opgeslagen), n: naam, g: pictogram (zie ui/glyphs.js)
 * - x: het verhaal. {plaats}, {erts} en {soldaat} vult het spel zelf in.
 * - ages: [van, tot] de tijdperken waarin hij kan komen (zonder ages: altijd)
 * - need: wat er in je wereld moet zijn, zie EVENT_NEEDS hieronder
 * - trade: gaat over handel; komt bij de Hanze vaker en nooit met Gesloten grenzen
 * - once: komt maar één keer per spel
 * - chain: komt nooit zomaar, alleen als vervolg op een eerdere keuze (zie `follow`)
 * - choices: twee of drie keuzes. De laatste keuze is gratis: die gebeurt vanzelf als je niet kiest.
 *
 * Elke keuze: l = tekst op de knop, d = korte uitleg van wat er gebeurt, plus wat ze doet:
 * - cost: wat je betaalt (moet je hebben) · gain: wat je krijgt · lose: wat je kwijtraakt (tot 0)
 * - villagers: dorpelingen erbij (of eraf: je houdt er altijd minstens 3)
 * - units: soldaten erbij · sendUnits: zoveel van je soldaten vertrekken (moet je hebben)
 * - buff: { bonus, days }: een tijdelijke bonus (sleutels uit data/bonus.js) voor zoveel dagen
 * - raid: vannacht een aanval · foes: { n, type }: nu meteen een groepje vijanden (type uit FOES)
 * - damage: zoveel gebouwen raken beschadigd · burn: het bos vlakbij brandt af
 * - meteor: er komt meteen een meteoriet
 * - follow: { k, days }: over `days` dagen komt gebeurtenis k. Een lijst bij k = één daarvan, bij toeval.
 * Bedragen kunnen meegroeien met het tijdperk: perAge({ food: [60, 20] }) is 60 voedsel,
 * plus 20 voor elk tijdperk verder.
 */

/** Bedragen die meegroeien: perAge({ food: [60, 20] }) geeft in tijdperk 2 { food: 100 }. */
export const perAge = table => age => {
  const out = {};
  for (const [r, [base, step]] of Object.entries(table)) out[r] = base + step * age;
  return out;
};

/** De nieuwste grondstof om te delven in dit tijdperk (geen voedsel of hout): steen, tin, ijzer, ... */
export const oreFor = age => GATHER.filter(r => r !== 'food' && r !== 'wood' && RES[r].age <= age).pop();

// Een rijke vondst: hoe zeldzamer het erts, hoe minder je krijgt (afgerond op tientallen)
const veinGain = age => {
  const ore = oreFor(age);
  return { [ore]: Math.round((150 + 70 * age) / (1 + RES[ore].age * 0.25) / 10) * 10 };
};

/** Wat een gebeurtenis in je wereld nodig heeft (`need`). Het spel kijkt dit na in game/events.js. */
export const EVENT_NEEDS = {
  barracks: 'Er staat een kazerne',
  forest: 'Er staat bos in je gebied',
  crowd: 'Je hebt minstens 8 dorpelingen',
  town: 'Je hebt meer dan 6 gebouwen',
  farm: 'Er staat een akker',
  maker: 'Er staat een werkplaats die iets maakt (gieterij, fabriek, ...)',
  stormy: 'Het is geen zomer',
  dry: 'Het is lente of zomer',
};

/** Woorden die het spel in de tekst invult. */
export const TEXT_WORDS = ['plaats', 'erts', 'soldaat'];

const NOTHING = 'Er gebeurt niets.';

export const EVENTS = [
  // ---- Altijd mogelijk (bedragen groeien mee met het tijdperk) ----
  {
    k: 'traveler',
    n: 'Een reiziger',
    g: '➜',
    x: 'Een vermoeide reiziger klopt aan in {plaats}. Hij vraagt om eten en een bed.',
    choices: [
      {
        l: 'Geef hem onderdak',
        cost: perAge({ food: [40, 15] }),
        follow: { k: 'travelerBack', days: 2 },
        d: 'Hij komt over 2 dagen terug om je te bedanken',
      },
      {
        l: 'Laat hem meewerken',
        villagers: 1,
        follow: { k: ['travelerThief', 'travelerHonest'], days: 2 },
        d: '+1 dorpeling. Maar is hij te vertrouwen? Over 2 dagen weet je het.',
      },
      { l: 'Stuur hem weg', d: NOTHING },
    ],
  },
  {
    k: 'refugees',
    n: 'Vluchtelingen',
    g: '☺',
    x: 'Een groep vluchtelingen vraagt onderdak in {plaats}.',
    choices: [
      { l: 'Neem ze allemaal op', cost: perAge({ food: [80, 30] }), villagers: 3, d: '+3 dorpelingen' },
      {
        l: 'Geef ze eten mee',
        cost: perAge({ food: [30, 10] }),
        follow: { k: 'refugeesThanks', days: 3 },
        d: 'Ze trekken verder. Over 3 dagen hoor je meer.',
      },
      { l: 'Stuur ze weg', d: NOTHING },
    ],
  },
  {
    k: 'feast',
    n: 'Oogstfeest',
    g: '⚘',
    x: 'Het volk wil een feest. Wat voor feest wordt het?',
    choices: [
      {
        l: 'Groot feest',
        cost: perAge({ food: [150, 60] }),
        buff: { bonus: { 'gather.all': 0.25 }, days: 2 },
        d: '2 dagen: al het verzamelwerk 25% sneller',
      },
      {
        l: 'Bouwfeest',
        cost: perAge({ food: [60, 25], wood: [60, 25] }),
        buff: { bonus: { 'build.speed': 0.4 }, days: 2 },
        d: '2 dagen: bouwen 40% sneller',
      },
      {
        l: 'Geen feest',
        buff: { bonus: { 'gather.all': -0.1 }, days: 1 },
        d: '1 dag: verzamelen 10% trager, want het volk moppert',
      },
    ],
  },
  {
    k: 'sickness',
    n: 'Ziekte',
    g: '✚',
    need: ['crowd'],
    x: 'Er waart een ziekte rond in {plaats}.',
    choices: [
      {
        l: 'Betaal genezers',
        // Vanaf de Middeleeuwen betaal je in goud, daarvoor in voedsel
        cost: age => (age >= 3 ? { gold: 40 + 20 * age } : { food: 140 + 40 * age }),
        d: 'Niemand wordt ziek',
      },
      {
        l: 'Zet de zieken apart',
        buff: { bonus: { 'gather.all': -0.2 }, days: 2 },
        d: '2 dagen: verzamelen 20% trager, maar niemand sterft',
      },
      { l: 'Laat het gaan', villagers: -2, d: '−2 dorpelingen' },
    ],
  },
  {
    k: 'forestFire',
    n: 'Bosbrand',
    g: '♨',
    need: ['forest'],
    x: 'De bliksem slaat in het bos bij je dorp. Het vuur breidt zich uit.',
    choices: [
      { l: 'Blussen', cost: perAge({ food: [80, 25] }), d: 'Iedereen helpt mee. Het bos blijft staan.' },
      {
        l: 'Laat het branden',
        burn: true,
        buff: { bonus: { farm: 0.25 }, days: 3 },
        d: 'Bomen gaan verloren, maar de as maakt de grond rijk: 3 dagen akkers 25% sneller',
      },
    ],
  },
  {
    k: 'mercs',
    n: 'Huurlingen',
    g: '⚔',
    need: ['barracks'],
    x: 'Drie huurlingen bieden hun diensten aan. Ze vechten als {soldaat}.',
    choices: [
      {
        l: 'Huur ze',
        cost: age => (age >= 3 ? { gold: 60 + 30 * age } : { food: 150 + 30 * age, wood: 60 + 20 * age }),
        units: 3,
        d: '+3 soldaten',
      },
      {
        l: 'Laat ze je leger drillen',
        cost: age => (age >= 3 ? { gold: 30 + 15 * age } : { food: 80 + 20 * age }),
        buff: { bonus: { 'train.speed': 0.5, 'army.dmg': 0.1 }, days: 3 },
        d: '3 dagen: soldaten trainen 50% sneller en doen 10% meer schade',
      },
      { l: 'Weiger', d: 'Ze trekken verder.' },
    ],
  },
  {
    k: 'tribute',
    n: 'Schatting',
    g: '⚑',
    x: 'Plunderaars eisen schatting. Betaal, of ze vallen vannacht aan.',
    choices: [
      { l: 'Betaal', cost: perAge({ food: [100, 60], wood: [80, 40] }), d: 'Ze laten je met rust' },
      {
        l: 'Bouw snel verdediging',
        cost: perAge({ stone: [80, 40] }),
        raid: true,
        buff: { bonus: { 'bld.hp': 0.4, 'tower.dmg': 0.25 }, days: 1 },
        d: 'Vannacht een aanval, maar 1 dag: gebouwen 40% meer levens en torens 25% meer schade',
      },
      { l: 'Weiger', raid: true, d: 'Vannacht een aanval' },
    ],
  },
  {
    k: 'vein',
    n: 'Rijke vondst',
    g: '◆',
    x: 'Verkenners vinden een rijke laag {erts}.',
    choices: [
      {
        l: 'Graaf het snel op',
        cost: perAge({ food: [60, 25] }),
        gain: veinGain,
        d: 'Je krijgt alles meteen',
      },
      {
        l: 'Graaf rustig',
        buff: { bonus: { 'gather.mine': 0.3 }, days: 3 },
        d: '3 dagen: steen en erts winnen 30% sneller',
      },
    ],
  },
  {
    k: 'storm',
    n: 'Storm op komst',
    g: '☁',
    need: ['town', 'stormy'],
    x: 'Een zware storm trekt over de vallei.',
    choices: [
      { l: 'Versterk de daken', cost: perAge({ wood: [80, 30] }), d: 'Geen schade' },
      {
        l: 'Iedereen naar binnen',
        buff: { bonus: { 'gather.all': -0.3 }, days: 1 },
        d: '1 dag: verzamelen 30% trager, maar geen schade',
      },
      { l: 'Afwachten', damage: 3, d: '3 gebouwen raken beschadigd' },
    ],
  },
  {
    k: 'drought',
    n: 'Droogte',
    g: '☉',
    need: ['farm', 'dry'],
    x: 'Het heeft weken niet geregend. De akkers drogen uit.',
    choices: [
      { l: 'Graaf een put', cost: perAge({ stone: [100, 40] }), d: 'De akkers blijven groen' },
      {
        l: 'Slacht het vee',
        gain: perAge({ food: [150, 50] }),
        buff: { bonus: { farm: -0.5 }, days: 3 },
        d: 'Nu extra voedsel, maar 3 dagen: akkers 50% trager',
      },
      { l: 'Wacht op regen', buff: { bonus: { farm: -0.3 }, days: 2 }, d: '2 dagen: akkers 30% trager' },
    ],
  },
  {
    k: 'babyBoom',
    n: 'Geboortegolf',
    g: '♥',
    x: 'Er worden veel kinderen geboren in {plaats}.',
    choices: [
      {
        l: 'Bouw een school',
        cost: perAge({ wood: [80, 30], stone: [60, 25] }),
        villagers: 2,
        buff: { bonus: { 'research.time': -0.3 }, days: 3 },
        d: '+2 dorpelingen en 3 dagen: onderzoek 30% sneller',
      },
      {
        l: 'Iedereen helpt mee',
        villagers: 3,
        buff: { bonus: { 'gather.all': -0.15 }, days: 2 },
        d: '+3 dorpelingen, maar 2 dagen: verzamelen 15% trager',
      },
      { l: 'Gewoon doorwerken', villagers: 1, d: '+1 dorpeling' },
    ],
  },

  // ---- Steentijd ----
  {
    k: 'wolves',
    n: 'Wolvenroedel',
    g: '☾',
    ages: [0, 2],
    x: 'Een roedel wolven sluipt rond het kamp. Ze hebben honger.',
    choices: [
      {
        l: 'Ga op jacht',
        foes: { n: 4, type: 0 },
        gain: { food: 120 },
        d: '4 wolven vallen nu aan, maar de jacht levert vlees op',
      },
      { l: 'Leg vlees neer', cost: { food: 100 }, d: 'De wolven blijven weg' },
      { l: 'Doe niets', raid: true, d: 'Ze komen terug: vannacht een aanval' },
    ],
  },
  {
    k: 'strangeTribe',
    n: 'Een vreemde stam',
    g: '⚖',
    ages: [0, 2],
    trade: true,
    x: 'Een vreemde stam komt langs met vellen en vuursteen. Ze willen ruilen.',
    choices: [
      { l: 'Ruil hout voor steen', cost: { wood: 120 }, gain: { stone: 150 }, d: 'Een eerlijke ruil' },
      {
        l: 'Nodig ze uit voor een maal',
        cost: { food: 80 },
        follow: { k: 'tribeBack', days: 2 },
        d: 'Ze komen over 2 dagen terug',
      },
      { l: 'Laat ze gaan', d: NOTHING },
    ],
  },
  {
    k: 'mammoths',
    n: 'Mammoetkudde',
    g: '⛰',
    ages: [0, 1],
    x: 'Een kudde mammoeten trekt door het dal.',
    choices: [
      {
        l: 'Grote jacht',
        villagers: -1,
        gain: { food: 350 },
        d: 'Veel vlees, maar de jacht is gevaarlijk: −1 dorpeling',
      },
      {
        l: 'Volg de kudde',
        buff: { bonus: { 'gather.food': 0.3 }, days: 2 },
        d: '2 dagen: voedsel verzamelen 30% sneller',
      },
    ],
  },
  {
    k: 'cave',
    n: 'Grot met tekeningen',
    g: '◎',
    ages: [0, 1],
    x: 'Kinderen vinden een grot vol oude tekeningen.',
    choices: [
      {
        l: 'Maak er een heilige plek van',
        cost: { stone: 80, wood: 40 },
        buff: { bonus: { 'research.time': -0.3 }, days: 4 },
        d: '4 dagen: onderzoek 30% sneller',
      },
      {
        l: 'Gebruik hem als voorraadkelder',
        buff: { bonus: { carry: 3 }, days: 3 },
        d: '3 dagen: dorpelingen dragen 3 meer per keer',
      },
      { l: 'Laat hem dicht', d: NOTHING },
    ],
  },

  // ---- Bronstijd ----
  {
    k: 'mineCollapse',
    n: 'Mijn ingestort',
    g: '⛏',
    ages: [1, 2],
    x: 'Een kopermijn is ingestort. Twee mijnwerkers zitten vast.',
    choices: [
      { l: 'Stut de gangen', cost: { wood: 150 }, d: 'Ze komen veilig boven' },
      {
        l: 'Graaf ze voorzichtig uit',
        buff: { bonus: { 'gather.mine': -0.3 }, days: 2 },
        d: '2 dagen: steen en erts winnen 30% trager',
      },
      { l: 'Geef het op', villagers: -2, d: '−2 dorpelingen' },
    ],
  },
  {
    k: 'smith',
    n: 'Rondtrekkende smid',
    g: '⚒',
    ages: [1, 3],
    x: 'Een smid trekt rond met zijn aambeeld. Hij wil een paar dagen voor je werken.',
    choices: [
      {
        l: 'Laat hem werktuigen maken',
        cost: { bronze: 40 },
        buff: { bonus: { 'gather.all': 0.15 }, days: 3 },
        d: '3 dagen: verzamelen 15% sneller',
      },
      {
        l: 'Laat hem wapens maken',
        cost: { bronze: 40 },
        buff: { bonus: { 'army.dmg': 0.25 }, days: 3 },
        d: '3 dagen: je leger doet 25% meer schade',
      },
      { l: 'Stuur hem verder', d: NOTHING },
    ],
  },
  {
    k: 'riverFlood',
    n: 'Overstroming',
    g: '≈',
    ages: [1, 3],
    x: 'De rivier treedt buiten haar oevers.',
    choices: [
      { l: 'Bouw een dijk', cost: { stone: 150, wood: 100 }, d: 'Het water blijft buiten' },
      {
        l: 'Laat het water komen',
        lose: perAge({ food: [100, 50] }),
        buff: { bonus: { farm: 0.35 }, days: 3 },
        d: 'Natte voorraad, maar het slib maakt de grond rijk: 3 dagen akkers 35% sneller',
      },
    ],
  },
  {
    k: 'tinTraders',
    n: 'Tinhandelaars',
    g: '⚖',
    ages: [1, 3],
    trade: true,
    x: 'Handelaars van over zee brengen tin. Ze zoeken een vaste haven.',
    choices: [
      { l: 'Koop hun tin', cost: { food: 200 }, gain: { tin: 120 }, d: 'Meteen tin in de voorraad' },
      {
        l: 'Geef ze een handelsplek',
        cost: { wood: 150 },
        buff: { bonus: { 'trader.rate': 1 }, days: 4 },
        d: '4 dagen: handelaars komen 2 keer zo vaak',
      },
      { l: 'Nee, dank je', d: NOTHING },
    ],
  },

  // ---- IJzertijd ----
  {
    k: 'druid',
    n: 'De druïde',
    g: '☉',
    ages: [2, 3],
    x: 'Een druïde zegt: "Breng een offer, dan wordt de oogst rijk."',
    choices: [
      {
        l: 'Offer voedsel',
        cost: { food: 250 },
        buff: { bonus: { farm: 0.35 }, days: 3 },
        d: '3 dagen: akkers 35% sneller',
      },
      {
        l: 'Offer ijzer',
        cost: { iron: 60 },
        buff: { bonus: { 'bld.hp': 0.3 }, days: 3 },
        d: '3 dagen: gebouwen 30% meer levens',
      },
      {
        l: 'Jaag hem weg',
        follow: { k: 'druidBack', days: 3 },
        d: 'Hij is boos. Over 3 dagen komt hij terug.',
      },
    ],
  },
  {
    k: 'hillTribe',
    n: 'Bergstam',
    g: '⛰',
    ages: [2, 3],
    x: 'Een stam uit de bergen wil zich bij je aansluiten.',
    choices: [
      { l: 'Geef ze wapens', cost: { iron: 70, food: 80 }, units: 3, d: '+3 soldaten' },
      { l: 'Laat ze boeren', cost: { food: 150 }, villagers: 3, d: '+3 dorpelingen' },
      { l: 'Stuur ze weg', d: NOTHING },
    ],
  },
  {
    k: 'roadBuilders',
    n: 'Vreemde wegenbouwers',
    g: '═',
    ages: [2, 3],
    x: 'Soldaten van een groot rijk bouwen wegen. Ze willen er ook één door jouw land.',
    choices: [
      {
        l: 'Laat ze bouwen',
        cost: { stone: 150, food: 100 },
        buff: { bonus: { 'move.all': 0.2 }, days: 4 },
        d: '4 dagen: iedereen beweegt 20% sneller',
      },
      {
        l: 'Laat ze hier kamperen',
        units: 2,
        lose: { food: 200 },
        d: '+2 soldaten, maar ze eten flink mee',
      },
      { l: 'Nee', d: NOTHING },
    ],
  },

  // ---- Middeleeuwen ----
  {
    k: 'plague',
    n: 'De pest',
    g: '✚',
    ages: [3, 4],
    need: ['crowd'],
    x: 'De pest bereikt de stad. Wat doe je?',
    choices: [
      {
        l: 'Sluit de poorten',
        buff: { bonus: { 'gather.all': -0.2 }, days: 3 },
        d: '3 dagen: verzamelen 20% trager, maar niemand sterft',
      },
      { l: 'Betaal pestdokters', cost: { gold: 120 }, villagers: -1, d: 'Er sterft maar 1 dorpeling' },
      { l: 'Bid en wacht', villagers: -3, d: '−3 dorpelingen' },
    ],
  },
  {
    k: 'tournament',
    n: 'Toernooi',
    g: '⚔',
    ages: [3, 4],
    x: 'Ridders uit de omtrek willen een toernooi houden in {plaats}.',
    choices: [
      {
        l: 'Houd een groot toernooi',
        cost: { gold: 100, food: 200 },
        units: 1,
        buff: { bonus: { 'army.dmg': 0.2 }, days: 3 },
        d: 'De winnaar blijft: +1 soldaat en 3 dagen: je leger doet 20% meer schade',
      },
      {
        l: 'Verkoop kaartjes',
        cost: { wood: 150 },
        gain: { gold: 200 },
        d: 'Tribunes bouwen en kaartjes verkopen',
      },
      { l: 'Geen toernooi', d: NOTHING },
    ],
  },
  {
    k: 'crusade',
    n: 'Oproep van de koning',
    g: '⚑',
    ages: [3, 4],
    need: ['barracks'],
    x: 'De koning roept op tot een verre tocht. Hij wil soldaten van je.',
    choices: [
      {
        l: 'Stuur 3 soldaten',
        sendUnits: 3,
        follow: { k: 'crusadeBack', days: 4 },
        d: '3 soldaten vertrekken. Over 4 dagen komen ze terug, met buit.',
      },
      { l: 'Koop je vrij', cost: { gold: 100 }, d: 'De koning is tevreden' },
      {
        l: 'Weiger',
        buff: { bonus: { 'chunk.cost': 0.3 }, days: 4 },
        d: 'De koning is boos: 4 dagen nieuw gebied 30% duurder',
      },
    ],
  },
  {
    k: 'monks',
    n: 'Monniken',
    g: '✎',
    ages: [3, 4],
    x: 'Monniken willen een klooster bouwen in {plaats}.',
    choices: [
      {
        l: 'Geef ze grond',
        cost: { stone: 200 },
        buff: { bonus: { 'research.time': -0.35 }, days: 4 },
        d: '4 dagen: onderzoek 35% sneller, want ze schrijven boeken over',
      },
      {
        l: 'Laat ze zieken verzorgen',
        cost: { food: 150 },
        buff: { bonus: { heal: 1 }, days: 4 },
        d: '4 dagen: dorpelingen genezen 1 levenspunt per seconde, het leger 2',
      },
      { l: 'Stuur ze weg', d: NOTHING },
    ],
  },

  // ---- Gouden Eeuw ----
  {
    k: 'stormSurge',
    n: 'Stormvloed',
    g: '≈',
    ages: [4, 5],
    x: 'Een stormvloed beukt op de dijken.',
    choices: [
      { l: 'Versterk de dijken', cost: { stone: 250, wood: 150 }, d: 'De dijken houden' },
      {
        l: 'Zet het land onder water',
        lose: { food: 300 },
        buff: { bonus: { 'raid.hp': -0.3, 'raid.size': -0.2 }, days: 3 },
        d: 'De akkers lopen onder, maar 3 dagen: aanvallers 30% zwakker en 20% kleiner',
      },
      { l: 'Hoop op het beste', damage: 4, lose: { food: 150 }, d: '4 gebouwen raken beschadigd' },
    ],
  },
  {
    k: 'tulips',
    n: 'Tulpenmanie',
    g: '⚘',
    ages: [4, 5],
    x: 'Iedereen wil tulpenbollen. Eén bol kost meer dan een huis!',
    choices: [
      {
        l: 'Koop bollen',
        cost: { gold: 150 },
        follow: { k: 'tulipFever', days: 2 },
        d: 'Over 2 dagen zijn ze misschien veel meer waard...',
      },
      {
        l: 'Verkoop akkers aan kwekers',
        gain: { gold: 120 },
        buff: { bonus: { farm: -0.25 }, days: 3 },
        d: 'Goud, maar 3 dagen: akkers 25% trager',
      },
      { l: 'Doe niet mee', d: NOTHING },
    ],
  },
  {
    k: 'eastShip',
    n: 'Een schip naar de Oost',
    g: '⚓',
    ages: [4, 5],
    trade: true,
    x: 'Een handelsschip zoekt geld voor een reis naar de Oost. Winst is niet zeker.',
    choices: [
      {
        l: 'Investeer veel',
        cost: { gold: 200 },
        // Twee op de drie keer komt het schip rijk terug, één keer vergaat het
        follow: { k: ['shipRich', 'shipRich', 'shipSunk'], days: 4 },
        d: 'Over 4 dagen is het schip terug. Of niet...',
      },
      { l: 'Koop alleen buskruit', cost: { gold: 80 }, gain: { powder: 100 }, d: 'Zeker van je zaak' },
      { l: 'Niet investeren', d: NOTHING },
    ],
  },

  // ---- Industriële tijd ----
  {
    k: 'strike',
    n: 'Staking',
    g: '⚙',
    ages: [5, 6],
    need: ['maker'],
    x: 'Arbeiders leggen het werk neer. Ze willen meer loon.',
    choices: [
      {
        l: 'Betaal meer loon',
        cost: { gold: 150 },
        buff: { bonus: { 'conv.speed': 0.2 }, days: 3 },
        d: 'Blije arbeiders: 3 dagen fabrieken 20% sneller',
      },
      {
        l: 'Geef ze een vrije dag',
        buff: { bonus: { 'conv.speed': -0.5 }, days: 1 },
        d: '1 dag: fabrieken 50% trager, daarna is het weer goed',
      },
      {
        l: 'Negeer ze',
        buff: { bonus: { 'conv.speed': -0.4 }, days: 3 },
        d: '3 dagen: fabrieken 40% trager',
      },
    ],
  },
  {
    k: 'railBaron',
    n: 'Spoorwegbaron',
    g: '═',
    ages: [5, 6],
    trade: true,
    x: 'Een rijke baron wil een spoorlijn aanleggen door {plaats}.',
    choices: [
      {
        l: 'Leg het spoor aan',
        cost: { steel: 120 },
        buff: { bonus: { 'move.all': 0.2, 'trader.rate': 1 }, days: 4 },
        d: '4 dagen: iedereen 20% sneller en handelaars 2 keer zo vaak',
      },
      {
        l: 'Verkoop hem grond',
        gain: { gold: 250 },
        buff: { bonus: { 'chunk.cost': 0.25 }, days: 4 },
        d: 'Goud, maar 4 dagen: nieuw gebied 25% duurder',
      },
      { l: 'Nee', d: NOTHING },
    ],
  },
  {
    k: 'inventor',
    n: 'De uitvinder',
    g: '✹',
    ages: [5, 6],
    x: 'Een uitvinder laat een nieuwe stoommachine zien.',
    choices: [
      {
        l: 'Betaal zijn onderzoek',
        cost: { coal: 150, gold: 100 },
        buff: { bonus: { 'research.time': -0.35 }, days: 4 },
        d: '4 dagen: onderzoek 35% sneller',
      },
      {
        l: 'Koop de machine',
        cost: { steel: 100 },
        buff: { bonus: { 'gather.mine': 0.3 }, days: 4 },
        d: '4 dagen: steen en erts winnen 30% sneller',
      },
      { l: 'Niet nodig', d: NOTHING },
    ],
  },
  {
    k: 'smog',
    n: 'Rook boven de stad',
    g: '☁',
    ages: [5, 6],
    need: ['maker'],
    x: 'Zwarte rook hangt boven de stad. Mensen hoesten.',
    choices: [
      { l: 'Bouw hoge schoorstenen', cost: { stone: 200, steel: 40 }, d: 'De lucht wordt weer schoon' },
      {
        l: 'Zet de fabrieken stil',
        buff: { bonus: { 'conv.speed': -0.5 }, days: 2 },
        d: '2 dagen: fabrieken 50% trager',
      },
      {
        l: 'Laat ze maar roken',
        villagers: -1,
        buff: { bonus: { 'gather.all': -0.1 }, days: 2 },
        d: '−1 dorpeling en 2 dagen: verzamelen 10% trager',
      },
    ],
  },

  // ---- Moderne tijd ----
  {
    k: 'oilSpill',
    n: 'Olieramp',
    g: '⛽',
    ages: [6, 7],
    x: 'Een tanker is lek. Olie spoelt aan op de kust.',
    choices: [
      { l: 'Ruim het op', cost: { gold: 150, fuel: 40 }, d: 'De kust wordt weer schoon' },
      {
        l: 'Schep de olie op',
        gain: { oil: 200 },
        villagers: -1,
        buff: { bonus: { 'gather.food': -0.3 }, days: 3 },
        d: 'Olie, maar −1 dorpeling en 3 dagen: voedsel verzamelen 30% trager',
      },
      {
        l: 'Laat het liggen',
        buff: { bonus: { 'gather.food': -0.35 }, days: 4 },
        d: '4 dagen: voedsel verzamelen 35% trager',
      },
    ],
  },
  {
    k: 'elections',
    n: 'Verkiezingen',
    g: '✓',
    ages: [6, 7],
    x: 'Er zijn verkiezingen. Welke partij steun je?',
    choices: [
      {
        l: 'De bouwpartij',
        buff: { bonus: { 'build.speed': 0.4, 'research.time': 0.2 }, days: 4 },
        d: '4 dagen: bouwen 40% sneller, maar onderzoek 20% trager',
      },
      {
        l: 'De wetenschapspartij',
        buff: { bonus: { 'research.time': -0.4, 'build.speed': -0.2 }, days: 4 },
        d: '4 dagen: onderzoek 40% sneller, maar bouwen 20% trager',
      },
      {
        l: 'De boerenpartij',
        buff: { bonus: { farm: 0.3, 'conv.speed': -0.15 }, days: 4 },
        d: '4 dagen: akkers 30% sneller, maar fabrieken 15% trager',
      },
    ],
  },
  {
    k: 'festival',
    n: 'Popfestival',
    g: '♥',
    ages: [6, 7],
    x: 'Jongeren willen een groot muziekfestival houden.',
    choices: [
      {
        l: 'Ja, groot!',
        cost: { food: 400 },
        villagers: 3,
        d: '+3 dorpelingen: een paar bezoekers blijven wonen',
      },
      {
        l: 'Alleen op het plein',
        cost: { food: 150 },
        buff: { bonus: { 'gather.all': 0.1 }, days: 2 },
        d: '2 dagen: verzamelen 10% sneller',
      },
      {
        l: 'Verbied het',
        buff: { bonus: { 'gather.all': -0.1 }, days: 1 },
        d: '1 dag: verzamelen 10% trager, want de jongeren zijn boos',
      },
    ],
  },

  // ---- Dronetijdperk ----
  {
    k: 'hackers',
    n: 'Hackers',
    g: '⚿',
    ages: [7, 8],
    x: 'Hackers hebben je computers gekraakt. Ze eisen chips.',
    choices: [
      { l: 'Betaal losgeld', cost: { chips: 40 }, d: 'Alles werkt weer' },
      {
        l: 'Huur ze in',
        cost: { gold: 200 },
        buff: { bonus: { 'research.time': -0.35 }, days: 3 },
        d: 'Ze werken nu voor jou: 3 dagen onderzoek 35% sneller',
      },
      {
        l: 'Trek de stekker eruit',
        buff: { bonus: { 'conv.speed': -0.4, power: -0.3 }, days: 2 },
        d: '2 dagen: fabrieken 40% trager en 30% minder stroom',
      },
    ],
  },
  {
    k: 'aiRevolt',
    n: 'AI-opstand',
    g: '✈',
    ages: [7, 8],
    x: 'De slimme computer van de stad wil zelf beslissen. Je drones luisteren niet meer.',
    choices: [
      {
        l: 'Onderhandel',
        cost: { chips: 60 },
        buff: { bonus: { 'robot.dmg': 0.3 }, days: 3 },
        d: '3 dagen: drones en exo-soldaten doen 30% meer schade',
      },
      {
        l: 'Laat de AI begaan',
        foes: { n: 4, type: 7 },
        buff: { bonus: { 'build.speed': 0.4 }, days: 3 },
        d: '4 drones vallen nu aan, maar 3 dagen: bouwen 40% sneller',
      },
      {
        l: 'Zet alles uit',
        buff: { bonus: { 'conv.speed': -0.3, power: -0.2 }, days: 2 },
        d: '2 dagen: fabrieken 30% trager en 20% minder stroom',
      },
    ],
  },
  {
    k: 'lithium',
    n: 'Lithiumkoorts',
    g: '◆',
    ages: [7, 8],
    x: 'Een bedrijf wil lithium graven onder je akkers.',
    choices: [
      {
        l: 'Graaf overal',
        gain: { lithium: 250 },
        buff: { bonus: { farm: -0.35 }, days: 4 },
        d: 'Veel lithium, maar 4 dagen: akkers 35% trager',
      },
      {
        l: 'Alleen aan de rand',
        gain: { lithium: 100 },
        buff: { bonus: { farm: -0.1 }, days: 2 },
        d: 'Wat lithium, en 2 dagen: akkers 10% trager',
      },
      { l: 'Nee', d: NOTHING },
    ],
  },

  // ---- Sterrentijdperk ----
  {
    k: 'signal',
    n: 'Signaal uit de ruimte',
    g: '☊',
    ages: [8, 8],
    once: true,
    x: 'Je telescopen vangen een vreemd signaal op uit de ruimte.',
    choices: [
      {
        l: 'Stuur een antwoord',
        cost: { fusion: 20 },
        follow: { k: ['aliensFriendly', 'aliensHostile'], days: 3 },
        d: 'Over 3 dagen komt er antwoord. Vriend of vijand?',
      },
      {
        l: 'Luister alleen',
        buff: { bonus: { 'research.time': -0.4 }, days: 4 },
        d: '4 dagen: onderzoek 40% sneller',
      },
      { l: 'Negeer het', d: NOTHING },
    ],
  },
  {
    k: 'meteorSwarm',
    n: 'Meteorenzwerm',
    g: '☄',
    ages: [8, 8],
    x: 'Sterrenkijkers zien een zwerm meteorieten aankomen.',
    choices: [
      {
        l: 'Trek ze aan',
        meteor: true,
        buff: { bonus: { 'meteor.rate': 1, 'meteor.ore': 0.5 }, days: 3 },
        d: 'Nu een meteoriet. 3 dagen: meteorieten 2 keer zo vaak en 50% meer erts. Kan gebouwen raken.',
      },
      {
        l: 'Schiet ze kapot',
        cost: { fusion: 15 },
        gain: { starmetal: 120 },
        d: 'Brokstukken sterrenmetaal',
      },
      { l: 'Schuil', d: NOTHING },
    ],
  },
  {
    k: 'moonBase',
    n: 'Een basis op de maan',
    g: '☾',
    ages: [8, 8],
    once: true,
    x: 'Kolonisten willen een basis op de maan beginnen.',
    choices: [
      {
        l: 'Stuur ze met spullen',
        cost: { steel: 200, fusion: 20 },
        villagers: -3,
        follow: { k: 'moonBack', days: 4 },
        d: '3 dorpelingen vertrekken. Over 4 dagen sturen ze iets terug.',
      },
      {
        l: 'Bouw een sterrenwacht',
        cost: { starmetal: 60 },
        buff: { bonus: { 'meteor.ore': 0.5 }, days: 4 },
        d: '4 dagen: meteorieten geven 50% meer erts',
      },
      { l: 'Nee', d: NOTHING },
    ],
  },

  // ---- Vervolgen: komen alleen na een eerdere keuze ----
  {
    k: 'travelerBack',
    n: 'De reiziger komt terug',
    g: '➜',
    chain: true,
    x: 'De reiziger van laatst is terug. Hij blijkt een rijke koopman en wil je bedanken.',
    choices: [
      {
        l: 'Neem zijn geschenk aan',
        gain: perAge({ food: [120, 50], wood: [100, 40] }),
        d: 'Een kar vol spullen',
      },
      {
        l: 'Vraag om zijn kaart',
        buff: { bonus: { 'chunk.cost': -0.4 }, days: 3 },
        d: '3 dagen: nieuw gebied 40% goedkoper',
      },
      { l: 'Vraag hem te blijven', villagers: 2, d: 'Hij en zijn knecht blijven: +2 dorpelingen' },
    ],
  },
  {
    k: 'travelerThief',
    n: 'Weg met de buit',
    g: '⛁',
    chain: true,
    x: 'De reiziger is er vannacht vandoor gegaan, met een deel van je voorraad!',
    choices: [
      {
        l: 'Ga hem achterna',
        villagers: -1,
        buff: { bonus: { 'gather.all': -0.2 }, days: 1 },
        d: 'Je krijgt alles terug en de dief is weg: −1 dorpeling. 1 dag: verzamelen 20% trager.',
      },
      {
        l: 'Laat hem gaan',
        villagers: -1,
        lose: perAge({ food: [80, 30], wood: [60, 25] }),
        d: 'De voorraad is weg, en de dief ook: −1 dorpeling',
      },
    ],
  },
  {
    k: 'travelerHonest',
    n: 'Een eerlijke werker',
    g: '☺',
    chain: true,
    x: 'De reiziger blijkt eerlijk en werkt hard. Nu wil hij zijn familie naar {plaats} halen.',
    choices: [
      { l: 'Haal ze hierheen', cost: perAge({ food: [60, 20] }), villagers: 2, d: '+2 dorpelingen' },
      {
        l: 'Laat hem de anderen leren',
        buff: { bonus: { 'gather.all': 0.15 }, days: 2 },
        d: 'Hij leert iedereen zijn vak: 2 dagen verzamelen 15% sneller',
      },
    ],
  },
  {
    k: 'refugeesThanks',
    n: 'Een bedankje',
    g: '♥',
    chain: true,
    x: 'De vluchtelingen hebben een nieuw thuis gevonden. Ze sturen een bedankje.',
    choices: [
      {
        l: 'Hout en steen',
        gain: perAge({ wood: [100, 40], stone: [80, 30] }),
        d: 'Een kar vol bouwspullen',
      },
      {
        l: 'Hun beste jager',
        villagers: 1,
        buff: { bonus: { 'gather.food': 0.2 }, days: 2 },
        d: '+1 dorpeling en 2 dagen: voedsel verzamelen 20% sneller',
      },
    ],
  },
  {
    k: 'tribeBack',
    n: 'De stam komt terug',
    g: '⚖',
    chain: true,
    x: 'De vreemde stam is terug. Ze willen vrienden blijven.',
    choices: [
      {
        l: 'Leer hun jachtkunst',
        buff: { bonus: { 'gather.food': 0.3 }, days: 3 },
        d: '3 dagen: voedsel verzamelen 30% sneller',
      },
      { l: 'Laat er twee blijven', cost: { food: 100 }, villagers: 2, d: '+2 dorpelingen' },
      { l: 'Neem hun geschenk aan', gain: { stone: 100, wood: 60 }, d: 'Steen en hout' },
    ],
  },
  {
    k: 'druidBack',
    n: 'De druïde komt terug',
    g: '☉',
    chain: true,
    x: 'De druïde is terug, met een leerling. "Jullie hebben de goden boos gemaakt."',
    choices: [
      {
        l: 'Offer alsnog',
        cost: { food: 300 },
        buff: { bonus: { farm: 0.2 }, days: 2 },
        d: '2 dagen: akkers 20% sneller',
      },
      {
        l: 'Neem de leerling op',
        cost: { food: 100 },
        villagers: 1,
        d: '+1 dorpeling, en het volk is gerust',
      },
      {
        l: 'Lach hem uit',
        buff: { bonus: { 'gather.all': -0.15 }, days: 2 },
        d: 'Het volk is bang: 2 dagen verzamelen 15% trager',
      },
    ],
  },
  {
    k: 'crusadeBack',
    n: 'De soldaten keren terug',
    g: '⚑',
    chain: true,
    x: 'Je soldaten zijn terug van de verre tocht. Twee hebben het gered, met buit.',
    choices: [
      {
        l: 'Terug in het leger',
        units: 2,
        gain: { gold: 150 },
        buff: { bonus: { 'army.dmg': 0.2 }, days: 4 },
        d: '+2 soldaten, wat goud en nieuwe trucs. 4 dagen: je leger doet 20% meer schade.',
      },
      {
        l: 'Laat ze boeren',
        villagers: 2,
        gain: { gold: 300 },
        d: 'Ze hebben genoeg gevochten: +2 dorpelingen, en de hele buit is voor jou',
      },
    ],
  },
  {
    k: 'tulipFever',
    n: 'Tulpenkoorts',
    g: '⚘',
    chain: true,
    x: 'Je bollen zijn twee keer zoveel waard! Verkopen of nog even wachten?',
    choices: [
      { l: 'Verkoop alles', gain: { gold: 300 }, d: 'Je krijgt het dubbele terug' },
      {
        l: 'Wacht op meer',
        follow: { k: 'tulipCrash', days: 2 },
        d: 'Wie weet worden ze nog meer waard... Over 2 dagen zie je het.',
      },
    ],
  },
  {
    k: 'tulipCrash',
    n: 'De tulpen zijn niets meer waard',
    g: '⚘',
    chain: true,
    x: 'De prijzen zijn ingestort. Niemand wil nog bollen.',
    choices: [
      { l: 'Verkoop wat je kan', gain: { gold: 40 }, d: 'Een klein beetje terug' },
      {
        l: 'Plant ze in de stad',
        buff: { bonus: { 'gather.all': 0.1 }, days: 3 },
        d: 'Mooie bloemen: 3 dagen verzamelen 10% sneller',
      },
    ],
  },
  {
    k: 'shipRich',
    n: 'Het schip is terug!',
    g: '⚓',
    chain: true,
    x: 'Het schip is terug uit de Oost, vol specerijen en zijde.',
    choices: [
      { l: 'Verkoop de lading', gain: { gold: 500 }, d: 'Een flinke winst' },
      {
        l: 'Houd een groot feest',
        gain: { food: 300 },
        buff: { bonus: { 'gather.all': 0.2 }, days: 3 },
        d: '3 dagen: verzamelen 20% sneller',
      },
    ],
  },
  {
    k: 'shipSunk',
    n: 'Het schip is vergaan',
    g: '⚓',
    chain: true,
    x: 'Slecht nieuws: het schip is gezonken in een storm. Je geld is weg.',
    choices: [
      {
        l: 'Steun de families',
        cost: { gold: 60 },
        buff: { bonus: { 'gather.all': 0.1 }, days: 2 },
        d: 'Het volk is dankbaar: 2 dagen verzamelen 10% sneller',
      },
      {
        l: 'Het is niet anders',
        buff: { bonus: { 'gather.all': -0.1 }, days: 2 },
        d: 'Het volk rouwt: 2 dagen verzamelen 10% trager',
      },
    ],
  },
  {
    k: 'aliensFriendly',
    n: 'Bezoekers uit de ruimte',
    g: '☄',
    chain: true,
    x: 'Een vriendelijk ruimteschip landt bij de stad. De bezoekers willen helpen.',
    choices: [
      { l: 'Vraag om sterrenmetaal', gain: { starmetal: 250 }, d: 'Een lading sterrenmetaal' },
      {
        l: 'Vraag om kennis',
        buff: { bonus: { 'research.time': -0.5 }, days: 4 },
        d: '4 dagen: onderzoek 50% sneller',
      },
      { l: 'Vraag om kolonisten', villagers: 4, d: '+4 dorpelingen' },
    ],
  },
  {
    k: 'aliensHostile',
    n: 'Ruimtepiraten!',
    g: '☄',
    chain: true,
    x: 'Ruimtepiraten hebben je antwoord opgevangen. Ze willen sterrenmetaal.',
    choices: [
      { l: 'Geef ze wat ze willen', cost: { starmetal: 80 }, d: 'Ze vliegen weg' },
      { l: 'Vecht', foes: { n: 6, type: 8 }, d: '6 ruimtepiraten landen nu' },
      {
        l: 'Verstop je',
        lose: { starmetal: 150 },
        damage: 2,
        d: 'Ze nemen sterrenmetaal mee en raken 2 gebouwen',
      },
    ],
  },
  {
    k: 'moonBack',
    n: 'Bericht van de maan',
    g: '☾',
    chain: true,
    x: 'De maanbasis werkt! De kolonisten sturen een lading terug.',
    choices: [
      { l: 'Sterrenmetaal', gain: { starmetal: 300 }, d: 'Een lading sterrenmetaal' },
      { l: 'Fusiecellen', gain: { fusion: 120 }, d: 'Een lading fusiecellen' },
    ],
  },
];

/** Gebeurtenis opzoeken op sleutel: EVENT.wolves */
export const EVENT = {};
EVENTS.forEach(e => (EVENT[e.k] = e));

/** Hoe lang je hebt om te kiezen, in seconden speltijd. */
export const CHOICE_TIME = 60;

/** De keuze die vanzelf gebeurt als je niet kiest: altijd de laatste. */
export const defaultChoice = def => def.choices.length - 1;

/** Bedragen voor dit tijdperk: een vast rijtje, of een rijtje dat meegroeit (zie perAge). Leeg = null. */
export function amountsFor(value, age) {
  if (!value) return null;
  return typeof value === 'function' ? value(age) : value;
}

// Bonussleutels die alleen iets doen met een leger, of alleen als er aanvallen zijn, of met handel
const ARMY_KEYS = ['army.dmg', 'army.hp', 'army.speed', 'robot.dmg', 'train.speed', 'loot'];
const RAID_KEYS = ['raid.size', 'raid.hp'];
const TRADE_KEYS = ['trader.rate'];

/**
 * Waar een keuze van afhangt: raids (er zijn aanvallen), army (je mag een leger hebben),
 * trade (er komen handelaars). Zo verdwijnen keuzes die in jouw spel geen zin hebben.
 */
export function choiceNeeds(choice) {
  const keys = Object.keys((choice.buff && choice.buff.bonus) || {});
  return {
    raids: !!(choice.raid || choice.foes) || keys.some(key => RAID_KEYS.includes(key)),
    army: !!(choice.units || choice.sendUnits) || keys.some(key => ARMY_KEYS.includes(key)),
    trade: keys.some(key => TRADE_KEYS.includes(key)),
  };
}

/**
 * Mag deze keuze in dit spel? `rules` is { peaceful, noArmy, noTrade }:
 * vredige modus, spelregel Geen leger en spelregel Gesloten grenzen.
 */
export function choiceAllowed(choice, rules = {}) {
  const needs = choiceNeeds(choice);
  return !(needs.raids && rules.peaceful) && !(needs.army && rules.noArmy) && !(needs.trade && rules.noTrade);
}

/** De keuzes die je te zien krijgt (hun plek in de lijst). */
export function allowedChoices(def, rules = {}) {
  return def.choices.map((choice, i) => (choiceAllowed(choice, rules) ? i : -1)).filter(i => i >= 0);
}

/**
 * Kan deze gebeurtenis in dit spel komen? De keuze die vanzelf gebeurt moet kunnen,
 * en er moet echt iets te kiezen zijn (minstens twee keuzes).
 */
export function eventAllowed(def, rules = {}) {
  if (def.trade && rules.noTrade) return false;
  const options = allowedChoices(def, rules);
  return options.includes(defaultChoice(def)) && options.length >= 2;
}

/** Komt deze gebeurtenis zomaar voor in dit tijdperk? (Vervolgen niet: die komen na een keuze.) */
export function inAge(def, age) {
  if (def.chain) return false;
  const [from, to] = def.ages || [0, Infinity];
  return age >= from && age <= to;
}

/**
 * Hoe vaak een gebeurtenis gekozen wordt, vergeleken met de rest. Gebeurtenissen van je eigen
 * tijdperk komen twee keer zo vaak als algemene. Handel komt vaker als handelaars vaker komen
 * (bij de Hanze twee keer zo vaak): `traderMul` is die vermenigvuldiger uit het bonusregister.
 */
export function eventWeight(def, traderMul = 1) {
  const own = def.ages ? 2 : 1;
  return own * (def.trade ? traderMul : 1);
}

// "goud", "goud en voedsel", "hout, steen en goud"
function listWords(words) {
  if (words.length < 2) return words.join('');
  return words.slice(0, -1).join(', ') + ' en ' + words[words.length - 1];
}

/**
 * Waarom je deze keuze nu niet kunt maken, of '' als het wel kan.
 * `have` is { res, units }: je voorraad en hoeveel soldaten je hebt.
 */
export function choiceProblem(choice, age, have) {
  const cost = amountsFor(choice.cost, age) || {};
  const short = Object.keys(cost).filter(r => !(have.res[r] >= cost[r]));
  if (short.length) return 'Te weinig ' + listWords(short.map(r => RES[r].n.toLowerCase()));
  if (choice.sendUnits && have.units < choice.sendUnits)
    return `Je hebt ${choice.sendUnits} soldaten nodig (nu ${have.units})`;
  return '';
}

// Bij tijd en kosten is een lager getal juist goed (sneller klaar, goedkoper, zwakkere vijand)
const GOOD_WHEN_LOWER = ['research.time', 'chunk.cost', 'wall.cost', 'raid.size', 'raid.hp'];

/** Is een tijdelijke bonus goed, slecht of allebei? Geeft 'good', 'bad' of 'mixed'. */
export function buffMood(bonus = {}) {
  let good = 0,
    bad = 0;
  for (const [key, value] of Object.entries(bonus)) {
    const better = GOOD_WHEN_LOWER.includes(key) ? value < 0 : value > 0;
    if (key === 'meteor.rate' || better) good++;
    else bad++;
  }
  return bad && good ? 'mixed' : bad ? 'bad' : 'good';
}

/**
 * Heeft een keuze een nadeel: iets kwijt, een aanval, schade of een bonus die (ook) slecht uitpakt?
 * Dan staat er geen "gratis" bij, ook al kost de keuze niets.
 */
export function hasDownside(choice) {
  const badBuff = !!choice.buff && buffMood(choice.buff.bonus) !== 'good';
  const harm = choice.lose || choice.sendUnits || choice.damage || choice.raid || choice.foes;
  return choice.villagers < 0 || badBuff || !!(harm || choice.burn || choice.meteor);
}

/**
 * Het korte effect van een tijdelijke bonus, voor op het plaatje onder de kaartjes. Uit de uitleg
 * komt het stuk na "3 dagen:", zonder de bijzinnen waar geen getal in staat:
 * "2 dagen: verzamelen 20% trager, maar niemand sterft" wordt "verzamelen 20% trager".
 */
export function buffEffect(text = '') {
  const afterDays = text.match(/\d+ dag(?:en)?:? (.+)$/);
  if (!afterDays) return '';
  const parts = afterDays[1].replace(/\.$/, '').split(/[,.] /);
  return parts.filter((part, i) => i === 0 || /\d/.test(part)).join(', ');
}

/** Is een keuze vooral goed nieuws ('good'), slecht nieuws ('bad') of allebei ('')? Voor de kleur van de melding. */
export function choiceMood(choice) {
  const mood = choice.buff ? buffMood(choice.buff.bonus) : '';
  const bad =
    choice.villagers < 0 ||
    !!(choice.lose || choice.damage || choice.raid || choice.foes || choice.burn) ||
    mood === 'bad';
  const good = choice.villagers > 0 || !!(choice.gain || choice.units) || mood === 'good';
  return good && !bad ? 'good' : bad && !good ? 'bad' : '';
}

/** Vul {plaats}, {erts} en {soldaat} in. Onbekende woorden blijven staan. */
export const fillText = (text, words) => text.replace(/\{(\w+)\}/g, (all, key) => words[key] ?? all);

// ---- Opslaan en laden: maak opgeslagen lijsten netjes (oude of kapotte opslag mag het spel niet breken) ----

const isBonus = bonus =>
  !!bonus &&
  typeof bonus === 'object' &&
  Object.keys(bonus).length > 0 &&
  Object.entries(bonus).every(([key, value]) => BONUS_KEYS[key] && Number.isFinite(value));

/** Tijdelijke bonussen: alleen wat een bekende bonus heeft en een eindtijd. */
export const cleanBuffs = list =>
  (Array.isArray(list) ? list : []).filter(b => b && isBonus(b.bonus) && Number.isFinite(b.until));

/** Vervolgen die nog komen: alleen bestaande gebeurtenissen met een dag. */
export const cleanFollowups = list =>
  (Array.isArray(list) ? list : []).filter(f => f && EVENT[f.k] && Number.isFinite(f.day));

/** Gebeurtenissen die al geweest zijn: alleen bekende sleutels, hooguit de laatste 60. */
export const cleanEventsSeen = list => (Array.isArray(list) ? list : []).filter(k => EVENT[k]).slice(-60);

/** De gebeurtenis die openstond: alleen als hij nog bestaat. */
export const cleanActiveEvent = ev =>
  ev && EVENT[ev.k] && Number.isFinite(ev.until) && typeof ev.text === 'string' ? ev : null;
