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

const mini = $('#mini'),
  mctx = mini.getContext('2d'),
  mbuf = document.createElement('canvas');
mbuf.width = W;
mbuf.height = H;
const mbctx = mbuf.getContext('2d'),
  mimg = mbctx.createImageData(W, H);
let MW = 200,
  MH = 200;
function miniXf() {
  const k = MW / (2 * W);
  return store.V2 ? [MW / W, 0, 0, MH / H, 0, 0] : [k, k, -k, k, MW / 2, 0];
}
// Vaste kleuren voor bronnen op de minikaart (één keer uitgerekend)
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
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
function paintMiniBase() {
  const d = mimg.data;
  for (let i = 0; i < W * H; i++) {
    const x = i % W,
      y = (i / W) | 0,
      n = node[i];
    let r = ground[i * 3],
      g = ground[i * 3 + 1],
      b = ground[i * 3 + 2];
    const nc = n && NODES[n].age <= G.age && NODE_RGB[n];
    if (nc) [r, g, b] = nc;
    if (road[i] && !bmap[i]) [r, g, b] = RC[road[i]];
    if (bmap[i]) [r, g, b] = [74, 136, 232];
    if (!G.unl[(y >> 4) * CN + (x >> 4)]) {
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
  for (const f of G.foes) if (!f.camp) mctx.fillRect(f.x - 1, f.y - 1, 2.5, 2.5);
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
  let x, y;
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
