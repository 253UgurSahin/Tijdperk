import type { GeneratedWorld } from '../src/world/generate';
import { describe, expect, it } from 'vitest';
import {
  BIOME,
  MAX_START_DIST,
  TER,
  generateWorld,
  isPassable,
  landParts,
  reachableFrom,
  startLimit,
} from '../src/world/generate';
import { MAPS } from '../src/data/maps';
import { NI } from '../src/data/nodes';

const W = 256,
  H = 256;
const worlds: [number, GeneratedWorld][] = [11, 4242, 987654].map(seed => [seed, generateWorld(seed, W, H)]);
// Elke kaartsoort met twee seeds (het continent is hierboven al getest)
const mapWorlds = MAPS.filter(m => m.k !== 'continent').flatMap(m =>
  [5, 4242].map((seed): [string, GeneratedWorld] => [`${m.n} ${seed}`, generateWorld(seed, W, H, m.k)]),
);

// Hoeveel van de kaart (als deel van 1) dit landschap heeft
const share = (w: GeneratedWorld, ...biomes: number[]) =>
  w.biome.filter(b => biomes.includes(b)).length / (W * H);

// Alle tegels die je vanaf de start lopend kunt bereiken
function reachable(w: GeneratedWorld) {
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
      // Beide kaarten staan zeker in mapWorlds (zie bovenaan)
      const islands = mapWorlds.find(([name]) => name === `Eilanden ${seed}`)![1];
      const highlands = mapWorlds.find(([name]) => name === `Bergland ${seed}`)![1];
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
      const count: Record<number, number> = {};
      for (const b of w.biome) count[b] = (count[b] || 0) + 1;
      for (const b of [BIOME.WATER, BIOME.GRASS, BIOME.FOREST, BIOME.HILLS])
        expect(count[b] || 0, String(b)).toBeGreaterThan(200);
      for (let i = 0; i < W * H; i++) if (w.node[i]) expect(isPassable(w.ter[i])).toBe(true);
    });
  }
});

// Een korte vingerafdruk van een rij getallen (FNV-1a over de bytes)
function fingerprint(a: Uint8Array | Uint16Array | Float32Array): string {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

describe('werelden uit oude opslag blijven gelijk', () => {
  // Oude opslag maakt de wereld opnieuw uit de seed: die moet daarom precies gelijk blijven.
  // (De vingerafdrukken komen uit de versie van vóór de grotere kaarten.)
  const OLD: [number, string, string[]][] = [
    [4242, 'continent', ['bcea8817', '5624097f', '947cc79c', 'd167ed99', 'f47f121b']],
    [11, 'islands', ['c595d069', '1985081b', '8cfa8cf3', '68519ab2', 'fa896230']],
    [987654, 'highlands', ['82d455a0', 'fb909ab', '27b1155b', 'c162333b', 'caabdfba']],
  ];
  for (const [seed, kind, prints] of OLD)
    it(`${kind} ${seed} (256) is precies dezelfde wereld als vroeger`, () => {
      const w = generateWorld(seed, 256, 256, kind);
      expect([w.ter, w.biome, w.node, w.amt, w.elev].map(fingerprint)).toEqual(prints);
    });
});

describe('grotere kaarten', () => {
  // Alle tegels die je vanaf de start lopend kunt bereiken, op een kaart van n bij n
  const reachOn = (w: GeneratedWorld, n: number) => reachableFrom(w.ter, n, n, w.start.y * n + w.start.x);

  it('de afstanden tot de eerste grondstoffen blijven die van een gewone kaart', () => {
    for (const k of Object.keys(MAX_START_DIST)) {
      expect(startLimit(k, 384), k).toBe(startLimit(k, 256));
      expect(startLimit(k, 512), k).toBe(startLimit(k, 256));
    }
  });

  it('zelfde seed, kaartsoort en grootte = dezelfde wereld, met de start in het midden', () => {
    const a = generateWorld(31, 384, 384, 'islands'),
      b = generateWorld(31, 384, 384, 'islands');
    expect(a.ter).toEqual(b.ter);
    expect(a.node).toEqual(b.node);
    expect(a.ter.length).toBe(384 * 384);
    expect(a.start).toEqual({ x: 192, y: 192 });
  });

  for (const m of MAPS) {
    const n = 384,
      w = generateWorld(4242, n, n, m.k);
    it(`${m.n} (${n}): vrije startplek, grondstoffen dichtbij en bijna al het land bereikbaar`, () => {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const i = (w.start.y + dy) * n + w.start.x + dx;
          expect(w.ter[i]).toBe(TER.LAND);
          expect(w.node[i]).toBe(0);
        }
      const seen = reachOn(w, n);
      for (const k of Object.keys(MAX_START_DIST)) {
        let best = Infinity;
        for (let i = 0; i < n * n; i++)
          if (w.node[i] === NI[k] && seen[i])
            best = Math.min(best, Math.hypot((i % n) - w.start.x, ((i / n) | 0) - w.start.y));
        expect(best, k).toBeLessThanOrEqual(startLimit(k, n) + 3);
      }
      let land = 0,
        reach = 0;
      for (let i = 0; i < n * n; i++)
        if (isPassable(w.ter[i])) {
          land++;
          if (seen[i]) reach++;
        }
      expect(reach / land).toBeGreaterThan(0.97);
    });
  }

  it('een enorme kaart (512) heeft veel meer ertsen dan een gewone', () => {
    const small = generateWorld(4242, 256, 256),
      big = generateWorld(4242, 512, 512);
    const count = (w: GeneratedWorld) => w.node.filter(t => t === NI.copper || t === NI.iron).length;
    expect(count(big)).toBeGreaterThan(count(small) * 2.5);
  });
});

describe('stukken land (voor het zoeken van routes)', () => {
  // Een eilandenkaart heeft losse eilandjes: daar komt geen route, en dan hoeft het zoeken niet eens te beginnen
  const n = 256,
    w = generateWorld(11, n, n, 'islands'),
    parts = landParts(w.ter, n, n);

  it('water en bergen horen bij geen stuk land, al het andere wel', () => {
    for (let i = 0; i < n * n; i++) expect(parts[i] > 0).toBe(isPassable(w.ter[i]));
  });

  it('hetzelfde nummer = je kunt er te voet komen, een ander nummer = nooit', () => {
    // Een paar beginplekken: de start en de eerste tegel van een paar andere stukken land
    const firstOf = new Map<number, number>();
    for (let i = 0; i < n * n; i++) if (parts[i] && !firstOf.has(parts[i])) firstOf.set(parts[i], i);
    expect(firstOf.size).toBeGreaterThan(1);
    const starts = [w.start.y * n + w.start.x, ...[...firstOf.values()].slice(0, 4)];
    for (const from of starts) {
      const seen = reachableFrom(w.ter, n, n, from);
      for (let i = 0; i < n * n; i++) if (parts[i]) expect(!!seen[i]).toBe(parts[i] === parts[from]);
    }
  });
});
