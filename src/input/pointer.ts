import type { Tile } from '../types';
import { bus } from '../core/bus';
import { CS } from '../core/constants';
import { $ } from '../core/dom';
import { dist } from '../core/util';
import { B } from '../data/buildings';
import { leftClick, rightClick } from './commands';
import { CUR } from './cursors';
import { placeLine } from './placement';
import { boxSelect, clearSel, unitAt, villAt } from './selection';
import { cam, centerOn, clampCam, s2iso, s2t, setZoom, updateCamera } from '../render/camera';
import { cv } from '../render/scene';
import { G, sel } from '../sim/state';
import { ui } from '../ui/state';

/**
 * Pointer gesture on the map. A press starts as 'pending' and becomes a pan once it moves, a box
 * selection with shift, or a line while placing walls or roads; a second finger turns it into a pinch.
 * Only the fields of the current mode are meaningful.
 */
export interface Drag {
    mode: 'pending' | 'pan' | 'box' | 'line' | 'pinch';
    /** Press: mouse button, start and last screen position, shift held, screen distance moved. */
    btn: number;
    sx: number;
    sy: number;
    lx: number;
    ly: number;
    shift: boolean;
    moved: number;
    /** Line: first and current tile. */
    t0: Tile;
    t1: Tile;
    /** Pinch: finger distance and zoom at the start (lx/ly then hold the midpoint between the fingers). */
    d0: number;
    z0: number;
}
export const mouse = { sx: 0, sy: 0, X: 0, Y: 0, tx: 0, ty: 0, in: false, moved: true, touch: false };
export let drag: Drag | null = null, hoverChunk: [number, number] | null = null;
const ptrs = new Map<number, { x: number; y: number }>();
export const keys = new Set<string>();
function local(e: MouseEvent): [number, number] {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
}
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const [sx, sy] = local(e);
    ptrs.set(e.pointerId, { x: sx, y: sy });
    mouse.touch = e.pointerType === 'touch';
    if (ptrs.size > 2)
        return;
    if (ptrs.size === 2) {
        const [p, q] = [...ptrs.values()];
        drag = { mode: 'pinch', d0: dist(p.x, p.y, q.x, q.y), z0: cam.z, lx: (p.x + q.x) / 2, ly: (p.y + q.y) / 2 } as Drag;
        return;
    }
    drag = { mode: 'pending', btn: e.button, sx, sy, lx: sx, ly: sy, shift: e.shiftKey, moved: 0 } as Drag;
    if (e.button === 1)
        drag.mode = 'pan';
    if (e.button === 0 && e.shiftKey && !ui.placing && !ui.expandMode)
        drag.mode = 'box';
    if (e.button === 0 && ui.placing && (B[ui.placing].wall || B[ui.placing].road)) {
        const t = s2t(sx, sy);
        drag.mode = 'line';
        drag.t0 = [Math.floor(t[0]), Math.floor(t[1])];
        drag.t1 = drag.t0;
    }
});
cv.addEventListener('pointermove', e => {
    const [sx, sy] = local(e);
    mouse.sx = sx;
    mouse.sy = sy;
    mouse.in = true;
    mouse.moved = true;
    mouse.touch = e.pointerType === 'touch';
    [mouse.X, mouse.Y] = s2iso(sx, sy);
    [mouse.tx, mouse.ty] = s2t(sx, sy);
    hoverChunk = [Math.floor(mouse.tx / CS), Math.floor(mouse.ty / CS)];
    if (ptrs.has(e.pointerId))
        ptrs.set(e.pointerId, { x: sx, y: sy });
    if (!drag)
        return;
    if (drag.mode === 'pinch') {
        if (ptrs.size !== 2)
            return;
        // zoom around the point between the fingers and pan along with them
        const [p, q] = [...ptrs.values()], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, a0 = s2t(drag.lx, drag.ly);
        setZoom(drag.z0 * dist(p.x, p.y, q.x, q.y) / drag.d0);
        updateCamera();
        const b0 = s2t(mx, my);
        cam.tx = null;
        cam.x += a0[0] - b0[0];
        cam.y += a0[1] - b0[1];
        clampCam();
        updateCamera();
        drag.lx = mx;
        drag.ly = my;
        return;
    }
    if (drag.mode === 'line') {
        drag.t1 = [Math.floor(mouse.tx), Math.floor(mouse.ty)];
        return;
    }
    const dx = sx - drag.lx, dy = sy - drag.ly;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.mode === 'pending' && drag.moved > 7) {
        drag.mode = 'pan';
        cv.style.cursor = 'grabbing';
    }
    if (drag.mode === 'pan') {
        const a0 = s2t(drag.lx, drag.ly), b0 = s2t(sx, sy);
        cam.tx = null;
        cam.x += a0[0] - b0[0];
        cam.y += a0[1] - b0[1];
        clampCam();
        updateCamera();
    }
    drag.lx = sx;
    drag.ly = sy;
});
cv.addEventListener('pointerup', e => {
    ptrs.delete(e.pointerId);
    if (!drag)
        return;
    if (drag.mode === 'pinch') {
        // one finger left: keep panning with it; it never counts as a tap
        const rest = [...ptrs.values()][0];
        drag = rest ? { mode: 'pan', btn: 0, sx: rest.x, sy: rest.y, lx: rest.x, ly: rest.y, shift: false, moved: 99 } as Drag : null;
        return;
    }
    const [sx, sy] = local(e);
    if (drag.mode === 'pending') {
        if (drag.btn === 0)
            leftClick(sx, sy, drag.shift);
        else if (drag.btn === 2)
            rightClick(sx, sy);
    }
    else if (drag.mode === 'box')
        boxSelect(drag.sx, drag.sy, sx, sy);
    else if (drag.mode === 'line' && ui.placing)
        placeLine(drag.t0, drag.t1);
    drag = null;
    cv.style.cursor = CUR.def;
});
cv.addEventListener('pointercancel', e => {
    ptrs.delete(e.pointerId);
    drag = null;
});
cv.addEventListener('pointerleave', () => {
    mouse.in = false;
    $('#hovertip').hidden = true;
});
cv.addEventListener('dblclick', e => {
    const [sx, sy] = local(e), [X, Y] = s2iso(sx, sy), u = unitAt(X, Y);
    if (u) {
        clearSel();
        G.us.forEach(o => {
            if (o.k === u.k)
                sel.us.add(o.id);
        });
        bus.uiDirty = true;
        return;
    }
    const v = villAt(X, Y);
    if (v) {
        clearSel();
        G.vs.forEach(o => {
            if (!o.hidden && o.job === v.job)
                sel.vs.add(o.id);
        });
        bus.uiDirty = true;
    }
});
cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [sx, sy] = local(e), b0 = s2t(sx, sy);
    setZoom(cam.z * Math.exp(-e.deltaY * .0015));
    updateCamera();
    const a0 = s2t(sx, sy);
    cam.x += b0[0] - a0[0];
    cam.y += b0[1] - a0[1];
    cam.tx = null;
    clampCam();
}, { passive: false });
$('#zIn').onclick = () => setZoom(cam.z * 1.2);
$('#zOut').onclick = () => setZoom(cam.z / 1.2);
$('#zHome').onclick = () => {
    const t = G.bs.find(b => b.type === 'townhall');
    if (t)
        centerOn(t.x + 1, t.y + 1);
};
