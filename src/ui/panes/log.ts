import type { LogEntry } from '../../types';
// Paneel "Logboek" met voorraadgrafiek.
import { sfx } from '../../audio/sound';
import { RES, RKEYS } from '../../data/resources';
import { G } from '../../game/state';
import { centerOn } from '../../render/camera';
import { renderEvent, renderOffer } from '../event';
import { esc, fmt } from '../format';
import { setHTML } from '../header';
import { $ } from '../../util/dom';

/** Welke grondstoffen in de grafiek staan: voedsel, hout, steen en wat nieuw is in dit tijdperk (max. 5). */
export const chartKeys = (age: number): string[] =>
  ['food', 'wood', 'stone', ...RKEYS.filter(k => RES[k].age === age && !RES[k].cr)].slice(0, 5);

/**
 * Teken de voorraadgrafiek op een canvas: één lijn per grondstof.
 * `hist` is G.hist: elke 10 seconden de hele voorraad (in de volgorde van RKEYS).
 */
export function drawChart(c: HTMLCanvasElement, hist: number[][], keys: string[]) {
  const x = c.getContext('2d')!,
    Wc = c.width,
    Hc = c.height;
  x.clearRect(0, 0, Wc, Hc);
  let mx = 1;
  for (const h of hist) for (const k of keys) mx = Math.max(mx, h[RKEYS.indexOf(k)]);
  x.strokeStyle = 'rgba(43,37,32,.1)';
  x.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    x.beginPath();
    x.moveTo(0, (Hc * i) / 4);
    x.lineTo(Wc, (Hc * i) / 4);
    x.stroke();
  }
  for (const k of keys) {
    const ki = RKEYS.indexOf(k);
    x.strokeStyle = RES[k].c;
    x.lineWidth = 2;
    x.beginPath();
    hist.forEach((h, i) => {
      const px = (i / Math.max(59, hist.length - 1)) * Wc,
        py = Hc - (h[ki] / mx) * (Hc - 6) - 3;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    });
    x.stroke();
  }
  x.fillStyle = 'rgba(43,37,32,.6)';
  x.font = '10px "IBM Plex Mono",monospace';
  x.textAlign = 'right';
  x.fillText(fmt(mx), Wc - 3, 10);
}

export function renderChart() {
  const c = $<HTMLCanvasElement>('#chart');
  if (!c || !G.hist.length || !document.querySelector('.pane[data-pane="log"]')!.classList.contains('on'))
    return;
  drawChart(c, G.hist, chartKeys(G.age));
}
function logItem(l: LogEntry): string {
  const j = l.x != null;
  return `<div class="e ${l.k}${j ? ' jump' : ''}" ${j ? `data-jx="${l.x}" data-jy="${l.y}" title="Klik om ernaartoe te gaan"` : ''}><span>DAG ${l.d}</span>${esc(l.t)}${j ? ' <i class="go">➜</i>' : ''}</div>`;
}
export function renderLog() {
  const sig = G.log.length + '|' + (G.log[0] && G.log[0].t);
  setHTML($('#log'), 'log', sig, () => G.log.slice(0, 14).map(logItem).join(''));
  const fs = 'f' + G.log.length + '|' + (G.log[0] && G.log[0].t);
  setHTML($('#feed'), 'feed', fs, () => G.log.slice(1, 4).map(logItem).join(''));
  renderOffer();
  renderEvent();
  renderChart();
}
for (const id of ['#log', '#feed'])
  $(id).addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('.jump');
    if (t) {
      centerOn(+t.dataset.jx!, +t.dataset.jy!);
      sfx('tick');
    }
  });
