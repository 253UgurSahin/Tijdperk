import { sfx } from '../audio/sound';
import { bus } from '../core/bus';
import { $, compact } from '../core/dom';
import { selectArmy, selectIdle } from '../input/keyboard';
import { clearSel } from '../input/selection';
import { cam, setZoom } from '../render/camera';
import { G } from '../sim/state';
import { setHTML } from './fmt';
import { measureHud } from './layout';
import { ui } from './state';

export let lastSpeed = 1;
let toastTimer = 0;
export function note(text: string, kind = '') {
    if (!G)
        return;
    G.log.unshift({ d: G.day, t: text, k: kind, x: bus.notePos ? bus.notePos[0] : undefined, y: bus.notePos ? bus.notePos[1] : undefined, id: G.nid++ });
    bus.notePos = null;
    G.log.length = Math.min(G.log.length, 40);
    bus.uiDirty = true;
}
export function toast(msg: string, kind = '') {
    if (kind === 'bad')
        sfx('bad', .6);
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.className = kind, kind === 'bad' ? 5200 : 3400);
    note(msg, kind);
}
export function pulseRes(k: string) {
    const el = document.querySelector(`#resbar .res[data-k="${k}"]`);
    if (el) {
        el.classList.add('pulse');
        setTimeout(() => el.classList.remove('pulse'), 400);
    }
}
export function setSpeed(s: number) {
    if (s)
        lastSpeed = s;
    G.speed = s;
    document.querySelectorAll<HTMLElement>('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s! === s));
    bus.uiDirty = true;
}
$('#speed').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (b)
        setSpeed(+b.dataset.s!);
});
export function setExpand(on: boolean) {
    ui.expandMode = on;
    if (on) {
        ui.placing = null;
        clearSel();
        if (cam.z > .42)
            setZoom(.38);
    }
    bus.uiDirty = true;
}
$('#expandBtn').onclick = () => {
    sfx('tick');
    setExpand(!ui.expandMode);
    if (compact())
        document.body.classList.remove('showmap');
};
$('#cancelBtn').onclick = () => {
    ui.placing = null;
    ui.cmdMode = null;
    ui.demoMode = false;
    setExpand(false);
    clearSel();
    bus.uiDirty = true;
};
$('#step').addEventListener('click', e => {
    if (compact() && (e.target as HTMLElement).closest('.oh')) {
        document.body.classList.toggle('showgoal');
        measureHud();
    }
});
// quick buttons next to population
export function renderQuick() {
    const idle = G.vs.filter(v => !v.hidden && v.state === 'idle').length, showIdle = idle >= 2 && G.t > 60;
    const sig = [showIdle && idle, G.us.length].join();
    setHTML($('#quick'), 'quick', sig, () => (showIdle ? `<button class="pbtn" data-q="idle" title="Selecteer dorpelingen zonder werk (sneltoets I)"><i>☺</i>${idle}</button>` : '') + (G.us.length ? `<button class="pbtn" data-q="army" title="Selecteer het hele leger (sneltoets Q)"><i>⚔</i>${G.us.length}</button>` : ''));
}
$('#quick').addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t)
        return;
    sfx('tick');
    if (t.dataset.q === 'idle')
        selectIdle();
    else if (t.dataset.q === 'army')
        selectArmy();
    bus.uiDirty = true;
});
