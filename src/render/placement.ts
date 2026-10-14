import * as THREE from 'three';
import { B } from '../data/buildings';
import { ghostPos } from '../input/placement';
import { drag, mouse } from '../input/pointer';
import { quadAt, rangeAt } from './decals';
import { makeBuilding } from './models';
import { S3 } from './scene';
import { canPlace, lineTiles } from '../sim/placement';
import { G } from '../sim/state';
import { ui } from '../ui/state';

// ---- ghost for placement ----
const ghostCache: Record<string, THREE.Group> = {};
const GHOK = new THREE.MeshStandardMaterial({ color: '#6fe08a', transparent: true, opacity: .55, flatShading: true, depthWrite: false }), GHBAD = new THREE.MeshStandardMaterial({ color: '#ff6a58', transparent: true, opacity: .55, flatShading: true, depthWrite: false });
function ghost(type: string): THREE.Group {
    if (ghostCache[type])
        return ghostCache[type];
    const g = makeBuilding(type, G.age, null);
    g.traverse(o => {
        if ((o as THREE.Mesh).isMesh) {
            o.castShadow = false;
            o.renderOrder = 4;
        }
    });
    S3.add(g);
    return ghostCache[type] = g;
}
function hideGhosts(except?: string | null) {
    for (const k in ghostCache)
        if (k !== except)
            ghostCache[k].visible = false;
}
export function drawPlacement() {
    if (!ui.placing || !mouse.in || mouse.touch) {
        hideGhosts();
        return;
    }
    const d = B[ui.placing];
    if (drag && drag.mode === 'line') {
        hideGhosts();
        let budget = { ...G.res };
        for (const [x, y] of lineTiles(drag.t0, drag.t1)) {
            const err = canPlace(ui.placing, x, y, true);
            let ok = !err;
            if (ok) {
                for (const k in d.cost)
                    if (budget[k] < d.cost[k])
                        ok = false;
                if (ok)
                    for (const k in d.cost)
                        budget[k] -= d.cost[k];
            }
            quadAt(x + .5, y + .5, .96, .96, ok ? '#59d27a' : '#e5584a', .55);
        }
        return;
    }
    const [gx, gy] = ghostPos(), err = canPlace(ui.placing, gx, gy), s = d.size;
    hideGhosts(ui.placing);
    if (!d.road) {
        const g = ghost(ui.placing);
        g.visible = true;
        g.position.set(gx + s / 2, 0, gy + s / 2);
        g.traverse(o => {
            if ((o as THREE.Mesh).isMesh)
                (o as THREE.Mesh).material = err ? GHBAD : GHOK;
        });
    }
    for (let dy = 0; dy < s; dy++)
        for (let dx = 0; dx < s; dx++)
            quadAt(gx + dx + .5, gy + dy + .5, .94, .94, err ? '#e5584a' : '#59d27a', .5);
    if (d.def || d.light)
        rangeAt(gx + s / 2, gy + s / 2, d.def ? d.def.r : d.light!, '#ffffff');
}
