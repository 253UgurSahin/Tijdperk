// Paneel "Leger".
import { store } from '../../core/store.js';
import { CX, CY, DAYLEN } from '../../config.js';
import { B } from '../../data/buildings.js';
import { FOES, UNITS } from '../../data/units.js';
import { has, pay } from '../../game/economy.js';
import { isMarching, isRaider, raidSize } from '../../game/military.js';
import { dayPace } from '../../game/mods.js';
import { arrivalHour, clockText } from '../../game/rivals.js';
import { G, sel } from '../../game/state.js';
import { hoursUntilRaid } from '../../game/time.js';
import { bMaxHp } from '../../game/upgrades.js';
import { selectArmy } from '../../input/input.js';
import { clearSel } from '../../input/selection.js';
import { centerOn } from '../../render/camera.js';
import { circ, portrait } from '../../render/icons.js';
import { costHTML } from '../format.js';
import { setHTML, sigs } from '../header.js';
import { toast } from '../hud.js';
import { CB } from '../inspector.js';
import { $ } from '../../util/dom.js';
import { dist } from '../../util/math.js';

function repairCost() {
  let miss = 0;
  for (const b of G.bs) if (b.done) miss += bMaxHp(b) - b.hp;
  miss = Math.ceil(miss);
  return miss < 1 ? null : { wood: Math.ceil(miss * 0.08), stone: Math.ceil(miss * 0.05) };
}
// Wat de aanvalskaart zegt: een aanval in je land, rivalen onderweg, of wanneer de volgende nachtelijke aanval komt
function raidCardText(raidNow, marching, hrs, secs) {
  if (raidNow) return { title: `${raidNow} aanvallers in je land`, sub: 'Dorpelingen schuilen' };
  if (marching.length) {
    const n = marching.length;
    return {
      title: `Onderweg: ${n} ${n === 1 ? 'soldaat' : 'soldaten'} van een rivaal`,
      sub: `Rond ${clockText(arrivalHour(marching))} hier · maak je leger klaar`,
    };
  }
  if (G.peaceful) return { title: 'Vredige modus', sub: 'Aanvallen staan uit' };
  let title = `Aanval over ${Math.ceil(secs / 60)} min`;
  if (secs == null) title = 'Geen aanval gepland';
  else if (hrs <= 0.01) title = 'Aanval begint';
  const sub = `±${raidSize()} ${FOES[G.age].n.toLowerCase()}${G.speed ? '' : ' · gepauzeerd'}`;
  return { title, sub };
}

export function renderDefense() {
  const th = G.bs.find(b => b.type === 'townhall'),
    hp = th ? th.hp / B.townhall.hp : 0,
    raidNow = G.foes.filter(isRaider).length,
    marching = G.foes.filter(isMarching), // soldaten van rivalen die nog onderweg zijn: nog niet in je land
    hrs = hoursUntilRaid(),
    rc = repairCost();
  // Uren op de klok omrekenen naar echte seconden (met Snelle dagen loopt de klok sneller)
  const secs = hrs == null ? null : (hrs * DAYLEN) / 24 / dayPace() / (G.speed || 1);
  const card = raidCardText(raidNow, marching, hrs, secs);
  const army = {};
  G.us.forEach(u => (army[u.k] = (army[u.k] || 0) + 1));
  {
    const tw = G.bs.filter(b => b.done && b.type !== 'townhall' && B[b.type].def).length;
    $('#defSect').textContent = `${tw} ${tw === 1 ? 'toren' : 'torens'} · ${G.us.length} soldaten`;
  }
  const sig = JSON.stringify([
    Math.round(hp * 50),
    raidNow,
    card.title,
    card.sub,
    secs == null ? -1 : Math.round(secs / 5),
    G.speed ? 1 : 0,
    rc && has(rc),
    !!rc,
    army,
    G.peaceful,
    G.camps.filter(c => c.alive).length,
  ]);
  setHTML(
    $('#defense'),
    'def',
    sig,
    () => `<div class="hlt"><span>Stamhuis${hp < 0.995 && !raidNow ? ' · herstelt vanzelf' : ''}</span><b>${Math.round(hp * 100)}%</b></div><div class="bar ${hp < 0.4 ? 'bad' : ''}"><i style="width:${hp * 100}%"></i></div>
    <div class="raidcard ${raidNow ? 'now' : ''}"><canvas class="moon" width="60" height="60"></canvas><div><b>${card.title}</b><small>${card.sub}</small></div></div>
    <div class="cmd" style="margin-top:10px">${rc ? CB('data-act="repair"', '✚', 'Herstel', { dis: !has(rc), cost: costHTML(rc, true), tip: 'Herstel alle gebouwen' }) : ''}${CB('data-act="army"', '⚔', 'Kies leger', { dis: !G.us.length, tip: 'Selecteer het hele leger' })}${CB('data-act="rally"', '⌂', 'Naar huis', { dis: !G.us.length, tip: 'Leger terug naar het stamhuis' })}${CB('data-act="camps"', '◎', 'Vijandelijk kamp', { tip: 'Camera naar het dichtstbijzijnde vijandelijke kamp' })}</div>
    ${
      G.us.length
        ? `<div class="stack" style="margin-top:10px">${Object.keys(army)
            .map(
              k =>
                `<span title="${UNITS[k].n}"><img src="${portrait('u', k)}" alt=""><b>${army[k]}</b></span>`,
            )
            .join('')}</div>`
        : '<div class="statline"><i class="dot"></i>Geen leger · bouw een kazerne</div>'
    }
    <div class="statline"><i class="dot"></i>${G.camps.filter(c => c.alive).length} vijandelijke kampen</div>`,
  );
  const m = document.querySelector('#defense .moon');
  if (m) {
    const x = m.getContext('2d');
    x.clearRect(0, 0, 60, 60);
    circ(x, 30, 30, 22, raidNow ? '#d97c6e' : '#d7c69a');
    circ(x, 38, 24, 18, raidNow ? '#f6e3df' : '#f1ece0');
  }
}
$('#defense').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  if (t.dataset.act === 'repair') {
    const rc = repairCost();
    if (rc && has(rc)) {
      pay(rc);
      G.bs.forEach(b => {
        if (b.done) b.hp = bMaxHp(b);
      });
      toast('Alle gebouwen hersteld.', 'good');
    }
  } else if (t.dataset.act === 'army') selectArmy();
  else if (t.dataset.act === 'camps') {
    const c = G.camps.filter(c => c.alive).sort((a, b) => dist(a.x, a.y, CX, CY) - dist(b.x, b.y, CX, CY))[0];
    if (c) {
      centerOn(c.x + 1, c.y + 1);
      clearSel();
      sel.camp = c.id;
      store.uiDirty = true;
    }
  } else if (t.dataset.act === 'rally') {
    const th = G.bs.find(x => x.type === 'townhall');
    G.us.forEach((u, k) => {
      u.tgt = null;
      u.order = 'move';
      u.path = null;
      u.gx = th.x + 1 + ((k % 5) - 2) * 0.8;
      u.gy = th.y + 3 + Math.floor(k / 5) * 0.8;
    });
    toast('Het leger keert terug naar het stamhuis.');
  }
  sigs.def = null;
  store.uiDirty = true;
});
