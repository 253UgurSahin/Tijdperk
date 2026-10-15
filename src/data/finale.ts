// De finale: een afgebouwde sterrenpoort moet eerst twee nachten opladen voordat je wint. Puur.

/** Zoveel hele nachten moet de poort opladen. */
export const CHARGE_NIGHTS = 2;
/** Tijdens het opladen zijn de nachtelijke aanvallen zoveel keer zo groot... */
export const FINALE_RAID_MUL = 2;
/** ...en komen ze uit zoveel richtingen tegelijk. */
export const FINALE_SIDES = 3;
// De nacht: om 21 uur begint de aanval, om 6 uur komt de zon op (zie game/time.ts)
const EVENING = 21;
const DAWN = 6;

/*
 * De finale in de spelstand (G.finale), of null zolang de poort nog nooit af was:
 * - hours: zoveel uur (op de klok) is de poort al aan het opladen
 * - need: zoveel uur moet hij in totaal; 0 = de poort staat er niet (verwoest), dus hij laadt niet op
 * - rivalsCalled: alle rivalen zijn al opgeroepen voor hun grote aanval
 * - done: helemaal opgeladen, de poort is open
 * - resets: zo vaak werd de poort verwoest tijdens het opladen
 */

/**
 * Hoeveel uur de poort moet opladen als hij af is om `clock` uur (0 tot 24):
 * tot de ochtend na twee hele nachten. Een nacht die al bezig is, telt niet mee.
 */
export function chargeHours(clock) {
  let toEvening = EVENING - clock;
  if (toEvening <= 0) toEvening += 24;
  // Tot de eerste avond, dan (CHARGE_NIGHTS - 1) hele dagen, en de laatste nacht tot de ochtend
  return toEvening + (CHARGE_NIGHTS - 1) * 24 + (24 - EVENING + DAWN);
}

/** Hoe vol de poort is, van 0 tot 1. */
export function chargeFrac(f) {
  if (!f) return 0;
  if (f.done) return 1;
  if (!(f.need > 0)) return 0; // verwoest: er laadt niets op
  return Math.min(1, f.hours / f.need);
}

/** De lading is weg (de poort is verwoest of staat er niet meer): het opladen begint opnieuw bij de bouw. */
export function resetCharge(f) {
  f.need = 0;
  f.hours = 0;
}

/** De lading als heel percentage. Pas 100 als hij echt vol is, zodat "100%" nooit blijft hangen. */
export const chargePercent = frac => (frac >= 1 ? 100 : Math.max(0, Math.min(99, Math.floor(frac * 100))));

/**
 * Hoeveel nachten je nog moet doorstaan. clock: het uur nu, hoursLeft: zoveel uur moet de poort nog opladen,
 * hoursDone: zoveel uur laadt hij al op. Een nacht die nu bezig is, telt alleen mee als het opladen al
 * vóór die nacht begon (zie chargeHours: een nacht die al bezig was, telt niet).
 */
export function nightsLeft(clock, hoursLeft, hoursDone = Infinity) {
  if (hoursLeft <= 0) return 0;
  const nightNow = clock >= EVENING || clock < DAWN;
  const sinceEvening = clock >= EVENING ? clock - EVENING : clock + 24 - EVENING;
  let nights = nightNow && hoursDone > sinceEvening ? 1 : 0;
  let nextEvening = EVENING - clock;
  if (nextEvening <= 0) nextEvening += 24;
  while (nextEvening < hoursLeft) {
    nights++;
    nextEvening += 24;
  }
  return nights;
}

/**
 * De teksten voor de balk bovenaan: { title, sub }. `rebuilding`: er staat al een nieuwe poort in de steigers.
 * `peaceful`: de vredige modus, dan komen er geen aanvallen en hoef je ook niet stand te houden.
 */
export function finaleText(f, clock, rebuilding = false, peaceful = false) {
  if (!f || f.done) return { title: 'De sterrenpoort is open', sub: '' };
  if (!(f.need > 0)) {
    const sub = rebuilding
      ? 'De nieuwe poort is in aanbouw'
      : 'Bouw hem opnieuw: dan begint het opladen weer';
    return { title: 'Sterrenpoort verwoest', sub };
  }
  const nights = nightsLeft(clock, f.need - f.hours, f.hours);
  return {
    title: `Sterrenpoort laadt op: ${chargePercent(chargeFrac(f))}%`,
    sub: nightsText(nights, peaceful),
  };
}

// Hoe lang het nog duurt, in nachten. Met aanvallen moet je standhouden; in de vredige modus wacht je alleen.
function nightsText(nights, peaceful) {
  if (nights > 1)
    return peaceful
      ? `Open over ${nights} nachten, bij zonsopgang`
      : `Houd nog ${nights} nachten stand · open bij zonsopgang`;
  if (nights === 1)
    return peaceful ? 'Open bij de volgende zonsopgang' : 'Nog 1 nacht: houd stand tot zonsopgang';
  return 'De zon komt bijna op';
}

/** De finale netjes voor de opslag. Opslag van daarvóór (of rommel) geeft null: de poort was nog nooit af. */
export function cleanFinale(o) {
  if (!o || typeof o !== 'object') return null;
  const num = v => (Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    hours: num(o.hours),
    need: num(o.need),
    rivalsCalled: !!o.rivalsCalled,
    done: !!o.done,
    resets: Math.round(num(o.resets)),
  };
}

/**
 * Waar een aanval vandaan komt: `sides` plekken uit `points` (lijst van [x, y]) die ver uit elkaar liggen.
 * De eerste is points[first]; elke volgende is de plek die het verst van de al gekozen plekken ligt.
 */
export function spreadOut(points, sides, first = 0) {
  if (!points.length) return [];
  const picks = [points[Math.min(first, points.length - 1)]];
  while (picks.length < sides) {
    let best = null,
      bestDist = 0;
    for (const p of points) {
      const nearest = Math.min(...picks.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])));
      if (nearest > bestDist) {
        bestDist = nearest;
        best = p;
      }
    }
    if (!best) break; // alle plekken liggen op dezelfde plek
    picks.push(best);
  }
  return picks;
}
