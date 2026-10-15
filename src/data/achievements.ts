// Alle prestaties die je kunt halen, en wanneer je ze haalt. Puur (geen spelstand), zodat het te testen is.
import { B } from './buildings';
import { DEFAULT_PEOPLE, PEOPLES } from './peoples';
import { TECH } from './tech';

/*
 * Elke prestatie:
 * - k: vaste sleutel (wordt in het profiel bewaard; volken op slot noemen deze sleutel)
 * - n: naam, d: wat je ervoor moet doen
 * - cat: groep op het profielscherm (zie ACHIEVEMENT_CATS)
 * - g: pictogram (zie ui/glyphs.ts); `age` of `people` laat in plaats daarvan een kraal of vaandel zien
 * - hidden: geheim: op het profielscherm staat ??? tot je hem haalt
 * - unlocks: { people: k }: speelt een volk vrij (zie `locked` in data/peoples.ts)
 * - when(f, have): gehaald? `f` zijn de feiten over het spel nu (zie emptyFacts hieronder),
 *   `have` zijn de prestaties die je al hebt (sleutel → wanneer)
 */

/** Een prestatie die je kunt halen (zie de uitleg hierboven). */
export interface AchievementDef {
  k: string;
  n: string;
  cat: string;
  d: string;
  g?: string;
  /** Laat de kraal van dit tijdperk zien in plaats van een pictogram. */
  age?: number;
  /** Laat het vaandel van dit volk zien in plaats van een pictogram. */
  people?: string;
  hidden?: boolean;
  unlocks?: { people: string };
  /** Gehaald? `have` geeft newAchievements altijd mee; alleen "Alle volken" kijkt ernaar. */
  when: (f: AchievementFacts, have?: AchievedMap) => boolean;
}

/** Feiten over een spel (zie emptyFacts): daarmee kijkt elke prestatie of hij gehaald is. */
export type AchievementFacts = ReturnType<typeof emptyFacts>;

/** Prestaties die je al hebt: sleutel → wanneer gehaald (of true als hij net gehaald is). */
export type AchievedMap = Record<string, number | boolean>;

/** Feiten over een spel, zoals game/achievements.ts ze verzamelt. Dit zijn de waarden bij een leeg spel. */
export const emptyFacts = () => ({
  age: 0, // tijdperk (0 = Steentijd)
  day: 1,
  diff: 1, // 0 = Vredig, 1 = Normaal, 2 = Zwaar, 3 = Meedogenloos
  peaceful: false, // vredige modus stond in dit spel aan (nu of eerder)
  people: DEFAULT_PEOPLE,
  won: false, // gewonnen met de Sterrenpoort (een kort spel of overleven telt hier niet)
  lost: false, // stamhuis gevallen
  villagers: 0, // dorpelingen nu
  soldiers: 0, // soldaten nu
  camps: 0, // kampen veroverd
  campsLeft: 1, // kampen die nog over zijn
  kills: 0, // vijanden verslagen
  raidsSurvived: 0, // aanvallen doorstaan
  gathered: 0, // grondstoffen verzameld
  inventions: 0, // onderzoek afgerond
  blessings: 0, // zegeningen gekozen
  riskyBlessings: 0, // waarvan met een nadeel
  builtWalls: false, // ooit een muur of poort gebouwd
  fullAge: -1, // hoogste tijdperk waarvan alle gebouwen tegelijk staan (-1 = geen)
  expansions: 0, // keren gebied uitgebreid
  meteors: 0, // meteorieten ingeslagen
  rivalsBeaten: 0, // rivalen verslagen
  wonders: 0, // wereldwonderen die nu van jou zijn
  wondersBuilt: 0, // wereldwonderen die je zelf afmaakte
  wonderRaces: 0, // wonderen afgemaakt terwijl een rivaal hetzelfde wonder bouwde
  wondersTaken: 0, // wonderen veroverd door een rivaal te verslaan
});

/** Prestatie: win een spel met dit volk. */
const winWith = (k: string, n: string, people: string, d: string): AchievementDef => ({
  k,
  n,
  cat: 'folk',
  people,
  d,
  when: f => f.won && f.people === people,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  // Tijdperken: elk nieuw tijdperk is een prestatie
  { k: 'age1', n: 'Brons en vuur', cat: 'age', age: 1, d: 'Bereik de Bronstijd', when: f => f.age >= 1 },
  { k: 'age2', n: 'Het zwarte metaal', cat: 'age', age: 2, d: 'Bereik de IJzertijd', when: f => f.age >= 2 },
  {
    k: 'age3',
    n: 'Muren van steen',
    cat: 'age',
    age: 3,
    d: 'Bereik de Middeleeuwen',
    unlocks: { people: 'bergvolk' },
    when: f => f.age >= 3,
  },
  {
    k: 'age4',
    n: 'Wind in de zeilen',
    cat: 'age',
    age: 4,
    d: 'Bereik de Gouden Eeuw',
    when: f => f.age >= 4,
  },
  {
    k: 'age5',
    n: 'Rook en stoom',
    cat: 'age',
    age: 5,
    d: 'Bereik de Industriële tijd',
    unlocks: { people: 'sterrenkijkers' },
    when: f => f.age >= 5,
  },
  { k: 'age6', n: 'Olie en asfalt', cat: 'age', age: 6, d: 'Bereik de Moderne tijd', when: f => f.age >= 6 },
  { k: 'age7', n: 'De zwerm', cat: 'age', age: 7, d: 'Bereik het Dronetijdperk', when: f => f.age >= 7 },
  {
    k: 'age8',
    n: 'Metaal uit de hemel',
    cat: 'age',
    age: 8,
    d: 'Bereik het Sterrentijdperk',
    when: f => f.age >= 8,
  },

  // Winnen: de Sterrenpoort bouwen, en dat op een moeilijke manier
  {
    k: 'win',
    n: 'Naar de sterren',
    cat: 'win',
    g: '★',
    d: 'Win een spel: bouw de Sterrenpoort',
    when: f => f.won,
  },
  {
    k: 'win_hard',
    n: 'IJzeren wil',
    cat: 'win',
    g: '⛨',
    d: 'Win op Zwaar of Meedogenloos, zonder vredige modus',
    when: f => f.won && f.diff >= 2 && !f.peaceful,
  },
  {
    k: 'win_walls',
    n: 'Open grenzen',
    cat: 'win',
    g: '⬚',
    d: 'Win zonder ooit een muur of poort te bouwen',
    when: f => f.won && !f.builtWalls,
  },
  {
    k: 'win_fast',
    n: 'Snel als de wind',
    cat: 'win',
    g: '⌛',
    d: 'Win binnen 40 dagen',
    when: f => f.won && f.day <= 40,
  },

  // Volken: win met elk volk
  winWith('win_friezen', 'Dijkgraaf', 'friezen', 'Win met de Friezen'),
  winWith('win_norse', 'Sage van het noorden', 'norse', 'Win met de Noormannen'),
  winWith('win_hanze', 'Koopmansgeest', 'hanze', 'Win met de Hanze'),
  winWith('win_bergvolk', 'Koning van de berg', 'bergvolk', 'Win met het Bergvolk'),
  winWith('win_sterrenkijkers', 'In de sterren geschreven', 'sterrenkijkers', 'Win met de Sterrenkijkers'),
  winWith('win_nomaden', 'Overal thuis', 'nomaden', 'Win met de Nomaden'),
  {
    k: 'win_all',
    n: 'Alle volken',
    cat: 'folk',
    g: '♛',
    d: 'Win met elk van de zes volken',
    when: (_f, have) => PEOPLES.every(p => have![`win_${p.k}`]),
  },

  // Strijd: kampen, aanvallen en vijanden
  {
    k: 'camps1',
    n: 'Eerste buit',
    cat: 'war',
    g: '⛁',
    d: 'Verover een vijandelijk kamp',
    when: f => f.camps >= 1,
  },
  {
    k: 'camps3',
    n: 'Veroveraar',
    cat: 'war',
    g: '⛁',
    d: 'Verover 3 vijandelijke kampen in één spel',
    unlocks: { people: 'nomaden' },
    when: f => f.camps >= 3,
  },
  {
    k: 'camps5',
    n: 'Krijgsheer',
    cat: 'war',
    g: '⛁',
    d: 'Verover 5 kampen in één spel',
    when: f => f.camps >= 5,
  },
  {
    k: 'camps_all',
    n: 'Geen vijand meer',
    cat: 'war',
    g: '⚑',
    d: 'Verover alle kampen op de kaart',
    when: f => f.camps > 0 && f.campsLeft === 0,
  },
  {
    k: 'rival1',
    n: 'Eén troon minder',
    cat: 'war',
    g: '♛',
    d: 'Versla een rivaal: verwoest zijn stamhuis',
    when: f => f.rivalsBeaten >= 1,
  },
  {
    k: 'rivals3',
    n: 'Alleenheerser',
    cat: 'war',
    g: '⚑',
    d: 'Versla drie rivalen in één spel',
    when: f => f.rivalsBeaten >= 3,
  },
  {
    k: 'wonder_taken',
    n: 'Buitgemaakt',
    cat: 'war',
    g: '★',
    d: 'Verover een wereldwonder: versla een rivaal die er een heeft',
    when: f => f.wondersTaken >= 1,
  },
  {
    k: 'raids3',
    n: 'Standgehouden',
    cat: 'war',
    g: '⛨',
    d: 'Doorsta 3 aanvallen in één spel',
    when: f => f.raidsSurvived >= 3,
  },
  {
    k: 'raids10',
    n: 'Onwrikbaar',
    cat: 'war',
    g: '⛨',
    d: 'Doorsta 10 aanvallen in één spel',
    when: f => f.raidsSurvived >= 10,
  },
  {
    k: 'kills100',
    n: 'Verdediger',
    cat: 'war',
    g: '⚔',
    d: 'Versla 100 vijanden in één spel',
    when: f => f.kills >= 100,
  },
  {
    k: 'kills500',
    n: 'Legende',
    cat: 'war',
    g: '⚔',
    d: 'Versla 500 vijanden in één spel',
    when: f => f.kills >= 500,
  },
  {
    k: 'army30',
    n: 'Groot leger',
    cat: 'war',
    g: '⚑',
    d: 'Heb 30 soldaten tegelijk',
    when: f => f.soldiers >= 30,
  },

  // Bouwen en groeien
  {
    k: 'pop25',
    n: 'Een echt dorp',
    cat: 'town',
    g: '☺',
    d: 'Heb 25 dorpelingen tegelijk',
    when: f => f.villagers >= 25,
  },
  {
    k: 'pop100',
    n: 'Wereldstad',
    cat: 'town',
    g: '⌂',
    d: 'Heb 100 dorpelingen tegelijk',
    when: f => f.villagers >= 100,
  },
  {
    k: 'gather10k',
    n: 'Volle schuren',
    cat: 'town',
    g: '◡',
    d: 'Verzamel 10.000 grondstoffen in één spel',
    when: f => f.gathered >= 10000,
  },
  {
    k: 'gather100k',
    n: 'Schatrijk',
    cat: 'town',
    g: '◡',
    d: 'Verzamel 100.000 grondstoffen in één spel',
    when: f => f.gathered >= 100000,
  },
  {
    k: 'builder',
    n: 'Bouwmeester',
    cat: 'town',
    g: '⚒',
    d: 'Laat alle nieuwe gebouwen van één tijdperk tegelijk staan (Middeleeuwen of later)',
    when: f => f.fullAge >= 3,
  },
  {
    k: 'land10',
    n: 'Landheer',
    cat: 'town',
    g: '⬚',
    d: 'Breid je gebied 10 keer uit in één spel',
    when: f => f.expansions >= 10,
  },
  {
    k: 'inventions10',
    n: 'Uitvinder',
    cat: 'town',
    g: '✎',
    d: 'Rond 10 onderzoeken af in één spel',
    when: f => f.inventions >= 10,
  },
  {
    k: 'inventions_all',
    n: 'Alwetend',
    cat: 'town',
    g: '✎',
    d: `Rond alle ${TECH.length} onderzoeken af in één spel`,
    when: f => f.inventions >= TECH.length,
  },
  {
    k: 'wonder1',
    n: 'Wereldwonder',
    cat: 'town',
    g: '★',
    d: 'Bouw een wereldwonder',
    when: f => f.wondersBuilt >= 1,
  },
  {
    k: 'wonders4',
    n: 'Wonderen van de wereld',
    cat: 'town',
    g: '★',
    d: 'Heb 4 wereldwonderen tegelijk',
    when: f => f.wonders >= 4,
  },
  {
    k: 'wonder_race',
    n: 'Net op tijd',
    cat: 'town',
    g: '⌛',
    d: 'Maak een wonder af terwijl een rivaal hetzelfde wonder bouwt',
    when: f => f.wonderRaces >= 1,
  },
  {
    k: 'risky3',
    n: 'Waaghals',
    cat: 'town',
    g: '✹',
    d: 'Kies 3 riskante zegeningen in één spel',
    when: f => f.riskyBlessings >= 3,
  },
  {
    k: 'blessed8',
    n: 'Gezegend',
    cat: 'town',
    g: '✹',
    d: 'Kies 8 zegeningen in één spel',
    when: f => f.blessings >= 8,
  },

  // Geheim: je ziet pas wat het is als je hem haalt
  {
    k: 'fallen',
    n: 'Opnieuw beginnen',
    cat: 'secret',
    g: '↻',
    hidden: true,
    d: 'Verlies je stamhuis. Volgende keer beter!',
    when: f => f.lost,
  },
  {
    k: 'swift',
    n: 'Haastige spoed',
    cat: 'secret',
    g: '»',
    hidden: true,
    d: 'Bereik de Middeleeuwen binnen 12 dagen',
    when: f => f.age >= 3 && f.day <= 12,
  },
  {
    k: 'starfall',
    n: 'Sterrenregen',
    cat: 'secret',
    g: '☄',
    hidden: true,
    d: 'Zie 3 meteorieten inslaan in één spel',
    when: f => f.meteors >= 3,
  },
];

/** Prestatie opzoeken op sleutel: ACHIEVEMENT.age3 */
export const ACHIEVEMENT: Record<string, AchievementDef> = {};
ACHIEVEMENTS.forEach(a => (ACHIEVEMENT[a.k] = a));

/** De groepen op het profielscherm, in deze volgorde. */
export const ACHIEVEMENT_CATS: Record<string, string> = {
  age: 'Tijdperken',
  win: 'Winnen',
  folk: 'Volken',
  war: 'Strijd',
  town: 'Bouwen en groeien',
  secret: 'Geheim',
};

/**
 * Welke prestaties haal je nu nieuw? Geeft de sleutels in de volgorde van de lijst.
 * Een prestatie die hier net gehaald is, telt meteen mee voor de volgende (zoals "Alle volken").
 */
export function newAchievements(facts: AchievementFacts, have: AchievedMap = {}): string[] {
  const got = { ...have };
  const earned: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.k] || !a.when(facts, got)) continue;
    got[a.k] = true;
    earned.push(a.k);
  }
  return earned;
}

/**
 * Gebouwen die je zelf kunt neerzetten, per tijdperk (zonder het stamhuis en paden).
 * Wereldwonderen tellen niet mee: een rivaal kan je er een afpakken.
 */
export const AGE_BUILDINGS: string[][] = [];
for (const [k, d] of Object.entries(B)) {
  if (d.nobuild || d.road || d.wonder) continue;
  (AGE_BUILDINGS[d.age] = AGE_BUILDINGS[d.age] || []).push(k);
}

/**
 * Het hoogste tijdperk waarvan alle gebouwen tegelijk staan, of -1 als dat er geen is.
 * `types` is een lijst (of Set) met de soorten gebouwen die nu klaar staan.
 */
export function fullAge(types: Iterable<string>): number {
  const have = new Set(types);
  for (let age = AGE_BUILDINGS.length - 1; age >= 0; age--) {
    const list = AGE_BUILDINGS[age] || [];
    if (list.length && list.every(k => have.has(k))) return age;
  }
  return -1;
}
