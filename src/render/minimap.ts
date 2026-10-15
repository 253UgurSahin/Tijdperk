// De minikaart rechtsonder, en de grote kaart (dezelfde kaart groot in het midden van het scherm).
import { store } from '../core/store';
import { viewYaw } from '../core/view';
import { CN, CS, H, W, onMapSize } from '../config';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { G } from '../game/state';
import { centerOn, s2t } from './camera';
import { VH, VW } from './scene';
import { RC } from './terrain';
import { $, isCompact } from '../util/dom';
import { clamp } from '../util/math';
import { bmap, ground, node, road } from '../world/world';
import { RIVAL } from '../data/rivals';
import { ownerAt, rbById, rivalById } from '../game/rivals';

const mini = $<HTMLCanvasElement>('#mini'),
  // De naald van het kompas op de minikaart (staat in index.html)
  needle = document.querySelector<SVGSVGElement>('#compass .needle')!,
  mctx = mini.getContext('2d')!,
  mbuf = document.createElement('canvas');
mbuf.width = W;
mbuf.height = H;
const mbctx = mbuf.getContext('2d')!;
let mimg = mbctx.createImageData(W, H);
let MW: number = 200,
  MH: number = 200,
  needleYaw = NaN;
// Een andere kaartgrootte: het kaartplaatje (één pixel per tegel) opnieuw op maat
onMapSize(() => {
  mbuf.width = W;
  mbuf.height = H;
  mimg = mbctx.createImageData(W, H);
  drawnVersion = -1;
});
/** De zes getallen voor setTransform: van kaarttegels naar pixels op de minikaart. */
type Transform2D = [number, number, number, number, number, number];
/**
 * De minikaart draait mee met het beeld: wat op het scherm boven is, is ook op de minikaart boven.
 * Hij wordt zo groot dat de gedraaide kaart er precies in past (schuin is dat een ruit).
 */
function miniScale(): number {
  const a = viewYaw();
  return MW / (W * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))));
}
function miniXf(): Transform2D {
  const a = viewYaw(),
    k = miniScale(),
    c = Math.cos(a) * k,
    s = Math.sin(a) * k;
  // Draaien rond het midden van de kaart, en dat midden in het midden van de minikaart zetten
  return [c, s, -s, c, MW / 2 - (c * W) / 2 + (s * H) / 2, MH / 2 - (s * W) / 2 - (c * H) / 2];
}
// Vaste kleuren voor bronnen op de minikaart (één keer uitgerekend)
const hex = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];
const NODE_RGB = NODES.map(n =>
  !n
    ? null
    : n.k === 'tree'
      ? [56, 96, 50]
      : n.k === 'rock'
        ? [150, 152, 144]
        : n.k === 'sand' || n.k === 'bush'
          ? null
          : hex(RES[n.res].c),
);

// De kaartafbeelding zelf wordt alleen opnieuw gemaakt als de wereld veranderd is; anders tekenen we alleen
// de stippen. Helemaal opnieuw als store.mapVersion optelt (een nieuwe wereld, gebied of rivaal), en anders
// alleen het stukje waar iets gebouwd, gekapt of gelegd is (zie miniChanged): op een grote kaart scheelt dat veel.
let drawnVersion = -1,
  drawnAge = -1;
// Welk stuk opnieuw moet, in tegels: van (x0, y0) tot en met (x1, y1). Leeg als x1 < x0.
const todo = { x0: 0, y0: 0, x1: -1, y1: -1 };
/** Teken de tegels (x0, y0) tot en met (x1, y1) opnieuw op de kaart, de volgende keer dat die getekend wordt. */
export function miniChanged(x0: number, y0: number, x1 = x0, y1 = y0): void {
  const empty = todo.x1 < todo.x0;
  todo.x0 = empty ? x0 : Math.min(todo.x0, x0);
  todo.y0 = empty ? y0 : Math.min(todo.y0, y0);
  todo.x1 = empty ? x1 : Math.max(todo.x1, x1);
  todo.y1 = empty ? y1 : Math.max(todo.y1, y1);
}
// Kleur (r, g, b) van een rivaal op nummer, voor zijn land en gebouwen
function rivalRGB(id: number): [number, number, number] {
  const r = rivalById(id);
  return r ? hex(RIVAL[r.k].c) : [200, 200, 200];
}
/** Teken het kaartplaatje van tegel (x0, y0) tot en met (x1, y1): grond, bronnen, wegen, gebouwen en gebied. */
function paintMiniBase(x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W - 1, x1);
  y1 = Math.min(H - 1, y1);
  if (x1 < x0 || y1 < y0) return;
  const d = mimg.data,
    w = W,
    cn = CN,
    age = G.age;
  const rivalRGBs = [null, rivalRGB(1), rivalRGB(2), rivalRGB(3)];
  // Gebouwen van een rivaal: zijn kleur, lichter, zodat ze opvallen
  const rivalBright = rivalRGBs.map(c => c && c.map(v => Math.min(255, v * 1.25 + 30)));
  // Van wie is elk gebied: een rivaal (zijn nummer), jij (0) of niemand (-1)? Eén keer per gebied uitgezocht
  // in plaats van per tegel: op een grote kaart scheelt dat veel.
  const land = new Int8Array(cn * cn);
  for (let c = 0; c < cn * cn; c++)
    land[c] = ownerAt((c % cn) * CS, Math.floor(c / cn) * CS) || (G.unl[c] ? 0 : -1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x,
        t = node[i],
        bid = bmap[i];
      let r = ground[i * 3],
        g = ground[i * 3 + 1],
        b = ground[i * 3 + 2];
      const nc = t ? NODE_RGB[t] : null;
      if (nc && NODES[t].age <= age) {
        r = nc[0];
        g = nc[1];
        b = nc[2];
      }
      // (hier ligt echt een weg: soort 1, 2 of 3, en die hebben allemaal een kleur)
      if (road[i] && !bid) {
        const c = RC[road[i]]!;
        r = c[0];
        g = c[1];
        b = c[2];
      }
      // Gebouwen: blauw van jou, of in de kleur van een rivaal
      const rb = bid ? rbById.get(bid) : undefined;
      if (rb) {
        // (rivalen hebben de nummers 1, 2 en 3; alleen plek 0 is leeg)
        const c = rivalBright[rb.rival]!;
        r = c[0];
        g = c[1];
        b = c[2];
      } else if (bid) {
        r = 74;
        g = 136;
        b = 232;
      }
      const who = land[(y >> 4) * cn + (x >> 4)];
      if (who > 0 && !rb) {
        // Land van een rivaal: donker, met een flinke tint van zijn kleur
        const c = rivalRGBs[who]!;
        r = r * 0.4 + c[0] * 0.3;
        g = g * 0.4 + c[1] * 0.3;
        b = b * 0.4 + c[2] * 0.3;
      } else if (who < 0 && !rb) {
        // Wildernis: donker
        r *= 0.42;
        g *= 0.45;
        b *= 0.5;
      }
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
  // Alleen het getekende stuk naar het plaatje
  mbctx.putImageData(mimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

export function renderMini() {
  MW = mini.width;
  MH = mini.height;
  if (drawnVersion !== store.mapVersion || drawnAge !== G.age) {
    drawnVersion = store.mapVersion;
    drawnAge = G.age;
    paintMiniBase(0, 0, W - 1, H - 1);
  } else if (todo.x1 >= todo.x0) paintMiniBase(todo.x0, todo.y0, todo.x1, todo.y1);
  todo.x1 = -1; // weer leeg
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, MW, MH);
  mctx.setTransform(...miniXf());
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(mbuf, 0, 0);
  // Stippen (in tegels): k keer zo groot als op de minikaart van een gewone kaart (zie markerScale)
  const k = markerScale();
  // Een vierkantje met midden (x, y) en zijde `size`
  const dot = (x: number, y: number, size: number) =>
    mctx.fillRect(x - (size * k) / 2, y - (size * k) / 2, size * k, size * k);
  for (const c of G.camps)
    if (c.alive) {
      mctx.fillStyle = '#e3584a';
      dot(c.x + 1, c.y + 1, 4);
    }
  if (G.meteor) {
    // Waar de meteoriet gaat inslaan
    mctx.strokeStyle = '#ffb27a';
    mctx.lineWidth = 2 * k;
    mctx.beginPath();
    mctx.arc(G.meteor.x, G.meteor.y, 6 * k, 0, Math.PI * 2);
    mctx.stroke();
  }
  mctx.fillStyle = '#ff5a4a';
  for (const f of G.foes) if (!f.camp && !f.rival) dot(f.x + 0.25, f.y + 0.25, 2.5);
  // Soldaten van rivalen in hun eigen kleur, met een donkere rand zodat je ze ook op hun eigen land ziet
  for (const f of G.foes) {
    if (!f.rival || f.retreat) continue;
    mctx.fillStyle = '#1d1712';
    dot(f.x + 0.25, f.y + 0.25, 3.3);
    // (bestaat de rivaal niet meer, dan is de sleutel leeg: RIVAL geeft dan niets en het wordt wit)
    mctx.fillStyle = RIVAL[rivalById(f.rival)?.k as string]?.c || '#ffffff';
    dot(f.x + 0.25, f.y + 0.25, 2.5);
  }
  // Een kampioen: een grote gouden stip met een donkere rand
  for (const f of G.foes) {
    if (!f.boss || f.retreat) continue;
    mctx.fillStyle = '#1d1712';
    dot(f.x, f.y, 6);
    mctx.fillStyle = '#e2b92c';
    dot(f.x, f.y, 4.4);
  }
  mctx.fillStyle = '#9fd0ff';
  for (const u of G.us) dot(u.x + 0.2, u.y + 0.2, 2);
  const pts = [s2t(0, 0), s2t(VW, 0), s2t(VW, VH), s2t(0, VH)].map(p => [
    clamp(p[0], -20, W + 20),
    clamp(p[1], -20, H + 20),
  ]);
  mctx.strokeStyle = '#f3ead2';
  // Op de grote kaart iets dikker, en scherp op een scherm met veel pixels
  mctx.lineWidth = ((big ? devicePixelRatio * 1.3 : 1) * 2.2) / miniScale();
  mctx.beginPath();
  pts.forEach((p, k) => (k ? mctx.lineTo(p[0], p[1]) : mctx.moveTo(p[0], p[1])));
  mctx.closePath();
  mctx.stroke();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  // Het kompas wijst naar het noorden (de bovenkant van de kaart): in 3D draait het mee met het beeld
  const yaw = viewYaw();
  if (yaw !== needleYaw) {
    needleYaw = yaw;
    needle.style.transform = `rotate(${yaw}rad)`;
  }
}
function miniTo(e: PointerEvent) {
  const r = mini.getBoundingClientRect(),
    X = ((e.clientX - r.left) / r.width) * MW,
    Y = ((e.clientY - r.top) / r.height) * MH;
  // Terugrekenen: eerst het midden eraf, dan de draaiing en de schaal van miniXf ongedaan maken
  const [c, s, , , ox, oy] = miniXf(),
    k2 = c * c + s * s,
    u = X - ox,
    v = Y - oy,
    x = (c * u + s * v) / k2,
    y = (c * v - s * u) / k2;
  centerOn(clamp(x, 0, W), clamp(y, 0, H), true);
}
mini.addEventListener('pointerdown', e => {
  miniTo(e);
  mini.setPointerCapture(e.pointerId);
  mini.onpointermove = ev => {
    if (ev.buttons) miniTo(ev);
  };
});
mini.addEventListener('pointerup', () => {
  if (isCompact()) setTimeout(() => document.body.classList.remove('showmap'), 150);
  // Op de grote kaart: je bent er nu, dus de kaart gaat dicht
  if (big) setBigMap(false);
});

/**
 * Hoe groot de stippen op de kaart zijn (keer hun maat in tegels). Op de minikaart van een gewone kaart 1;
 * op een grotere kaart groeien ze mee, anders worden ze te klein. Op de grote kaart zijn ze op het scherm
 * iets groter dan op de minikaart.
 */
function markerScale(): number {
  if (!big) return Math.max(1, W / 256);
  return (1.3 * W) / Math.max(1, mini.clientWidth);
}

// ---- De grote kaart (op een groot scherm): de minikaart groot in het midden, de rest gedimd ----

const miniBox = $('#miniBox'),
  bigBtn = $('#mapBig'),
  // Zo groot is het canvas van de minikaart in index.html; de grote kaart maakt het tijdelijk groter
  SMALL = mini.width;
let big = false,
  bigLayer: HTMLElement | null = null;

/** Staat de grote kaart open? */
export const bigMapOpen = (): boolean => big;

/** Open of sluit de grote kaart. Een klik op de kaart brengt je erheen en sluit hem; Esc sluit hem ook. */
export function setBigMap(open: boolean): void {
  if (open === big) return;
  big = open;
  if (open) {
    if (!bigLayer) {
      bigLayer = document.createElement('div');
      bigLayer.id = 'bigMap';
      // Klik naast de kaart (op de donkere achtergrond): dicht
      bigLayer.addEventListener('pointerdown', e => {
        if (e.target === bigLayer) setBigMap(false);
      });
      document.body.appendChild(bigLayer);
    }
    // Dezelfde kaart met dezelfde knoppen (2D/3D, kompas, draaien) verhuist naar het midden
    bigLayer.appendChild(miniBox);
  } else $('#mapPanel').prepend(miniBox);
  document.body.classList.toggle('bigmap', open);
  bigBtn.setAttribute('aria-pressed', String(open));
  bigBtn.title = open ? 'Kaart kleiner (Esc)' : 'Grote kaart';
  bigBtn.setAttribute('aria-label', bigBtn.title);
  fitMini();
  renderMini();
}

// Het canvas krijgt zoveel pixels als het groot is op het scherm (maal de pixeldichtheid): dan blijft
// de grote kaart scherp. De minikaart houdt haar vaste maat.
function fitMini() {
  const size = big ? Math.round(mini.clientWidth * Math.min(2, devicePixelRatio || 1)) : SMALL;
  if (mini.width !== size) mini.width = mini.height = size;
}

bigBtn.onclick = () => setBigMap(!big);
addEventListener('resize', () => {
  if (!big) return;
  // Wordt het scherm klein (telefoon), dan is er de knop Kaart: de grote kaart gaat dicht
  if (isCompact()) setBigMap(false);
  else {
    fitMini();
    renderMini();
  }
});
