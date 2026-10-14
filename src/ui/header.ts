import { sigs } from '../core/bus';
import { TAU } from '../core/constants';
import { $, compact, TOUCH } from '../core/dom';
import { fmt } from '../core/util';
import { B } from '../data/buildings';
import { GATHER } from '../data/resources';
import { TECH } from '../data/tech';
import { powerDem, powerSup, wr } from '../sim/caches';
import { popCap, popNow } from '../sim/entities';
import { chunkCost } from '../sim/expand';
import { lackText } from '../sim/placement';
import { armsCost, canUpg, has, hasT, toolCost, upgCost } from '../sim/rules';
import { G, sel } from '../sim/state';
import { isNight, raidNight, season } from '../sim/time';
import { coach, coachAct, coachTile, setCoachAct, setCoachTile } from './coach';
import { costText } from './commands';
import { renderQuick } from './hud';
import { updateTabs } from './panels';
import { buildResBar, rate, resMax, setResMax, updateResPop } from './resources';
import { ui } from './state';

export function updateHeader() {
    buildResBar();
    updateResPop();
    const rb = $('#resbar');
    if (rb.scrollHeight > rb.clientHeight + 2 && resMax > 2 && !compact()) {
        setResMax(resMax - 1);
        sigs.resbar = null;
        buildResBar();
    }
    if (compact() && rb.scrollWidth > rb.clientWidth + 2 && resMax > 2) {
        setResMax(resMax - 1);
        sigs.resbar = null;
        buildResBar();
    }
    const prod: Record<string, number> = {};
    for (const b of G.bs) {
        const d = B[b.type];
        if (b.done && b.on && d.conv)
            for (const k in d.conv.out)
                prod[k] = (prod[k] || 0) + 1;
        if (b.done && d.pump)
            prod[d.pump.res] = (prod[d.pump.res] || 0) + 1;
    }
    for (const el of document.querySelectorAll<HTMLElement>('#resbar .res,#resPop .res')) {
        const k = el.dataset.k!;
        el.querySelector('b')!.textContent = fmt(G.res[k]);
        const r = rate[k], em = el.querySelector('em')!;
        if (r !== undefined && Math.abs(r) >= 1) {
            em.textContent = (r > 0 ? '+' : '−') + Math.abs(Math.round(r)) + '/m';
            em.className = r > 0 ? '' : 'down';
        }
        else
            em.textContent = '';
        const wk = el.querySelector('.wk');
        if (wk) {
            const n = GATHER.includes(k) ? (wr[k] || 0) : (prod[k] || 0), t = (GATHER.includes(k) ? '☺ ' : '⚙ ') + n;
            if (wk.textContent !== t)
                wk.textContent = t;
            wk.classList.toggle('zero', !n);
        }
    }
    const cap = popCap(), pn = popNow();
    $('#popStat b').textContent = `${pn}/${cap}`;
    $('#popStat').classList.toggle('bad', pn >= cap && G.bs.some(b => b.type !== 'townhall' && B[b.type].pop && b.done));
    updateTabs();
    const ps = $('#powStat');
    ps.hidden = G.age < 3;
    if (!ps.hidden) {
        $('#powStat b').textContent = `${Math.round(powerSup)}/${powerDem}`;
        ps.classList.toggle('bad', powerDem > powerSup);
    }
}
export function updateWorldTop() {
    const h = Math.floor(G.clock), m = Math.floor((G.clock - h) * 6) * 10, part = G.clock < 6 ? 'nacht' : G.clock < 12 ? 'ochtend' : G.clock < 18 ? 'middag' : G.clock < 21 ? 'avond' : 'nacht';
    {
        const dt = `Dag ${G.day} · ${season().n}${G.rain ? ' ☂' : ''}`;
        const el = $('#dayTxt');
        if (el.textContent !== dt)
            el.textContent = dt;
    }
    const raidNow = G.foes.some(f => !f.camp && !f.retreat), t = $('#timeTxt');
    if (raidNow) {
        t.textContent = 'Aanval gaande';
        t.className = 'raid';
    }
    else {
        t.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${part}`;
        t.className = '';
    }
    drawDial($('#dial'), 68);
    const C = coach();
    setCoachAct(C.act || null);
    const prevTile = coachTile;
    setCoachTile(C.tile || null);
    if (prevTile !== coachTile) {
        sigs.cats = null;
        sigs.grid = null;
    }
    if ($('#modeTxt').textContent !== C.t)
        $('#modeTxt').textContent = C.t;
    if ($('#modeHint').textContent !== C.h)
        $('#modeHint').textContent = C.h;
    $('#step').classList.toggle('alarm', C.t === 'Aanval!');
    {
        const cb = $('#coachBtn'), al = coachAct ? coachAct.l : '';
        cb.hidden = !al || !!ui.placing;
        if (cb.textContent !== al)
            cb.textContent = al;
    }
    let txt = '', hint = '', cls = '';
    if (ui.placing) {
        const d = B[ui.placing];
        txt = `${d.n} plaatsen`;
        hint = (has(d.cost) ? `Kost ${costText(d.cost)}. ` : `Nog ${lackText(d.cost)} nodig. `) + (d.wall || d.road ? (TOUCH ? 'Tik op een vrij veld.' : 'Klik of sleep een lijn.') : (TOUCH ? 'Tik op een vrije plek.' : 'Klik op een groen veld. Bomen en stenen worden opgeruimd.'));
    }
    else if (ui.expandMode) {
        txt = 'Gebied uitbreiden';
        hint = `Kies een gemarkeerd gebied aan de rand van je land. Kost ${costText(chunkCost())}.`;
    }
    else if (ui.cmdMode) {
        txt = ui.cmdMode === 'amove' ? 'Aanvalsmars' : 'Patrouille';
        hint = ui.cmdMode === 'amove' ? 'Klik op een doel. Eenheden vechten onderweg.' : 'Klik op het eindpunt. Ze lopen heen en weer.';
        cls = 'army';
    }
    else if (ui.demoMode) {
        txt = 'Sloopmodus';
        hint = 'Klik op een gebouw, muur of weg om het af te breken.';
        cls = 'army';
    }
    else if (sel.us.size) {
        txt = `${sel.us.size} ${sel.us.size === 1 ? 'eenheid' : 'eenheden'}`;
        hint = TOUCH ? 'Tik op de kaart om te lopen, op een vijand om aan te vallen.' : 'Rechtsklik om te lopen, of op een vijand om aan te vallen.';
        cls = 'army';
    }
    else if (sel.vs.size) {
        txt = `${sel.vs.size} ${sel.vs.size === 1 ? 'dorpeling' : 'dorpelingen'}`;
        hint = TOUCH ? 'Tik op een boom, akker of bouwplaats.' : 'Rechtsklik op een boom, akker of bouwplaats.';
    }
    const hb = $('#hintbar');
    hb.hidden = !txt;
    if (txt) {
        if ($('#hintTxt').textContent !== txt)
            $('#hintTxt').textContent = txt;
        if ($('#hintSub').textContent !== hint)
            $('#hintSub').textContent = hint;
        $('#modeDot').className = 'dot ' + cls;
        $('#cancelBtn').textContent = TOUCH ? 'Sluiten' : 'Annuleren';
    }
    renderQuick();
    $('#expandBtn').classList.toggle('on', ui.expandMode);
    $('#expandBtn').firstElementChild!.textContent = ui.expandMode ? 'Klaar' : 'Uitbreiden';
    $('#expandBtn').title = `Gebied uitbreiden (E) · ${costText(chunkCost())}`;
    $('#raidflash').classList.toggle('on', raidNow);
    const dq = document.querySelector('#sidebtns [data-p="def"]'), uq = document.querySelector('#sidebtns [data-p="upg"]');
    if (dq)
        dq.classList.toggle('dot', raidNow || (raidNight() && G.clock >= 12 && G.clock < 21));
    if (uq)
        uq.classList.toggle('dot', G.bs.some(b => canUpg(b) && has(upgCost(b))) || (G.toolLvl < G.age && has(toolCost())) || (G.armsLvl < G.age && has(armsCost())) || (!G.research && TECH.some(T => T.age <= G.age && !hasT(T.k) && has(T.cost))));
}
function drawDial(c: HTMLCanvasElement, S: number) {
    const x = c.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, S, S);
    x.translate(S / 2, S / 2);
    const r = S / 2 - 3;
    x.fillStyle = '#2f3d5e';
    x.beginPath();
    x.arc(0, 0, r, 0, TAU);
    x.fill();
    x.fillStyle = '#f0d68a';
    x.beginPath();
    x.moveTo(0, 0);
    x.arc(0, 0, r, (6.5 / 24) * TAU + Math.PI / 2, (18 / 24) * TAU + Math.PI / 2);
    x.closePath();
    x.fill();
    const a = G.clock / 24 * TAU + Math.PI / 2, px = Math.cos(a) * r * .62, py = Math.sin(a) * r * .62;
    x.fillStyle = isNight() ? '#e8ecf4' : '#e0942f';
    x.beginPath();
    x.arc(px, py, r * .24, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(214,180,108,.8)';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(0, 0, r, 0, TAU);
    x.stroke();
    x.setTransform(1, 0, 0, 1, 0, 0);
}
