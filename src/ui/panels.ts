import { sfx } from '../audio/sound';
import { $, compact } from '../core/dom';
import { B } from '../data/buildings';
import { G } from '../sim/state';
import { renderChart } from './chart';
import { measureHud } from './layout';

// floating panel (Volk / Leger / Onderzoek / Logboek)
let ptab: string | null = null;
const PT: Record<string, string> = { pop: 'Volk', def: 'Leger', upg: 'Onderzoek', log: 'Logboek' };
function setPane(k: string | null) {
    ptab = k;
    $('#panel').hidden = !k;
    document.body.classList.toggle('panelopen', !!k);
    document.querySelectorAll<HTMLElement>('#sidebtns button').forEach(b => b.classList.toggle('on', b.dataset.p === k));
    document.querySelectorAll<HTMLElement>('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === k));
    if (k)
        $('#panelTitle').textContent = PT[k];
    renderChart();
}
$('#sidebtns').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (b) {
        sfx('tick');
        setPane(ptab === b.dataset.p && !compact() ? null : b.dataset.p!);
    }
});
$('#panelClose').onclick = () => {
    sfx('tick');
    setPane(null);
};
export function updateTabs() {
    const vis: Record<string, number | boolean> = { pop: 1, def: G.us.length || G.raids > 0 || G.bs.some(b => b.type === 'barracks' || (B[b.type].def && b.type !== 'townhall')) || G.foes.some(f => !f.camp), upg: G.age >= 1 || G.day >= 3 || Object.keys(G.tech).length, log: G.day >= 2 };
    document.querySelectorAll<HTMLElement>('#sidebtns button').forEach(b => {
        b.hidden = !vis[b.dataset.p!];
    });
    if (ptab && !vis[ptab])
        setPane(null);
    const s4 = document.querySelector<HTMLElement>('#speed [data-s="4"]')!;
    s4.hidden = !(G.age >= 1 || G.day >= 3 || G.speed === 4);
}
export function togglePanel(side?: string) {
    if (side === undefined) {
        setPane(null);
        document.body.classList.remove('showmap');
        return;
    }
    if (side === 'left')
        setPane(ptab ? null : 'pop');
    else if (side === 'goal') {
        document.body.classList.toggle('showgoal');
        measureHud();
    }
    else
        document.body.classList.toggle('showmap');
}
