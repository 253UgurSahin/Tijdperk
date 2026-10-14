import type { Building, Camp, GameState } from '../types';
import { CN, TAU, W } from '../core/constants';
import { dist, mulberry32 } from '../core/util';
import { PLACES } from '../data/names';
import { RKEYS } from '../data/resources';
import { spawnFoe } from './entities';
import { inb, node, ter } from './world';

/** The running game. Set by newGame() and when a save is loaded. */
export let G!: GameState;
/** Buildings by id. */
export const bById = new Map<number, Building>();
/** Current selection: villager and unit ids, a building id, a camp id or a resource tile. */
export const sel = { vs: new Set<number>(), us: new Set<number>(), b: null as number | null, camp: null as number | null, node: -1 };
export function baseState(seed: number): GameState {
    const g: GameState = { seed, age: 0, res: {}, t: 0, clock: 7, day: 1, speed: 1, unl: new Array(CN * CN).fill(0),
        bs: [], vs: [], us: [], foes: [], proj: [], fx: [], regrow: [], camps: [], spawnQ: [], log: [], nid: 1, raids: 0, tools: 1, carryCap: 10,
        autoTrain: true, trainQ: 0, toolLvl: 0, armsLvl: 0, rain: 0, groups: {}, hist: [], offer: null, stance: 'guard', diff: 1, tech: {}, research: null, buff: {}, forceRaid: 0, event: null, lastEvent: 0, training: false, trainT: 0, peaceful: false, won: false, over: false, bought: 0, hungry: false,
        stats: { gathered: 0, killed: 0, born: 0, camps: 0, trained: 0, knight: 0 } };
    RKEYS.forEach(k => g.res[k] = 0);
    return g;
}
export const placeName = () => PLACES[G.seed % PLACES.length];
export function genCamps(seed: number) {
    const R = mulberry32(seed + 77), RANGES = [[22, 28], [27, 35], [33, 42], [39, 48], [45, 54], [50, 58]];
    for (let tier = 0; tier < 6; tier++) {
        for (let tries = 0; tries < 200; tries++) {
            const a = R() * TAU, r = RANGES[tier][0] + R() * (RANGES[tier][1] - RANGES[tier][0]);
            const x = Math.round(64 + Math.cos(a) * r), y = Math.round(64 + Math.sin(a) * r);
            if (!inb(x - 1, y - 1) || !inb(x + 2, y + 2))
                continue;
            let ok = true;
            for (let dy = -1; dy <= 2; dy++)
                for (let dx = -1; dx <= 2; dx++) {
                    if (ter[(y + dy) * W + x + dx] === 1)
                        ok = false;
                }
            if (!ok || G.camps.some(c => dist(c.x, c.y, x, y) < 14))
                continue;
            for (let dy = -1; dy <= 2; dy++)
                for (let dx = -1; dx <= 2; dx++)
                    node[(y + dy) * W + x + dx] = 0;
            const camp: Camp = { id: G.nid++, kind: 'c', x, y, tier, hp: 500 * (1 + tier * 1.2), mhp: 500 * (1 + tier * 1.2), alive: true };
            G.camps.push(camp);
            spawnCampGuards(camp);
            break;
        }
    }
}
function spawnCampGuards(c: Camp) {
    const n = 3 + c.tier * 2;
    for (let k = 0; k < n; k++) {
        const a = k / n * TAU;
        spawnFoe(c.tier === 5 && k % 2 ? 5 : Math.min(c.tier, 4), c.x + 1 + Math.cos(a) * 2, c.y + 1 + Math.sin(a) * 2, 1 + c.tier * .15, c);
    }
}
export const th = () => G.bs.find(b => b.type === 'townhall');
export function setG(v: GameState) {
    G = v;
    return v;
}
