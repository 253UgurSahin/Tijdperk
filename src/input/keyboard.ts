import { setSound, sfx, sndOn } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $, compact } from '../core/dom';
import { B } from '../data/buildings';
import { demolish } from './commands';
import { keys } from './pointer';
import { clearSel, selUnits } from './selection';
import { V2, cam, centerOn, setView, setZoom } from '../render/camera';
import { G, bById, sel } from '../sim/state';
import { setTab } from '../ui/commands';
import { lastSpeed, setExpand, setSpeed, toast } from '../ui/hud';
import { selCmds } from '../ui/inspector';
import { closeModal, openPause, showHelp } from '../ui/modals';
import { togglePanel } from '../ui/panels';
import { ui } from '../ui/state';

addEventListener('keydown', e => {
    if ((e.target as HTMLElement).tagName === 'INPUT')
        return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !/^f[1-5]$/.test(k))
        return;
    if (!$('#modal').hidden) {
        if (k === 'escape' && !G.over)
            closeModal();
        return;
    }
    if (!$('#title').hidden)
        return;
    keys.add(k);
    if (k === 'escape') {
        const busy = ui.placing || ui.expandMode || ui.cmdMode || ui.demoMode || sel.us.size || sel.vs.size || sel.b || sel.camp || sel.node >= 0;
        ui.placing = null;
        ui.cmdMode = null;
        ui.demoMode = false;
        setExpand(false);
        clearSel();
        if (compact())
            togglePanel();
        if (!busy)
            openPause();
        bus.uiDirty = true;
    }
    else if (k === 'f' && sel.us.size) {
        ui.cmdMode = 'amove';
        bus.uiDirty = true;
    }
    else if (k === 'r' && sel.us.size) {
        ui.cmdMode = 'patrol';
        bus.uiDirty = true;
    }
    else if (k === 'delete' && !sel.b) {
        ui.demoMode = !ui.demoMode;
        ui.placing = null;
        bus.uiDirty = true;
    }
    else if (k === ' ') {
        e.preventDefault();
        setSpeed(G.speed ? 0 : lastSpeed);
    }
    else if (k === ']') {
        setSpeed(G.speed === 0 ? 1 : G.speed === 1 ? 2 : 4);
    }
    else if (k === '[') {
        setSpeed(G.speed === 4 ? 2 : G.speed === 2 ? 1 : 1);
    }
    else if (/^f[1-5]$/.test(k)) {
        e.preventDefault();
        const g = k.slice(1);
        if (e.ctrlKey || e.metaKey || e.altKey) {
            const ids = [...sel.us, ...sel.vs];
            if (ids.length) {
                G.groups[g] = ids;
                toast(`Groep ${g} ingesteld (${ids.length}).`);
            }
        }
        else {
            const ids = G.groups[g] || [];
            const us = G.us.filter(u => ids.includes(u.id)), vs = G.vs.filter(v => ids.includes(v.id));
            if (us.length || vs.length) {
                clearSel();
                us.forEach(u => sel.us.add(u.id));
                vs.forEach(v => sel.vs.add(v.id));
                const f = us[0] || vs[0];
                if (ui.lastGroup === g)
                    centerOn(f.x, f.y);
                ui.lastGroup = g;
                sfx('select');
                bus.uiDirty = true;
            }
            else
                toast(`Groep ${g} is leeg. Ctrl+F${g} stelt een groep in.`);
        }
    }
    else if (k === 's' && !e.ctrlKey && (sel.us.size)) {
        selUnits().forEach(u => {
            u.tgt = null;
            u.order = 'guard';
            u.path = null;
            u.gx = u.x;
            u.gy = u.y;
        });
        sfx('tick');
    }
    else if (k === 'h' || k === '?')
        showHelp();
    else if (k === 'e')
        setExpand(!ui.expandMode);
    else if (k === 'v')
        setView(!V2);
    else if (k === 'm')
        setSound(!sndOn);
    else if (k === 'z' || k === 'x' || k === 'c' || k === 'b') {
        const t = { z: 'home', x: 'eco', c: 'light', b: 'mil' }[k];
        if (selCmds != null && !sel.vs.size)
            clearSel();
        setTab(t);
    }
    else if (k === 'p') {
        togglePanel('left');
    }
    else if (k === 'q')
        selectArmy();
    else if (/^[1-9]$/.test(k) && !e.ctrlKey) {
        const tiles = [...document.querySelectorAll<HTMLElement>('#cmdgrid .gb[data-b]')], t = tiles[+k - 1];
        if (t) {
            t.click();
        }
    }
    else if (k === 'i')
        selectIdle();
    else if ((k === 'delete' || k === 'backspace') && sel.b) {
        e.preventDefault();
        const b = bById.get(sel.b);
        if (b && b.type !== 'townhall') {
            if (ui.demolishArm === b.id)
                demolish(b);
            else {
                ui.demolishArm = b.id;
                sigs.ins = null;
                toast(`Druk nogmaals om ${B[b.type].n.toLowerCase()} af te breken.`);
                setTimeout(() => {
                    if (ui.demolishArm === b.id) {
                        ui.demolishArm = 0;
                        sigs.ins = null;
                        bus.uiDirty = true;
                    }
                }, 3000);
            }
        }
    }
    else if (k === '+' || k === '=')
        setZoom(cam.z * 1.2);
    else if (k === '-')
        setZoom(cam.z / 1.2);
    else if (k === 'home')
        $('#zHome').click();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k))
        e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
export function selectArmy() {
    clearSel();
    G.us.forEach(u => sel.us.add(u.id));
    if (!G.us.length)
        toast('Je hebt nog geen leger. Bouw een kazerne.');
    bus.uiDirty = true;
}
export function selectIdle() {
    const idle = G.vs.filter(v => !v.hidden && v.state === 'idle');
    clearSel();
    if (idle.length) {
        idle.forEach(v => sel.vs.add(v.id));
        centerOn(idle[0].x, idle[0].y);
    }
    else
        toast('Niemand staat stil. Iedereen is aan het werk.');
    bus.uiDirty = true;
}
