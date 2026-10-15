// Legerregels zonder spelstand: rangen van veteranen, de rol van elke soldaat en plekken in een formatie.

// Na zoveel verslagen vijanden stijgt een soldaat een rang (rang 1, 2 en 3)
export const RANK_AT = [3, 8, 15];
// Namen van de rangen; rang 0 is een gewone soldaat
export const RANK_NAMES = ['Rekruut', 'Veteraan', 'Elite', 'Held'];
// Elke rang geeft zoveel extra schade en levens
export const RANK_BONUS = 0.1;

/** De rang bij dit aantal overwinningen: 0 (nieuw) tot 3 (held). */
export function rankFromKills(kills) {
  // Gewoon tellen (zonder nieuwe lijst): dit gebeurt elk beeld voor elke soldaat
  let rank = 0;
  for (const need of RANK_AT) if (kills >= need) rank++;
  return rank;
}

/** Vermenigvuldiger voor schade en levens bij deze rang: rang 2 geeft 1,2. */
export const rankMul = rank => 1 + RANK_BONUS * rank;

/** Naam van een rang, zoals "Veteraan". */
export const rankName = rank => RANK_NAMES[rank] || RANK_NAMES[0];

/** Hoeveel overwinningen er nog nodig zijn voor de volgende rang, of null als hij al held is. */
export function killsToNextRank(kills) {
  const next = RANK_AT.find(need => kills < need);
  return next == null ? null : next - kills;
}

/** De soldaat met de meeste overwinningen (minstens één rang), of null als er geen veteraan is. */
export function bestVeteran(units) {
  let best = null;
  for (const u of units) {
    const kills = u.kills || 0;
    if (rankFromKills(kills) > 0 && (!best || kills > best.kills)) best = u;
  }
  return best;
}

// De drie rollen in een formatie, van voor naar achter
export const ROLE_ORDER = ['front', 'ranged', 'siege'];
// Korte namen voor de speler: [één, meer]
export const ROLE_NAMES = {
  front: ['voorhoede', 'voorhoede'],
  ranged: ['schutter', 'schutters'],
  siege: ['geschut', 'geschut'],
};

/** Naam van een rol bij n soldaten: "1 schutter", "3 schutters". */
export const roleWord = (role, n) => ROLE_NAMES[role][n === 1 ? 0 : 1];

/**
 * De rol van een soldaat in een formatie. Wie van dichtbij vecht (of zwaar gepantserd is, zoals een tank)
 * gaat voorop, geschut met ontploffingen achteraan, en alle andere schutters daartussen.
 */
export function unitRole(unit) {
  if (unit.r <= 1.5 || unit.big) return 'front';
  if (unit.splash) return 'siege';
  return 'ranged';
}

// Afstand tussen twee plekken in een formatie, in tegels
export const FORMATION_GAP = 0.9;

/** Hoeveel soldaten naast elkaar in een rij staan: niet te breed en niet te diep. */
export const rowWidth = n => Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 2))));

/**
 * De plekken in een formatie, per rol. `roles` is de rol van elke soldaat.
 * Een plek is { side, back }: side = opzij (0 is het midden), back = hoe ver naar achteren.
 * De voorhoede staat vooraan, dan de schutters, het geschut achteraan. Elke rol begint een eigen rij.
 * Het midden van de hele formatie ligt op back = 0.
 */
export function formationSlots(roles, gap = FORMATION_GAP) {
  const width = rowWidth(roles.length),
    slots = { front: [], ranged: [], siege: [] };
  let row = 0;
  for (const role of ROLE_ORDER) {
    const count = roles.filter(r => r === role).length;
    for (let first = 0; first < count; first += width) {
      const inRow = Math.min(width, count - first);
      for (let c = 0; c < inRow; c++)
        slots[role].push({ side: (c - (inRow - 1) / 2) * gap, back: row * gap });
      row++;
    }
  }
  // Schuif alles op, zodat het midden van de formatie op het doel komt te liggen
  const all = ROLE_ORDER.flatMap(role => slots[role]),
    middle = all.reduce((sum, s) => sum + s.back, 0) / (all.length || 1);
  for (const s of all) s.back -= middle;
  return slots;
}

/**
 * Waar elke soldaat heen loopt bij een opdracht in formatie. `units` is een lijst { x, y, role },
 * (tx, ty) het doel. De voorkant kijkt in de looprichting: van het midden van de groep naar het doel.
 * Geeft een lijst { x, y }, in dezelfde volgorde als `units`.
 */
export function formationGoals(units, tx, ty, gap = FORMATION_GAP) {
  if (!units.length) return [];
  const cx = units.reduce((sum, u) => sum + u.x, 0) / units.length,
    cy = units.reduce((sum, u) => sum + u.y, 0) / units.length;
  // Looprichting (vooruit) en de richting opzij. Staat de groep al op het doel, dan kijkt hij naar boven.
  let fx = tx - cx,
    fy = ty - cy;
  const len = Math.hypot(fx, fy);
  if (len < 0.5) {
    fx = 0;
    fy = -1;
  } else {
    fx /= len;
    fy /= len;
  }
  const sx = -fy,
    sy = fx;
  const forward = u => u.x * fx + u.y * fy,
    sideways = u => u.x * sx + u.y * sy;
  const slots = formationSlots(
      units.map(u => u.role),
      gap,
    ),
    goals = new Array(units.length);
  for (const role of ROLE_ORDER) {
    // Wie het verst vooruit staat, krijgt een plek in de voorste rij van zijn rol.
    // Binnen een rij krijgt wie links loopt ook een plek links: zo lopen ze elkaar niet voor de voeten.
    const mine = units.map((u, i) => ({ u, i })).filter(o => o.u.role === role);
    mine.sort((a, b) => forward(b.u) - forward(a.u));
    const rows = [];
    for (const s of slots[role]) {
      if (!rows.length || rows[rows.length - 1][0].back !== s.back) rows.push([]);
      rows[rows.length - 1].push(s);
    }
    let next = 0;
    for (const rowSlots of rows) {
      const group = mine.slice(next, next + rowSlots.length).sort((a, b) => sideways(a.u) - sideways(b.u));
      next += rowSlots.length;
      group.forEach((o, k) => {
        const s = rowSlots[k];
        goals[o.i] = { x: tx + sx * s.side - fx * s.back, y: ty + sy * s.side - fy * s.back };
      });
    }
  }
  return goals;
}

// Staat iemand verder dan dit (in tegels) van het midden van de groep, dan lopen ze niet samen op
export const TOGETHER_RANGE = 6;

/** Staan deze soldaten bij elkaar: allemaal binnen 6 tegels van het midden? `units` is een lijst { x, y }. */
export function closeTogether(units, range = TOGETHER_RANGE) {
  if (units.length < 2) return false;
  const cx = units.reduce((sum, u) => sum + u.x, 0) / units.length,
    cy = units.reduce((sum, u) => sum + u.y, 0) / units.length;
  return units.every(u => Math.hypot(u.x - cx, u.y - cy) <= range);
}

/**
 * Het looptempo van elke soldaat, zodat ze tegelijk aankomen. `units` is een lijst { dist, spd }:
 * hoe ver hij moet lopen en hoe snel hij kan. Wie verder moet, loopt sneller (nooit sneller dan hij kan),
 * zo haalt de voorhoede het geschut in. Niemand loopt trager dan de helft van de traagste,
 * want een omweg om een muur is langer dan de rechte lijn. Tempo 0 betekent: op volle snelheid.
 */
export function arrivalPaces(units) {
  // Hoe lang de laatste erover doet: zoveel tijd krijgt iedereen
  const time = Math.max(0, ...units.map(u => u.dist / u.spd));
  if (!time) return units.map(() => 0);
  const slowest = Math.min(...units.map(u => u.spd));
  return units.map(u => Math.min(u.spd, Math.max(u.dist / time, slowest / 2)));
}

// Groepen 1 tot en met 5 (sneltoetsen F1 tot F5)
export const GROUP_KEYS = ['1', '2', '3', '4', '5'];

/** Groepen uit een opgeslagen spel netjes maken: alleen groep 1 tot 5, met een lijst nummers. */
export function cleanGroups(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const g of GROUP_KEYS) {
    const ids = Array.isArray(raw[g]) ? raw[g].filter(id => Number.isInteger(id)) : [];
    if (ids.length) out[g] = ids;
  }
  return out;
}
