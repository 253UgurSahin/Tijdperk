import type { LogEntry } from '../types';
import { sfx } from '../audio/sound';
import { $ } from '../core/dom';
import { esc } from '../core/util';
import { centerOn } from '../render/camera';
import { G } from '../sim/state';
import { renderChart } from './chart';
import { setHTML } from './fmt';
import { renderEvent, renderOffer } from './notices';

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
