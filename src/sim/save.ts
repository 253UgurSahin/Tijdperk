import type { Building, GameState, Stance } from '../types';
import { W } from '../core/constants';
import { B } from '../data/buildings';
import { spawnFoe, spawnUnit, spawnVillager } from './entities';
import { G, bById, baseState, setG } from './state';
import { amt, bmap, buildLists, genWorld, node, road, setBlk } from './world';

export const SKEY = 'tijdperken-save-v3';
function b64(u8: Uint8Array): string {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000)
        s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000) as unknown as number[]);
    return btoa(s);
}
function ub64(b: string): Uint8Array {
    const s = atob(b), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++)
        u[i] = s.charCodeAt(i);
    return u;
}
export function serialize(cam: { x: number; y: number; z: number }): string {
    const g: Record<string, unknown> = {};
    for (const k of ['age', 'res', 't', 'clock', 'day', 'unl', 'raids', 'tools', 'carryCap', 'autoTrain', 'peaceful', 'won', 'bought', 'stats', 'nid', 'trainQ', 'log', 'toolLvl', 'armsLvl', 'rain', 'groups', 'hist', 'stance', 'diff', 'tech', 'research', 'buff', 'forceRaid', 'lastEvent'] as (keyof GameState)[])
        g[k] = G[k];
    return JSON.stringify({ v: 3, seed: G.seed, g, road: b64(road), node: b64(node), amt: b64(new Uint8Array(amt.buffer)),
        bs: G.bs.map(b => ({ id: b.id, type: b.type, lvl: b.lvl || 0, x: b.x, y: b.y, hp: b.hp, done: b.done, prog: b.prog, bt: b.bt, on: b.on, q: b.q, rally: b.rally })),
        vs: G.vs.map(v => ({ x: v.x, y: v.y, name: v.name, job: v.job, hp: v.hp })), us: G.us.map(u => ({ k: u.k, x: u.x, y: u.y, hp: u.hp, st: u.stance || 'guard', id: u.id })),
        camps: G.camps.map(c => ({ id: c.id, x: c.x, y: c.y, tier: c.tier, hp: c.hp, mhp: c.mhp, alive: c.alive })),
        guards: G.foes.filter(f => f.camp).map(f => ({ type: f.type, x: f.x, y: f.y, hp: f.hp, mhp: f.mhp, camp: f.camp })), cam: { x: cam.x, y: cam.y, z: cam.z }, cv: 2 });
}
/** The JSON stored in localStorage (format v3). */
export interface SaveData {
    v: 3;
    seed: number;
    g: Partial<GameState>;
    road?: string;
    node: string;
    amt: string;
    bs: (Pick<Building, 'id' | 'type' | 'x' | 'y' | 'hp' | 'done' | 'prog' | 'bt' | 'on' | 'q' | 'rally'> & { lvl: number })[];
    vs: { x: number; y: number; name: string; job: string; hp: number }[];
    us: { k: string; x: number; y: number; hp: number; st?: Stance; id?: number }[];
    camps: { id: number; x: number; y: number; tier: number; hp: number; mhp: number; alive: boolean }[];
    guards: { type: number; x: number; y: number; hp: number; mhp: number; camp: number }[];
    cam?: { x: number; y: number; z?: number };
    cv?: number;
}
export function restore(str: string): SaveData | null {
    const s: SaveData = JSON.parse(str);
    if (s.v !== 3)
        return null;
    setG(baseState(s.seed));
    genWorld(s.seed);
    Object.assign(G, s.g);
    G.groups = G.groups || {};
    G.hist = G.hist || [];
    G.offer = null;
    G.stats = Object.assign(baseState(0).stats, s.g.stats);
    G.log = s.g.log || [];
    G.toolLvl = s.g.toolLvl || 0;
    G.armsLvl = s.g.armsLvl || 0;
    G.tech = G.tech || {};
    G.buff = G.buff || {};
    G.diff = G.diff == null ? 1 : G.diff;
    G.event = null;
    if (s.road)
        road.set(ub64(s.road));
    node.set(ub64(s.node));
    amt.set(new Uint16Array(ub64(s.amt).buffer));
    buildLists();
    bById.clear();
    for (const o of s.bs) {
        const d = B[o.type];
        const b: Building = { ...o, kind: 'b', cd: 0, ct: 0, gt: d.gen ? d.gen.t ?? 0 : 0, run: false, qt: 0, act: 0, q: o.q || [] };
        G.bs.push(b);
        bById.set(b.id, b);
        for (let dy = 0; dy < d.size; dy++)
            for (let dx = 0; dx < d.size; dx++)
                bmap[(b.y + dy) * W + b.x + dx] = b.id;
        if (b.done)
            setBlk(b, true);
    }
    for (const o of s.vs) {
        const v = spawnVillager(o.x, o.y);
        v.name = o.name;
        v.job = o.job;
        v.hp = o.hp;
    }
    for (const o of s.us) {
        const u = spawnUnit(o.k, o.x, o.y);
        u.hp = o.hp;
        u.stance = o.st || 'guard';
        if (o.id)
            u.id = o.id;
    }
    G.camps = s.camps.map(c => ({ ...c, kind: 'c' }));
    for (const o of s.guards) {
        const c = G.camps.find(c => c.id === o.camp);
        if (!c)
            continue;
        const f = spawnFoe(o.type, o.x, o.y, 1, c);
        f.hp = o.hp;
        f.mhp = o.mhp;
        f.hx = c.x + 1 + (Math.random() - .5) * 3;
        f.hy = c.y + 1 + (Math.random() - .5) * 3;
    }
    return s;
}
