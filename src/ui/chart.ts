import { $ } from '../core/dom';
import { fmt } from '../core/util';
import { RES, RKEYS } from '../data/resources';
import { G } from '../sim/state';

export function renderChart() {
    const c = $<HTMLCanvasElement>('#chart');
    if (!c || !G.hist.length || !document.querySelector('.pane[data-pane="log"]')!.classList.contains('on'))
        return;
    const x = c.getContext('2d')!, Wc = c.width, Hc = c.height;
    x.clearRect(0, 0, Wc, Hc);
    const keys = ['food', 'wood', 'stone', ...RKEYS.filter(k => RES[k].age === G.age && !RES[k].cr)].slice(0, 5), H2 = G.hist;
    let mx = 1;
    for (const h of H2)
        for (const k of keys)
            mx = Math.max(mx, h[RKEYS.indexOf(k)]);
    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        x.beginPath();
        x.moveTo(0, Hc * i / 4);
        x.lineTo(Wc, Hc * i / 4);
        x.stroke();
    }
    for (const k of keys) {
        const ki = RKEYS.indexOf(k);
        x.strokeStyle = RES[k].c;
        x.lineWidth = 2;
        x.beginPath();
        H2.forEach((h, i) => {
            const px = i / (Math.max(59, H2.length - 1)) * Wc, py = Hc - h[ki] / mx * (Hc - 6) - 3;
            i ? x.lineTo(px, py) : x.moveTo(px, py);
        });
        x.stroke();
    }
    x.fillStyle = 'rgba(236,230,216,.6)';
    x.font = '10px "IBM Plex Mono",monospace';
    x.textAlign = 'right';
    x.fillText(fmt(mx), Wc - 3, 10);
}
