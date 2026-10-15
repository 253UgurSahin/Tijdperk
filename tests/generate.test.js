import { describe, expect, it } from 'vitest';
import { BIOME, MAX_START_DIST, TER, generateWorld, isPassable, startLimit } from '../src/world/generate.js';
import { MAPS } from '../src/data/maps.js';
import { NI } from '../src/data/nodes.js';

const W = 256,
  H = 256;
const worlds = [11, 4242, 987654].map(seed => [seed, generateWorld(seed, W, H)]);
// Elke kaartsoort met twee seeds (het continent is hierboven al getest)
const mapWorlds = MAPS.filter(m => m.k !== 'continent').flatMap(m =>
  [5, 4242].map(seed => [`${m.n} ${seed}`, generateWorld(seed, W, H, m.k)]),
);

// Hoeveel van de kaart (als deel van 1) dit landschap heeft
const share = (w, ...biomes) => w.biome.filter(b => biomes.includes(b)).length / (W * H);

// Alle tegels die je vanaf de start lopend kunt bereiken
function reachable(w) {
  const seen = new Uint8Array(W * H),
    q = [w.start.y * W + w.start.x];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h],
      x = i % W,
      y = (i / W) | 0;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!seen[j] && isPassable(w.ter[j])) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  return seen;
}

describe('wereldgenerator', () => {
  it('zelfde seed geeft dezelfde wereld', () => {
    const a = generateWorld(77, 128, 128),
      b = generateWorld(77, 128, 128);
    expect(a.ter).toEqual(b.ter);
    expect(a.node).toEqual(b.node);
  });

  it('andere seed geeft een andere wereld', () => {
    expect(worlds[0][1].ter).not.toEqual(worlds[1][1].ter);
  });

  it('zonder kaartsoort is het een continent', () => {
    const a = generateWorld(77, 128, 128),
      b = generateWorld(77, 128, 128, 'continent'),
      c = generateWorld(77, 128, 128, 'bestaat-niet');
    expect(b.ter).toEqual(a.ter);
    expect(c.ter).toEqual(a.ter);
  });

  it('zelfde seed en kaartsoort geeft dezelfde wereld, een andere kaartsoort een andere', () => {
    for (const m of MAPS) {
      const a = generateWorld(31, 128, 128, m.k),
        b = generateWorld(31, 128, 128, m.k);
      expect(a.ter, m.k).toEqual(b.ter);
      expect(a.node, m.k).toEqual(b.node);
    }
    const continent = generateWorld(31, 128, 128, 'continent');
    expect(generateWorld(31, 128, 128, 'islands').ter).not.toEqual(continent.ter);
    expect(generateWorld(31, 128, 128, 'highlands').ter).not.toEqual(continent.ter);
  });

  it('eilanden hebben meer zee, bergland meer heuvels en bergen', () => {
    for (const seed of [5, 4242]) {
      const continent = generateWorld(seed, W, H, 'continent');
      const islands = mapWorlds.find(([name]) => name === `Eilanden ${seed}`)[1];
      const highlands = mapWorlds.find(([name]) => name === `Bergland ${seed}`)[1];
      expect(share(islands, BIOME.WATER)).toBeGreaterThan(share(continent, BIOME.WATER) + 0.1);
      expect(share(highlands, BIOME.HILLS, BIOME.MOUNTAIN)).toBeGreaterThan(
        share(continent, BIOME.HILLS, BIOME.MOUNTAIN) + 0.1,
      );
      expect(share(highlands, BIOME.WATER)).toBeLessThan(share(continent, BIOME.WATER));
    }
  });

  for (const [seed, w] of [...worlds, ...mapWorlds]) {
    it(`seed ${seed}: startplek is vrij, droog land`, () => {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const i = (w.start.y + dy) * W + w.start.x + dx;
          expect(w.ter[i]).toBe(TER.LAND);
          expect(w.node[i]).toBe(0);
        }
    });

    it(`seed ${seed}: elke grondstof ligt bereikbaar op een redelijke afstand`, () => {
      const seen = reachable(w);
      for (const k of Object.keys(MAX_START_DIST)) {
        const max = startLimit(k, W) + 3;
        let best = Infinity;
        for (let i = 0; i < W * H; i++)
          if (w.node[i] === NI[k] && seen[i])
            best = Math.min(best, Math.hypot((i % W) - w.start.x, ((i / W) | 0) - w.start.y));
        expect(best, k).toBeLessThanOrEqual(max);
      }
    });

    it(`seed ${seed}: het meeste land is te voet bereikbaar`, () => {
      const seen = reachable(w);
      let land = 0,
        reach = 0;
      for (let i = 0; i < W * H; i++)
        if (isPassable(w.ter[i])) {
          land++;
          if (seen[i]) reach++;
        }
      expect(reach / land).toBeGreaterThan(0.97);
    });

    it(`seed ${seed}: de wereld is gevarieerd`, () => {
      const count = {};
      for (const b of w.biome) count[b] = (count[b] || 0) + 1;
      for (const b of [BIOME.WATER, BIOME.GRASS, BIOME.FOREST, BIOME.HILLS])
        expect(count[b] || 0, String(b)).toBeGreaterThan(200);
      for (let i = 0; i < W * H; i++) if (w.node[i]) expect(isPassable(w.ter[i])).toBe(true);
    });
  }
});
