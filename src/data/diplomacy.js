// Diplomatie met rivalen: relaties, kansen en wat elke actie kost of oplevert. Puur, zodat het te testen is.
import { RES } from './resources.js';

/** Een relatie loopt van −100 (vijandig) tot 100 (beste vrienden). */
export const REL_MIN = -100;
export const REL_MAX = 100;

/** Waar de relatie begint, per karakter (zie PERSONALITIES in data/rivals.js), op Normaal. */
export const START_REL = { handelaar: 20, bouwer: 0, krijger: -30 };
/** Op Zwaar begint (en blijft) elke relatie zoveel lager, op Meedogenloos twee keer zoveel. */
export const DIFF_REL_STEP = 15;

/**
 * Waar de relatie begint, met de moeilijkheid erbij (G.diff: 0 Vredig, 1 Normaal, 2 Zwaar, 3 Meedogenloos).
 * Op de zware standen zijn rivalen minder vriendelijk, zodat ze ook vaker aanvallen.
 */
export function startRel(personality, diff = 1) {
  const steps = Number.isInteger(diff) ? Math.max(0, diff - 1) : 0;
  return (START_REL[personality] ?? 0) - steps * DIFF_REL_STEP;
}

/** Zoveel relatie is nodig voor een handelsverdrag en voor een bondgenootschap. */
export const TRADE_MIN = 20;
export const ALLY_MIN = 60;
/** Zakt de relatie hieronder, dan stopt het verdrag of het bondgenootschap vanzelf. */
export const TRADE_KEEP = 0;
export const ALLY_KEEP = 30;
/** Zakt de relatie tot hier, dan verklaart de rivaal jou de oorlog. */
export const WAR_AT = -70;
/** Schatting eisen kan pas als je minstens zoveel keer zo sterk bent. */
export const TRIBUTE_RATIO = 1.5;
/** Vielen ze je in de laatste zoveel dagen aan, dan is terugslaan geen verraad. */
export const RETALIATE_DAYS = 3;
/** Zoveel dagen moet je wachten na een mislukte poging (per actie). */
export const RETRY_DAYS = { trade: 1, ally: 2, tribute: 3, peace: 1 };

/** Zoveel verandert een relatie door wat er in de wereld gebeurt. */
export const REL = {
  attacked: -30, // je valt hen aan zonder oorlogsverklaring
  attackedAtWar: -3, // je valt hen aan terwijl het oorlog is
  othersBetrayed: -10, // de andere rivalen, als je iemand zonder oorlogsverklaring aanvalt
  camp: 5, // je verovert een vijandelijk kamp: een gezamenlijke vijand minder
  boss: 8, // je verslaat een kampioen
  conquered: -10, // je verslaat een andere rivaal: ze worden bang (een Krijger juist niet, zie conquestEffect)
  declareWar: -40,
  tradeFail: -5,
  allyFail: -5,
  tributeOk: -10,
  tributeFail: -20,
  cancelTrade: -5,
  cancelAlly: -15,
};

// ---- Hoe ze over je denken ----

/*
 * De stand van een relatie in één woord. `from` is de laagste relatie voor dat woord.
 * Bondgenoot en In oorlog zijn geen getal maar een toestand (zie relationLevel).
 */
export const LEVELS = [
  { k: 'vijandig', n: 'Vijandig', from: REL_MIN },
  { k: 'koel', n: 'Koel', from: -50 },
  { k: 'neutraal', n: 'Neutraal', from: -15 },
  { k: 'vriendelijk', n: 'Vriendelijk', from: TRADE_MIN },
];
export const ALLY_LEVEL = { k: 'bondgenoot', n: 'Bondgenoot', from: ALLY_MIN };
export const WAR_LEVEL = { k: 'oorlog', n: 'In oorlog', from: REL_MIN };

/** De stand van een relatie: { k, n }. In oorlog altijd In oorlog, met een bondgenootschap altijd Bondgenoot. */
export function relationLevel(rel, ally = false, war = false) {
  if (war) return WAR_LEVEL;
  if (ally) return ALLY_LEVEL;
  const value = Math.round(rel);
  let level = LEVELS[0];
  for (const l of LEVELS) if (value >= l.from) level = l;
  return level;
}
/** De stand van een relatie als woord: Vijandig, Koel, Neutraal, Vriendelijk, Bondgenoot of In oorlog. */
export const relationLabel = (rel, ally = false, war = false) => relationLevel(rel, ally, war).n;

/** Een relatie binnen de grenzen (−100 tot 100). Wat geen getal is, wordt 0. */
export const clampRel = n => (Number.isFinite(n) ? Math.max(REL_MIN, Math.min(REL_MAX, n)) : 0);

/** Een relatie als tekst met teken: "+24", "−8", "0". */
export const relText = n => {
  const v = Math.round(n);
  if (v > 0) return `+${v}`;
  return v < 0 ? `−${-v}` : '0';
};

// ---- Aanvallen ----

// Hoeveel keer langer een rivaal wacht tussen twee aanvallen, per stand. In oorlog: gewoon (keer 1).
const ATTACK_WAIT = { vijandig: 1, koel: 1.5, neutraal: 2, vriendelijk: 3 };

/** Hoeveel keer langer dan normaal een rivaal wacht met aanvallen. Een bondgenoot valt nooit aan (Infinity). */
export function attackWait({ rel, ally = false, war = false }) {
  if (ally) return Infinity;
  if (war) return 1;
  return ATTACK_WAIT[relationLevel(rel).k];
}

/**
 * Op welke dag een rivaal op zijn vroegst weer aanvalt. `first` en `every` komen van zijn karakter,
 * `attacks` is hoe vaak hij al aanviel en `lastAttack` de dag van zijn laatste aanval
 * (of van de vrede of de betaalde eis: ook dan wacht hij weer een hele tijd).
 * Nooit vóór dag 4. Een bondgenoot: Infinity.
 */
export function nextAttackDay({ first, every, attacks, lastAttack, rel, ally = false, war = false }) {
  const wait = attackWait({ rel, ally, war });
  if (wait === Infinity) return Infinity;
  const firstDay = Math.max(4, Math.round(first * wait));
  const again = lastAttack ? lastAttack + Math.max(1, Math.round(every * wait)) : 0;
  // Nog nooit aangevallen: de eerste aanval, maar niet vlak na een vrede of een betaalde eis
  if (!attacks) return Math.max(firstDay, again);
  return Math.max(4, again);
}

// ---- Waarde van grondstoffen ----

/** Wat één stuk van een grondstof waard is: die van latere tijdperken tellen zwaarder (net als costValue). */
export const resValue = k => 1 + (RES[k] ? RES[k].age : 0) * 0.5;

/** Hoeveel stuks van grondstof `k` samen `value` waard zijn (naar boven afgerond). */
export const amountFor = (value, k) => Math.ceil(value / resValue(k));

/** Je grootste voorraad (in waarde) uit `keys`, of null als je van niets iets hebt. */
export function surplusRes(res, keys) {
  let best = null,
    most = 0;
  for (const k of keys) {
    const worth = (res[k] || 0) * resValue(k);
    if (worth > most) {
      most = worth;
      best = k;
    }
  }
  return best;
}

/** Je kleinste voorraad (in waarde) uit `keys`, maar niet `not`. */
export function scarceRes(res, keys, not = null) {
  let best = null,
    least = Infinity;
  for (const k of keys) {
    if (k === not) continue;
    const worth = (res[k] || 0) * resValue(k);
    if (worth < least) {
      least = worth;
      best = k;
    }
  }
  return best;
}

// ---- Geschenk ----

// Hoeveel relatie een geschenk oplevert, per karakter: een Krijger is minder snel onder de indruk
const GIFT_REL = { handelaar: 15, bouwer: 12, krijger: 8 };

/** Wat een geschenk waard is (in waarde): groeit met je tijdperk. */
export const giftValue = age => 100 + age * 60;

/**
 * Hoeveel relatie een geschenk oplevert. `recent` is hoeveel geschenken je de laatste dag al gaf:
 * elk volgend geschenk doet 40% minder (en altijd minstens 2).
 */
export function giftEffect(personality, recent = 0) {
  const base = GIFT_REL[personality] || 10;
  return Math.max(2, Math.round(base * 0.6 ** Math.max(0, Math.ceil(recent))));
}

/** Het geschenk zelf: `giftValue` in de grondstof waar je het meeste van hebt. Null als je niets hebt. */
export function giftCost(res, keys, age) {
  const k = surplusRes(res, keys);
  return k ? { [k]: amountFor(giftValue(age), k) } : null;
}

// ---- Handelsverdrag ----

/** Elke zoveel seconden speltijd wordt er geruild (een minuut). */
export const TRADE_EVERY = 60;
/** Wat je per ruil geeft (in waarde): groeit met je tijdperk. */
export const tradeValue = age => 30 + age * 20;
/** Je krijgt 80% van de waarde terug: zij verdienen er ook aan. */
export const TRADE_RATE = 0.8;
/** Een verdrag ruilt alleen als je daarna nog minstens zoveel ruilen overhoudt: je laatste voorraad houd je zelf. */
export const TRADE_RESERVE = 2;

/** Moet de handel even wachten? Ja als je na deze ruil minder dan TRADE_RESERVE ruilen overhoudt. */
export const tradeWaits = (res, trade) =>
  (res[trade.give] || 0) - trade.giveAmt < trade.giveAmt * TRADE_RESERVE;

/**
 * Een handelsverdrag: elke minuut geef je `giveAmt` van je grootste voorraad (`give`) en krijg je
 * `getAmt` van je kleinste (`get`). Null als er niets te ruilen valt.
 */
export function tradeDeal(res, keys, age) {
  const give = surplusRes(res, keys);
  const get = give && scarceRes(res, keys, give);
  if (!give || !get) return null;
  const giveAmt = amountFor(tradeValue(age), give);
  const getAmt = Math.max(1, Math.floor((giveAmt * resValue(give) * TRADE_RATE) / resValue(get)));
  return { give, giveAmt, get, getAmt };
}

// ---- Kansen (in procenten, van 0 tot 100) ----

const pct = n => Math.max(0, Math.min(100, Math.round(n)));

// Hoe graag elk karakter handelt, een verbond sluit of schatting betaalt
const TRADE_TASTE = { handelaar: 25, bouwer: 5, krijger: -15 };
const ALLY_TASTE = { handelaar: 1, bouwer: 1, krijger: 0.35 }; // een Krijger sluit zelden een verbond
const TRIBUTE_TASTE = { handelaar: 10, bouwer: 0, krijger: -20 };

/** Kans dat een rivaal een handelsverdrag sluit. Pas vanaf relatie 20, en nooit in oorlog. */
export function tradeChance({ rel, personality, war = false }) {
  if (war || rel < TRADE_MIN) return 0;
  return pct(50 + (rel - TRADE_MIN) * 1.5 + (TRADE_TASTE[personality] || 0));
}

/** Kans op een bondgenootschap. Pas vanaf relatie 60; een handelsverdrag helpt. */
export function allyChance({ rel, personality, war = false, trade = false }) {
  if (war || rel < ALLY_MIN) return 0;
  const base = 35 + (rel - ALLY_MIN) * 2 + (trade ? 15 : 0);
  return pct(base * (ALLY_TASTE[personality] ?? 1));
}

/** Hoeveel keer zo sterk jij bent als zij (leger en torens, zie armyPower in data/rivals.js). */
export const powerRatio = (yours, theirs) => (yours + 20) / (theirs + 20);

/** Kans dat ze schatting betalen. Alleen als je minstens anderhalf keer zo sterk bent; hoogstens 95%. */
export function tributeChance({ ratio, personality }) {
  if (!(ratio >= TRIBUTE_RATIO)) return 0;
  return pct(Math.min(95, 15 + (ratio - TRIBUTE_RATIO) * 60 + (TRIBUTE_TASTE[personality] || 0)));
}

/** Kans op vrede. Pas na een dag oorlog; beter als de oorlog lang duurt, als jij sterker bent of na geschenken. */
export function peaceChance({ ratio, warDays, personality, rel }) {
  if (warDays < 1) return 0;
  const strength = (Math.min(ratio, 3) - 1) * 30;
  const mood = (rel - REL_MIN) / 5;
  const stubborn = personality === 'krijger' ? -15 : 0;
  return pct(Math.min(95, 20 + warDays * 8 + strength + mood + stubborn));
}

/** Wat een rivaal betaalt als hij schatting betaalt (zijn tijdperk telt). */
export function tributeFor(age) {
  const tribute = { food: 120 + age * 60, wood: 90 + age * 40 };
  if (age < 3) tribute.stone = 60 + age * 30;
  else tribute.gold = 20 + age * 8;
  return tribute;
}

// ---- Vanzelf: relaties schuiven terug ----

/** Zoveel punten per dag schuift een relatie naar haar rustpunt. */
export const DRIFT_PER_DAY = 4;

/**
 * Waar een relatie vanzelf naartoe schuift: het begin van zijn karakter, hoger met een verdrag of verbond.
 * Een verdrag of verbond blijft vanzelf altijd ruim boven de grens waaronder het stopt (ook bij een Krijger).
 * In oorlog zakt hij naar −80.
 */
export function restingRel({ personality, diff = 1, trade = false, ally = false, war = false }) {
  if (war) return -80;
  let rest = startRel(personality, diff) + (trade ? 10 : 0) + (ally ? 30 : 0);
  if (trade) rest = Math.max(rest, TRADE_KEEP + 10);
  if (ally) rest = Math.max(rest, ALLY_KEEP + 15);
  return rest;
}

/** Een relatie na `days` dagen, een stukje dichter bij `rest` (nooit voorbij). */
export function drift(rel, rest, days) {
  const step = DRIFT_PER_DAY * days;
  return rel < rest ? Math.min(rest, rel + step) : Math.max(rest, rel - step);
}

/** Wat het verslaan van een andere rivaal doet: een Krijger heeft daar respect voor, de rest wordt bang. */
export const conquestEffect = personality => (personality === 'krijger' ? 5 : REL.conquered);

// ---- Berichten van rivalen ----

/*
 * Wat een rivaal je kan sturen, met een gewicht (2 = twee keer zo vaak als 1).
 * - trade: eenmalige ruil · ask: vraagt om hulp · ally: stelt een bondgenootschap voor
 * - demand: eist iets (anders valt hij snel aan) · peace: wil vrede (alleen in oorlog)
 * `ratio` is hoeveel keer zo sterk jij bent.
 */
export function offerKinds({ rel, personality, ally = false, war = false, warDays = 0, ratio = 1 }) {
  if (war) return warDays >= 3 && ratio >= 1.2 ? [['peace', 1]] : [];
  const kinds = [];
  if (rel >= -15) kinds.push(['trade', personality === 'handelaar' ? 4 : 2]);
  if (rel >= -15) kinds.push(['ask', 1]);
  if (rel >= ALLY_MIN && !ally && personality !== 'krijger') kinds.push(['ally', 2]);
  if (rel < 0 && ratio < 0.9) kinds.push(['demand', personality === 'krijger' ? 3 : 1]);
  return kinds;
}

/** Wat een eenmalige ruil van een rivaal je oplevert (in waarde). Vrienden geven je een betere prijs. */
export const offerValue = age => 150 + age * 80;
export const offerPriceMul = rel => (rel >= TRADE_MIN ? 1 : 1.25);

/**
 * Een eenmalige ruil: zij geven `amt` van je kleinste voorraad (`want`) voor `price` van je grootste (`give`).
 * Zelfde vorm als de reizende handelaar (G.offer). Null als er niets te ruilen valt.
 */
export function rivalTrade(res, keys, age, rel) {
  const give = surplusRes(res, keys);
  const want = give && scarceRes(res, keys, give);
  if (!give || !want) return null;
  const amt = amountFor(offerValue(age), want);
  const price = Math.round((amt * resValue(want) * offerPriceMul(rel)) / resValue(give));
  return { want, amt, give, price };
}

/** Zo lang (seconden speltijd) staat een bericht van een rivaal open. */
export const OFFER_TIME = 90;

/** Hoeveel relatie een antwoord op een bericht oplevert (ja) of kost (nee). */
export const OFFER_REL = {
  trade: { yes: 3, no: 0 },
  ask: { yes: 12, no: -3 },
  ally: { yes: 0, no: -5 },
  demand: { yes: 5, no: -10 },
  peace: { yes: 0, no: 0 },
};

/** Waarom een rivaal om hulp vraagt (een willekeurige reden bij het bericht). */
export const ASK_REASONS = [
  'hun oogst is mislukt',
  'een brand heeft hun opslag verwoest',
  'de winter was streng',
  'hun koning geeft een groot feest',
];

// ---- Hulp van bondgenoten ----

/** Kans (in procenten) dat een bondgenoot soldaten stuurt als je wordt aangevallen. Een Krijger helpt het vaakst. */
export const HELP_CHANCE = { krijger: 85, bouwer: 60, handelaar: 50 };
/** Zoveel soldaten stuurt een bondgenoot: meer in latere tijdperken (2 tot 6). */
export const helperCount = age => 2 + Math.floor(age / 2);

/** De start-gegevens van de diplomatie met een nieuwe rivaal van dit karakter (op moeilijkheid `diff`). */
export function diplomacyStart(personality, diff = 1) {
  return {
    rel: startRel(personality, diff), // relatie, van −100 tot 100
    trade: null, // handelsverdrag: { give, giveAmt, get, getAmt }, of null
    tradeT: 0, // seconden sinds de laatste ruil
    ally: false, // bondgenootschap
    atWar: false, // oorlog (verklaard door jou of door hen)
    warDay: 0, // dag waarop de oorlog begon
    lastAttack: 0, // dag van hun laatste aanval op jou (of van de vrede of een betaalde eis)
    raidDay: 0, // dag waarop ze je echt voor het laatst aanvielen (terugslaan is dan geen verraad)
    threatDay: 0, // je weigerde hun eis: op deze dag vallen ze aan (0 = niet)
    spareUntil: 0, // je betaalde hun eis: tot deze dag vallen ze niet aan (0 = niet)
    retry: {}, // per actie de dag vanaf wanneer je het opnieuw mag vragen
    gifts: 0, // geschenken van de laatste tijd (zakt 1 per dag)
    helpDay: 0, // dag waarop ze je voor het laatst hulp stuurden
    offerDay: 2 + Math.round(Math.random() * 2), // dag van hun volgende bericht
  };
}

/**
 * Diplomatie uit de opslag, netjes gemaakt. Opslag van vóór de diplomatie heeft niets: dan de start
 * van dit karakter. `every` is hoeveel dagen hij tussen aanvallen wacht (voor de dag van de laatste aanval).
 */
export function cleanDiplomacy(o, personality, every, diff = 1) {
  const start = diplomacyStart(personality, diff);
  const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
  const trade = o.trade;
  const tradeOk =
    trade && RES[trade.give] && RES[trade.get] && trade.giveAmt > 0 && trade.getAmt > 0 ? trade : null;
  // Oude opslag onthield de dag van de volgende aanval: de laatste aanval was `every` dagen daarvoor
  const lastAttack = Number.isFinite(o.lastAttack)
    ? o.lastAttack
    : o.attacks > 0 && Number.isFinite(o.nextAttack)
      ? o.nextAttack - every
      : 0;
  return {
    rel: Number.isFinite(o.rel) ? clampRel(o.rel) : start.rel,
    trade: tradeOk
      ? { give: trade.give, giveAmt: trade.giveAmt, get: trade.get, getAmt: trade.getAmt }
      : null,
    tradeT: num(o.tradeT, 0),
    ally: !!o.ally && !o.atWar,
    atWar: !!o.atWar,
    warDay: num(o.warDay, 0),
    lastAttack,
    raidDay: num(o.raidDay, lastAttack),
    threatDay: num(o.threatDay, 0),
    spareUntil: num(o.spareUntil, 0),
    retry: o.retry && typeof o.retry === 'object' ? { ...o.retry } : {},
    gifts: num(o.gifts, 0),
    helpDay: num(o.helpDay, 0),
    offerDay: num(o.offerDay, start.offerDay),
  };
}
