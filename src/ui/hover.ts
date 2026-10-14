import { W } from '../core/constants';
import { $ } from '../core/dom';
import { clamp, esc, fmt } from '../core/util';
import { B } from '../data/buildings';
import { NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { FOES, UNITS } from '../data/units';
import { CUR } from '../input/cursors';
import { ghostPos } from '../input/placement';
import { drag, mouse } from '../input/pointer';
import { bAtScreen, campAt, foeAt, unitAt, villAt } from '../input/selection';
import { VH, VW, cv } from '../render/scene';
import { canPlace } from '../sim/placement';
import { sel } from '../sim/state';
import { amt, inb, isUnl, node, nodeVis } from '../sim/world';
import { bShort } from './commands';
import { ui } from './state';

// hover tooltip
export function updateHover() {
    const tip = $('#hovertip');
    if (!(drag && drag.mode === 'pan')) {
        if (ui.placing)
            cv.style.cursor = CUR.build;
        else if (ui.demoMode)
            cv.style.cursor = CUR.demo;
        else if (ui.cmdMode)
            cv.style.cursor = CUR.atk;
    }
    if (ui.placing && mouse.in && !mouse.touch && !(drag && drag.mode === 'pan')) {
        const [gx, gy] = ghostPos(), err = canPlace(ui.placing, gx, gy);
        tip.className = err ? 'bad' : 'ok';
        tip.innerHTML = err ? `<b>${err}</b>` : `<b>${B[ui.placing].n}</b><span>Klik om te bouwen</span>`;
        tip.hidden = false;
        const r = tip.getBoundingClientRect();
        tip.style.left = clamp(mouse.sx + 18, 8, VW - r.width - 8) + 'px';
        tip.style.top = clamp(mouse.sy + 20, 8, VH - r.height - 8) + 'px';
        return;
    }
    if (tip.className)
        tip.className = '';
    if (!mouse.in || drag || mouse.touch || ui.placing || ui.expandMode || ui.demoMode || ui.cmdMode) {
        if (!tip.dataset.res)
            tip.hidden = true;
        return;
    }
    if (!mouse.moved)
        return;
    mouse.moved = false;
    const X = mouse.X, Y = mouse.Y, ix = Math.floor(mouse.tx), iy = Math.floor(mouse.ty);
    let h: string | null = null;
    const f = foeAt(X, Y), u = unitAt(X, Y), v = villAt(X, Y), c = campAt(X, Y), b = bAtScreen(X, Y);
    cv.style.cursor = sel.us.size && (f || c) ? CUR.atk : (u || v || b || c) ? CUR.hand : CUR.def;
    if (f)
        h = `<b>${FOES[f.type].n.replace(/en$|s$/, '')}</b><span>Vijand · ${Math.ceil(f.hp)} levenspunten</span>`;
    else if (u)
        h = `<b>${UNITS[u.k].n}</b><span>${Math.ceil(u.hp)}/${Math.round(u.mhp)} leven · ${u.tgt ? 'in gevecht' : 'paraat'}</span>`;
    else if (v)
        h = `<b>${esc(v.name)}</b><span>${v.job === 'auto' ? 'Automatisch' : v.job === 'build' ? 'Bouwer' : RES[v.job].n}${v.carry.amt ? ` · draagt ${v.carry.amt}` : ''}</span>`;
    else if (c)
        h = `<b>Vijandelijk kamp</b><span>Niveau ${c.tier + 1} · klik om te bekijken</span>`;
    else if (b) {
        const d = B[b.type];
        h = `<b>${d.n}</b><span>${b.done ? bShort(b.type) : 'In aanbouw · ' + Math.floor(b.prog / b.bt * 100) + '%'}</span>`;
    }
    else if (inb(ix, iy)) {
        const i = iy * W + ix;
        if (nodeVis(i)) {
            const N = NODES[node[i]];
            h = `<b>${N.n}</b><span>${fmt(amt[i])} ${RES[N.res].n.toLowerCase()}${isUnl(ix, iy) ? '' : ' · buiten je land'}</span>`;
        }
        else if (!isUnl(ix, iy))
            h = `<b>Onontgonnen land</b><span>Breid je gebied uit om hier te bouwen</span>`;
    }
    if (!h) {
        tip.hidden = true;
        return;
    }
    tip.innerHTML = h;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = clamp(mouse.sx + 16, 8, VW - r.width - 8) + 'px';
    tip.style.top = clamp(mouse.sy + 18, 8, VH - r.height - 60) + 'px';
}
