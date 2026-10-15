// De minikaart rechtsonder.
import { store } from '../core/store';
import { CN, H, W } from '../config';
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
  mctx = mini.getContext('2d')!,
  mbuf = document.createElement('canvas');
mbuf.width = W;
mbuf.height = H;
const mbctx = mbuf.getContext('2d')!,
  mimg = mbctx.createImageData(W, H);
let MW: number = 200,
  MH: number = 200;
/** De zes getallen voor setTransform: van kaarttegels naar pixels op de minikaart. */
type Transform2D = [number, number, number, number, number, number];
function miniXf(): Transform2D {
  const k = MW / (2 * W);
  return store.V2 ? [MW / W, 0, 0, MH / H, 0, 0] : [k, k, -k, k, MW / 2, 0];
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

// De kaartafbeelding zelf wordt alleen opnieuw gemaakt als de wereld veranderd is
// (store.mapVersion telt op bij nieuwe gebouwen, wegen, bronnen of gebied); anders tekenen we alleen de stippen.
let drawnVersion = -1,
  drawnAge = -1;
// Kleur (r, g, b) van een rivaal op nummer, voor zijn land en gebouwen
function rivalRGB(id: number): [number, number, number] {
  const r = rivalById(id);
  return r ? hex(RIVAL[r.k].c) : [200, 200, 200];
}
function paintMiniBase() {
  const d = mimg.data;
  const rivalRGBs = [null, rivalRGB(1), rivalRGB(2), rivalRGB(3)];
  for (let i = 0; i < W * H; i++) {
    const x = i % W,
      y = (i / W) | 0,
      n = node[i];
    let r = ground[i * 3],
      g = ground[i * 3 + 1],
      b = ground[i * 3 + 2];
    const nc = n && NODES[n].age <= G.age && NODE_RGB[n];
    if (nc) [r, g, b] = nc;
    // (hier ligt echt een weg: soort 1, 2 of 3, en die hebben allemaal een kleur)
    if (road[i] && !bmap[i]) [r, g, b] = RC[road[i]]!;
    // Gebouwen: blauw van jou, of in de kleur van een rivaal (licht, zodat ze opvallen)
    const rb = bmap[i] && rbById.get(bmap[i]);
    // (rivalen hebben de nummers 1, 2 en 3; alleen plek 0 is leeg)
    if (rb) [r, g, b] = rivalRGBs[rb.rival]!.map(c => Math.min(255, c * 1.25 + 30));
    else if (bmap[i]) [r, g, b] = [74, 136, 232];
    const owner = ownerAt(x, y);
    if (owner && !rb) {
      // Land van een rivaal: donker, met een flinke tint van zijn kleur
      const c = rivalRGBs[owner]!;
      r = r * 0.4 + c[0] * 0.3;
      g = g * 0.4 + c[1] * 0.3;
      b = b * 0.4 + c[2] * 0.3;
    } else if (!G.unl[(y >> 4) * CN + (x >> 4)] && !rb) {
      r *= 0.42;
      g *= 0.45;
      b *= 0.5;
    }
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  mbctx.putImageData(mimg, 0, 0);
}

export function renderMini() {
  MW = mini.width;
  MH = mini.height;
  if (drawnVersion !== store.mapVersion || drawnAge !== G.age) {
    drawnVersion = store.mapVersion;
    drawnAge = G.age;
    paintMiniBase();
  }
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, MW, MH);
  mctx.setTransform(...miniXf());
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(mbuf, 0, 0);
  for (const c of G.camps)
    if (c.alive) {
      mctx.fillStyle = '#e3584a';
      mctx.fillRect(c.x - 1, c.y - 1, 4, 4);
    }
  if (G.meteor) {
    // Waar de meteoriet gaat inslaan
    mctx.strokeStyle = '#ffb27a';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(G.meteor.x, G.meteor.y, 6, 0, Math.PI * 2);
    mctx.stroke();
  }
  mctx.fillStyle = '#ff5a4a';
  for (const f of G.foes) if (!f.camp && !f.rival) mctx.fillRect(f.x - 1, f.y - 1, 2.5, 2.5);
  // Soldaten van rivalen in hun eigen kleur, met een donkere rand zodat je ze ook op hun eigen land ziet
  for (const f of G.foes) {
    if (!f.rival || f.retreat) continue;
    mctx.fillStyle = '#1d1712';
    mctx.fillRect(f.x - 1.4, f.y - 1.4, 3.3, 3.3);
    // (bestaat de rivaal niet meer, dan is de sleutel leeg: RIVAL geeft dan niets en het wordt wit)
    mctx.fillStyle = RIVAL[rivalById(f.rival)?.k as string]?.c || '#ffffff';
    mctx.fillRect(f.x - 1, f.y - 1, 2.5, 2.5);
  }
  mctx.fillStyle = '#9fd0ff';
  for (const u of G.us) mctx.fillRect(u.x - 0.8, u.y - 0.8, 2, 2);
  const pts = [s2t(0, 0), s2t(VW, 0), s2t(VW, VH), s2t(0, VH)].map(p => [
    clamp(p[0], -20, W + 20),
    clamp(p[1], -20, H + 20),
  ]);
  mctx.strokeStyle = '#f3ead2';
  mctx.lineWidth = 1.6 / (MW / (2 * W));
  mctx.beginPath();
  pts.forEach((p, k) => (k ? mctx.lineTo(p[0], p[1]) : mctx.moveTo(p[0], p[1])));
  mctx.closePath();
  mctx.stroke();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
}
function miniTo(e: PointerEvent) {
  const r = mini.getBoundingClientRect(),
    X = ((e.clientX - r.left) / r.width) * MW,
    Y = ((e.clientY - r.top) / r.height) * MH;
  let x: number, y: number;
  if (store.V2) {
    x = X / (MW / W);
    y = Y / (MH / H);
  } else {
    const k = MW / (2 * W),
      u = X - MW / 2;
    x = (u / k + Y / k) / 2;
    y = (Y / k - u / k) / 2;
  }
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
});
