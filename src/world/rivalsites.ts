// Waar rivalen wonen: ver van jouw startplek, op droog land dat je te voet kunt bereiken. Puur (alleen de kaart).
import { CS } from '../config';
import { MAX_RIVALS } from '../data/rivals';
import { mulberry32 } from '../util/random';
import { isPassable, reachableFrom } from './generate';

/** Zo ver (in tegels) ligt het stamhuis van een rivaal minstens van het midden van de kaart (jouw stamhuis). */
export const RIVAL_MIN_DIST = 70;
// Zo ver liggen twee rivalen minstens van elkaar
const RIVAL_SPACING = 64;
// Eerst streng zoeken (ver weg, veel land); lukt dat niet, dan wat ruimer
const TRIES = [
  { minDist: RIVAL_MIN_DIST, land: 0.45 },
  { minDist: RIVAL_MIN_DIST, land: 0.3 },
  { minDist: 56, land: 0.25 },
];

/**
 * Kies startplekken voor de rivalen in een wereld (`ter` uit generateWorld, W bij H tegels).
 * Elke plek is { x, y, chunks }: (x, y) is de linkerbovenhoek van het stamhuis (2×2 tegels),
 * `chunks` zijn de vier gebieden (2×2) rond dat stamhuis. Ze liggen zo ver mogelijk rondom verspreid.
 * Zelfde wereld en seed = zelfde plekken; een spel met n rivalen neemt de eerste n.
 */
export function pickRivalSites(ter, W, H, seed) {
  const CN = W / CS,
    cx = W / 2,
    cy = H / 2;
  const reach = reachableFrom(ter, W, H, cy * W + cx);
  const R = mulberry32((seed >>> 0) + 5150);
  const startAngle = R() * Math.PI * 2;
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && reach[y * W + x] && isPassable(ter[y * W + x]);
  const sites = [];
  for (const rule of TRIES) {
    const options = candidates(rule, { ok, ter, W, CN, cx, cy, R });
    while (sites.length < MAX_RIVALS) {
      // Elke rivaal krijgt een eigen richting (een derde van de cirkel verder), zodat ze rondom wonen
      const want = startAngle + (sites.length * Math.PI * 2) / MAX_RIVALS;
      let best = null,
        bestScore = Infinity;
      for (const c of options) {
        const clash = sites.some(
          s => Math.hypot(s.x - c.x, s.y - c.y) < RIVAL_SPACING || s.chunks.some(k => c.chunks.includes(k)),
        );
        if (clash) continue;
        // Liefst in de goede richting, en niet onnodig ver weg (dan duurt hun mars eindeloos)
        const score = angleGap(c.angle, want) + c.jitter + Math.max(0, c.dist - 95) / 30;
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (!best) break;
      sites.push({ x: best.x, y: best.y, chunks: best.chunks });
    }
  }
  return sites;
}

// Alle hoekpunten tussen vier gebieden die als thuis voor een rivaal kunnen dienen
function candidates(rule, { ok, ter, W, CN, cx, cy, R }) {
  const list = [];
  for (let by = 1; by < CN; by++)
    for (let bx = 1; bx < CN; bx++) {
      const jitter = R() * 0.5; // altijd trekken, zodat de volgorde van de toevalsgetallen vast blijft
      const px = bx * CS,
        py = by * CS;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < rule.minDist) continue;
      if (landShare(ter, W, (bx - 1) * CS, (by - 1) * CS, 2 * CS) < rule.land) continue;
      const spot = townhallSpot(ok, px, py);
      if (!spot) continue;
      const chunks = [(by - 1) * CN + bx - 1, (by - 1) * CN + bx, by * CN + bx - 1, by * CN + bx];
      list.push({ ...spot, chunks, dist, angle: Math.atan2(spot.y - cy, spot.x - cx), jitter });
    }
  return list;
}

// Een plek voor het stamhuis vlak bij (px, py): 2×2 tegels plus een rand van één tegel, allemaal begaanbaar
function townhallSpot(ok, px, py) {
  for (let r = 0; r <= 5; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = px - 1 + dx,
          y = py - 1 + dy;
        let free = true;
        for (let yy = y - 1; yy <= y + 2 && free; yy++)
          for (let xx = x - 1; xx <= x + 2; xx++)
            if (!ok(xx, yy)) {
              free = false;
              break;
            }
        if (free) return { x, y };
      }
  return null;
}

// Welk deel (0 tot 1) van een vierkant stuk kaart begaanbaar land is
function landShare(ter, W, x0, y0, size) {
  let land = 0;
  for (let y = y0; y < y0 + size; y++)
    for (let x = x0; x < x0 + size; x++) if (isPassable(ter[y * W + x])) land++;
  return land / (size * size);
}

// Hoe ver twee richtingen uit elkaar liggen (0 tot π)
function angleGap(a, b) {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}
