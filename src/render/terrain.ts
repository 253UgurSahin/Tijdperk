// De grond: kleuren per tegel, de vorm van het land en de rand van je gebied.
// (Fijne details en rotswanden: terrainlook.ts · water: water.ts)
import * as T3 from 'three';
import { CN, H, W, onMapSize } from '../config';
import { G } from '../game/state';
import { mat } from './kit';
import { R3, S3 } from './scene';
import { hash2 } from '../util/random';
import { dressTerrain } from './terrainlook';
import { updateWaterDepth } from './water';
import { TER, ground, mountainHeight, road, ter } from '../world/world';
import { ownerAt, rivalColour } from '../game/rivals';

// Kleur van een rivaal als [r, g, b], voor zijn land en de rand eromheen
const rivalRGB = (id: number) => {
  const c = rivalColour(id);
  return [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
};

// Pixels per tegel in de grondtextuur. Op een grotere kaart minder, zodat de textuur nooit groter wordt dan
// 3072 × 3072 pixels (zoals op een gewone kaart): dat past op elke videokaart en in het geheugen van een telefoon.
const TEX_MAX = 3072;
const tilePixels = () => Math.min(12, Math.floor(TEX_MAX / Math.max(W, H)));
let TS = tilePixels(),
  // Zo breed (in pixels) zijn de randen van wegen en gebieden: op een gewone kaart 2
  EDGE = Math.max(1, Math.round(TS / 6));
const TCAN = document.createElement('canvas');
TCAN.width = W * TS;
TCAN.height = H * TS;
export const tctx = TCAN.getContext('2d')!;
/** De pixels van de grondtextuur (gemaakt door paintAll bij een nieuw spel). */
export let timg: ImageData | null = null;
export const TTEX = new T3.CanvasTexture(TCAN);
TTEX.magFilter = T3.LinearFilter;
TTEX.minFilter = T3.LinearMipmapLinearFilter;
TTEX.anisotropy = 4;
export const TMAT = new T3.MeshStandardMaterial({ map: TTEX, roughness: 0.95, flatShading: false });
dressTerrain(TMAT);
// De grond in vierkante stukken van TERRAIN_PIECE tegels: wat buiten beeld ligt, slaat de videokaart over.
// (Op een grote kaart is de grond een half miljoen driehoekjes; dichtbij zie je er maar een paar duizend van.)
const TERRAIN_PIECE = 64;
const TGROUP = new T3.Group();
S3.add(TGROUP);
/** Kleur van elke soort weg als [r, g, b] (0 = geen weg). */
export const RC: ([number, number, number] | null)[] = [null, [176, 152, 108], [168, 166, 156], [78, 82, 88]];
/** Kleur van de grond op tegel (x, y), zoals de wereldgenerator die heeft bepaald. */
export function tileRGB(x: number, y: number) {
  const i = (y * W + x) * 3;
  return [ground[i], ground[i + 1], ground[i + 2]];
}
// Grondkleur op een willekeurig punt: de kleuren van de vier dichtstbijzijnde tegels lopen
// zacht in elkaar over, zodat er geen harde blokken tussen gras, bos en zand zitten.
const groundAt = (u: number, v: number, out: number[]) => {
  const x0 = Math.max(0, Math.min(W - 2, Math.floor(u))),
    y0 = Math.max(0, Math.min(H - 2, Math.floor(v))),
    fx = Math.max(0, Math.min(1, u - x0)),
    fy = Math.max(0, Math.min(1, v - y0)),
    a = (y0 * W + x0) * 3,
    b = a + 3,
    c = a + W * 3,
    d = c + 3;
  for (let k = 0; k < 3; k++) {
    const top = ground[a + k] + (ground[b + k] - ground[a + k]) * fx,
      bot = ground[c + k] + (ground[d + k] - ground[c + k]) * fx;
    out[k] = top + (bot - top) * fy;
  }
};
const px3 = [0, 0, 0];

// Is hier een weg? (0 buiten de kaart)
const roadOn = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : road[y * W + x]);
/** Eén stuk weg op de grond: van het midden van tegel (ax, ay) naar dat van (bx, by), met het soort weg. */
interface RoadPiece {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  tier: number;
  /** Rond plein in plaats van vierkant (een tegel met alleen schuine buren: dan geen kartelrand). */
  round?: boolean;
}
/**
 * De stukken weg die tegel (x, y) kunnen raken: van elke wegtegel eromheen naar zijn buren. Ook schuin:
 * twee wegtegels die alleen met een hoekje aan elkaar zitten, krijgen een schuine strook ertussen, die
 * over de hoeken van de tegels ernaast loopt. Zo sluit een schuin pad netjes aan in plaats van een
 * dambord te worden. (Zit er al een weg recht ertussen, dan niet: dan blijft een bocht gewoon haaks.)
 */
function roadPieces(x: number, y: number): RoadPiece[] {
  const list: RoadPiece[] = [];
  for (let ry = y - 1; ry <= y + 1; ry++)
    for (let rx = x - 1; rx <= x + 1; rx++) {
      const t = roadOn(rx, ry);
      if (!t) continue;
      const square = { ax: rx, ay: ry, bx: rx, by: ry, tier: t, round: false }; // het plein van de tegel zelf
      list.push(square);
      let straight = false,
        slanted = false;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const n = roadOn(rx + dx, ry + dy);
        if (n) {
          straight = true;
          list.push({ ax: rx, ay: ry, bx: rx + dx, by: ry + dy, tier: Math.max(t, n) });
        }
      }
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const n = roadOn(rx + dx, ry + dy);
        if (n && !roadOn(rx + dx, ry) && !roadOn(rx, ry + dy)) {
          slanted = true;
          list.push({ ax: rx, ay: ry, bx: rx + dx, by: ry + dy, tier: Math.max(t, n) });
        }
      }
      square.round = slanted && !straight;
    }
  return list;
}
/**
 * Welk soort weg ligt op punt (u, v) (in tegels), of 0. Een recht stuk is een rechthoek (dan sluit het
 * strak aan op de tegel ernaast), een schuin stuk een strook even breed als een recht stuk.
 */
function roadTierAt(pieces: RoadPiece[], u: number, v: number, half: number): number {
  let best = 0;
  for (const p of pieces) {
    if (p.tier <= best) continue;
    const ax = p.ax + 0.5,
      ay = p.ay + 0.5,
      dx = p.bx - p.ax,
      dy = p.by - p.ay;
    let hit: boolean;
    if (p.round) {
      const ex = u - ax,
        ey = v - ay;
      hit = ex * ex + ey * ey <= half * half;
    } else if (dx !== 0 && dy !== 0) {
      // Schuin: afstand tot het lijnstuk tussen de twee middens
      const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / 2)),
        ex = u - (ax + dx * t),
        ey = v - (ay + dy * t);
      hit = ex * ex + ey * ey <= half * half;
    } else {
      // Recht (of het plein zelf): binnen de rechthoek van midden tot midden, half breed
      const x0 = Math.min(ax, ax + dx) - half,
        x1 = Math.max(ax, ax + dx) + half,
        y0 = Math.min(ay, ay + dy) - half,
        y1 = Math.max(ay, ay + dy) + half;
      hit = u >= x0 && u <= x1 && v >= y0 && v <= y1;
    }
    if (hit) best = p.tier;
  }
  return best;
}

export function paintTile(x: number, y: number) {
  const i = y * W + x,
    mine = G.unl[(y >> 4) * CN + (x >> 4)] === 1,
    own = mine ? 0 : ownerAt(x, y), // land van een rivaal (zijn nummer), of 0
    lk = !mine && !own, // wildernis: die tekenen we donkerder
    tint = own ? rivalRGB(own) : null,
    d = timg!.data,
    X0 = x * TS,
    Y0 = y * TS,
    WW = W * TS;
  // De wegen die over deze tegel kunnen lopen (meestal geen: dan slaan we het hele zoeken over)
  const pieces = roadPieces(x, y),
    half = 0.5 - EDGE / TS; // een weg is een tegel breed, min een grasrandje aan elke kant
  for (let py = 0; py < TS; py++)
    for (let px = 0; px < TS; px++) {
      groundAt(x + (px + 0.5) / TS - 0.5, y + (py + 0.5) / TS - 0.5, px3);
      let [r, g, b] = px3;
      const h = hash2(X0 + px, Y0 + py, 7);
      if (ter[i] === 0) {
        const k = 0.9 + h * 0.18;
        r *= k;
        g *= k;
        b *= k;
        if (h > 0.965) {
          r *= 0.78;
          g *= 0.82;
          b *= 0.7;
        }
      } else if (ter[i] !== TER.WATER) {
        const k = 0.94 + h * 0.1;
        r *= k;
        g *= k;
        b *= k;
      }
      const rd = pieces.length ? roadTierAt(pieces, x + (px + 0.5) / TS, y + (py + 0.5) / TS, half) : 0;
      if (rd) {
        const c = RC[rd]!,
          k = 0.9 + h * 0.16;
        r = c[0] * k;
        g = c[1] * k;
        b = c[2] * k;
        // Klinkers: een patroon van voegen
        if (rd === 2 && ((px + (py >> 2) * 2) % 5 === 0 || py % 4 === 0)) {
          r *= 0.86;
          g *= 0.86;
          b *= 0.86;
        }
        // Asfalt: een gestippelde middenstreep (alleen op de wegtegel zelf, niet op een schuin hoekje)
        if (rd === 3 && road[i] === 3 && py === TS / 2 && px % 6 < 3) {
          r = 230;
          g = 220;
          b = 150;
        }
      }
      if (lk) {
        const m = (r + g + b) / 3;
        r = (r * 0.35 + m * 0.25) * 0.62 + 14;
        g = (g * 0.35 + m * 0.25) * 0.62 + 18;
        b = (b * 0.35 + m * 0.25) * 0.62 + 24;
      }
      // Land van een rivaal: bewoond (dus niet donker), met een zweem van zijn kleur
      if (tint) {
        r = r * 0.88 + (tint[0] - r * 0.88) * 0.14;
        g = g * 0.88 + (tint[1] - g * 0.88) * 0.14;
        b = b * 0.88 + (tint[2] - b * 0.88) * 0.14;
      }
      const o = ((Y0 + py) * WW + X0 + px) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  // Rand van het gebied van een rivaal, in zijn kleur
  if (tint) {
    const put = (px: number, py: number) => {
      const o = ((Y0 + py) * WW + X0 + px) * 4;
      d[o] = tint[0];
      d[o + 1] = tint[1];
      d[o + 2] = tint[2];
    };
    // Grenst deze tegel links, rechts, boven of onder aan land dat niet van deze rivaal is?
    const left = ownerAt(x - 1, y) !== own,
      right = ownerAt(x + 1, y) !== own,
      up = ownerAt(x, y - 1) !== own,
      down = ownerAt(x, y + 1) !== own;
    // Een rand van EDGE pixels breed
    for (let p = 0; p < TS; p++)
      for (let w = 0; w < EDGE; w++) {
        if (left) put(w, p);
        if (right) put(TS - 1 - w, p);
        if (up) put(p, w);
        if (down) put(p, TS - 1 - w);
      }
  }
  // Rand van je gebied
  if (mine) {
    const L = (xx: number, yy: number) =>
      xx < 0 || yy < 0 || xx >= W || yy >= H || !G.unl[(yy >> 4) * CN + (xx >> 4)];
    const put = (px: number, py: number) => {
      const o = ((Y0 + py) * WW + X0 + px) * 4;
      d[o] = 236;
      d[o + 1] = 214;
      d[o + 2] = 150;
    };
    // Grenst deze tegel links, rechts, boven of onder aan land dat niet van jou is? Daar een rand van EDGE pixels
    const left = L(x - 1, y),
      right = L(x + 1, y),
      up = L(x, y - 1),
      down = L(x, y + 1);
    for (let p = 0; p < TS; p++)
      for (let w = 0; w < EDGE; w++) {
        if (left) put(w, p);
        if (right) put(TS - 1 - w, p);
        if (up) put(p, w);
        if (down) put(p, TS - 1 - w);
      }
  }
}
export function paintAll() {
  timg = tctx.createImageData(W * TS, H * TS);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paintTile(x, y);
  tctx.putImageData(timg, 0, 0);
  TTEX.needsUpdate = true;
}

// Tegels die opnieuw geschilderd moeten worden. Alleen dat stukje gaat daarna naar de videokaart,
// in plaats van de hele grondtextuur (die is 3072×3072 pixels: dat zou haperen).
const pending = new Set<number>();
const PATCH = document.createElement('canvas'),
  pctx = PATCH.getContext('2d')!,
  PATCHTEX = new T3.CanvasTexture(PATCH),
  patchPos = new T3.Vector2();
export const repaintTile = (x: number, y: number) => pending.add(y * W + x);
export const pendingTiles = () => pending.size;

export function flushTerrain() {
  if (!pending.size) return;
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (const i of pending) {
    const x = i % W,
      y = (i / W) | 0;
    paintTile(x, y);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  pending.clear();
  const px = x0 * TS,
    py = y0 * TS,
    pw = (x1 - x0 + 1) * TS,
    ph = (y1 - y0 + 1) * TS;
  tctx.putImageData(timg!, 0, 0, px, py, pw, ph);
  // Nog niet op de videokaart, of een heel groot stuk: dan gewoon alles in één keer
  if (!R3.properties.get(TTEX).__webglTexture || pw * ph > (TCAN.width * TCAN.height) / 4) {
    TTEX.needsUpdate = true;
    return;
  }
  PATCH.width = pw;
  PATCH.height = ph;
  pctx.drawImage(TCAN, px, py, pw, ph, 0, 0, pw, ph);
  // De textuur staat ondersteboven op de videokaart (flipY), dus de y-positie telt van onderen
  patchPos.set(px, TCAN.height - py - ph);
  R3.copyTextureToTexture(patchPos, PATCHTEX, TTEX);
}
// Hoogte van elk hoekpunt van de grond (W+1 bij H+1), voor dingen die óp de bergen staan
let heights = new Float32Array((W + 1) * (H + 1));
/** Hoogte van de grond op punt (x, z), tussen de hoekpunten in geschat. */
export function groundHeight(x: number, z: number): number {
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x))),
    z0 = Math.max(0, Math.min(H - 1, Math.floor(z))),
    fx = Math.max(0, Math.min(1, x - x0)),
    fz = Math.max(0, Math.min(1, z - z0)),
    at = (xx: number, zz: number) => heights[zz * (W + 1) + xx],
    top = at(x0, z0) + (at(x0 + 1, z0) - at(x0, z0)) * fx,
    bottom = at(x0, z0 + 1) + (at(x0 + 1, z0 + 1) - at(x0, z0 + 1)) * fx;
  return top + (bottom - top) * fz;
}
export function buildTerrain() {
  for (const m of TGROUP.children as T3.Mesh[]) m.geometry.dispose();
  TGROUP.clear();
  const g = new T3.PlaneGeometry(W, H, W, H);
  g.rotateX(-Math.PI / 2);
  g.translate(W / 2, 0, H / 2);
  const p = g.attributes.position as T3.BufferAttribute;
  for (let k = 0; k < p.count; k++) {
    const x = Math.round(p.getX(k)),
      z = Math.round(p.getZ(k));
    // Elke hoekpunt kijkt naar de 4 tegels eromheen: water zakt omlaag, bergen rijzen op
    let wc = 0,
      rc = 0,
      rise = 0,
      n = 0;
    for (const [dx, dz] of [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
    ]) {
      const xx = x + dx,
        zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= W || zz >= H) continue;
      n++;
      const t = ter[zz * W + xx];
      if (t === TER.WATER) wc++;
      else if (t === TER.ROCK) {
        rc++;
        rise += 1.3 + mountainHeight(zz * W + xx) * 4.5 + hash2(x, z, 77) * 0.6; // grillige toppen
      }
    }
    // Midden in een berg: extra hobbels, zodat de toppen grilliger worden en er rotswanden ontstaan
    const crag = rc === n ? (hash2(x, z, 78) - 0.4) * 0.9 : 0;
    if (rc) p.setY(k, (rise / n) * (rc === n ? 1 : 0.4) + crag);
    else p.setY(k, wc === n && n ? -0.55 : wc ? (-0.32 * wc) / n : 0);
    heights[z * (W + 1) + x] = p.getY(k);
  }
  g.computeVertexNormals();
  updateWaterDepth();
  // Eerst de hele grond (dan lopen de stukken naadloos in elkaar over), daarna in stukken knippen
  for (let z0 = 0; z0 < H; z0 += TERRAIN_PIECE)
    for (let x0 = 0; x0 < W; x0 += TERRAIN_PIECE) TGROUP.add(terrainPiece(g, x0, z0));
  g.dispose();
}
/** Een stuk grond van TERRAIN_PIECE bij TERRAIN_PIECE tegels vanaf tegel (x0, z0), geknipt uit de hele grond `g`. */
function terrainPiece(g: T3.BufferGeometry, x0: number, z0: number): T3.Mesh {
  const w = Math.min(TERRAIN_PIECE, W - x0),
    h = Math.min(TERRAIN_PIECE, H - z0),
    n = (w + 1) * (h + 1),
    srcPos = (g.attributes.position as T3.BufferAttribute).array,
    srcNrm = (g.attributes.normal as T3.BufferAttribute).array,
    srcUv = (g.attributes.uv as T3.BufferAttribute).array,
    pos = new Float32Array(n * 3),
    nrm = new Float32Array(n * 3),
    uv = new Float32Array(n * 2),
    index: number[] = [];
  let k = 0;
  for (let z = 0; z <= h; z++)
    for (let x = 0; x <= w; x++, k++) {
      const s = (z0 + z) * (W + 1) + x0 + x; // hetzelfde hoekpunt in de hele grond
      for (let c = 0; c < 3; c++) {
        pos[k * 3 + c] = srcPos[s * 3 + c];
        nrm[k * 3 + c] = srcNrm[s * 3 + c];
      }
      uv[k * 2] = srcUv[s * 2];
      uv[k * 2 + 1] = srcUv[s * 2 + 1];
    }
  // Twee driehoekjes per tegel, in dezelfde volgorde als three.js dat bij een vlak doet
  for (let z = 0; z < h; z++)
    for (let x = 0; x < w; x++) {
      const a = z * (w + 1) + x,
        b = a + w + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const piece = new T3.BufferGeometry();
  piece.setIndex(index);
  piece.setAttribute('position', new T3.BufferAttribute(pos, 3));
  piece.setAttribute('normal', new T3.BufferAttribute(nrm, 3));
  piece.setAttribute('uv', new T3.BufferAttribute(uv, 2));
  piece.computeBoundingSphere();
  const m = new T3.Mesh(piece, TMAT);
  m.receiveShadow = true;
  return m;
}
// De rand van de kaart: een donkere wand omlaag aan alle vier de kanten
const SKIRT = new T3.Group();
S3.add(SKIRT);
function buildSkirt() {
  for (const m of SKIRT.children as T3.Mesh[]) m.geometry.dispose();
  SKIRT.clear();
  const sk = mat('#3a2f25');
  for (const [x, z, ry, l] of [
    [W / 2, H, 0, W],
    [W, H / 2, Math.PI / 2, H],
    [W / 2, 0, Math.PI, W],
    [0, H / 2, -Math.PI / 2, H],
  ]) {
    const m = new T3.Mesh(new T3.PlaneGeometry(l, 6), sk);
    m.position.set(x, -3, z);
    m.rotation.y = ry;
    SKIRT.add(m);
  }
}
buildSkirt();

// Een andere kaartgrootte: grondtextuur, hoogtes en rand opnieuw op maat (de grond zelf volgt bij de nieuwe wereld)
onMapSize(() => {
  TS = tilePixels();
  EDGE = Math.max(1, Math.round(TS / 6));
  TCAN.width = W * TS;
  TCAN.height = H * TS;
  timg = null;
  TTEX.dispose(); // de videokaart maakt de textuur opnieuw, in de nieuwe maat
  pending.clear();
  heights = new Float32Array((W + 1) * (H + 1));
  buildSkirt();
});
