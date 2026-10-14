import { bus, sigs } from '../core/bus';
import { CN, H, TH, TW, W } from '../core/constants';
import { $ } from '../core/dom';
import { frame } from './loop';
import { clearSel } from '../input/selection';
import { V2, cam, centerOn, clampCam, setV2, setZoom } from '../render/camera';
import { resize } from '../render/scene';
import { computeAvail, computeCaches } from '../sim/caches';
import { placeBuilding, spawnVillager } from '../sim/entities';
import { SKEY, restore, serialize } from '../sim/save';
import { G, bById, baseState, genCamps, placeName, setG } from '../sim/state';
import { buildLists, genWorld } from '../sim/world';
import { onAgeChange } from '../ui/age';
import { note, setSpeed, toast } from '../ui/hud';
import { measureHud } from '../ui/layout';
import { showTitle } from '../ui/modals';

export function newGame(seed?: number, diff = 1) {
    seed = seed || ((Math.random() * 1e9) | 0);
    setG(baseState(seed));
    G.diff = diff;
    G.peaceful = diff === 0;
    Object.assign(G.res, diff === 2 ? { food: 150, wood: 120, stone: 40 } : { food: 200, wood: 160, stone: 60 });
    for (const c of [[3, 3], [4, 3], [3, 4], [4, 4]])
        G.unl[c[1] * CN + c[0]] = 1;
    genWorld(seed);
    buildLists();
    bById.clear();
    placeBuilding('townhall', 63, 63, true);
    for (let k = 0; k < 5; k++)
        spawnVillager(63 + (k % 3) * .7, 65.5 + (k > 2 ? .8 : 0));
    genCamps(seed);
    clearSel();
    centerOn(64, 64, true);
    cam.z = 1;
    note(`Je stam vestigt zich in ${placeName()}.`);
    afterLoad();
}
export function save(manual?: boolean) {
    try {
        localStorage.setItem(SKEY, serialize(cam));
        $('#saved').lastChild!.textContent = `Opgeslagen op dag ${G.day}`;
        if (manual)
            toast('Spel opgeslagen.', 'good');
    }
    catch (e) {
        $('#saved').lastChild!.textContent = 'Opslaan lukt niet in deze browser';
        if (manual)
            toast('Opslaan lukt niet in deze browser.', 'bad');
    }
}
export function load() {
    try {
        const s = localStorage.getItem(SKEY);
        if (!s)
            return false;
        return deserialize(s);
    }
    catch (e) {
        return false;
    }
}
export function wipe() {
    try {
        localStorage.removeItem(SKEY);
    }
    catch (e) {
    }
}
function afterLoad() {
    computeCaches();
    computeAvail();
    onAgeChange();
    setSpeed(1);
    setZoom(cam.z);
    for (const k in sigs)
        sigs[k] = null;
    bus.uiDirty = true;
}
addEventListener('visibilitychange', () => {
    if (document.hidden && G && !G.over)
        save();
});
export function start() {
    resize();
    try {
        if (localStorage.getItem('tijdperken-view') === '2d')
            setV2(true);
    }
    catch (e) {
    }
    document.body.classList.toggle('v2', V2);
    if (!load())
        newGame();
    showTitle();
    measureHud();
    requestAnimationFrame(frame);
}
export function deserialize(str: string): boolean {
    const s = restore(str);
    if (!s)
        return false;
    if (s.cam) {
        let x = s.cam.x, y = s.cam.y;
        if (s.cv !== 2) {
            const X = x, Y = y;
            x = (X / TW + Y / TH) / 2;
            y = (Y / TH - X / TW) / 2;
            if (!(x >= 0 && x <= W && y >= 0 && y <= H)) {
                x = 64;
                y = 64;
            }
        }
        cam.x = x;
        cam.y = y;
        cam.z = s.cam.z || 1;
        clampCam();
    }
    clearSel();
    afterLoad();
    return true;
}
