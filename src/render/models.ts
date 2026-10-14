import type { Building } from '../types';
import * as THREE from 'three';
import { TAU, W } from '../core/constants';
import { B } from '../data/buildings';
import { C, CYANM, FOE, GLASS, GLOWM, WIN, bx, chim, cn, crenel, cy, door, flagpole, flame, gCyl, gIco, gr, mat, mergeStatic, mk, pr, sp, wins } from './kit';
import { bById } from '../sim/state';
import { bmap } from '../sim/world';

// ---- building models ----
type ModelFn = (g: THREE.Group, a: number, b?: Building | null) => void;
const MODELS: Record<string, ModelFn> = {
    townhall(g, a) {
        if (a === 0) {
            cy(g, .92, .18, '#7d6a4c', 0, 0, 0, 10);
            cn(g, .98, 1.25, '#b08758', 0, .15, 0, 10);
            cn(g, .42, .35, '#8f6c44', 0, 1.2, 0, 10);
            door(g, 0, .9, .3, .38, '#3b2a1a');
            for (let k = 0; k < 3; k++) {
                const a2 = k * 2.1;
                cy(g, .03, .5, '#5f4630', Math.cos(a2) * .1, 1.3, Math.sin(a2) * .1, 5);
            }
            for (const [x, z] of [[.6, .7], [-.7, .55]])
                bx(g, .08, .5, .08, C.woodd, x, 0, z);
            bx(g, .12, .12, .25, '#c9b48a', .62, .5, .7);
            flagpole(g, -.6, 0, .6, 1.2);
        }
        else if (a === 1) {
            bx(g, 1.6, .6, .8, C.clay, 0, 0, -.1);
            gr(g, 1.75, .55, 1, C.thatch, 0, .6, -.1);
            bx(g, .6, .5, .6, C.wood, .55, 0, .5);
            gr(g, .7, .35, .75, C.thatch, .55, .5, .5, Math.PI / 2);
            door(g, 1.6, .6, .24, .34, '#3b2a1a', -.3);
            wins(g, 1.6, .8, .3, .14, 3, 0, -.1, .1);
            flagpole(g, -.75, .6, .35, .9);
        }
        else if (a === 2) {
            bx(g, 1.9, .12, 1.9, C.stoned);
            bx(g, .95, 1.2, .95, C.stone, -.3, 0, -.3);
            crenel(g, .95, .95, 1.2, C.stone, 3);
            bx(g, 1.1, .6, .7, C.plaster, .3, 0, .45);
            gr(g, 1.2, .45, .85, C.slate, .3, .6, .45);
            wins(g, 1.1, .7, .3, .14, 3, .3, .45, .1);
            door(g, 1.1, 1.6, .26, .36, '#3b2a1a', .3);
            flagpole(g, -.3, 1.32, -.3, .8);
        }
        else if (a === 3) {
            bx(g, 1.8, .8, 1, C.brick, 0, 0, 0);
            gr(g, 1.9, .5, 1.15, C.slate, 0, .8, 0);
            bx(g, .45, 1.5, .45, C.brick, 0, 0, .35);
            pr(g, .55, .5, .55, C.slate, 0, 1.5, .35);
            bx(g, .26, .26, .02, '#f1ecdc', 0, 1.15, .585);
            wins(g, 1.8, 1, .4, .22, 5, 0, 0, .11);
            door(g, 0, 1.6, .3, .4, '#3b2a1a');
            flagpole(g, .7, .8, .3, .8);
        }
        else if (a === 4) {
            bx(g, 1.8, .15, 1.8, C.concrete);
            bx(g, 1.4, 1.6, 1.1, C.concrete, 0, .15, -.15);
            for (let i = 0; i < 5; i++)
                bx(g, 1.42, .12, 1.12, GLASS, 0, .35 + i * .27, -.15);
            bx(g, .6, .4, .5, '#9a9d97', .45, .15, .55);
            bx(g, .05, .6, .05, C.dmetal, -.4, 1.75, -.4);
            flagpole(g, .75, .15, .75, 1);
        }
        else {
            cy(g, .95, .15, C.white, 0, 0, 0, 16);
            cy(g, .55, 1.9, C.white, 0, .15, 0, 12, .42);
            mk(gCyl(.62, .62, 24), CYANM, g, 0, 1.2, 0, 1, .06, 1);
            sp(g, .45, '#d9e6ea', 0, 2.05, 0, 1, .7);
            cy(g, .025, .6, C.metal, 0, 2.3, 0, 5);
            mk(gCyl(.97, .97, 24), CYANM, g, 0, .15, 0, 1, .04, 1);
        }
    },
    hut(g) {
        cy(g, .36, .42, '#a9845a', 0, 0, 0, 8);
        cn(g, .47, .55, C.thatch, 0, .4, 0, 8);
        door(g, 0, .7, .15, .24, '#3b2a1a');
    },
    campfire(g) {
        for (let k = 0; k < 7; k++) {
            const a = k / 7 * TAU;
            sp(g, .065, '#8a8a82', Math.cos(a) * .22, .03, Math.sin(a) * .22);
        }
        bx(g, .36, .05, .06, C.woodd, 0, 0, 0, .6);
        bx(g, .36, .05, .06, C.woodd, 0, 0, 0, -.6);
        flame(g, 0, .02, 0, 1.3);
    },
    storage(g) {
        bx(g, .86, .06, .86, C.woodd);
        for (const [x, z] of [[-.36, -.36], [.36, -.36], [-.36, .36], [.36, .36]])
            bx(g, .06, .5, .06, C.wood, x, 0, z);
        gr(g, .95, .28, .95, C.thatch, 0, .5, 0);
        bx(g, .22, .2, .22, '#a07a4c', -.18, .06, .12);
        bx(g, .18, .16, .18, '#8b6a40', .15, .06, -.12);
        for (let k = 0; k < 3; k++)
            cy(g, .05, .5, '#7a5a36', .2, .08 + k * .09, .18).rotation.z = Math.PI / 2;
    },
    farm(g) {
        bx(g, 1.92, .05, 1.92, C.soil);
        for (let r = 0; r < 7; r++)
            bx(g, 1.7, .1, .09, '#86aa48', 0, .05, -.78 + r * .26);
        for (const [x, z] of [[-.95, -.95], [.95, -.95], [-.95, .95], [.95, .95]])
            bx(g, .05, .22, .05, C.woodd, x, 0, z);
        bx(g, .05, .04, 1.9, C.wood, -.95, .16, 0);
        bx(g, 1.9, .04, .05, C.wood, 0, .16, .95);
    },
    barracks(g) {
        bx(g, 1.92, .04, 1.92, '#8d7856');
        bx(g, 1.2, .62, .7, C.wood, -.25, 0, -.45);
        gr(g, 1.3, .42, .85, C.thatch, -.25, .62, -.45);
        door(g, 1.2, -.2, .24, .34, '#3b2a1a', -.25);
        for (let i = 0; i < 8; i++) {
            const u = -.9 + i * .257;
            bx(g, .05, .3, .05, C.woodd, u, 0, .9);
            bx(g, .05, .3, .05, C.woodd, .9, 0, u);
        }
        bx(g, 1.85, .04, .04, C.wood, 0, .24, .9);
        bx(g, .04, .04, 1.85, C.wood, .9, .24, 0);
        for (let k = 0; k < 4; k++)
            cy(g, .012, .55, '#7d6a52', .45 + k * .08, 0, .25, 4);
        flagpole(g, .65, 0, -.6, 1);
    },
    watchtower(g) {
        for (const [x, z] of [[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]])
            bx(g, .07, 1.15, .07, C.wood, x, 0, z);
        bx(g, .7, .07, .7, C.woodd, 0, 1.1, 0);
        bx(g, .7, .18, .04, C.wood, 0, 1.17, .33);
        bx(g, .04, .18, .7, C.wood, .33, 1.17, 0);
        pr(g, .85, .4, .85, C.thatch, 0, 1.45, 0);
        for (const [x, z] of [[-.3, -.3], [.3, .3], [-.3, .3], [.3, -.3]])
            bx(g, .04, .3, .04, C.woodd, x, 1.17, z);
        flagpole(g, 0, 1.8, 0, .4);
    },
    house(g) {
        bx(g, .74, .48, .62, C.clay);
        gr(g, .84, .38, .78, C.thatch, 0, .48, 0);
        door(g, 0, .62, .15, .26, '#3b2a1a', -.15);
        bx(g, .12, .12, .02, WIN, .18, .22, .315);
        chim(g, .24, .6, -.12);
    },
    foundry(g) {
        bx(g, 1.2, .6, .9, C.stone, -.25, 0, -.3);
        gr(g, 1.3, .4, 1.05, C.slate, -.25, .6, -.3);
        cy(g, .32, .7, C.stoned, .5, 0, .45, 10, .22);
        bx(g, .2, .16, .04, GLOWM, .5, .08, .77);
        cy(g, .09, 1.5, C.stoned, .5, .6, .45, 8);
        for (let k = 0; k < 3; k++)
            bx(g, .18, .05, .08, C.bronze, -.4 + k * .2, 0, .55);
        flagpole(g, -.8, .6, .1, .6);
    },
    bronzetower(g) {
        cy(g, .36, 1.1, C.stone, 0, 0, 0, 10, .3);
        cy(g, .36, .12, C.stoned, 0, 1.1, 0, 10);
        cn(g, .4, .5, C.bronze, 0, 1.22, 0, 10);
        bx(g, .06, .16, .02, '#26231f', 0, .6, .31);
        flagpole(g, 0, 1.7, 0, .3);
    },
    stonehouse(g) {
        bx(g, .8, .62, .7, C.stone);
        gr(g, .9, .4, .84, C.slate, 0, .62, 0);
        door(g, 0, .7, .16, .28, '#3b2a1a', -.16);
        wins(g, .8, .7, .32, .13, 2, 0, 0, .1);
        chim(g, -.25, .75, -.1, .32, C.stoned);
    },
    smithy(g) {
        bx(g, 1.1, .62, .8, C.plaster, -.3, 0, -.35);
        for (const u of [-.82, .22])
            bx(g, .06, .62, .06, C.woodd, u, 0, .06);
        gr(g, 1.2, .45, .95, C.slate, -.3, .62, -.35);
        bx(g, .7, .06, .7, C.woodd, .5, .75, .45);
        for (const [x, z] of [[.2, .15], [.8, .15], [.2, .75], [.8, .75]])
            bx(g, .05, .75, .05, C.wood, x, 0, z);
        bx(g, .36, .3, .3, C.stoned, .55, 0, .4);
        bx(g, .24, .04, .18, GLOWM, .55, .3, .4);
        bx(g, .16, .12, .08, '#3d4045', .2, 0, .75);
        chim(g, .55, .8, .32, .5, C.stoned);
    },
    market(g) {
        bx(g, 1.92, .03, 1.92, '#b7a27c');
        ([['#c0453a', -.5, -.45], ['#2f6fd6', .45, -.45], ['#e0b240', -.05, .45]] as [string, number, number][]).forEach(([c, x, z]) => {
            for (const [dx, dz] of [[-.3, -.22], [.3, -.22], [-.3, .22], [.3, .22]])
                bx(g, .04, .5, .04, C.woodd, x + dx, 0, z + dz);
            gr(g, .72, .18, .55, c, x, .5, z);
            bx(g, .6, .2, .3, C.wood, x, 0, z + .05);
            sp(g, .06, '#d98a3a', x - .12, .24, z + .05);
            sp(g, .06, '#8bb24a', x + .1, .24, z + .05);
        });
        cy(g, .12, .26, '#7a5a36', .75, 0, .6, 8);
        cy(g, .12, .26, '#7a5a36', .75, 0, .85, 8);
    },
    lantern(g) {
        cy(g, .04, 1.05, C.woodd, 0, 0, 0, 6);
        bx(g, .16, .18, .16, '#3a2f25', 0, 1.02, 0);
        flame(g, 0, 1.05, 0, .7);
    },
    castletower(g) {
        bx(g, .82, 1.55, .82, C.stone);
        bx(g, .9, .1, .9, C.stoned, 0, 1.5, 0);
        crenel(g, .9, .9, 1.6, C.stone, 3);
        for (const y of [.5, 1.05])
            bx(g, .06, .2, .02, '#26231f', 0, y, .415);
        bx(g, .02, .2, .06, '#26231f', .415, .8, 0);
        flagpole(g, 0, 1.72, 0, .5);
    },
    blastfurnace(g) {
        bx(g, 1.92, .08, 1.92, '#7d7568');
        cy(g, .5, 1.7, C.brick, -.25, 0, -.25, 10, .32);
        cy(g, .36, .15, C.dmetal, -.25, 1.7, -.25, 10);
        bx(g, .7, .6, .6, C.brick, .45, 0, .4);
        gr(g, .8, .3, .72, C.slate, .45, .6, .4);
        bx(g, .3, .2, .04, GLOWM, -.25, .12, .24);
        bx(g, .08, .08, .9, C.metal, .1, 1.2, .05, .7);
        cy(g, .1, 1.3, C.dmetal, .6, 0, -.55, 8);
    },
    powerplant(g) {
        bx(g, 1.3, .85, 1, C.brick, -.2, 0, .2);
        gr(g, 1.4, .35, 1.1, C.slate, -.2, .85, .2);
        wins(g, 1.3, 1, .45, .24, 4, -.2, .2, .12);
        for (const [x, z] of [[.5, -.55], [.75, -.2]]) {
            cy(g, .13, 2.1, C.brick, x, 0, z, 10, .11);
            bx(g, .24, .06, .24, '#f1ece0', x, 1.7, z);
        }
        cy(g, .3, .4, C.metal, -.6, 0, -.6, 10);
    },
    rowhouse(g) {
        bx(g, .9, .82, .62, C.brick);
        gr(g, .98, .32, .74, C.slate, 0, .82, 0);
        door(g, 0, .62, .13, .26, '#2b2f35', -.22);
        door(g, 0, .62, .13, .26, '#2b2f35', .22);
        wins(g, .9, .62, .48, .14, 3, 0, 0, .1);
        for (const x of [-.3, 0, .3])
            chim(g, x, 1, -.05, .2, C.brick);
    },
    streetlamp(g) {
        cy(g, .03, 1.25, '#2e3236', 0, 0, 0, 6);
        bx(g, .3, .03, .03, '#2e3236', .12, 1.22, 0);
        const l = bx(g, .12, .08, .12, '#fff2c4', .25, 1.13, 0);
        l.material = mat('#fff2c4', { e: '#fff2c4', ei: .2 });
        l.userData.lamp = 1;
    },
    workshop(g) {
        bx(g, 1.7, .75, 1.2, C.brick, 0, 0, 0);
        for (let k = 0; k < 3; k++)
            gr(g, .5, .3, 1.25, C.metal, -.55 + k * .55, .75, 0, 0);
        bx(g, .6, .5, .03, '#3d4247', 0, 0, .61);
        wins(g, 1.7, 1.2, .4, .2, 4, 0, 0, .11);
        flagpole(g, .75, .75, .5, .6);
    },
    cannon(g) {
        cy(g, .46, .22, '#9a8e74', 0, 0, 0, 10);
        cy(g, .34, .06, '#6e6656', 0, .22, 0, 10);
        const c = cy(g, .07, .7, '#2e3236', 0, .38, .05, 8);
        c.rotation.x = 1.2;
        c.position.z = -.1;
        for (const x of [-.16, .16]) {
            const w = cy(g, .14, .04, C.woodd, x, .3, 0, 10);
            w.rotation.z = Math.PI / 2;
        }
    },
    oilpump(g) {
        bx(g, .82, .08, .82, C.concrete);
        bx(g, .08, .55, .08, C.dmetal, -.08, .08, 0);
        bx(g, .08, .55, .08, C.dmetal, .08, .08, 0);
        const p = new THREE.Group();
        p.position.set(0, .66, 0);
        bx(p, .85, .08, .08, '#d8a33a', 0, -.04, 0);
        bx(p, .12, .22, .1, '#d8a33a', .42, -.15, 0);
        g.add(p);
        p.userData.pump = 1;
        bx(g, .18, .25, .18, C.dmetal, -.3, .08, .25);
    },
    refinery(g) {
        bx(g, 1.92, .06, 1.92, C.concrete);
        for (const [x, z, r] of [[-.5, -.5, .32], [.1, -.6, .26], [-.55, .2, .28]]) {
            cy(g, r, .55, C.white, x, 0, z, 14);
            cy(g, r * 1.02, .04, C.metal, x, .55, z, 14);
        }
        cy(g, .1, 1.9, C.metal, .5, 0, .1, 8);
        cy(g, .08, 1.5, C.metal, .75, 0, .45, 8);
        for (const y of [.6, 1.1, 1.5])
            bx(g, .22, .04, .22, C.dmetal, .5, y, .1);
        bx(g, 1, .06, .06, C.dmetal, 0, .5, .3);
        flame(g, .5, 1.9, .1, .6);
    },
    silicaworks(g) {
        bx(g, 1.6, .6, 1.2, C.white, 0, 0, -.2);
        sp(g, .32, '#c9d4da', -.4, .6, -.2, 1, .6);
        sp(g, .32, '#c9d4da', .35, .6, -.2, 1, .6);
        bx(g, 1.62, .1, 1.22, mat('#3a6f8e'), 0, .42, -.2);
        bx(g, .4, .3, .5, C.concrete, .6, 0, .6);
        door(g, 1.6, 1.2 - .4, .3, .3, '#3d4247', 0);
    },
    oilplant(g) {
        bx(g, 1.3, .8, 1, C.concrete, -.2, 0, .2);
        wins(g, 1.3, 1, .4, .18, 4, -.2, .2, .14);
        cy(g, .15, 2, '#a9a99f', .6, 0, -.55, 10, .11);
        for (const [x, z] of [[.6, .4], [.6, .75]])
            cy(g, .18, .4, C.white, x, 0, z, 10);
        bx(g, .4, .2, .4, '#d8a33a', -.6, .8, -.1);
    },
    apartment(g) {
        bx(g, .86, 1.85, .86, '#cfc5b2');
        for (let i = 0; i < 6; i++)
            bx(g, .88, .11, .88, GLASS, 0, .2 + i * .28, 0);
        bx(g, .3, .2, .3, '#9a9d97', .1, 1.85, -.1);
        door(g, 0, .86, .18, .22, '#2b2f35');
    },
    aa(g) {
        bx(g, .84, .16, .84, C.concrete);
        cy(g, .3, .2, C.dmetal, 0, .16, 0, 10);
        bx(g, .36, .24, .3, '#5b6644', 0, .36, 0);
        for (const x of [-.08, .08]) {
            const b = cy(g, .035, .6, C.dmetal, x, .5, 0, 6);
            b.rotation.x = -.7;
            b.position.z = -.05;
        }
    },
    chipfab(g) {
        bx(g, 1.75, .62, 1.35, '#f2f4f5');
        bx(g, 1.77, .14, 1.37, mat('#2f6fd6', { r: .3, m: .2 }), 0, .3, 0);
        for (let k = 0; k < 4; k++)
            bx(g, .16, .18, .16, C.metal, -.6 + k * .4, .62, -.3);
        door(g, 1.75, 1.35, .36, .3, '#3d4247');
    },
    batteryfab(g) {
        bx(g, 1.2, .6, 1.1, '#dfe3e4', -.3, 0, -.3);
        bx(g, 1.22, .08, 1.12, mat('#77bf40'), -.3, .42, -.3);
        for (let k = 0; k < 4; k++) {
            cy(g, .13, .5, '#77bf40', .75, 0, -.7 + k * .38, 10);
            cy(g, .05, .06, C.metal, .75, .5, -.7 + k * .38, 6);
        }
    },
    solar(g) {
        for (let r = 0; r < 3; r++)
            for (let c = 0; c < 2; c++) {
                const x = -.45 + c * .9, z = -.6 + r * .6;
                bx(g, .05, .2, .05, C.metal, x, 0, z);
                const p = bx(g, .8, .03, .45, mat('#1f3f6e', { r: .2, m: .5 }), x, .2, z);
                p.rotation.x = -.45;
            }
    },
    hangar(g) {
        bx(g, 1.92, .05, 1.92, '#7d8287');
        const a = mk(gCyl(.85, .85, 16, Math.PI), mat('#9aa2a8', { m: .3 }), g, 0, 0, -.2, 1, 1.5, 1);
        a.rotation.z = Math.PI / 2;
        a.rotation.y = Math.PI / 2;
        a.position.set(-.75, 0, -.2);
        a.scale.set(1, 1.5, 1);
        bx(g, 1.5, .02, .5, '#e8c84a', 0, .05, .7);
    },
    laser(g) {
        cy(g, .42, .25, C.concrete, 0, 0, 0, 12);
        sp(g, .36, '#dfe6ea', 0, .25, 0, 1, .7);
        cy(g, .06, .45, C.metal, 0, .45, 0, 8);
        mk(gIco(0), CYANM, g, 0, .92, 0, .09, .09, .09);
    },
    towerblock(g) {
        bx(g, 1.2, 3, 1.2, '#e8edf0');
        for (let i = 0; i < 10; i++)
            bx(g, 1.22, .18, 1.22, GLASS, 0, .25 + i * .27, 0);
        bx(g, 1.3, .1, 1.3, C.white, 0, 3, 0);
        sp(g, .25, '#6fae58', .2, 3.05, .2, 0, .6);
        mk(gCyl(.04, .04, 6), CYANM, g, -.4, 3, -.4, 1, .5, 1);
    },
    command(g) {
        bx(g, 1.95, .12, 1.95, C.concrete);
        cy(g, .85, .6, C.white, 0, .12, 0, 8, .75);
        cy(g, .45, 1.6, '#dfe6ea', 0, .72, 0, 8, .3);
        mk(gCyl(.5, .5, 16), CYANM, g, 0, 1.3, 0, 1, .05, 1);
        const d = sp(g, .3, C.white, .55, .95, .45, 1, .35);
        d.rotation.x = .6;
        cy(g, .03, .6, C.metal, 0, 2.3, 0, 5);
        mk(gIco(0), CYANM, g, 0, 2.9, 0, .07, .07, .07);
        flagpole(g, -.75, .12, .75, 1);
    },
};
// walls: post + arms toward neighbouring walls
export function wallMask(b: Building): number {
    let m = 0;
    const n = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    n.forEach(([dx, dy], k) => {
        const o = bById.get(bmap[(b.y + dy) * W + b.x + dx]);
        if (o && B[o.type].wall)
            m |= 1 << k;
    });
    return m;
}
function makeWall(g: THREE.Group, type: string, m: number) {
    const col = { palisade: C.wood, gate: C.wood, stonewall: C.stone, concrete: C.concrete }[type]!, h = { palisade: .55, gate: .6, stonewall: .6, concrete: .7 }[type]!, t = type === 'palisade' ? .16 : .24;
    if (type === 'palisade') {
        const pts = [[0, 0]];
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dz], k) => {
            if (m >> k & 1)
                for (const f of [.18, .36])
                    pts.push([dx * f, dz * f]);
        });
        for (const [x, z] of pts) {
            cy(g, .07, h, C.wood, x, 0, z, 6);
            cn(g, .07, .12, C.woodd, x, h, z, 6);
        }
        return;
    }
    if (type === 'gate') {
        const ns = (m & 5) && !(m & 10);
        bx(g, ns ? .22 : .22, h + .15, .22, C.woodd, ns ? -.38 : 0, 0, ns ? 0 : -.38);
        bx(g, .22, h + .15, .22, C.woodd, ns ? .38 : 0, 0, ns ? 0 : .38);
        bx(g, ns ? .98 : .2, .12, ns ? .2 : .98, C.wood, 0, h + .05, 0);
        bx(g, ns ? .5 : .08, h - .1, ns ? .08 : .5, '#7a5a36', 0, 0, 0);
        flagpole(g, 0, h + .15, 0, .3);
        return;
    }
    bx(g, t * 1.4, h + .12, t * 1.4, col);
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dz], k) => {
        if (m >> k & 1) {
            bx(g, dx ? .5 : t, h, dz ? .5 : t, col, dx * .25, 0, dz * .25);
            if (type === 'stonewall')
                bx(g, dx ? .18 : t * 1.1, .1, dz ? .18 : t * 1.1, C.stoned, dx * .3, h, dz * .3);
        }
    });
}
export function makeCamp(g: THREE.Group, tier: number) {
    bx(g, 2.6, .04, 2.6, '#5d4a36');
    const tc = ['#7a5a3a', '#8a3a2a', '#7a2e2e', '#5d4a3a', '#4a4e54', '#3a3f45'][tier];
    for (const [x, z] of [[-.6, -.5], [.55, -.6], [-.5, .6]])
        cn(g, .45, .7, tc, x, 0, z, 6);
    for (let k = 0; k < 14; k++) {
        const a = k / 14 * TAU;
        cy(g, .06, .5, C.woodd, Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3, 5);
    }
    flame(g, .3, 0, .3, 1.2);
    flagpole(g, 0, 0, 0, 1.2, FOE);
    if (tier >= 3)
        bx(g, .5, .4, .4, C.dmetal, .6, 0, .5);
}
export function makeBuilding(type: string, age: number, b?: Building | null): THREE.Group {
    const g = new THREE.Group(), d = B[type];
    if (d.wall)
        makeWall(g, type, b ? wallMask(b) : 0);
    else
        (MODELS[type] || MODELS.storage)(g, age, b);
    return mergeStatic(g);
}
