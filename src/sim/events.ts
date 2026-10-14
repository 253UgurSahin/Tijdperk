import type { Cost, GameEvent } from '../types';
import { bus, note, pulseRes, sfx, sigs, toast } from '../core/bus';
import { DAYLEN, W } from '../core/constants';
import { dist } from '../core/util';
import { NI } from '../data/nodes';
import { GATHER, RES } from '../data/resources';
import { UNITS } from '../data/units';
import { spawnUnit, spawnVillager } from './entities';
import { burst } from './fx';
import { bMaxHp, built, has, pay } from './rules';
import { G, placeName, sel, th } from './state';
import { raidNight, season } from './time';
import { inb, isUnl, node, nodeLists } from './world';

function bestMerc() {
    return Object.keys(UNITS).filter(k => UNITS[k].src === 'barracks' && UNITS[k].age <= G.age).pop()!;
}
/** Random events: a choice between option a (usually paid) and b. */
interface EventDef {
    id: string;
    g: string;
    t: string;
    x: (ev: GameEvent) => string;
    cond?: () => boolean;
    pre?: (ev: GameEvent) => void;
    a: { l: string; c?: () => Cost; f?: (ev: GameEvent) => void };
    b: { l: string; f?: (ev: GameEvent) => void };
}
export const EVENTS: EventDef[] = [
    { id: 'refugees', g: '☺', t: 'Vluchtelingen', x: () => `Drie reizigers vragen onderdak in ${placeName()}.`, a: { l: 'Neem ze op', c: () => ({ food: 60 + G.age * 20 }), f: () => {
                const h = th()!;
                for (let k = 0; k < 3; k++)
                    spawnVillager(h.x + .5 + k * .6, h.y + 2.4);
                toast('Drie nieuwe dorpelingen sluiten zich aan.', 'good');
            } }, b: { l: 'Stuur weg' } },
    { id: 'feast', g: '✺', t: 'Oogstfeest', x: () => 'Het volk vraagt om een feest. Het kost voedsel, maar iedereen werkt daarna een tijd harder.', a: { l: 'Vier het', c: () => ({ food: 150 + G.age * 60 }), f: () => {
                G.buff.work = G.t + DAYLEN * 1.5;
                toast('Feest! Iedereen werkt anderhalve dag 25% sneller.', 'good');
            } }, b: { l: 'Niet nu' } },
    { id: 'sick', g: '✚', t: 'Ziekte', cond: () => G.vs.length > 8, x: () => 'Er waart een ziekte rond. Genezers kunnen helpen, voor een prijs.', a: { l: 'Betaal genezers', c: (): Cost => G.age >= 2 ? { gold: 40 + G.age * 20 } : { food: 140 } }, b: { l: 'Laat het gaan', f: () => {
                for (let k = 0; k < 2 && G.vs.length > 3; k++) {
                    const v = G.vs[(Math.random() * G.vs.length) | 0];
                    G.vs = G.vs.filter(x => x !== v);
                    sel.vs.delete(v.id);
                }
                toast('Twee dorpelingen zijn bezweken aan de ziekte.', 'bad');
            } } },
    { id: 'fire', g: '♨', t: 'Bliksem in het bos', cond: () => !!forestTile(), x: () => 'Een blikseminslag zet het bos bij je dorp in brand.', a: { l: 'Blussen', c: () => ({ wood: 60 + G.age * 20 }), f: () => toast('Het vuur is geblust.', 'good') }, b: { l: 'Laten branden', f: ev => burnForest(ev.fx!, ev.fy!) } },
    { id: 'mercs', g: '⚔', t: 'Huurlingen', cond: () => built('barracks'), x: () => `Drie ${UNITS[bestMerc()].n.toLowerCase()}s bieden hun diensten aan.`, a: { l: 'Huur ze', c: (): Cost => G.age >= 2 ? { gold: 60 + G.age * 30 } : { food: 200, wood: 80 }, f: () => {
                const h = th()!, k = bestMerc();
                for (let i = 0; i < 3; i++) {
                    const u = spawnUnit(k, h.x + 1 + i * .6, h.y + 3);
                    u.stance = G.stance;
                }
                toast('Drie huurlingen voegen zich bij je leger.', 'good');
            } }, b: { l: 'Weiger' } },
    { id: 'tribute', g: '⚑', t: 'Schatting', cond: () => !G.peaceful && G.day >= 3 && !raidNight(), x: () => 'Plunderaars eisen schatting. Betaal, of ze vallen vannacht aan.', a: { l: 'Betaal', c: () => ({ food: 100 + G.age * 60, wood: 80 + G.age * 40 }) }, b: { l: 'Weiger', f: () => {
                G.forceRaid = G.day;
                toast('Ze komen vannacht. Bereid je voor.', 'bad');
            } } },
    { id: 'vein', g: '◆', t: 'Rijke vondst', x: ev => `Verkenners vinden een rijke laag ${RES[ev.r!].n.toLowerCase()} in de rivierbedding.`, pre: ev => {
            const r = GATHER.filter(r => RES[r].age <= G.age && r !== 'food' && r !== 'wood');
            ev.r = r[(Math.random() * r.length) | 0];
        }, a: { l: 'Graaf het op', c: () => ({ food: 50 + G.age * 20 }), f: ev => {
                const n = 150 + G.age * 80;
                G.res[ev.r!] += n;
                pulseRes(ev.r!);
                toast(`+${n} ${RES[ev.r!].n.toLowerCase()}.`, 'good');
            } }, b: { l: 'Laat liggen' } },
    { id: 'storm', g: '☂', t: 'Storm op komst', cond: () => season().n !== 'Zomer' && G.bs.length > 6, x: () => 'Een zware storm trekt over de vallei. Versterk de daken of neem de schade.', a: { l: 'Versterk daken', c: () => ({ wood: 80 + G.age * 30 }) }, b: { l: 'Afwachten', f: () => {
                const c = G.bs.filter(b => b.done && b.type !== 'townhall');
                for (let k = 0; k < 3 && c.length; k++) {
                    const b = c.splice((Math.random() * c.length) | 0, 1)[0];
                    b.hp = Math.max(1, b.hp - bMaxHp(b) * .35);
                    b.flash = .4;
                }
                G.rain = 1;
                toast('De storm heeft drie gebouwen beschadigd.', 'bad');
            } } },
];
function forestTile() {
    const L = nodeLists[NI.tree];
    for (let k = 0; k < 40; k++) {
        const i = L[(Math.random() * L.length) | 0];
        if (i != null && node[i] === NI.tree && isUnl(i % W, (i / W) | 0))
            return i;
    }
    return null;
}
function burnForest(x: number, y: number) {
    let n = 0;
    for (let yy = y - 4; yy <= y + 4; yy++)
        for (let xx = x - 4; xx <= x + 4; xx++) {
            if (!inb(xx, yy) || dist(xx, yy, x, y) > 4)
                continue;
            const i = yy * W + xx;
            if (node[i] === NI.tree) {
                node[i] = 0;
                G.regrow.push({ i, t: NI.tree, at: G.t + 300 });
                n++;
                if (n % 2)
                    burst(xx + .5, yy + .5, '#3a2a20');
            }
        }
    bus.notePos = [x, y];
    toast(`Het vuur verwoestte ${n} bomen.`, 'bad');
}
export function spawnEvent() {
    const pool = EVENTS.filter(e => !e.cond || e.cond());
    if (!pool.length)
        return;
    const d = pool[(Math.random() * pool.length) | 0], ev: GameEvent = { id: d.id, until: G.t + 45 };
    if (d.pre)
        d.pre(ev);
    if (d.id === 'fire') {
        const i = forestTile()!;
        ev.fx = i % W;
        ev.fy = (i / W) | 0;
    }
    ev.text = d.x(ev);
    ev.ca = d.a.c ? d.a.c() : null;
    G.event = ev;
    G.lastEvent = G.t;
    sfx('alarm');
    sigs.ev = null;
    note(`${d.t}: ${ev.text}`, 'age');
}
export function resolveEvent(ch: string, timeout?: boolean) {
    const ev = G.event;
    if (!ev)
        return;
    const d = EVENTS.find(e => e.id === ev.id)!;
    if (ch === 'a') {
        if (ev.ca && !has(ev.ca))
            return;
        if (ev.ca)
            pay(ev.ca);
        if (d.a.f)
            d.a.f(ev);
        else
            toast(`${d.t}: geregeld.`, 'good');
        sfx('upgrade');
    }
    else {
        if (timeout)
            note(`Geen keuze gemaakt: ${d.b.l.toLowerCase()}.`);
        if (d.b.f)
            d.b.f(ev);
        else
            note(`${d.t}: ${d.b.l.toLowerCase()}.`);
    }
    G.event = null;
    sigs.ev = null;
    bus.uiDirty = true;
}
export function makeOffer() {
    const gath = GATHER.filter(r => RES[r].age <= G.age), want = gath[(Math.random() * gath.length) | 0];
    let give = gath[(Math.random() * gath.length) | 0];
    if (give === want)
        give = gath[(gath.indexOf(want) + 1) % gath.length];
    const amt = 100 + G.age * 60, price = Math.round(amt * (1.1 + Math.random() * .7) * (RES[want].age + 1) / (RES[give].age + 1));
    G.offer = { want, amt, give, price, until: G.t + 70 };
    bus.notePos = null;
    toast(`Een reizende handelaar biedt ${amt} ${RES[want].n.toLowerCase()} voor ${price} ${RES[give].n.toLowerCase()}.`);
    sfx('select');
    sigs.offer = null;
}
