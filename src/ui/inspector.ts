import type { Building, Stance, Villager } from '../types';
// Selectiepaneel: info en knoppen voor wat je hebt aangeklikt.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { W } from '../config';
import { AGES } from '../data/ages';
import { B } from '../data/buildings';
import { NODES } from '../data/nodes';
import { PEOPLE } from '../data/peoples';
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
  marketPrices,
  maxLvl,
  toolCost,
  upgCost,
  upgradeRows,
  upgrade,
  upgradeArms,
  upgradeTools,
} from '../game/upgrades';
import { buildCost } from '../game/placement';
import { unhide } from '../game/villagers';
import { clearSel, resetV, selUnits, selVills } from '../input/selection';
import { centerOn } from '../render/camera';
import { selectArmy, selectIdle } from '../input/input';
import { CHAPTERS } from '../game/chapters';
import { iconFor, portrait } from '../render/icons';
import { bShort } from './buildmenu';
import { TOUCH, compareHTML, compareText, costHTML, esc, fmt, gem, hy } from './format';
import { ico } from './glyphs';
import { setHTML, sigs } from './header';
import { setExpand, toast } from './hud';
import { bannerHTML, showPeopleInfo } from './peoples';
import { rivalCommand, rivalSelection } from './rivals';
import { $ } from '../util/dom';
import { clamp, dist } from '../util/math';
import { amt, bmap, isUnl, node, setBlk } from '../world/world';
import { canMake, fitsPeople } from '../data/succession';
import { canDemolish, noDemolishText, ownerLine, refreshWonders, wonderStatus } from '../game/wonders';

// Selectiepaneel
/** Opties voor een opdrachttegel: aan, gevaarlijk, uitgeschakeld, uitleg, plaatje en kosten. */
export interface CmdOpts {
  on?: boolean;
  danger?: boolean | 1;
  dis?: boolean;
  tip?: string;
  img?: string;
  cost?: string;
}
/** De bouwstenen van het selectiepaneel die ui/rivals.ts ook gebruikt. */
export interface InspectorParts {
  /** Kop met plaatje, titel en een regel eronder. */
  head: (port: string, t: string, sub: string) => string;
  /** Levensbalk (f van 0 tot 1) met tekst. */
  hpl: (f: number, txt: string, cls?: string) => string;
  CB: (data: string, glyph: string, label: string, o?: CmdOpts) => string;
  /** Een plaatje. */
  im: (src: string) => string;
}
// Een opdrachttegel. De uitleg (data-tip) toont buildmenu.ts in een eigen tooltip.
export const CB = (data: string, glyph: string, label: string, o: CmdOpts = {}): string => {
  const cls = ['cb', o.on && 'on', o.danger && 'danger', o.cost && 'has-cost'].filter(Boolean).join(' ');
  const pic = o.img ? `<img src="${o.img}" alt="">` : `<span class="g">${ico(glyph)}</span>`;
  const cost = o.cost ? `<span class="c">${o.cost}</span>` : '';
  return `<button class="${cls}" ${data} ${o.dis ? 'disabled' : ''} aria-label="${esc(label.replace(/\u00AD/g, ''))}" data-tip="${esc(o.tip || '')}">${pic}<span class="l">${hy(label)}</span>${cost}</button>`;
};
// Selectiepaneel met de knoppen die bij de selectie horen
export let selCmds: string | null = null,
  selCtx = '';
export function renderInspector() {
  const p = $('#inspector'),
    vs = selVills(),
    us = selUnits(),
    b = sel.b && bById.get(sel.b),
    camp = sel.camp && G.camps.find(c => c.id === sel.camp && c.alive);
  const X = `<button class="quiet x" data-x="1" aria-label="Sluiten">${TOUCH ? 'Sluiten' : ico('✕')}</button>`;
  const im = (src: string) => `<img src="${src}" alt="">`;
  const head = (port: string, t: string, sub: string) =>
    `${X}<div class="selh"><div class="port">${port}</div><div><div class="selt">${t}</div><div class="sels">${sub}</div></div></div>`;
  // Levensbalk: zonder eigen kleur wordt hij oranje bij weinig en rood bij heel weinig leven
  const hpl = (f: number, txt: string, cls = '') => {
    const tone = cls || (f < 0.35 ? 'bad' : f < 0.65 ? 'warn' : '');
    return `<div class="hpline"><div class="bar ${tone}"><i style="width:${clamp(f, 0, 1) * 100}%"></i></div><span>${txt}</span></div>`;
  };
  // Iets van een rivaal aangeklikt: een gebouw of de rivaal zelf (zie ui/rivals.ts)
  const rival = !vs.length && !us.length && !b && !camp ? rivalSelection({ head, hpl, CB, im }) : null;
  if (rival) {
    document.body.classList.add('insp');
    selCtx = rival.ctx;
    selCmds = rival.cmds;
    return setHTML(p, 'ins', rival.sig, () => rival.html);
  }
  if (!vs.length && !us.length && !b && !camp && sel.node < 0) {
    document.body.classList.remove('insp');
    selCmds = null;
    selCtx = '';
    const idle = G.vs.filter(v => !v.hidden && v.state === 'idle').length;
    const sig =
      'e' + G.people + G.age + popNow() + popCap() + G.us.length + G.unl.filter(Boolean).length + '/' + idle;
    // Niets geselecteerd: een overzicht van je stad met snelknoppen, zodat het paneel nooit leeg is
    const quick = (k: string, label: string, key: string, n?: number) =>
      `<button class="quick" data-quick="${k}">${label}${n != null ? `<b>${n}</b>` : ''}${TOUCH ? '' : `<kbd>${key}</kbd>`}</button>`;
    // Je volk, met zijn vlag: klik om te zien wat het goed kan
    const folk = PEOPLE[G.people];
    const folkBtn = `<button class="quick folkq" data-quick="people" title="Je volk: wat kan het goed?">${bannerHTML(folk, 'xs')}Volk: ${folk.n}</button>`;
    return setHTML(
      p,
      'ins',
      sig,
      () =>
        `<div class="empty"><div class="selh" style="padding-right:0"><div class="port">${im(iconFor('townhall'))}</div><div><div class="selt">${placeName()}</div><div class="sels">${AGES[G.age].n} · ${AGES[G.age].lvl}</div></div></div>` +
        `<p class="chron">Hoofdstuk ${AGES[G.age].r} · ${CHAPTERS[G.age].t}</p>` +
        `<div class="stats"><span><i>${ico('⌂')}</i>${popNow()}/${popCap()} inwoners</span><span><i>${ico('⚔')}</i>${G.us.length} soldaten</span><span><i>${ico('◇')}</i>${G.unl.filter(Boolean).length} gebieden</span></div>` +
        `<div class="quicks">${quick('idle', 'Wie doet niets?', 'I', idle)}${G.us.length ? quick('army', 'Hele leger', 'Q', G.us.length) : ''}${quick('home', 'Naar het stamhuis', 'Home')}${folkBtn}</div></div>`,
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
          ? `<div class="stats"><span><i>${ico('⚔')}</i>${Math.round(U.dmg * armsMul())} schade</span><span><i>${ico('◎')}</i>bereik ${U.r}</span><span><i>${ico('»')}</i>snelheid ${U.spd}</span>${U.air ? `<span><i>${ico('✈')}</i>raakt drones</span>` : ''}</div>`
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
      ? CB('data-b="pump"', '⛽', 'Oliepomp', { tip: 'Zet een oliepomp op deze bron', dis: G.age < 6 })
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
        cmd += CB('data-b="upgrade"', '▲', `Verbeter`, {
          dis: !has(c),
          cost: costHTML(c, true),
          tip: `Naar niveau ${l + 2}. ` + compareText(upgradeRows(b)),
        });
      }
    }
    if (b.type === 'townhall') {
      cmd += CB('data-b="train1"', '', `Dorpeling`, {
        img: portrait('v', 'auto'),
        dis: popNow() >= popCap() || G.res.food < trainCost(),
        cost: costHTML({ food: trainCost() }, true),
        tip: popNow() >= popCap() ? 'Geen plek: bouw eerst een woning' : 'Train een dorpeling',
      });
      if (G.toolLvl < G.age)
        cmd += CB('data-g="tools"', '⚒', `Werktuig ${G.toolLvl + 2}`, {
          dis: !has(toolCost()),
          cost: costHTML(toolCost(), true),
          tip: '+15% verzamelsnelheid en +2 draagvermogen voor iedereen',
        });
    }
    if (d.train) {
      // Wat je nu kunt trainen, plus alleen het eerstvolgende tijdperk als vooruitblik.
      // Alleen soldaten van jouw volk: de Noormannen hebben een Berserker in plaats van een zwaardvechter.
      const mine = Object.keys(UNITS).filter(k => UNITS[k].src === d.train && fitsPeople(k, G.people));
      const nextAge = Math.min(...mine.map(k => UNITS[k].age).filter(a => a > G.age));
      const list = mine.filter(k => canMake(k, G.age, G.people) || UNITS[k].age === nextAge);
      cmd += list
        .map(k => {
          const U = UNITS[k],
            lock = U.age > G.age;
          return CB(`data-train="${k}"`, '', U.n, {
            img: portrait('u', k),
            dis: lock || !has(U.cost),
            cost: lock ? `<span class="lk">${AGES[U.age].r}</span>` : costHTML(U.cost, true),
            tip: lock
              ? `Vanaf de ${AGES[U.age].n.toLowerCase()}`
              : `${U.hp} leven · ${U.dmg} schade · bereik ${U.r}${U.air ? ' · raakt drones' : ''}${U.bonus ? ' · ' + U.bonus.d : ''}${U.note ? ' · ' + U.note : ''} · ${U.t}s · Shift-klik: 5 tegelijk`,
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
          G.stance === 'hold' ? 'Blijf staan' : G.stance === 'aggr' ? 'Achtervolg' : 'Verdedig',
          { tip: 'Wat nieuwe eenheden doen. Klik om te wisselen.' },
        );
    }
    if (b.type === 'barracks' && G.armsLvl < G.age)
      cmd += CB('data-g="arms"', '⛨', `Pantser ${G.armsLvl + 2}`, {
        dis: !has(armsCost()),
        cost: costHTML(armsCost(), true),
        tip: '+15% schade en levenspunten voor het hele leger',
      });
    // Het stamhuis, een wereldwonder en een sterrenpoort die oplaadt breek je niet af (zie canDemolish)
    if (canDemolish(b))
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
    (UPG_OK(b.type) && has(upgCost(b))) + // knop 'Verbeteren' aan of uit
    b.starved +
    b.run +
    b.blocked +
    (siteCnt.get(b.id) || 0) +
    lvlOf(b) +
    powerRatio.toFixed(2) +
    (d.wonder ? wonderStatus(b.type).text : '');
  setHTML(p, 'ins', sig, () => {
    const mh = bMaxHp(b);
    let h = head(
      im(iconFor(b.type)),
      d.n + (lvlOf(b) ? ` <span class="lv">niv. ${lvlOf(b) + 1}</span>` : ''),
      b.done
        ? d.wonder
          ? `Wereldwonder · ${AGES[d.age].n}` // de bonus staat in de kaart eronder
          : esc(bShort(b.type))
        : 'In aanbouw · ' + Math.floor((b.prog / b.bt) * 100) + '%',
    );
    h += b.done
      ? hpl(b.hp / mh, `${Math.ceil(b.hp)}/${Math.ceil(mh)}`)
      : hpl(b.prog / b.bt, `${Math.floor((b.prog / b.bt) * 100)}% gebouwd`, 'acc');
    if (!b.done)
      return (
        h +
        `<div class="statline ${siteCnt.get(b.id) ? '' : 'warn'}"><i class="dot"></i>${siteCnt.get(b.id) ? siteCnt.get(b.id) + ' bouwers aan het werk' : 'Nog geen bouwers: stuur er een paar heen'}</div>` +
        (d.wonder ? wonderCardHTML(b) : '')
      );
    if (d.wonder) h += wonderCardHTML(b);
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
    if (d.pop) h += `<div class="stats"><span><i>${ico('⌂')}</i>${bPop(b)} inwoners</span></div>`;
    if (d.def)
      h += `<div class="stats"><span><i>${ico('⚔')}</i>${Math.round(d.def.dmg * (1 + 0.4 * lvlOf(b)))} schade</span><span><i>${ico('◎')}</i>bereik ${d.def.r}</span></div>`;
    if (UPG_OK(b.type)) {
      const l = lvlOf(b),
        top = AGES.length - 1 - B[b.type].age,
        mx = maxLvl(b);
      // Verbeterkaart: welk niveau, wat het oplevert (nu → straks), wat het kost
      const pips = `<span class="pips">${Array.from({ length: top + 1 }, (_, i) => `<i class="${i <= l ? 'on' : i <= mx ? 'av' : ''}"></i>`).join('')}</span>`;
      if (l < mx) {
        const c = upgCost(b);
        // Vooraan zetten: op een breed scherm staat de kaart dan rechts naast de gegevens
        h =
          `<div class="upcard side"><div class="uph"><b>Verbeteren naar niveau ${l + 2}</b>${pips}</div>${compareHTML(upgradeRows(b))}<div class="upf">${costHTML(c)}<button class="primary" data-b="upgrade" ${has(c) ? '' : 'disabled'}>Verbeteren</button></div></div>` +
          h;
      } else
        h += `<div class="lvrow">${pips}<span>Niveau ${l + 1} · ${l < top ? 'volgende verbetering in de ' + AGES[Math.min(AGES.length - 1, B[b.type].age + l + 1)].n.toLowerCase() : 'hoogste niveau'}</span></div>`;
    }
    if (d.market)
      h +=
        '<div class="trade">' +
        ['food', 'wood', 'stone', 'copper', 'iron', 'coal']
          .filter(r => RES[r].age <= G.age)
          .map(r => {
            const { buy, sell } = marketPrices(b, r);
            return `<span>${gem(r)}${RES[r].n}</span><button data-buy="${r}" ${G.res.gold >= buy ? '' : 'disabled'} title="Koop 100 voor ${buy} goud">Koop ${buy}</button><button data-sell="${r}" ${G.res[r] >= 100 ? '' : 'disabled'} title="Verkoop 100 voor ${sell} goud">Verkoop ${sell}</button>`;
          })
          .join('') +
        '</div>';
    if (b.q.length) {
      // Wachtrij: de eerste wordt nu getraind (met voortgang), de rest wacht. Klik = annuleren.
      const first = UNITS[b.q[0]],
        pct = clamp(b.qt / first.t, 0, 1) * 100,
        left = Math.max(0, Math.ceil(first.t - b.qt));
      const chip = (k: string, i: number) =>
        `<button class="qchip" data-cq="${i}" aria-label="${UNITS[k].n} annuleren" title="${UNITS[k].n} · klik om te annuleren"><img src="${portrait('u', k)}" alt=""></button>`;
      const rest = b.q.slice(1).map((k, i) => chip(k, i + 1));
      h +=
        `<div class="qnow"><button class="qchip big" data-cq="0" aria-label="${first.n} annuleren" title="Klik om te annuleren"><img src="${portrait('u', b.q[0])}" alt=""></button>` +
        `<div class="qinfo"><div class="qtop"><b>${first.n}</b><span>${b.blocked ? '<em>geen plek</em>' : left + 's'}</span></div>` +
        `<div class="bar acc"><i style="width:${pct}%"></i></div></div>` +
        (rest.length ? `<div class="qnext" title="Daarna in de wachtrij">${rest.join('')}</div>` : '') +
        `</div>`;
    }
    if (b.type === 'townhall' && (G.training || G.trainQ))
      h += `<div class="statline"><i class="dot"></i>Traint dorpelingen${G.trainQ ? ` · ${G.trainQ} in wachtrij` : ''}</div>`;
    return h;
  });
}
// Bij een wereldwonder van jou: de bonus, en hoe het ervoor staat (af, of een race met een rivaal)
function wonderCardHTML(b: Building) {
  const d = B[b.type],
    w = wonderStatus(b.type);
  const line = b.done ? ownerLine(b.type) : w.tone === 'warn' ? w.text : 'Nog niemand anders bouwt eraan';
  const tone = b.done ? 'good' : w.tone;
  // Elk wonder heeft een korte uitleg van zijn bonus (perk), zie data/buildings.ts
  return `<div class="wcard"><div class="wperk">${ico('★')}<span><b>Bonus:</b> ${esc(d.perk!)}</span></div><div class="statline ${tone}"><i class="dot"></i>${esc(line)}</div></div>`;
}
export function insHandler(e: MouseEvent) {
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  const b = sel.b && bById.get(sel.b);
  if (rivalCommand(t)) return; // knoppen bij een rivaal (zie ui/rivals.ts)
  // Snelknoppen in het overzicht
  if (t.dataset.quick === 'idle') return selectIdle();
  if (t.dataset.quick === 'army') return selectArmy();
  if (t.dataset.quick === 'home') return $('#zHome').click();
  if (t.dataset.quick === 'people') return showPeopleInfo();
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
  } else if (t.dataset.train && b && canMake(t.dataset.train, G.age, G.people)) {
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
    // Koop- en verkoopknoppen staan alleen bij een geselecteerde markt, dus b is er
    const r = t.dataset.buy,
      c = marketPrices(b as Building, r).buy;
    if (G.res.gold >= c) {
      G.res.gold -= c;
      G.res[r] += 100;
    }
  } else if (t.dataset.sell) {
    const r = t.dataset.sell,
      c = marketPrices(b as Building, r).sell;
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
  // Nog een keer nakijken: een knop kan er nog staan van vlak voordat de poort begon op te laden
  if (!canDemolish(b)) {
    toast(noDemolishText(b));
    return;
  }
  setBlk(b, false);
  const d = B[b.type],
    f = b.done ? 0.5 : 0.75;
  const cost = buildCost(b.type); // terug wat het nu kost, dus met bonussen
  for (const k in cost) G.res[k] += Math.floor(cost[k] * f);
  b.q.forEach(k => gain(UNITS[k].cost));
  b.dead = true;
  for (let dy = 0; dy < d.size; dy++) for (let dx = 0; dx < d.size; dx++) bmap[(b.y + dy) * W + b.x + dx] = 0;
  G.bs = G.bs.filter(x => x !== b);
  bById.delete(b.id);
  if (sel.b === b.id) sel.b = null;
  for (const v of G.vs) if (v.hidden && v.shelter === b.id) unhide(v);
  if (!d.wall) toast(`${d.n} afgebroken.`);
  burst(b.x + 0.5, b.y + 0.5, '#8a7a62');
  // Een wonder (of de bouwplaats ervan) weg: zet de lijst met eigenaars en de bonussen opnieuw
  if (d.wonder) refreshWonders();
  store.demolishArm = 0;
  store.uiDirty = true;
}
