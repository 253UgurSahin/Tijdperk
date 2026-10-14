import { bus, sigs } from '../core/bus';
import { DAYLEN } from '../core/constants';
import { $ } from '../core/dom';
import { dist } from '../core/util';
import { B } from '../data/buildings';
import { FOES, UNITS } from '../data/units';
import { selectArmy } from '../input/keyboard';
import { clearSel } from '../input/selection';
import { centerOn } from '../render/camera';
import { circ, portrait } from '../render/icons';
import { raidSize } from '../sim/combat';
import { bMaxHp, has, pay } from '../sim/rules';
import { G, sel } from '../sim/state';
import { hoursUntilRaid } from '../sim/time';
import { costHTML, setHTML } from './fmt';
import { toast } from './hud';
import { CB } from './inspector';

function repairCost() {
    let miss = 0;
    for (const b of G.bs)
        if (b.done)
            miss += bMaxHp(b) - b.hp;
    miss = Math.ceil(miss);
    return miss < 1 ? null : { wood: Math.ceil(miss * .08), stone: Math.ceil(miss * .05) };
}
export function renderDefense() {
    const th = G.bs.find(b => b.type === 'townhall'), hp = th ? th.hp / bMaxHp(th) : 0, raidNow = G.foes.filter(f => !f.camp && !f.retreat).length, hrs = hoursUntilRaid(), rc = repairCost();
    const secs = hrs == null ? null : hrs * DAYLEN / 24 / (G.speed || 1);
    const army: Record<string, number> = {};
    G.us.forEach(u => army[u.k] = (army[u.k] || 0) + 1);
    {
        const tw = G.bs.filter(b => b.done && b.type !== 'townhall' && B[b.type].def).length;
        $('#defSect').textContent = `${tw} ${tw === 1 ? 'toren' : 'torens'} · ${G.us.length} soldaten`;
    }
    const sig = JSON.stringify([Math.round(hp * 50), raidNow, secs == null ? -1 : Math.round(secs / 5), G.speed ? 1 : 0, rc && has(rc), !!rc, army, G.peaceful, G.camps.filter(c => c.alive).length]);
    setHTML($('#defense'), 'def', sig, () => `<div class="hlt"><span>Stamhuis${hp < .995 && !raidNow ? ' · herstelt vanzelf' : ''}</span><b>${Math.round(hp * 100)}%</b></div><div class="bar ${hp < .4 ? 'bad' : ''}"><i style="width:${hp * 100}%"></i></div>
    <div class="raidcard ${raidNow ? 'now' : ''}"><canvas class="moon" width="60" height="60"></canvas><div><b>${raidNow ? `${raidNow} aanvallers in je land` : G.peaceful ? 'Vredige modus' : secs == null ? 'Geen aanval gepland' : hrs! <= 0.01 ? 'Aanval begint' : `Aanval over ${Math.ceil(secs / 60)} min`}</b><small>${raidNow ? 'Dorpelingen schuilen' : G.peaceful ? 'Aanvallen staan uit' : `±${raidSize()} ${FOES[G.age].n.toLowerCase()}${G.speed ? '' : ' · gepauzeerd'}`}</small></div></div>
    <div class="cmd" style="margin-top:10px">${rc ? CB('data-act="repair"', '✚', 'Herstel', { dis: !has(rc), cost: costHTML(rc), tip: 'Herstel alle gebouwen' }) : ''}${CB('data-act="army"', '⚔', 'Kies leger', { dis: !G.us.length, tip: 'Selecteer het hele leger' })}${CB('data-act="rally"', '⌂', 'Naar huis', { dis: !G.us.length, tip: 'Leger terug naar het stamhuis' })}${CB('data-act="camps"', '◎', 'Vijandelijk kamp', { tip: 'Camera naar het dichtstbijzijnde vijandelijke kamp' })}</div>
    ${G.us.length ? `<div class="stack" style="margin-top:10px">${Object.keys(army).map(k => `<span title="${UNITS[k].n}"><img src="${portrait('u', k)}" alt=""><b>${army[k]}</b></span>`).join('')}</div>` : '<div class="statline"><i class="dot"></i>Geen leger · bouw een kazerne</div>'}
    <div class="statline"><i class="dot"></i>${G.camps.filter(c => c.alive).length} vijandelijke kampen</div>`);
    const m = document.querySelector<HTMLCanvasElement>('#defense .moon');
    if (m) {
        const x = m.getContext('2d')!;
        x.clearRect(0, 0, 60, 60);
        circ(x, 30, 30, 22, raidNow ? '#d97c6e' : '#d7c69a');
        circ(x, 38, 24, 18, raidNow ? '#f6e3df' : '#f1ece0');
    }
}
$('#defense').addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t || t.disabled)
        return;
    if (t.dataset.act === 'repair') {
        const rc = repairCost();
        if (rc && has(rc)) {
            pay(rc);
            G.bs.forEach(b => {
                if (b.done)
                    b.hp = bMaxHp(b);
            });
            toast('Alle gebouwen hersteld.', 'good');
        }
    }
    else if (t.dataset.act === 'army')
        selectArmy();
    else if (t.dataset.act === 'camps') {
        const c = G.camps.filter(c => c.alive).sort((a, b) => dist(a.x, a.y, 64, 64) - dist(b.x, b.y, 64, 64))[0];
        if (c) {
            centerOn(c.x + 1, c.y + 1);
            clearSel();
            sel.camp = c.id;
            bus.uiDirty = true;
        }
    }
    else if (t.dataset.act === 'rally') {
        const th = G.bs.find(x => x.type === 'townhall');
        G.us.forEach((u, k) => {
            u.tgt = null;
            u.order = 'move';
            u.path = null;
            u.gx = th!.x + 1 + (k % 5 - 2) * .8;
            u.gy = th!.y + 3 + Math.floor(k / 5) * .8;
        });
        toast('Het leger keert terug naar het stamhuis.');
    }
    sigs.def = null;
    bus.uiDirty = true;
});
