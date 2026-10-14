import { CN, H, W } from '../core/constants';
import { $, compact } from '../core/dom';
import { clamp } from '../core/util';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { V2, centerOn, s2t } from '../render/camera';
import { VH, VW } from '../render/scene';
import { RC, tileRGB } from '../render/terrain';
import { G } from '../sim/state';
import { bmap, node, road } from '../sim/world';

// ---- minimap (rotated like the camera) ----
const mini = $<HTMLCanvasElement>('#mini'), mctx = mini.getContext('2d')!, mbuf = document.createElement('canvas');
mbuf.width = W;
mbuf.height = H;
const mbctx = mbuf.getContext('2d')!, mimg = mbctx.createImageData(W, H);
let MW = 200, MH = 200;
function miniXf(): [number, number, number, number, number, number] {
    const k = MW / (2 * W);
    return V2 ? [MW / W, 0, 0, MH / H, 0, 0] : [k, k, -k, k, MW / 2, 0];
}
export function renderMini() {
    MW = mini.width;
    MH = mini.height;
    const d = mimg.data;
    for (let i = 0; i < W * H; i++) {
        const x = i % W, y = (i / W) | 0;
        let [r, g, b] = tileRGB(x, y);
        const n = node[i];
        if (n && NODES[n].age <= G.age) {
            const k = NODES[n].k;
            if (k === 'tree') {
                r = 56;
                g = 96;
                b = 50;
            }
            else if (k === 'rock') {
                r = 150;
                g = 152;
                b = 144;
            }
            else if (k !== 'sand' && k !== 'bush') {
                const c = RES[NODES[n].res].c;
                r = parseInt(c.slice(1, 3), 16);
                g = parseInt(c.slice(3, 5), 16);
                b = parseInt(c.slice(5, 7), 16);
            }
        }
        if (road[i] && !bmap[i]) {
            const c = RC[road[i]]!;
            r = c[0];
            g = c[1];
            b = c[2];
        }
        if (bmap[i]) {
            r = 74;
            g = 136;
            b = 232;
        }
        if (!G.unl[(y >> 4) * CN + (x >> 4)]) {
            r *= .42;
            g *= .45;
            b *= .5;
        }
        d[i * 4] = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = b;
        d[i * 4 + 3] = 255;
    }
    mbctx.putImageData(mimg, 0, 0);
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
    mctx.fillStyle = '#ff5a4a';
    for (const f of G.foes)
        if (!f.camp)
            mctx.fillRect(f.x - 1, f.y - 1, 2.5, 2.5);
    mctx.fillStyle = '#9fd0ff';
    for (const u of G.us)
        mctx.fillRect(u.x - .8, u.y - .8, 2, 2);
    const pts = [s2t(0, 0), s2t(VW, 0), s2t(VW, VH), s2t(0, VH)].map(p => [clamp(p[0], -20, W + 20), clamp(p[1], -20, H + 20)]);
    mctx.strokeStyle = '#f3ead2';
    mctx.lineWidth = 1.6 / (MW / (2 * W));
    mctx.beginPath();
    pts.forEach((p, k) => k ? mctx.lineTo(p[0], p[1]) : mctx.moveTo(p[0], p[1]));
    mctx.closePath();
    mctx.stroke();
    mctx.setTransform(1, 0, 0, 1, 0, 0);
}
function miniTo(e: PointerEvent) {
    const r = mini.getBoundingClientRect(), X = (e.clientX - r.left) / r.width * MW, Y = (e.clientY - r.top) / r.height * MH;
    let x: number, y: number;
    if (V2) {
        x = X / (MW / W);
        y = Y / (MH / H);
    }
    else {
        const k = MW / (2 * W), u = X - MW / 2;
        x = (u / k + Y / k) / 2;
        y = (Y / k - u / k) / 2;
    }
    centerOn(clamp(x, 0, W), clamp(y, 0, H), true);
}
mini.addEventListener('pointerdown', e => {
    miniTo(e);
    mini.setPointerCapture(e.pointerId);
    mini.onpointermove = ev => {
        if (ev.buttons)
            miniTo(ev);
    };
});
mini.addEventListener('pointerup', () => {
    if (compact())
        setTimeout(() => document.body.classList.remove('showmap'), 150);
});
