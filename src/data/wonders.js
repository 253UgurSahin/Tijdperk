// Wereldwonderen: welke er zijn, wat ze geven en hoe het ervoor staat. Puur, zodat het te testen is.
import { B, BKEYS } from './buildings.js';
import { RIVAL, verb } from './rivals.js';

/*
 * De wonderen zelf staan in data/buildings.js (met wonder: true). Hier staat wat erbij hoort.
 * In de spelstand bewaart G.wonders wie welk wonder heeft: { pyramid: { by: 'you', day: 12 } }.
 * `by` is 'you' (jij) of de sleutel van een rivaal (zoals 'wolven'). Wat er niet in staat, is nog vrij.
 */

/** Alle wonderen, van oud naar nieuw: één per tijdperk. */
export const WONDERS = BKEYS.filter(k => B[k].wonder).sort((a, b) => B[a].age - B[b].age);

/*
 * Bouwtijd. De bouwtijd van een wonder (bt, 120 tot 180 seconden) geldt voor een gewone ploeg van 3 bouwers.
 * Meer bouwers helpen, maar steeds minder: samen werken ze √(bouwers / 3) keer zo snel.
 * Met 1 bouwer duurt het Hunebed zo 208 seconden, met 3 bouwers 120 en met 8 bouwers 73.
 */
export const WONDER_CREW = 3;

/** Hoeveel bouwseconden één bouwer per seconde aan een wonder doet, als er `builders` bouwers aan werken. */
export const wonderBuildRate = builders => 1 / Math.sqrt(WONDER_CREW * Math.max(1, builders));

/** Hoe lang een wonder duurt met zoveel bouwers, in seconden (zonder bouwbonussen). */
export const wonderBuildTime = (k, builders = WONDER_CREW) =>
  Math.round(B[k].bt * Math.sqrt(WONDER_CREW / Math.max(1, builders)));

/** Een rivaal doet er anderhalf keer zo lang over als jij met een gewone ploeg: zo heb je tijd om te reageren. */
export const RIVAL_BUILD_FACTOR = 1.5;
export const rivalWonderTime = k => Math.round(B[k].bt * RIVAL_BUILD_FACTOR);

/*
 * Een rivaal begint pas op deze dag te sparen voor een wonder: dag 10 voor het Hunebed, dan 3 dagen later per tijdperk.
 * Zo heb jij in het begin de tijd om zelf je eerste wonder te halen.
 */
export const wonderStartDay = k => 10 + 3 * B[k].age;

/** Vanaf dit deel van de prijs zie je dat een rivaal voor een wonder spaart. */
export const SAVING_SHOWN = 0.5;

/** "het Hunebed", "de Piramide": de naam met het goede lidwoord. */
export const theWonder = k => `${B[k].article} ${B[k].n}`;

/** Hetzelfde, maar met een hoofdletter vooraan: "Het Hunebed". */
export const TheWonder = k => {
  const text = theWonder(k);
  return text[0].toUpperCase() + text.slice(1);
};

/** Het werkwoord dat bij het wonder past: "is" of (bij de Deltawerken) "zijn". */
export const wonderVerb = (k, one, many) => (B[k].plural ? many : one);

/** "het" of (bij de Deltawerken) "ze": voor zinnen als "Bouw het zelf eerst". */
export const wonderIt = k => wonderVerb(k, 'het', 'ze');

/** Hoe je een wonder van een rivaal terugkrijgt, in één zin. */
export const winBackText = (k, by) =>
  `Verwoest ${wonderIt(k)}, of versla ${rivalName(by)}: dan ${wonderVerb(k, 'is', 'zijn')} ${wonderIt(k)} weer te krijgen.`;

/** De sleutels van de wonderen die van jou zijn. */
export const ownWonders = wonders => WONDERS.filter(k => wonders && wonders[k] && wonders[k].by === 'you');

/** De bonussen van al jouw wonderen, voor het bonusregister (zie game/bonus.js). */
export const wonderBonuses = wonders => ownWonders(wonders).map(k => B[k].bonus);

/**
 * Wonderen uit de opslag netjes gemaakt: alleen bestaande wonderen, met een eigenaar en een dag.
 * Opslag van vóór de wonderen (of kapotte gegevens) geeft een lege lijst.
 */
export function cleanWonders(saved) {
  const out = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const k of WONDERS) {
    const w = saved[k];
    if (!w || typeof w.by !== 'string' || !w.by) continue;
    out[k] = { by: w.by, day: Number.isInteger(w.day) && w.day > 0 ? w.day : 1 };
  }
  return out;
}

/**
 * Welk wonder een rivaal (Bouwer) hierna wil bouwen: het oudste dat nog vrij is en bij zijn tijdperk past.
 * `taken` is een Set met wonderen die al een eigenaar hebben of die een andere rivaal al bouwt.
 */
export function nextFreeWonder(age, taken) {
  return WONDERS.find(k => B[k].age <= age && !taken.has(k)) || null;
}

/**
 * Hoe het ervoor staat met een wonder, in woorden voor spelers.
 * - owner: 'you', de sleutel van een rivaal, of null (nog vrij)
 * - sites: wie er nu aan bouwt: [{ by: 'you' of rivaalsleutel, frac: 0 tot 1 }]
 * - saving: rivalen die ervoor sparen: [{ by: rivaalsleutel, frac: 0 tot 1 }]
 * Geeft { text, short, tone, rival }. text is een hele regel, short past op een bouwtegel.
 * tone: 'good' (van jou), 'bad' (bezet), 'warn' (een rivaal bouwt of spaart ervoor) of '' (vrij, of alleen jij bouwt).
 * rival: de rivaal waar het over gaat (voor zijn vaandel op de tegel), of null.
 */
export function wonderStatusText(owner, sites = [], saving = []) {
  if (owner === 'you') return { text: 'Van jou', short: 'van jou', tone: 'good', rival: null };
  if (owner)
    return { text: `Al gebouwd door ${rivalName(owner)}`, short: 'bezet', tone: 'bad', rival: owner };
  const mine = sites.find(s => s.by === 'you');
  // De rivaal die het verst is, telt
  const theirs = farthest(sites.filter(s => s.by !== 'you'));
  if (theirs && mine)
    return {
      text: `Race: ${rivalName(theirs.by)} ${pct(theirs.frac)}, jij ${pct(mine.frac)}`,
      short: pct(theirs.frac),
      tone: 'warn',
      rival: theirs.by,
    };
  if (theirs)
    return {
      text: `Wordt gebouwd door ${rivalName(theirs.by)} (${pct(theirs.frac)})`,
      short: pct(theirs.frac),
      tone: 'warn',
      rival: theirs.by,
    };
  // Spaart een rivaal ervoor? Dan zie je dat al voordat hij begint
  const saver = farthest(saving);
  const saves = saver ? `${rivalName(saver.by)} ${savesVerb(saver.by)} ervoor: ${pct(saver.frac)}` : '';
  if (mine)
    return {
      text: `Jij bouwt eraan: ${pct(mine.frac)}${saver ? `. ${saves}` : ''}`,
      short: `jij ${pct(mine.frac)}`,
      tone: saver ? 'warn' : '',
      rival: null,
    };
  if (saver) return { text: `Nog vrij, maar ${saves}`, short: 'spaart', tone: 'warn', rival: saver.by };
  return { text: 'Nog vrij', short: '', tone: '', rival: null };
}
const pct = frac => `${Math.floor(Math.min(1, Math.max(0, frac)) * 100)}%`;
const farthest = list => list.slice().sort((a, b) => b.frac - a.frac)[0];
const savesVerb = k => (RIVAL[k] ? verb(RIVAL[k], 'spaart', 'sparen') : 'spaart');
const rivalName = k => (RIVAL[k] ? RIVAL[k].n : 'een rivaal');
