import type { Building, Stance, Villager } from '../types';
// Selectiepaneel: info en knoppen voor wat je hebt aangeklikt.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { W } from '../config';
import { AGES } from '../data/ages';
import { B } from '../data/buildings';
import { NODES } from '../data/nodes';
import { GATHER, RES } from '../data/resources';
import { UNITS } from '../data/units';
import { avail, computeCaches, powerRatio, siteCnt } from '../game/caches';
import { gain, has, pay } from '../game/economy';
import { popCap, popNow, trainCost } from '../game/entities';
import { burst } from '../game/fx';
import { G, bById, placeName, sel } from '../game/state';
import {
  UPG_OK,
  armsCost,
  armsMul,
  bMaxHp,
  bPop,
  lvlOf,
  maxLvl,
  toolCost,
  upgCost,
  upgEffect,
  upgrade,
  upgradeArms,
  upgradeTools,
} from '../game/upgrades';
import { unhide } from '../game/villagers';
import { clearSel, resetV, selUnits, selVills } from '../input/selection';
import { centerOn } from '../render/camera';
import { iconFor, portrait } from '../render/icons';
import { bShort } from './buildmenu';
import { TOUCH, costHTML, esc, fmt, gem, hy } from './format';
import { setHTML, sigs } from './header';
import { setExpand, toast } from './hud';
import { $ } from '../util/dom';
import { clamp, dist } from '../util/math';
import { amt, bmap, isUnl, node, setBlk } from '../world/world';
import { canMake } from '../data/succession';

// Selectiepaneel
/** Opties voor een knop in het selectiepaneel. */
interface CmdOpts {
  on?: boolean;
  danger?: boolean | 1;
  dis?: boolean;
  tip?: string;
  img?: string;
  cost?: string;
}
export const CB = (data: string, glyph: string, label: string, o: CmdOpts = {}): string =>
  `<button class="cb ${o.on ? 'on' : ''} ${o.danger ? 'danger' : ''}" ${data} ${o.dis ? 'disabled' : ''} title="${esc(o.tip || label)}">${o.img ? `<img src="${o.img}" alt="">` : `<span class="g">${glyph}</span>`}<span class="l">${hy(label)}</span>${o.cost ? `<span class="c">${o.cost}</span>` : ''}</button>`;
// Selectiepaneel met de knoppen die bij de selectie horen
export let selCmds: string | null = null,
  selCtx = '';
export function renderInspector() {
  const p = $('#inspector'),
    vs = selVills(),
    us = selUnits(),
    b = sel.b && bById.get(sel.b),
    camp = sel.camp && G.camps.find(c => c.id === sel.camp && c.alive);
  const X = `<button class="quiet x" data-x="1" aria-label="Sluiten">${TOUCH ? 'Sluiten' : '×'}</button>`;
  const im = (src: string) => `<img src="${src}" alt="">`;
  const head = (port: string, t: string, sub: string) =>
    `${X}<div class="selh"><div class="port">${port}</div><div><div class="selt">${t}</div><div class="sels">${sub}</div></div></div>`;
  const hpl = (f: number, txt: string, cls = '') =>
    `<div class="hpline"><div class="bar ${cls}"><i style="width:${clamp(f, 0, 1) * 100}%"></i></div><span>${txt}</span></div>`;
  if (!vs.length && !us.length && !b && !camp && sel.node < 0) {
    document.body.classList.remove('insp');
    selCmds = null;
    selCtx = '';
    const sig = 'e' + G.age + popNow() + popCap() + G.us.length + G.unl.filter(Boolean).length;
    return setHTML(
      p,
      'ins',
      sig,
      () =>
        `<div class="empty"><div class="selh" style="padding-right:0"><div class="port">${im(iconFor('townhall'))}</div><div><div class="selt">${placeName()}</div><div class="sels">${AGES[G.age].n} · ${AGES[G.age].lvl}</div></div></div><div class="stats"><span><i>⌂</i>${popNow()}/${popCap()} inwoners</span><span><i>⚔</i>${G.us.length} soldaten</span><span><i>◇</i>${G.unl.filter(Boolean).length} gebieden</span></div><p class="small" style="margin-top:8px">${TOUCH ? 'Tik' : 'Klik'} op een gebouw, dorpeling of soldaat om het te bekijken. Kies hiernaast wat je wilt bouwen.</p></div>`,
    );
  }
  document.body.classList.add('insp');
  if (us.length) {
    const by: Record<string, number> = {};
    us.forEach(u => (by[u.k] = (by[u.k] || 0) + 1));
    const hp = us.reduce((a, u) => a + u.hp, 0),
      mhp = us.reduce((a, u) => a + u.mhp, 0),
      st = new Set(us.map(u => u.stance || 'guard')),
      cur = st.size === 1 ? [...st][0] : null,
      U = UNITS[us[0].k],
      one = Object.keys(by).length === 1;
    selCtx = us.length === 1 ? U.n : 'Leger';
    selCmds =
      CB('data-u="stop"', '■', 'Stop', { tip: 'Stop en blijf hier staan (S)' }) +
      CB('data-u="amove"', '⚔', 'Aanvals­mars', {
        on: store.cmdMode === 'amove',
        tip: 'Loop naar een punt en vecht onderweg (F)',
      }) +
      CB('data-u="patrol"', '⇄', 'Patrouille', {
        on: store.cmdMode === 'patrol',
        tip: 'Loop heen en weer tussen hier en een punt (R)',
      }) +
      CB('data-u="home"', '⌂', 'Naar huis', { tip: 'Terug naar het stamhuis' }) +
      CB('data-st="guard"', '⛨', 'Verdedig', {
        on: cur === 'guard',
        tip: 'Vecht terug en keert daarna terug naar zijn plek',
      }) +
      CB('data-st="hold"', '▣', 'Blijf staan', {
        on: cur === 'hold',
        tip: 'Blijft staan en vecht alleen binnen bereik',
      }) +
      CB('data-st="aggr"', '➶', 'Achtervolg', {
        on: cur === 'aggr',
        tip: 'Gaat achter elke vijand in de buurt aan',
      });
    return setHTML(
      p,
      'ins',
      'u' + JSON.stringify(by) + Math.round((hp / mhp) * 20) + cur,
      () => `${head(im(portrait('u', us[0].k)), us.length === 1 ? U.n : one ? `${us.length} × ${U.n}` : 'Leger', `${us.length} ${us.length === 1 ? 'eenheid' : 'eenheden'}${G.armsLvl ? ` · pantser ${G.armsLvl + 1}` : ''}`)}${hpl(hp / mhp, `${Math.ceil(hp)}/${Math.ceil(mhp)}`)}
      ${
        one
          ? `<div class="stats"><span><i>⚔</i>${Math.round(U.dmg * armsMul())} schade</span><span><i>◎</i>bereik ${U.r}</span><span><i>»</i>snelheid ${U.spd}</span>${U.air ? '<span><i>✈</i>raakt drones</span>' : ''}</div>`
          : `<div class="stack">${Object.keys(by)
              .map(
                k =>
                  `<button class="pick" data-only="${k}" title="${UNITS[k].n}: klik = alleen deze, Shift-klik = deze eruit"><img src="${portrait('u', k)}" alt=""><b>${by[k]}</b></button>`,
              )
              .join('')}</div>`
      }`,
    );
  }
  if (vs.length) {
    const one = vs.length === 1 && vs[0],
      jobs = ['auto', 'build', ...GATHER.filter(r => RES[r].age <= G.age)],
      cur = new Set(vs.map(v => v.job));
    selCmds = null;
    selCtx = '';
    const st = (v: Villager) =>
      v.hidden
        ? v.state === 'sleep'
          ? 'Slaapt binnen'
          : 'Schuilt binnen'
        : v.state === 'gather'
          ? 'Verzamelt ' + RES[v.res!].n.toLowerCase()
          : v.state === 'build'
            ? 'Bouwt'
            : v.state === 'walk'
              ? v.on === 'drop'
                ? 'Brengt spullen weg'
                : v.on === 'sleep'
                  ? 'Gaat naar huis'
                  : v.on === 'shelter'
                    ? 'Vlucht naar binnen'
                    : 'Onderweg'
              : 'Wacht op werk';
    return setHTML(
      p,
      'ins',
      'v' +
        vs.map(v => v.id + v.job + st(v) + v.carry.amt + Math.round(v.hp)).join() +
        Object.keys(avail).join(),
      () => `${head(im(portrait('v', one ? one.job : 'auto')), one ? esc(one.name) : vs.length + ' dorpelingen', one ? st(one) + (one.carry.amt ? ` · draagt ${one.carry.amt} ${RES[one.carry.res!].n.toLowerCase()}` : '') : 'Groep geselecteerd')}
      ${one ? hpl(one.hp / one.mhp, `${Math.ceil(one.hp)}/${one.mhp}`) : ''}
      <div class="chips">${jobs
        .map(j => {
          const n = j === 'auto' ? 'Vanzelf' : j === 'build' ? 'Bouwen' : RES[j].n,
            dis = j !== 'auto' && j !== 'build' && !avail[j];
          return `<button class="chip ${cur.size === 1 && cur.has(j) ? 'on' : ''}" data-job="${j}" ${dis ? 'disabled' : ''} title="${dis ? 'Niet in je gebied' : j === 'auto' ? 'Werkt op wat het hardst nodig is' : 'Vaste taak: ' + n.toLowerCase()}">${j === 'auto' || j === 'build' ? '' : gem(j)}${n}</button>`;
        })
        .join('')}</div>`,
    );
  }
  if (camp) {
    const guards = G.foes.filter(f => f.camp === camp.id).length;
    selCtx = 'Vijandelijk kamp';
    selCmds =
      CB('data-u="attackcamp"', '⚔', `Val aan (${G.us.length})`, {
        dis: !G.us.length,
        tip: 'Stuur het hele leger naar dit kamp',
      }) + CB('data-u="go"', '◎', 'Bekijk', { tip: 'Camera naar het kamp' });
    return setHTML(
      p,
      'ins',
      'c' + camp.id + Math.round(camp.hp) + guards + G.us.length,
      () =>
        `${head(im(portrait('f', Math.min(camp.tier, 5))), 'Vijandelijk kamp', `Niveau ${camp.tier + 1} · ${guards} bewakers`)}${hpl(camp.hp / camp.mhp, `${Math.ceil(camp.hp)}/${Math.ceil(camp.mhp)}`, 'bad')}<p class="small" style="margin-top:8px">Verover het voor buit. Het gebied wordt dan van jou.</p>`,
    );
  }
  if (sel.node >= 0) {
    const i = sel.node,
      n = node[i];
    if (!n) {
      sel.node = -1;
      return;
    }
    const N = NODES[n],
      x = i % W,
      y = (i / W) | 0,
      workers = G.vs.filter(v => v.tgt && v.tgt.k === 'node' && v.tgt.i === i).length;
    selCtx = N.n;
    selCmds = N.pump
      ? CB('data-b="pump"', '⛽', 'Oliepomp', { tip: 'Zet een oliepomp op deze bron', dis: G.age < 4 })
      : !isUnl(x, y)
        ? CB('data-u="expand"', '⬚', 'Uitbreiden', { tip: 'Dit ligt buiten je land' })
        : CB('data-u="send"', '➜', 'Stuur 1', { tip: 'Stuur de dichtstbijzijnde vrije dorpeling' }) +
          CB('data-u="send3"', '➜', 'Stuur 3', { tip: 'Stuur drie dorpelingen' });
    return setHTML(
      p,
      'ins',
      'n' + i + amt[i] + workers,
      () =>
        `${X}<div class="selh"><div class="port">${gem(N.res)}</div><div><div class="selt">${N.n}</div><div class="sels"><b class="num">${fmt(amt[i])}</b> ${RES[N.res].n.toLowerCase()} · ${workers} aan het werk</div></div></div>${hpl(amt[i] / N.amt[1], 'voorraad', 'acc')}${isUnl(x, y) ? '' : '<p class="small" style="margin-top:8px">Dit ligt buiten je land. Breid eerst uit.</p>'}`,
    );
  }
  // Hier is altijd een gebouw geselecteerd: al het andere is hierboven al afgehandeld.
  if (!b) return;
  const d = B[b.type];
  selCtx = d.n;
  // Knoppen voor een geselecteerd gebouw
  let cmd = '';
  if (!b.done) {
    cmd =
      CB('data-b="helpbuild"', '⚒', `Bouwers (${siteCnt.get(b.id) || 0})`, {
        tip: 'Stuur 2 extra dorpelingen naar deze bouwplaats',
      }) +
      CB('data-b="demolish"', '✕', store.demolishArm ? 'Zeker?' : 'Afbreken', {
        danger: 1,
        tip: 'Krijg 75% van de kosten terug',
      });
  } else {
    if (d.conv || (d.gen && !d.gen.solar) || d.pump)
      cmd += CB('data-b="toggle"', b.on ? '⏻' : '⏼', b.on ? 'Aan' : 'Uit', {
        on: b.on,
        tip: b.on ? 'Zet dit gebouw uit' : 'Zet dit gebouw aan',
      });
    if (UPG_OK(b.type)) {
      const l = lvlOf(b),
        mx = maxLvl(b);
      if (l < mx) {
        const c = upgCost(b);
        cmd += CB('data-b="upgrade"', '▲', `Niveau ${l + 2}`, {
          dis: !has(c),
          cost: costHTML(c),
          tip: upgEffect(b.type, l + 1),
        });
      }
    }
    if (b.type === 'townhall') {
      cmd += CB('data-b="train1"', '', `Dorpeling`, {
        img: portrait('v', 'auto'),
        dis: popNow() >= popCap() || G.res.food < trainCost(),
        cost: costHTML({ food: trainCost() }),
        tip: popNow() >= popCap() ? 'Geen plek: bouw eerst een woning' : 'Train een dorpeling',
      });
      if (G.toolLvl < G.age)
        cmd += CB('data-g="tools"', '⚒', `Werktuig ${G.toolLvl + 2}`, {
          dis: !has(toolCost()),
          cost: costHTML(toolCost()),
          tip: '+15% verzamelsnelheid en +2 draagvermogen voor iedereen',
        });
    }
    if (d.train) {
      const list = Object.keys(UNITS).filter(
        k => UNITS[k].src === d.train && (canMake(k, G.age) || UNITS[k].age > G.age),
      );
      cmd += list
        .map(k => {
          const U = UNITS[k],
            lock = U.age > G.age;
          return CB(`data-train="${k}"`, '', U.n, {
            img: portrait('u', k),
            dis: lock || !has(U.cost),
            cost: lock ? `<span class="lk">${AGES[U.age].r}</span>` : costHTML(U.cost),
            tip: lock
              ? `Vanaf de ${AGES[U.age].n.toLowerCase()}`
              : `${U.hp} leven · ${U.dmg} schade · bereik ${U.r}${U.air ? ' · raakt drones' : ''} · ${U.t}s · Shift-klik: 5 tegelijk`,
          });
        })
        .join('');
      cmd +=
        CB('data-b="rally"', '⚑', 'Verzamel­punt', {
          on: !!b.rally,
          tip: b.rally
            ? 'Verzamelpunt staat · rechtsklik op de kaart verplaatst het'
            : 'Rechtsklik op de kaart zet het verzamelpunt',
        }) +
        CB(
          'data-st="cycle"',
          G.stance === 'hold' ? '▣' : G.stance === 'aggr' ? '➶' : '⛨',
          G.stance === 'hold'
            ? 'Nieuwe: blijf staan'
            : G.stance === 'aggr'
              ? 'Nieuwe: achtervolg'
              : 'Nieuwe: verdedig',
          { tip: 'Wat nieuwe eenheden doen. Klik om te wisselen.' },
        );
    }
    if (b.type === 'barracks' && G.armsLvl < G.age)
      cmd += CB('data-g="arms"', '⛨', `Pantser ${G.armsLvl + 2}`, {
        dis: !has(armsCost()),
        cost: costHTML(armsCost()),
        tip: '+15% schade en levenspunten voor het hele leger',
      });
    if (b.type !== 'townhall')
      cmd += CB('data-b="demolish"', '✕', store.demolishArm ? 'Zeker?' : 'Afbreken', {
        danger: 1,
        tip: 'Krijg 50% van de kosten terug (Delete)',
      });
  }
  selCmds = cmd || '<p class="small" style="grid-column:1/-1">Geen opdrachten voor dit gebouw.</p>';
  const sig =
    'b' +
    b.id +
    b.done +
    Math.round(b.prog) +
    Math.round(b.hp) +
    b.on +
    b.q.join() +
    Math.round(b.qt * 4) +
    G.age +
    (d.market ? Object.values(G.res).map(Math.floor).join() : '') +
    b.starved +
    b.run +
    b.blocked +
    (siteCnt.get(b.id) || 0) +
    lvlOf(b) +
    powerRatio.toFixed(2);
  setHTML(p, 'ins', sig, () => {
    const mh = bMaxHp(b);
    let h = head(
      im(iconFor(b.type)),
      d.n + (lvlOf(b) ? ` <span class="lv">niv. ${lvlOf(b) + 1}</span>` : ''),
      b.done ? esc(bShort(b.type)) : 'In aanbouw · ' + Math.floor((b.prog / b.bt) * 100) + '%',
    );
    h += b.done
      ? hpl(b.hp / mh, `${Math.ceil(b.hp)}/${Math.ceil(mh)}`, b.hp / mh < 0.4 ? 'bad' : '')
      : hpl(b.prog / b.bt, `${Math.floor((b.prog / b.bt) * 100)}% gebouwd`, 'acc');
    if (!b.done)
      return (
        h + `<div class="statline"><i class="dot"></i>${siteCnt.get(b.id) || 0} bouwers aan het werk</div>`
      );
    if (d.conv || d.gen || d.pump) {
      const stt = !b.on
        ? 'Uit'
        : d.conv
          ? b.starved
            ? 'Wacht op ' +
              Object.keys(d.conv.in)
                .map(r => RES[r].n.toLowerCase())
                .join(' en ')
            : 'Produceert'
          : d.gen
            ? d.gen.solar
              ? 'Zonnestroom'
              : b.run
                ? 'Levert stroom'
                : 'Geen brandstof'
            : 'Pompt';
      h += `<div class="statline ${b.starved && b.on ? 'warn' : ''}"><i class="dot"></i>${stt}${d.power && powerRatio < 1 ? ` · stroom ${Math.round(powerRatio * 100)}%` : ''}</div>`;
    }
    if (d.pop) h += `<div class="stats"><span><i>⌂</i>${bPop(b)} inwoners</span></div>`;
    if (d.def)
      h += `<div class="stats"><span><i>⚔</i>${Math.round(d.def.dmg * (1 + 0.4 * lvlOf(b)))} schade</span><span><i>◎</i>bereik ${d.def.r}</span></div>`;
    if (UPG_OK(b.type)) {
      const l = lvlOf(b),
        top = 5 - B[b.type].age,
        mx = maxLvl(b);
      h += `<div class="lvrow"><span class="pips">${Array.from({ length: top + 1 }, (_, i) => `<i class="${i <= l ? 'on' : i <= mx ? 'av' : ''}"></i>`).join('')}</span><span>${l < mx ? 'verbetering klaar' : l < top ? 'volgend niveau in de ' + AGES[Math.min(5, B[b.type].age + l + 1)].n.toLowerCase() : 'max'}</span></div>`;
    }
    if (d.market)
      h +=
        '<div class="trade">' +
        ['food', 'wood', 'stone', 'copper', 'iron', 'coal']
          .filter(r => RES[r].age <= G.age)
          .map(r => {
            const buy = Math.round(20 * (1 + RES[r].age * 0.5) * (1 - 0.1 * lvlOf(b))),
              sell = Math.round(8 * (1 + RES[r].age * 0.5) * (1 + 0.15 * lvlOf(b)));
            return `<span>${gem(r)}${RES[r].n}</span><button data-buy="${r}" ${G.res.gold >= buy ? '' : 'disabled'} title="Koop 100 voor ${buy} goud">Koop ${buy}</button><button data-sell="${r}" ${G.res[r] >= 100 ? '' : 'disabled'} title="Verkoop 100 voor ${sell} goud">Verkoop ${sell}</button>`;
          })
          .join('') +
        '</div>';
    if (b.q.length)
      h += `<div class="hpline"><div class="bar acc"><i style="width:${(b.qt / UNITS[b.q[0]].t) * 100}%"></i></div><span>${UNITS[b.q[0]].n}${b.blocked ? ' · geen plek' : ''}</span></div><div class="queue">${b.q.map((k, i) => `<button class="qchip" data-cq="${i}" title="Klik om te annuleren">${UNITS[k].n}</button>`).join('')}</div>`;
    if (b.type === 'townhall' && (G.training || G.trainQ))
      h += `<div class="statline"><i class="dot"></i>Traint dorpelingen${G.trainQ ? ` · ${G.trainQ} in wachtrij` : ''}</div>`;
    return h;
  });
}
export function insHandler(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  const b = sel.b && bById.get(sel.b);
  // Klik op een soort in een gemengde selectie: alleen die houden (Shift: die juist weghalen)
  if (t.dataset.only) {
    for (const u of selUnits()) if ((u.k === t.dataset.only) === e.shiftKey) sel.us.delete(u.id);
    sigs.ins = null;
    store.uiDirty = true;
    return;
  }
  if (t.dataset.x) {
    clearSel();
    sigs.grid = null;
  } else if (t.dataset.st) {
    if (t.dataset.st === 'cycle') {
      G.stance = G.stance === 'guard' ? 'hold' : G.stance === 'hold' ? 'aggr' : 'guard';
    } else
      selUnits().forEach(u => {
        u.stance = t.dataset.st as Stance;
        if (u.stance === 'hold') {
          u.order = 'guard';
          u.gx = u.x;
          u.gy = u.y;
          u.path = null;
        }
      });
  } else if (t.dataset.u === 'go') {
    const c = G.camps.find(c => c.id === sel.camp);
    if (c) centerOn(c.x + 1, c.y + 1);
  } else if (t.dataset.u === 'expand') {
    setExpand(true);
  } else if (t.dataset.u === 'send3') {
    const i = sel.node;
    G.vs
      .filter(v => !v.hidden && v.job === 'auto')
      .sort((a, b) => dist(a.x, a.y, i % W, (i / W) | 0) - dist(b.x, b.y, i % W, (i / W) | 0))
      .slice(0, 3)
      .forEach(v => {
        resetV(v);
        v.job = NODES[node[i]].res;
        v.keep = { k: 'node', i };
      });
    toast('Drie dorpelingen onderweg.');
  } else if (t.dataset.b === 'pump') {
    store.placing = 'oilpump';
    store.expandMode = false;
    store.uiDirty = true;
  } else if (t.dataset.b === 'helpbuild' && b) {
    G.vs
      .filter(v => !v.hidden && v.job === 'auto' && !(v.tgt && v.tgt.k === 'site' && v.tgt.b === b))
      .sort((p, q) => dist(p.x, p.y, b.x, b.y) - dist(q.x, q.y, b.x, b.y))
      .slice(0, 2)
      .forEach(v => {
        resetV(v);
        v.job = 'build';
        v.prefSite = b;
      });
  } else if (t.dataset.b === 'train1') {
    G.trainQ++;
  } else if (t.dataset.b === 'rally' && b) {
    toast('Rechtsklik op de kaart om het verzamelpunt te zetten.');
  } else if (t.dataset.job) {
    for (const v of selVills()) {
      v.job = t.dataset.job;
      resetV(v);
    }
    computeCaches();
  } else if (t.dataset.u === 'home') {
    const th = G.bs.find(x => x.type === 'townhall')!;
    selUnits().forEach((u, k) => {
      u.tgt = null;
      u.order = 'move';
      u.path = null;
      u.gx = th.x + 1 + ((k % 5) - 2) * 0.8;
      u.gy = th.y + 3 + Math.floor(k / 5) * 0.8;
    });
  } else if (t.dataset.u === 'stop')
    selUnits().forEach(u => {
      u.tgt = null;
      u.order = 'guard';
      u.path = null;
      u.gx = u.x;
      u.gy = u.y;
    });
  else if (t.dataset.u === 'attackcamp') {
    const c = G.camps.find(c => c.id === sel.camp)!;
    G.us.forEach(u => {
      u.tgt = c;
      u.order = 'attack';
      u.path = null;
    });
    toast('Het leger rukt uit.', 'good');
  } else if (t.dataset.u === 'send') {
    const i = sel.node,
      v = G.vs
        .filter(v => !v.hidden && v.job === 'auto')
        .sort((a, b) => dist(a.x, a.y, i % W, (i / W) | 0) - dist(b.x, b.y, i % W, (i / W) | 0))[0];
    if (v) {
      resetV(v);
      v.job = NODES[node[i]].res;
      v.keep = { k: 'node', i };
      toast(`${v.name} gaat ${RES[v.job].n.toLowerCase()} halen.`);
    } else toast('Geen automatische dorpeling vrij.');
  } else if (t.dataset.train && b && canMake(t.dataset.train, G.age)) {
    const U = UNITS[t.dataset.train],
      n = e.shiftKey ? 5 : 1;
    for (let i = 0; i < n && has(U.cost); i++) {
      pay(U.cost);
      b.q.push(t.dataset.train);
    }
  } else if (t.dataset.cq !== undefined && b) {
    const i = +t.dataset.cq,
      k = b.q.splice(i, 1)[0];
    if (k) gain(UNITS[k].cost);
    if (i === 0) b.qt = 0;
  } else if (t.dataset.u === 'amove') {
    store.cmdMode = store.cmdMode === 'amove' ? null : 'amove';
  } else if (t.dataset.u === 'patrol') {
    store.cmdMode = store.cmdMode === 'patrol' ? null : 'patrol';
  } else if (t.dataset.b === 'toggle' && b) b.on = !b.on;
  else if (t.dataset.b === 'upgrade' && b) upgrade(b);
  else if (t.dataset.g === 'tools') upgradeTools();
  else if (t.dataset.g === 'arms') upgradeArms();
  else if (t.dataset.b === 'demolish' && b) {
    if (store.demolishArm) demolish(b);
    else {
      store.demolishArm = 1;
      setTimeout(() => {
        store.demolishArm = 0;
        sigs.ins = null;
      }, 3000);
    }
  } else if (t.dataset.buy) {
    const r = t.dataset.buy,
      c = Math.round(20 * (1 + RES[r].age * 0.5) * (1 - 0.1 * lvlOf(b as Building)));
    if (G.res.gold >= c) {
      G.res.gold -= c;
      G.res[r] += 100;
    }
  } else if (t.dataset.sell) {
    const r = t.dataset.sell,
      c = Math.round(8 * (1 + RES[r].age * 0.5) * (1 + 0.15 * lvlOf(b as Building)));
    if (G.res[r] >= 100) {
      G.res[r] -= 100;
      G.res.gold += c;
    }
  }
  sigs.ins = null;
  store.uiDirty = true;
}
$('#inspector').addEventListener('click', insHandler);
export function demolish(b: Building) {
  setBlk(b, false);
  const d = B[b.type],
    f = b.done ? 0.5 : 0.75;
  for (const k in d.cost) G.res[k] += Math.floor(d.cost[k] * f);
  b.q.forEach(k => gain(UNITS[k].cost));
  b.dead = true;
  for (let dy = 0; dy < d.size; dy++) for (let dx = 0; dx < d.size; dx++) bmap[(b.y + dy) * W + b.x + dx] = 0;
  G.bs = G.bs.filter(x => x !== b);
  bById.delete(b.id);
  if (sel.b === b.id) sel.b = null;
  for (const v of G.vs) if (v.hidden && v.shelter === b.id) unhide(v);
  if (!d.wall) toast(`${d.n} afgebroken.`);
  burst(b.x + 0.5, b.y + 0.5, '#8a7a62');
  store.demolishArm = 0;
  store.uiDirty = true;
}
