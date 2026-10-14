// Wereldgenerator: maakt uit één getal (de seed) een complete kaart.
// Werkwijze, zoals de natuur het ook doet:
//   1. hoogtekaart  → zee, kust, vlakten, heuvels en bergen
//   2. rivieren     → stromen van de heuvels omlaag naar zee of een meer
//   3. vochtigheid  → bossen waar het nat is, woestijn waar het droog is
//   4. grondstoffen → elk erts in het landschap waar het hoort (koper in heuvels, olie in de woestijn, ...)
//   5. eerlijkheid  → elke grondstof ligt op een redelijke afstand van je startplek
//   6. bereikbaarheid → geen stukken land die je nooit kunt bereiken
// Zelfde seed = altijd dezelfde wereld. Dit bestand gebruikt geen spelstand of browser, dus het is te testen.
import { NI, NODES } from '../data/nodes.js';
import { clamp, dist } from '../util/math.js';
import { fbm, hash2, mulberry32 } from '../util/random.js';

// Terreinsoorten voor de spelregels (waar je mag lopen en bouwen)
export const TER = { LAND: 0, WATER: 1, SAND: 2, SALT: 3, ROCK: 4 };

// Landschappen, voor de kleur van de grond en waar grondstoffen liggen
export const BIOME = { WATER: 0, BEACH: 1, GRASS: 2, FOREST: 3, HILLS: 4, MOUNTAIN: 5, DESERT: 6, SALT: 7 };

// Hoeveel van de kaart (als deel van 1) lager ligt dan elke grens.
// Zo krijgt elke wereld ongeveer evenveel zee, heuvels en bergen.
const LEVELS = { sea: 0.24, shore: 0.28, hill: 0.74, peak: 0.92 };

/** Kun je over deze tegel lopen? (geen water en geen berg) */
export const isPassable = t => t !== TER.WATER && t !== TER.ROCK;

// Hoe ver (in tegels) elke grondstof hoogstens van de start mag liggen. Vroege tijdperken dichtbij.
export const MAX_START_DIST = {
  tree: 9,
  bush: 10,
  rock: 12,
  copper: 24,
  tin: 28,
  iron: 36,
  gold: 42,
  coal: 40,
  oil: 52,
  sand: 52,
  lithium: 64,
};

/** Maximale afstand (in tegels) van de start tot grondstof `k` op een kaart van breedte W. */
export const startLimit = (k, W) =>
  k === 'tree' || k === 'bush' || k === 'rock' ? MAX_START_DIST[k] : MAX_START_DIST[k] * (W / 128) * 0.7;

export function generateWorld(seed, W, H) {
  const N = W * H,
    R = mulberry32(seed),
    s = seed % 9973,
    cx = W / 2,
    cy = H / 2,
    scale = W / 128; // grotere kaart = ruimere afstanden
  const ter = new Uint8Array(N),
    biome = new Uint8Array(N),
    node = new Uint8Array(N),
    amt = new Uint16Array(N),
    elev = new Float32Array(N),
    moist = new Float32Array(N);
  const idx = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // ---- 1. Hoogte: grote landmassa's + middelgrote heuvels + kleine oneffenheden ----
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let e =
        0.55 * fbm(x / (34 * scale), y / (34 * scale), s) +
        0.3 * fbm(x / (14 * scale), y / (14 * scale), s + 11) +
        0.15 * fbm(x / 5, y / 5, s + 23);
      // Naar de rand van de kaart toe zakt het land weg in zee
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y) / (W * 0.1);
      e -= Math.pow(1 - clamp(edge, 0, 1), 2) * 0.22;
      elev[idx(x, y)] = e;
    }
  // Grenzen bepalen uit de hoogteverdeling van deze wereld
  const sorted = Float32Array.from(elev).sort(),
    q = p => sorted[Math.floor(p * (N - 1))];
  const SEA = q(LEVELS.sea),
    SHORE = q(LEVELS.shore),
    HILL = q(LEVELS.hill),
    PEAK = q(LEVELS.peak);
  // De startplek is altijd vlak, droog land
  const flat = (SHORE + HILL) / 2,
    flatR = 16 * scale * 0.7;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, cx, cy);
      if (d >= flatR) continue;
      const k = 1 - d / flatR,
        i = idx(x, y);
      elev[i] = elev[i] * (1 - k) + flat * k;
    }

  // ---- 2. Basisterrein uit de hoogte ----
  for (let i = 0; i < N; i++) {
    const e = elev[i];
    if (e < SEA) [ter[i], biome[i]] = [TER.WATER, BIOME.WATER];
    else if (e < SHORE) [ter[i], biome[i]] = [TER.SAND, BIOME.BEACH];
    else if (e >= PEAK) [ter[i], biome[i]] = [TER.ROCK, BIOME.MOUNTAIN];
    else if (e >= HILL) [ter[i], biome[i]] = [TER.LAND, BIOME.HILLS];
    else [ter[i], biome[i]] = [TER.LAND, BIOME.GRASS];
  }

  // Losse rotstegels worden heuvel: bergen horen in ketens, niet als losse blokjes
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (ter[i] !== TER.ROCK) continue;
      let n = 0;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (ter[j] === TER.ROCK) n++;
      if (n < 2) [ter[i], biome[i]] = [TER.LAND, BIOME.HILLS];
    }

  // ---- 3. Rivieren: van de heuvels omlaag naar zee ----
  // Een rivier kiest steeds de laagste buur, met een duwtje richting de dichtstbijzijnde zee.
  // In een kuil mag hij even omhoog; lukt dat te lang niet, dan ontstaat er een meer.
  const seaDist = distanceTo(i => elev[i] < SEA, W, H, 255);
  const riverCount = Math.round((N / 9000) * 1.2);
  const startClear = 14 * scale * 0.7;
  const isRiver = new Uint8Array(N);
  for (let r = 0, tries = 0; r < riverCount && tries < 600; tries++) {
    const x0 = (R() * W) | 0,
      y0 = (R() * H) | 0,
      i0 = idx(x0, y0);
    if (elev[i0] < HILL || elev[i0] >= PEAK || dist(x0, y0, cx, cy) < startClear * 2) continue;
    r++;
    let x = x0,
      y = y0,
      sinceFord = 0,
      uphill = 0;
    for (let step = 0; step < 600; step++) {
      const i = idx(x, y);
      if (ter[i] === TER.WATER && !isRiver[i]) break; // aangekomen bij zee, meer of andere rivier
      if (dist(x, y, cx, cy) < startClear) break; // nooit door je startplek
      isRiver[i] = 1;
      // Om de zoveel tegels een doorwaadbare plek, zodat je kunt oversteken
      if (++sinceFord > 12 + R() * 8) {
        [ter[i], biome[i]] = [TER.SAND, BIOME.BEACH];
        sinceFord = 0;
      } else [ter[i], biome[i]] = [TER.WATER, BIOME.WATER];
      let best = null,
        bs = Infinity;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = idx(nx, ny);
        if (isRiver[j]) continue;
        const score = elev[j] + seaDist[j] * 0.0015 + (hash2(nx, ny, s + r) - 0.5) * 0.01;
        if (score < bs) {
          bs = score;
          best = [nx, ny];
        }
      }
      if (best && elev[idx(best[0], best[1])] > elev[i]) uphill++;
      else uphill = 0;
      if (!best || uphill > 6) {
        // Vastgelopen in een kom: hier ontstaat een meertje
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            if (inside(x + dx, y + dy) && dx * dx + dy * dy <= 5 && dist(x + dx, y + dy, cx, cy) > startClear)
              [ter[idx(x + dx, y + dy)], biome[idx(x + dx, y + dy)]] = [TER.WATER, BIOME.WATER];
        break;
      }
      [x, y] = best;
    }
  }

  // ---- 4. Vochtigheid: grote weerpatronen + extra vocht vlak bij water ----
  const waterDist = distanceTo(i => ter[i] === TER.WATER, W, H, 8);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      let m = fbm(x / (28 * scale), y / (28 * scale), s + 500);
      m += 0.14 * (1 - waterDist[i] / 8);
      if (dist(x, y, cx, cy) < 22 * scale * 0.7) m = Math.max(m, 0.45); // geen woestijn bij de start
      moist[i] = m;
      if (biome[i] !== BIOME.GRASS && biome[i] !== BIOME.HILLS) continue;
      if (biome[i] === BIOME.GRASS && m < 0.36) {
        // Droog en laag: woestijn, met hier en daar een zoutvlakte
        [ter[i], biome[i]] = [TER.SAND, BIOME.DESERT];
        if (m < 0.31 && fbm(x / 9, y / 9, s + 600) > 0.55 && dist(x, y, cx, cy) > 30 * scale * 0.7)
          [ter[i], biome[i]] = [TER.SALT, BIOME.SALT];
      } else if (biome[i] === BIOME.GRASS && m > 0.55) biome[i] = BIOME.FOREST;
    }

  // ---- 5. Begroeiing en losse stenen per landschap ----
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y),
        b = biome[i],
        clump = fbm(x / 7, y / 7, s + 100);
      if (b === BIOME.FOREST && R() < 0.35 + clump * 0.45) node[i] = NI.tree;
      else if (b === BIOME.GRASS) {
        if (clump > 0.64 && R() < 0.55)
          node[i] = NI.tree; // bosjes
        else if (fbm(x / 6, y / 6, s + 200) > 0.69 && R() < 0.45) node[i] = NI.bush;
        else if (R() < 0.004) node[i] = NI.rock;
      } else if (b === BIOME.HILLS) {
        if (fbm(x / 6, y / 6, s + 300) > 0.6 && R() < 0.35) node[i] = NI.rock;
        else if (clump > 0.68 && R() < 0.3) node[i] = NI.tree;
      } else if (b === BIOME.DESERT && fbm(x / 5, y / 5, s + 700) > 0.55 && R() < 0.4) node[i] = NI.sand;
      else if (b === BIOME.BEACH && R() < 0.12) node[i] = NI.sand;
    }

  // ---- 6. Ertsen: elk in het landschap waar het hoort ----
  const deposits = {};
  const blob = (bx, by, r, k) => {
    const t = NI[k];
    for (let y = Math.floor(by - r - 1); y <= by + r + 1; y++)
      for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x++) {
        if (!inside(x, y) || dist(x, y, bx, by) > r || R() > 0.72) continue;
        const i = idx(x, y);
        if (!isPassable(ter[i])) continue;
        if (k === 'lithium') [ter[i], biome[i]] = [TER.SALT, BIOME.SALT];
        node[i] = t;
      }
    (deposits[k] = deposits[k] || []).push([bx, by]);
  };
  const near = (x, y, b, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (inside(x + dx, y + dy) && biome[idx(x + dx, y + dy)] === b) return true;
    return false;
  };
  // [erts, aantal per 128×128, grootte, waar het mag liggen]
  const ORES = [
    ['copper', 5, 2, (x, y, b) => b === BIOME.HILLS],
    ['tin', 4, 1.8, (x, y, b) => b === BIOME.HILLS],
    ['iron', 5, 2.2, (x, y, b) => b === BIOME.HILLS && near(x, y, BIOME.MOUNTAIN, 4)],
    ['gold', 3, 1.6, (x, y, b) => (b === BIOME.HILLS || b === BIOME.BEACH) && near(x, y, BIOME.WATER, 5)],
    ['coal', 5, 2.3, (x, y, b) => b === BIOME.HILLS || (b === BIOME.FOREST && near(x, y, BIOME.HILLS, 3))],
    ['oil', 5, 1.5, (x, y, b) => b === BIOME.DESERT || b === BIOME.BEACH],
    ['lithium', 3, 2.2, (x, y, b) => b === BIOME.SALT || b === BIOME.DESERT],
  ];
  const area = (W * H) / (128 * 128);
  for (const [k, perMap, size, fits] of ORES) {
    const want = Math.round(perMap * Math.max(1, area * 0.75));
    for (let n = 0, tries = 0; n < want && tries < 3000; tries++) {
      const x = (R() * W) | 0,
        y = (R() * H) | 0;
      if (!fits(x, y, biome[idx(x, y)]) || dist(x, y, cx, cy) < 7) continue;
      if ((deposits[k] || []).some(([px, py]) => dist(px, py, x, y) < 12 * scale * 0.7)) continue;
      blob(x, y, size * (0.8 + R() * 0.5), k);
      n++;
    }
  }

  // ---- 7. Eerlijkheid: zorg dat elke grondstof bereikbaar dichtbij ligt ----
  for (const k of Object.keys(MAX_START_DIST)) {
    const limit = startLimit(k, W);
    const t = NI[k];
    let ok = false;
    for (let y = Math.max(0, cy - limit); y < Math.min(H, cy + limit) && !ok; y++)
      for (let x = Math.max(0, cx - limit); x < Math.min(W, cx + limit); x++)
        if (node[idx(x, y)] === t && dist(x, y, cx, cy) <= limit) {
          ok = true;
          break;
        }
    if (ok) continue;
    // Niet gevonden: leg zelf een plek aan, ergens in de ring rond de start
    for (let tries = 0; tries < 200; tries++) {
      const a = R() * Math.PI * 2,
        rr = limit * (0.55 + R() * 0.4),
        x = Math.round(cx + Math.cos(a) * rr),
        y = Math.round(cy + Math.sin(a) * rr);
      if (!inside(x, y) || !isPassable(ter[idx(x, y)])) continue;
      const size = k === 'tree' ? 3.5 : k === 'bush' || k === 'rock' ? 2.2 : 2;
      if (k === 'oil' || k === 'sand')
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) {
            const i = idx(x + dx, y + dy);
            if (inside(x + dx, y + dy) && ter[i] === TER.LAND && dx * dx + dy * dy <= 9)
              [ter[i], biome[i]] = [TER.SAND, BIOME.DESERT];
          }
      blob(x, y, size, k);
      break;
    }
  }

  // ---- 8. Startplek vrij maken ----
  for (let y = cy - 3; y <= cy + 3; y++)
    for (let x = cx - 3; x <= cx + 3; x++) {
      const i = idx(x, y);
      node[i] = 0;
      [ter[i], biome[i]] = [TER.LAND, BIOME.GRASS];
    }

  // ---- 9. Bereikbaarheid: verbind losse stukken land met een pas of doorwaadbare plek ----
  connectRegions(ter, biome, node, W, H, idx(cx, cy));

  // ---- 10. Hoeveelheid per bron ----
  for (let i = 0; i < N; i++)
    if (node[i]) {
      if (!isPassable(ter[i])) {
        node[i] = 0;
        continue;
      }
      const a = NODES[node[i]].amt;
      amt[i] = Math.round(a[0] + R() * (a[1] - a[0]));
    }

  // levels: hoogtegrenzen van deze wereld (voor kleuren en de hoogte van bergen)
  const levels = { sea: SEA, deep: q(0.03), peak: PEAK, top: q(0.997) };
  return { ter, biome, node, amt, elev, moist, levels, start: { x: cx, y: cy } };
}

/** Afstand (in tegels, tot `max`) van elke tegel tot de dichtstbijzijnde tegel waarvoor `is(i)` geldt. */
function distanceTo(is, W, H, max) {
  const N = W * H,
    d = new Uint8Array(N).fill(max),
    q = [];
  for (let i = 0; i < N; i++)
    if (is(i)) {
      d[i] = 0;
      q.push(i);
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h],
      x = i % W,
      y = (i / W) | 0;
    if (d[i] + 1 >= max) continue;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (d[j] > d[i] + 1) {
        d[j] = d[i] + 1;
        q.push(j);
      }
    }
  }
  return d;
}

/**
 * Zoekt stukken land die je vanaf de start niet kunt bereiken (achter een rivier of bergkam)
 * en maakt een doorgang: water wordt een doorwaadbare plek, berg wordt een bergpas.
 * Hele kleine eilandjes (minder dan 25 tegels) laten we liggen.
 */
export function connectRegions(ter, biome, node, W, H, startIdx) {
  const N = W * H,
    main = new Uint8Array(N);
  const nbs = i => {
    const x = i % W,
      y = (i / W) | 0,
      out = [];
    if (x > 0) out.push(i - 1);
    if (x < W - 1) out.push(i + 1);
    if (y > 0) out.push(i - W);
    if (y < H - 1) out.push(i + W);
    return out;
  };
  const flood = (from, mark) => {
    const q = [from];
    mark[from] = 1;
    let n = 0;
    for (let h = 0; h < q.length; h++) {
      n++;
      for (const j of nbs(q[h]))
        if (!mark[j] && isPassable(ter[j])) {
          mark[j] = 1;
          q.push(j);
        }
    }
    return n;
  };
  flood(startIdx, main);

  // Geef elk los stuk land een nummer en tel hoe groot het is, om kleine eilandjes over te slaan
  const label = new Int32Array(N).fill(-1),
    sizes = [];
  for (let i = 0; i < N; i++) {
    if (label[i] >= 0 || !isPassable(ter[i])) continue;
    const id = sizes.length,
      q = [i];
    label[i] = id;
    for (let h = 0; h < q.length; h++)
      for (const j of nbs(q[h]))
        if (label[j] < 0 && isPassable(ter[j])) {
          label[j] = id;
          q.push(j);
        }
    sizes.push(q.length);
  }
  const bigEnough = i => label[i] >= 0 && sizes[label[i]] >= 25;

  // Herhaal: zoek vanaf het verbonden land het dichtstbijzijnde losse stuk en graaf een doorgang
  for (let round = 0; round < 60; round++) {
    const from = new Int32Array(N).fill(-1),
      q = [];
    for (let i = 0; i < N; i++)
      if (main[i]) {
        from[i] = i;
        q.push(i);
      }
    let hit = -1;
    for (let h = 0; h < q.length && hit < 0; h++)
      for (const j of nbs(q[h])) {
        if (from[j] >= 0) continue;
        from[j] = q[h];
        if (bigEnough(j) && !main[j]) {
          hit = j;
          break;
        }
        if (!isPassable(ter[j])) q.push(j); // alleen door water en berg zoeken
      }
    if (hit < 0) break;
    for (let k = from[hit]; !main[k]; k = from[k]) {
      if (ter[k] === TER.WATER) [ter[k], biome[k]] = [TER.SAND, BIOME.BEACH];
      else [ter[k], biome[k]] = [TER.LAND, BIOME.HILLS];
      node[k] = 0;
    }
    // Het nieuwe stuk land en het gegraven pad horen nu bij het verbonden land
    main.fill(0);
    flood(startIdx, main);
  }
}
