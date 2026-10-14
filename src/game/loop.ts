import { bus } from '../core/bus';
import { $ } from '../core/dom';
import { SET } from '../core/settings';
import { save } from './session';
import { drag, keys, mouse } from '../input/pointer';
import { cam, clampCam, panScreen } from '../render/camera';
import { render } from '../render/index';
import { G, sel } from '../sim/state';
import { update } from '../sim/update';
import { curAge, onAgeChange } from '../ui/age';
import { renderChronicle } from '../ui/chronicle';
import { renderCmd } from '../ui/commands';
import { renderDefense } from '../ui/defense';
import { updateHeader, updateWorldTop } from '../ui/header';
import { updateHover } from '../ui/hover';
import { renderInspector } from '../ui/inspector';
import { renderJobs } from '../ui/jobs';
import { renderLog } from '../ui/log';
import { renderMini } from '../ui/minimap';
import { updateRates } from '../ui/resources';
import { renderUpgrades } from '../ui/upgrades';
import { adaptResolution } from '../render/scene';

let lastT = performance.now(), acc = 0, uiT = 0, miniT = 0, saveT = 0;
const edge = { x: -1, y: -1 };
addEventListener('mousemove', e => {
    edge.x = e.clientX;
    edge.y = e.clientY;
});
document.addEventListener('mouseleave', () => {
    edge.x = -1;
});
addEventListener('blur', () => {
    edge.x = -1;
});
export function frame(now: number) {
    const rdt = Math.min(.1, (now - lastT) / 1000);
    lastT = now;
    if ($('#modal').hidden) {
        const pp = 900 * rdt;
        let kx = 0, ky = 0;
        if (keys.has('w') || keys.has('arrowup'))
            ky += 1;
        if (keys.has('s') && !sel.us.size || keys.has('arrowdown'))
            ky -= 1;
        if (keys.has('a') || keys.has('arrowleft'))
            kx += 1;
        if (keys.has('d') || keys.has('arrowright'))
            kx -= 1;
        if (SET.edge && edge.x >= 0 && !drag && !mouse.touch && $('#title').hidden) {
            const m = 10;
            if (edge.x < m)
                kx += 1;
            else if (edge.x > innerWidth - m)
                kx -= 1;
            if (edge.y < m)
                ky += 1;
            else if (edge.y > innerHeight - m)
                ky -= 1;
        }
        if (kx || ky)
            panScreen(kx * pp, ky * pp);
    }
    if (!$('#title').hidden) {
        cam.x += Math.cos(now / 9000) * .4 * rdt;
        cam.y += Math.sin(now / 7000) * .3 * rdt;
        clampCam();
    }
    if (cam.tx != null) {
        const k = 1 - Math.pow(.002, rdt);
        cam.x += (cam.tx - cam.x) * k;
        cam.y += (cam.ty! - cam.y) * k;
        if (Math.abs(cam.tx - cam.x) < .02 && Math.abs(cam.ty! - cam.y) < .02)
            cam.tx = null;
    }
    if (bus.shake > 0)
        bus.shake = Math.max(0, bus.shake - rdt);
    if (G.speed && !G.over) {
        acc += rdt * G.speed;
        let n = 0;
        while (acc >= 1 / 30 && n < 16) {
            update(1 / 30);
            acc -= 1 / 30;
            n++;
        }
        if (n >= 16)
            acc = 0;
    }
    render();
    adaptResolution(rdt);
    updateHover();
    uiT -= rdt;
    if (uiT <= 0 || bus.uiDirty) {
        uiT = .25;
        bus.uiDirty = false;
        if (curAge !== G.age)
            onAgeChange();
        updateHeader();
        updateWorldTop();
        renderChronicle();
        renderUpgrades();
        renderJobs();
        renderDefense();
        renderLog();
        renderInspector();
        renderCmd();
    }
    miniT -= rdt;
    if (miniT <= 0) {
        miniT = .4;
        renderMini();
    }
    updateRates(rdt);
    saveT += rdt;
    if (saveT > 60) {
        saveT = 0;
        if (!G.over)
            save();
    }
    requestAnimationFrame(frame);
}
