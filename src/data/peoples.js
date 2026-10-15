// De zes volken waaruit je kiest bij een nieuwe wereld, elk met eigen voordelen. Puur, zodat het te testen is.
import { RES } from './resources.js';

/*
 * Elk volk:
 * - k: vaste sleutel (wordt opgeslagen in G.people), n: naam
 * - c: kleur van de vlag, g: teken op de vlag (zie ui/glyphs.js)
 * - motto: een korte zin voor op de kaart
 * - d: wat het volk goed kan, in gewone taal en met dezelfde getallen als in `bonus`
 * - start: wat je extra krijgt bij het begin: grondstoffen (res) en dorpelingen (villagers)
 * - bonus: sleutels uit src/data/bonus.js; die gelden het hele spel
 * - unique: een eigen soldaat (unit) die bij dit volk een gewone soldaat (replaces) vervangt
 * - locked: nog op slot tot je prestatie `by` haalt; `text` zegt wat je daarvoor moet doen
 */
export const PEOPLES = [
  {
    k: 'friezen',
    n: 'Friezen',
    c: '#2f6aa8',
    g: '⚘',
    motto: 'Wij temmen het water.',
    d: [
      'Akkers oogsten 20% sneller',
      'Mildere winter: in de winter 45% meer voedsel dan anders',
      'Muren en poorten kosten 30% minder',
    ],
    start: { res: { food: 80 } },
    bonus: { farm: 0.2, 'winter.food': 0.45, 'wall.cost': -0.3 },
  },
  {
    k: 'norse',
    n: 'Noormannen',
    c: '#b23a2e',
    g: '⚔',
    motto: 'Over zee naar verre kusten.',
    d: [
      'Je leger doet 10% meer schade',
      'Veroverde kampen geven 50% meer buit',
      'Eigen soldaat vanaf de IJzertijd: de Berserker (slaat sneller, minder leven), in plaats van de zwaardvechter',
    ],
    start: { res: { wood: 80 } },
    bonus: { 'army.dmg': 0.1, loot: 0.5 },
    unique: { replaces: 'swordsman', unit: 'berserker' },
  },
  {
    k: 'hanze',
    n: 'Hanze',
    c: '#d6a12b',
    g: '⚖',
    motto: 'Handel maakt een stad rijk.',
    d: ['Op de markt 20% betere prijzen', 'Reizende handelaars komen 2 keer zo vaak'],
    start: { res: { food: 50, wood: 50 } },
    bonus: { market: 0.2, 'trader.rate': 1 },
  },
  {
    k: 'bergvolk',
    n: 'Bergvolk',
    c: '#5d6670',
    g: '⛏',
    motto: 'Wat de berg geeft, houden we.',
    d: ['Steen, ijzer en kolen winnen gaat 20% sneller', 'Torens hebben 20% meer levens'],
    start: { res: { stone: 80 } },
    bonus: { 'gather.rock': 0.2, 'tower.hp': 0.2 },
    locked: { by: 'age3', text: 'Bereik de Middeleeuwen' },
  },
  {
    k: 'sterrenkijkers',
    n: 'Sterrenkijkers',
    c: '#5b4bb0',
    g: '☄',
    motto: 'Ons antwoord staat in de sterren.',
    d: ['Onderzoek duurt 30% korter', 'Meteorieten met nieuwe ertsen vallen 25% vaker'],
    start: {},
    bonus: { 'research.time': -0.3, 'meteor.rate': 0.25 },
    locked: { by: 'age5', text: 'Bereik de Industriële tijd' },
  },
  {
    k: 'nomaden',
    n: 'Nomaden',
    c: '#5f8f3a',
    g: '⛺',
    motto: 'Ons thuis is waar we staan.',
    d: [
      'Nieuw gebied kost 30% minder',
      'Dorpelingen lopen 10% sneller',
      'Altijd 2 plekken extra om te wonen',
    ],
    start: { villagers: 2 },
    // De twee extra dorpelingen krijgen ook een plek om te wonen
    bonus: { 'chunk.cost': -0.3, 'vill.speed': 0.1, pop: 2 },
    locked: { by: 'camps3', text: 'Verover 3 vijandelijke kampen' },
  },
];

/** Volk opzoeken op sleutel: PEOPLE.norse */
export const PEOPLE = {};
PEOPLES.forEach(p => (PEOPLE[p.k] = p));

/** Met dit volk begin je als je niets kiest, en dit krijgen oude opslagen zonder volk. */
export const DEFAULT_PEOPLE = 'friezen';

/** De bonussen van een volk, als lijst (G.people bewaart alleen de sleutel). */
export const peopleBonuses = k => (PEOPLE[k] && PEOPLE[k].bonus ? [PEOPLE[k].bonus] : []);

/**
 * Mag je met dit volk spelen? `profile` is het spelersprofiel, zoals
 * { achievements: { age3: true } }: de prestaties die je ooit haalde.
 * Zonder profiel (of met een leeg profiel) kun je alleen de vrije volken kiezen.
 */
export function isPeopleUnlocked(k, profile = {}) {
  const people = PEOPLE[k];
  if (!people) return false;
  if (!people.locked) return true;
  const achievements = (profile && profile.achievements) || {};
  return !!achievements[people.locked.by];
}

/** Wat je nog moet doen om dit volk vrij te spelen, of '' als dat al gelukt is. */
export function lockText(k, profile) {
  if (isPeopleUnlocked(k, profile)) return '';
  return (PEOPLE[k] && PEOPLE[k].locked && PEOPLE[k].locked.text) || '';
}

/** Het startvoordeel in één regel, zoals 'Start: +80 voedsel', of '' als er geen is. */
export function startLine(k) {
  const start = (PEOPLE[k] && PEOPLE[k].start) || {};
  const parts = Object.entries(start.res || {}).map(([r, n]) => `+${n} ${RES[r].n.toLowerCase()}`);
  if (start.villagers) parts.push(`+${start.villagers} dorpelingen`);
  return parts.length ? 'Start: ' + parts.join(', ') : '';
}
