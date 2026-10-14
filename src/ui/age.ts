import { sfx } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $ } from '../core/dom';
import { AGES, AGE_UP } from '../data/ages';
import { B, ROADS } from '../data/buildings';
import { RES, RKEYS } from '../data/resources';
import { computeAvail } from '../sim/caches';
import { CHAPTERS } from '../sim/chapters';
import { popNow } from '../sim/entities';
import { built, canUpg, has, pay, roadTier } from '../sim/rules';
import { G } from '../sim/state';
import { toast } from './hud';
import { buildResBar } from './resources';

export let curAge = -1;
// age up
export function ageUp() {
    const nx = AGE_UP[G.age + 1];
    if (!nx || !has(nx.cost) || popNow() < nx.pop || !nx.need.every(built))
        return;
    pay(nx.cost);
    G.age++;
    const b = $('#banner');
    b.innerHTML = `<div class="in"><div class="eyebrow">Hoofdstuk ${AGES[G.age].r}</div><div class="t">${AGES[G.age].n}</div><div class="y">${AGES[G.age].y} · ${CHAPTERS[G.age].t}</div></div>`;
    b.hidden = false;
    setTimeout(() => b.hidden = true, 4500);
    const nr = RKEYS.filter(k => RES[k].age === G.age && !RES[k].cr).map(k => RES[k].n.toLowerCase());
    sfx('age');
    const nu = G.bs.filter(canUpg).length;
    toast(`De ${AGES[G.age].n.toLowerCase()} breekt aan. Ontdekt: ${nr.join(' en ')}. Nieuwe verbeteringen: werktuigen, wapens${nu ? ` en ${nu} gebouwen` : ''}.`, 'age');
    computeAvail();
    onAgeChange();
    setTimeout(() => document.querySelectorAll<HTMLElement>('#resbar .res').forEach(el => {
        if (RES[el.dataset.k!].age === G.age) {
            el.classList.add('new');
            setTimeout(() => el.classList.remove('new'), 3000);
        }
    }), 60);
}
export function onAgeChange() {
    curAge = G.age;
    document.body.dataset.age = String(G.age);
    const A = AGES[G.age];
    B.road.n = ROADS[roadTier()].n;
    B.road.cost = ROADS[roadTier()].cost;
    $('#locEyebrow').textContent = A.n;
    $('#ageNum').textContent = A.r;
    buildResBar(true);
    sigs.cats = null;
    sigs.grid = null;
    sigs.ins = null;
    bus.uiDirty = true;
}
