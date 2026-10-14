import { note, sfx, sigs, toast } from '../core/bus';
import { dist } from '../core/util';
import { NODES } from '../data/nodes';
import { RKEYS } from '../data/resources';
import { TK } from '../data/tech';
import { bUpdate } from './buildings';
import { computeAvail, computeCaches } from './caches';
import { fUpdate, raidPing, setRaidPing, uUpdate, updateProj } from './combat';
import { spawnFoe } from './entities';
import { makeOffer, resolveEvent, spawnEvent } from './events';
import { bMaxHp, hasT } from './rules';
import { G, th } from './state';
import { advanceClock, isNight } from './time';
import { vUpdate } from './villagers';
import { amt, bmap, node, nodeLists } from './world';

let periodic = 0, slowP = 0, histT = 0;
export function update(dt: number) {
    if (G.over)
        return;
    G.t += dt;
    advanceClock(dt);
    if (!G.offer && G.day >= 2 && !isNight() && Math.random() < dt / 420)
        makeOffer();
    if (G.offer && G.t > G.offer.until) {
        G.offer = null;
        sigs.offer = null;
        note('De handelaar is verder getrokken.');
    }
    if (G.research) {
        G.research.t += dt;
        const T = TK[G.research.k];
        if (G.research.t >= T.t) {
            G.tech[T.k] = 1;
            if (T.k === 'masonry')
                G.bs.forEach(b => b.hp *= 1.25);
            G.research = null;
            toast(`Onderzoek klaar: ${T.n}. ${T.d}.`, 'good');
            sfx('upgrade');
            sigs.upg = null;
        }
    }
    if (hasT('medicine'))
        for (const v of G.vs)
            if (!v.hidden)
                v.hp = Math.min(v.mhp, v.hp + dt);
    if (!G.event && G.day >= 2 && !isNight() && G.t - G.lastEvent > 150 && Math.random() < dt / 220)
        spawnEvent();
    if (G.event && G.t > G.event.until)
        resolveEvent('b', true);
    histT -= dt;
    if (histT <= 0) {
        histT = 10;
        G.hist.push(RKEYS.map(k => Math.round(G.res[k])));
        if (G.hist.length > 60)
            G.hist.shift();
    }
    periodic -= dt;
    if (periodic <= 0) {
        periodic = .5;
        computeCaches();
    }
    slowP -= dt;
    if (slowP <= 0) {
        slowP = 2;
        computeAvail();
    }
    G.res.food -= (G.vs.length * .05 + G.us.length * .08) * dt;
    if (G.res.food < 0) {
        G.res.food = 0;
        if (!G.hungry) {
            G.hungry = true;
            toast('Er is geen voedsel meer. Je volk werkt half zo snel.', 'bad');
        }
    }
    else if (G.res.food > 20)
        G.hungry = false;
    for (const b of G.bs)
        bUpdate(b, dt);
    for (const v of G.vs)
        vUpdate(v, dt);
    for (const u of G.us)
        uUpdate(u, dt);
    for (const f of G.foes)
        if (!f.dead)
            fUpdate(f, dt);
    G.foes = G.foes.filter(f => !f.dead);
    if (G.spawnQ.length) {
        const now = G.spawnQ.filter(s => s.at <= G.t);
        if (now.length) {
            for (const s of now)
                spawnFoe(s.type, s.x, s.y, s.scale);
            G.spawnQ = G.spawnQ.filter(s => s.at > G.t);
        }
    }
    updateProj(dt);
    for (const e of G.fx) {
        e.life -= dt;
        if (e.type === 'smoke') {
            e.z += e.vz * dt;
            e.x += .12 * dt;
            e.y -= .12 * dt;
        }
        else if (e.type === 'float')
            e.z = (e.z || 0) + dt * 18;
        else if (e.type === 'chip') {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.z += e.vz * dt;
            e.vz -= 180 * dt;
            if (e.z < 0)
                e.z = 0;
        }
    }
    G.fx = G.fx.filter(e => e.life > 0);
    {
        const h = th();
        if (h && h.done && !G.over) {
            const mx = bMaxHp(h);
            if (h.hp < mx && !G.foes.some(f => !f.retreat && (!f.camp || dist(f.x, f.y, h.x + 1, h.y + 1) < 12)))
                h.hp = Math.min(mx, h.hp + mx * dt / 240);
        }
    }
    if (G.regrow.length && Math.random() < dt)
        G.regrow = G.regrow.filter(r => {
            if (r.at > G.t)
                return true;
            if (!node[r.i] && !bmap[r.i]) {
                node[r.i] = r.t;
                amt[r.i] = NODES[r.t].amt[0];
                nodeLists[r.t].push(r.i);
            }
            return false;
        });
    if (raidPing) {
        raidPing.t -= dt;
        if (raidPing.t <= 0)
            setRaidPing(null);
    }
}
