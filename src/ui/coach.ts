import type { AgeUpDef } from '../types';
import { sfx } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $ } from '../core/dom';
import { dist, fmt } from '../core/util';
import { AGES, AGE_UP } from '../data/ages';
import { B, BKEYS } from '../data/buildings';
import { GATHER, RES } from '../data/resources';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { avail } from '../sim/caches';
import { popCap, popNow } from '../sim/entities';
import { lackText } from '../sim/placement';
import { built, has } from '../sim/rules';
import { G, bById, sel, th } from '../sim/state';
import { hoursUntilRaid, isNight } from '../sim/time';
import { ageUp } from './age';
import { setTab } from './commands';
import { setExpand, toast } from './hud';
import { ui } from './state';

$('#coachBtn').onclick = () => {
    if (!coachAct)
        return;
    sfx('tick');
    const a = coachAct;
    if (a.b) {
        setTab(B[a.b].cat);
        ui.placing = a.b;
        ui.expandMode = false;
        clearSel();
        sigs.grid = null;
        if (!has(B[a.b].cost))
            toast(`Nog ${lackText(B[a.b].cost)} nodig. Je kunt alvast een plek zoeken.`);
    }
    else if (a.k === 'expand')
        setExpand(true);
    else if (a.k === 'age')
        ageUp();
    else if (a.k === 'alarm') {
        const h = th()!, f = G.foes.filter(f => !f.camp && !f.retreat).sort((p, q) => dist(p.x, p.y, h.x, h.y) - dist(q.x, q.y, h.x, h.y))[0];
        if (f)
            centerOn(f.x, f.y);
    }
    else if (a.k === 'sel') {
        const b = bById.get(a.id!);
        if (b) {
            clearSel();
            sel.b = b.id;
            centerOn(b.x + 1, b.y + 1);
        }
    }
    bus.uiDirty = true;
};
/** Coach button action: place building `b`, or command `k` ('alarm', 'expand', 'age', or 'sel' building `id`). */
interface CoachAct { l: string; b?: string; k?: string; id?: number }
/** Next-step advice: title, hint, build tile to highlight and button action. */
interface CoachTip { t: string; h: string; tile?: string; act?: CoachAct }
export let coachTile: string | null = null, coachAct: CoachAct | null = null;
export const placed = (k: string): boolean => G.bs.some(b => b.type === k);
function bestHouse() {
    return BKEYS.filter(k => B[k].pop && k !== 'townhall' && !B[k].nobuild && B[k].age <= G.age).sort((a, b) => B[b].age - B[a].age)[0];
}
export function lackList(nx: AgeUpDef): string[] {
    const out = [];
    for (const k in nx.cost)
        if (G.res[k] < nx.cost[k])
            out.push(`${fmt(Math.ceil(nx.cost[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
    for (const n of nx.need)
        if (!built(n))
            out.push(`een ${B[n].n.toLowerCase()}`);
    if (popNow() < nx.pop)
        out.push(`${nx.pop - popNow()} inwoners`);
    return out;
}
export const andJoin = (a: string[]): string => a.length > 2 ? a.slice(0, 2).join(', ') + ' en meer' : a.length === 2 ? a[0] + ' en ' + a[1] : a[0] || '';
const bAct = (k: string) => ({ l: 'Bouw ' + B[k].n.toLowerCase(), b: k });
export function coach(): CoachTip {
    const nx = AGE_UP[G.age + 1], NA = nx && AGES[G.age + 1].n.toLowerCase(), pn = popNow(), cap = popCap();
    const raid = G.foes.filter(f => !f.camp && !f.retreat).length;
    if (raid)
        return { t: 'Aanval!', h: `${raid} vijanden in je land. Je dorpelingen schuilen. Torens en soldaten verdedigen.`, act: { l: 'Bekijk de aanval', k: 'alarm' } };
    const lit = G.bs.some(b => b.type !== 'townhall' && B[b.type].light && !B[b.type].gen);
    const dark = G.vs.filter(v => v.state === 'sleep' || (v.state === 'walk' && v.on === 'sleep')).length;
    if (isNight() && dark && !lit && B.campfire.age <= G.age)
        return { t: `Het is donker: ${dark} ${dark === 1 ? 'dorpeling stopt' : 'dorpelingen stoppen'} met werken.`, h: 'Bij een kampvuur werken ze ’s nachts door. Zet het bij de bomen of akkers.', tile: 'campfire', act: bAct('campfire') };
    const hrs = hoursUntilRaid();
    if (!G.peaceful && hrs != null && hrs < 7.5) {
        const def = G.bs.some(b => b.type !== 'townhall' && B[b.type].def);
        const bar = G.bs.find(b => b.type === 'barracks' && b.done);
        if (!def && G.us.length < 3) {
            if (bar)
                return { t: 'Vannacht komt een aanval.', h: 'Train een paar soldaten in de kazerne, of bouw een toren bij het stamhuis.', act: { l: 'Naar de kazerne', k: 'sel', id: bar.id } };
            const tw = BKEYS.filter(k => B[k].def && B[k].cat === 'mil' && !B[k].nobuild && B[k].age <= G.age).sort((a, b) => B[b].age - B[a].age)[0];
            if (tw)
                return { t: 'Vannacht komt een aanval.', h: `Bouw een ${B[tw].n.toLowerCase()} bij het stamhuis om je dorp te verdedigen.`, tile: tw, act: bAct(tw) };
        }
    }
    if (G.age === 0) {
        if (!placed('hut'))
            return { t: 'Bouw een hut.', h: `Je stam zit vol (${pn}/${cap}). Met een hut is er plek voor nieuwe dorpelingen.`, tile: 'hut', act: bAct('hut') };
        if (!placed('farm'))
            return { t: 'Leg een akker aan.', h: 'Een akker geeft voedsel dat nooit opraakt.', tile: 'farm', act: bAct('farm') };
        if (!placed('storage'))
            return { t: 'Bouw een opslagplaats.', h: 'Zet hem bij de bomen: dan lopen je dorpelingen minder ver. Nodig voor de bronstijd.', tile: 'storage', act: bAct('storage') };
        if (!placed('campfire'))
            return { t: 'Steek een kampvuur aan.', h: 'In het licht werken dorpelingen ook ’s nachts door.', tile: 'campfire', act: bAct('campfire') };
        if (!G.peaceful && !placed('barracks'))
            return { t: 'Bouw een kazerne.', h: 'Vanaf de tweede nacht vallen vijanden aan. In de kazerne train je verdedigers.', tile: 'barracks', act: bAct('barracks') };
    }
    if (!nx) {
        if (!placed('command'))
            return { t: 'Bouw het commandocentrum.', h: 'Daarmee voltooi je je beschaving.', tile: 'command', act: bAct('command') };
        return { t: G.won ? 'Je beschaving is voltooid.' : 'Het commandocentrum wordt gebouwd.', h: G.won ? 'Bouw gerust verder.' : 'Nog even geduld.' };
    }
    for (const n of nx.need)
        if (!placed(n))
            return { t: `Bouw een ${B[n].n.toLowerCase()}.`, h: `Nodig voor de ${NA}.${B[n].desc ? ' ' + B[n].desc : ''}`, tile: n, act: bAct(n) };
    if (pn < nx.pop && pn >= cap) {
        const h = bestHouse();
        return { t: `Bouw een ${B[h].n.toLowerCase()}.`, h: `Er is geen plek voor meer inwoners (${pn}/${cap}). De ${NA} vraagt er ${nx.pop}.`, tile: h, act: bAct(h) };
    }
    for (const k in nx.cost) {
        if (G.res[k] >= nx.cost[k])
            continue;
        const left = fmt(Math.ceil(nx.cost[k] - G.res[k]));
        if (GATHER.includes(k) && !avail[k])
            return { t: 'Breid je gebied uit.', h: `Er ligt nog geen ${RES[k].n.toLowerCase()} binnen je grenzen. Je hebt er nog ${left} nodig.`, act: { l: 'Gebied uitbreiden', k: 'expand' } };
        if (RES[k].cr) {
            const mk = BKEYS.find(b => B[b].conv && B[b].conv.out[k]);
            if (mk && !placed(mk))
                return { t: `Bouw een ${B[mk].n.toLowerCase()}.`, h: `Daar maak je ${RES[k].n.toLowerCase()}, nodig voor de ${NA}.`, tile: mk, act: bAct(mk) };
            if (mk) {
                const inp = Object.keys(B[mk].conv!.in).filter(r => G.res[r] < 5);
                return { t: `Nog ${left} ${RES[k].n.toLowerCase()} nodig.`, h: inp.length ? `De ${B[mk].n.toLowerCase()} wacht op ${inp.map(r => RES[r].n.toLowerCase()).join(' en ')}.` : `De ${B[mk].n.toLowerCase()} maakt het vanzelf.` };
            }
        }
    }
    if (pn < nx.pop)
        return { t: `Je stam groeit: ${pn} van ${nx.pop} inwoners.`, h: G.autoTrain ? 'Het stamhuis traint vanzelf dorpelingen zolang er voedsel is.' : 'Train dorpelingen in het stamhuis.' };
    const miss = lackList(nx);
    if (miss.length)
        return { t: `Op weg naar de ${NA}.`, h: `Nog ${andJoin(miss)} nodig. Je dorpelingen verzamelen vanzelf.` };
    return { t: `Klaar voor de ${NA}!`, h: 'Alles is binnen. Zet de stap naar een nieuw tijdperk.', act: { l: `Naar de ${NA}`, k: 'age' } };
}
export function setCoachAct(v: typeof coachAct) {
    coachAct = v;
    return v;
}
export function setCoachTile(v: typeof coachTile) {
    coachTile = v;
    return v;
}
