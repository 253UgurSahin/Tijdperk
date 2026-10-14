import * as THREE from 'three';
import { CN, CS, W } from '../core/constants';
import { B } from '../data/buildings';
import { drag, hoverChunk, mouse } from '../input/pointer';
import { updateCamera } from './camera';
import { pool, poolsBegin, poolsEnd, quadAt, rangeAt, ringAt } from './decals';
import { drawFx, drawRain } from './fx';
import { flagpole } from './kit';
import { applySeason, lighting } from './lighting';
import { drawOverlay } from './overlay';
import { drawPlacement } from './placement';
import { CAM3, R3, S3, setTM } from './scene';
import { checkWorld, syncBuildings, syncCamps, syncEntities } from './sync';
import { canBuyChunk } from '../sim/expand';
import { G, bById, sel } from '../sim/state';
import { darkness } from '../sim/time';
import { inb } from '../sim/world';
import { ui } from '../ui/state';

// ---- main render ----
export function render() {
    setTM(performance.now() / 1000);
    const dk = darkness();
    checkWorld();
    applySeason();
    updateCamera();
    poolsBegin();
    syncBuildings();
    syncEntities();
    syncCamps();
    drawFx();
    drawRain();
    drawPlacement();
    lighting(dk);
    // selection decals
    const sb = sel.b && bById.get(sel.b);
    if (sb) {
        const d = B[sb.type], s = d.size, cx = sb.x + s / 2, cz = sb.y + s / 2;
        quadAt(cx, cz, s + .15, s + .15, '#9fe28a', .28, .025);
        for (const r of [d.def && d.def.r, d.light].filter(Boolean))
            rangeAt(cx, cz, r!, '#ffffff');
        if (sb.rally) {
            ringAt(sb.rally.x, sb.rally.y, .35, '#ffffff', .9);
            const f = pool('rally', () => {
                const g = new THREE.Group();
                flagpole(g, 0, 0, 0, .8);
                return g;
            });
            f.position.set(sb.rally.x, 0, sb.rally.y);
        }
    }
    if (sel.camp) {
        const c = G.camps.find(c => c.id === sel.camp);
        if (c)
            ringAt(c.x + 1, c.y + 1, 1.7, '#e3584a', .9);
    }
    if (sel.node >= 0)
        ringAt(sel.node % W + .5, ((sel.node / W) | 0) + .5, .45, '#ffffff', .9);
    if (mouse.in && !drag && !ui.placing && !ui.expandMode && inb(Math.floor(mouse.tx), Math.floor(mouse.ty)) && !mouse.touch)
        quadAt(Math.floor(mouse.tx) + .5, Math.floor(mouse.ty) + .5, .96, .96, '#ffffff', .12, .02);
    if (ui.expandMode)
        for (let cy2 = 0; cy2 < CN; cy2++)
            for (let cx2 = 0; cx2 < CN; cx2++) {
                if (!canBuyChunk(cx2, cy2))
                    continue;
                const hov = hoverChunk && hoverChunk[0] === cx2 && hoverChunk[1] === cy2;
                quadAt(cx2 * CS + 8, cy2 * CS + 8, CS - .6, CS - .6, hov ? '#ffe6a8' : '#d6b46c', hov ? .42 : .3, .06);
            }
    poolsEnd();
    R3.render(S3, CAM3);
    drawOverlay();
}
