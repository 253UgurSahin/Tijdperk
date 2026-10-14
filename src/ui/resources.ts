import { sfx } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $, compact } from '../core/dom';
import { clamp, fmt } from '../core/util';
import { AGE_UP } from '../data/ages';
import { B, BKEYS } from '../data/buildings';
import { GATHER, RES, RKEYS } from '../data/resources';
import { mouse } from '../input/pointer';
import { VH, VW, worldEl } from '../render/scene';
import { demand, wr } from '../sim/caches';
import { G } from '../sim/state';
import { gem, setHTML } from './fmt';
import { ui } from './state';

// resource tooltips
$('#resbar').addEventListener('pointerover', e => {
    const r = (e.target as HTMLElement).closest<HTMLElement>('.res');
    if (!r || mouse.touch)
        return;
    const k = r.dataset.k!, tip = $('#hovertip'), rr = r.getBoundingClientRect(), w = worldEl.getBoundingClientRect();
    const users = BKEYS.filter(b => {
        const d = B[b];
        const inp = d.conv ? d.conv.in : d.gen && d.gen.in;
        return inp && inp[k] && G.bs.some(x => x.type === b && x.done);
    }).map(b => B[b].n), makers = BKEYS.filter(b => B[b].conv && B[b].conv.out[k]).map(b => B[b].n), rt = rate[k] || 0;
    tip.className = '';
    tip.innerHTML = `<b>${RES[k].n}</b><span>${fmt(G.res[k])} op voorraad · ${rt >= 0 ? '+' : '−'}${Math.abs(Math.round(rt))} per minuut</span>${GATHER.includes(k) ? `<span>${wr[k] || 0} dorpelingen verzamelen</span>` : ''}${makers.length ? `<span>Gemaakt in: ${makers.join(', ')}</span>` : ''}${users.length ? `<span>Verbruikt door: ${users.join(', ')}</span>` : ''}`;
    tip.hidden = false;
    tip.dataset.res = '1';
    tip.style.left = clamp(rr.right - w.left + 8, 8, VW - 280) + 'px';
    tip.style.top = clamp(rr.top - w.top, 8, VH - 120) + 'px';
});
$('#resbar').addEventListener('pointerout', e => {
    if (!e.relatedTarget || !(e.relatedTarget as Element).closest || !(e.relatedTarget as Element).closest('.res')) {
        const t = $('#hovertip');
        delete t.dataset.res;
        t.hidden = true;
    }
});
// resources (bottom-left)
export const rate: Record<string, number> = {};
let rateSnap: { t: number; r: Record<string, number> } | null = null, rateT = 0;
export let resMax = 5;
function relevantRes() {
    const out: string[] = [], add = (k: string) => {
        if (k && RES[k] && RES[k].age <= G.age && !out.includes(k))
            out.push(k);
    };
    if (ui.placing)
        for (const k in B[ui.placing].cost)
            add(k);
    const nx = AGE_UP[G.age + 1];
    if (nx)
        for (const k in nx.cost)
            add(k);
    ['food', 'wood', 'stone'].forEach(add);
    for (const k in demand)
        add(k);
    for (const b of G.bs) {
        const d = B[b.type];
        if (b.done && d.conv)
            for (const k in d.conv.out)
                add(k);
    }
    RKEYS.filter(k => RES[k].age === G.age).forEach(add);
    return out;
}
const resItem = (k: string): string => `<div class="res" data-k="${k}">${gem(k)}<div><b>${fmt(G.res[k])}</b><small>${RES[k].n}</small><em></em></div><span class="wk zero" title="${GATHER.includes(k) ? 'Dorpelingen op deze grondstof' : 'Gebouwen die dit maken'}"></span></div>`;
export function buildResBar(force?: boolean) {
    const all = relevantRes(), lim = innerWidth <= 620 ? 3 : compact() ? 4 : 5, max = Math.min(resMax, lim), keys = all.slice(0, max).sort((a, b) => RKEYS.indexOf(a) - RKEYS.indexOf(b)), rest = RKEYS.filter(k => RES[k].age <= G.age).length - keys.length;
    const sig = keys.join() + '|' + rest;
    if (!force && sigs.resbar === sig)
        return;
    sigs.resbar = sig;
    $('#resbar').innerHTML = keys.map(resItem).join('') + (rest > 0 ? `<button class="quiet" id="resMore" aria-expanded="${!$('#resPop').hidden}">+${rest} meer</button>` : '');
    updateResPop();
}
export function updateResPop() {
    const p = $('#resPop');
    if (p.hidden)
        return;
    const ks = RKEYS.filter(k => RES[k].age <= G.age);
    setHTML(p, 'respop', ks.join(), () => ks.map(resItem).join(''));
}
$('#resbar').addEventListener('click', e => {
    const m = (e.target as HTMLElement).closest('#resMore');
    if (m) {
        sfx('tick');
        const p = $('#resPop');
        p.hidden = !p.hidden;
        sigs.respop = null;
        updateResPop();
        m.setAttribute('aria-expanded', String(!p.hidden));
        bus.uiDirty = true;
    }
});
addEventListener('pointerdown', e => {
    const p = $('#resPop');
    if (!p.hidden && !(e.target as HTMLElement).closest('#resPop,#resMore'))
        p.hidden = true;
    if (document.body.classList.contains('showmap') && !(e.target as HTMLElement).closest('#mapPanel,#modal'))
        document.body.classList.remove('showmap');
}, true);
addEventListener('resize', () => {
    resMax = 5;
    sigs.resbar = null;
});
export function updateRates(rdt: number) {
    rateT -= rdt;
    if (rateT <= 0) {
        rateT = 5;
        if (rateSnap) {
            const gt = G.t - rateSnap.t;
            if (gt > 0)
                for (const k of RKEYS) {
                    const r = (G.res[k] - rateSnap.r[k]) / gt * 60;
                    rate[k] = rate[k] === undefined ? r : rate[k] * .6 + r * .4;
                }
        }
        rateSnap = { t: G.t, r: { ...G.res } };
    }
}
export function setResMax(v: number) {
    resMax = v;
    return v;
}
