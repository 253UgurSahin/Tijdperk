import type { Meteor } from '../types';
// Meteorieten: af en toe slaat er een in. Rond de krater liggen daarna nieuwe ertsen,
// vooral van grondstoffen die bij jou schaars of op zijn. Zo raakt de wereld nooit helemaal leeg.
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { CX, CY, DAYLEN, W } from '../config';
import { SET } from '../core/settings';
import { B } from '../data/buildings';
import { NI, NODES } from '../data/nodes';
import { RES } from '../data/resources';
import { avail, computeAvail } from './caches';
import { burst } from './fx';
import { G } from './state';
import { bMaxHp, hasT } from './upgrades';
import { note, toast } from '../ui/hud';
import { clamp, dist } from '../util/math';
import {
  amt,
  bmap,
  ground,
  inb,
  isUnl,
  markGroundDirty,
  node,
  nodeLists,
  passable,
  road,
  unreach,
} from '../world/world';

const WARNING = 14; // seconden tussen de waarschuwing en de inslag
const FALL = 3.5; // de laatste seconden is de vuurbal te zien
const FIRST_DAY = 3; // eerste meteoriet niet vóór deze dag

// Welke ertsen een meteoriet kan brengen (bomen, struiken, zand en olie niet)
const METEOR_ORES = ['rock', 'copper', 'tin', 'iron', 'gold', 'coal', 'lithium', 'starmetal'];

/** Elke speltik: plan de volgende meteoriet, tel af en laat hem inslaan. */
export function updateMeteors(dt: number) {
  if (G.nextMeteor == null) G.nextMeteor = (FIRST_DAY - 1) * DAYLEN + DAYLEN * (0.5 + Math.random());
  // In het Sterrentijdperk is sterrenmetaal nodig: de eerste meteoriet komt dan snel
  if (G.age >= 8 && !G.starMeteor) {
    G.starMeteor = true;
    G.nextMeteor = Math.min(G.nextMeteor, G.t + 20);
  }
  const m = G.meteor;
  if (!m) {
    if (G.t >= G.nextMeteor) announce();
    return;
  }
  m.t -= dt;
  if (m.t <= FALL && !m.falling) {
    m.falling = true;
    sfx('meteor');
  }
  if (m.t <= 0) impact(m);
}

/** Kies een plek en waarschuw de speler. */
function announce() {
  const spot = pickSpot();
  // Volgende: sneller als er grondstoffen op zijn, anders na 1,5 tot 3 dagen
  const scarce = scarceOres().length;
  const wait = scarce ? 1 + Math.random() : 1.5 + Math.random() * 1.5;
  // Sterrentijdperk: vaker, en nog vaker met sterrenkaarten
  const often = G.age >= 8 ? (hasT('starcharts') ? 0.4 : 0.6) : 1;
  G.nextMeteor = G.t + DAYLEN * wait * often;
  if (!spot) return;
  G.meteor = { x: spot[0] + 0.5, y: spot[1] + 0.5, t: WARNING, falling: false };
  store.notePos = [spot[0], spot[1]];
  toast(
    `Een vallende ster! Over ${WARNING} seconden slaat een meteoriet in, in het ${compassFromHome(spot[0], spot[1])}.`,
    'age',
  );
  sfx('alarm');
}

/** Een plek op land, liefst net binnen of vlak naast je gebied, en niet op het stamhuis. */
function pickSpot() {
  for (let tries = 0; tries < 400; tries++) {
    const a = Math.random() * Math.PI * 2,
      r = 8 + Math.random() * (14 + G.unl.filter(Boolean).length * 1.2),
      x = Math.round(CX + Math.cos(a) * r),
      y = Math.round(CY + Math.sin(a) * r);
    if (!inb(x - 4, y - 4) || !inb(x + 4, y + 4)) continue;
    if (!passable(y * W + x)) continue;
    const th = G.bs.find(b => b.type === 'townhall');
    if (th && dist(x, y, th.x + 1, th.y + 1) < 7) continue;
    // Liever bij jouw land: buiten je gebied slaagt alleen een deel van de pogingen
    if (!isUnl(x, y) && Math.random() < 0.5) continue;
    return [x, y];
  }
  return null;
}

/** Ertsen van dit tijdperk die nu niet in je gebied te vinden zijn. */
function scarceOres() {
  return METEOR_ORES.filter(k => NODES[NI[k]].age <= G.age && !avail[NODES[NI[k]].res]);
}

/** Kies de ertsen voor deze meteoriet: schaarse eerst, anders wat je het minst hebt. */
function pickOres() {
  const usable = METEOR_ORES.filter(k => NODES[NI[k]].age <= G.age);
  const scarce = scarceOres();
  const byStock = [...usable].sort((a, b) => G.res[NODES[NI[a]].res] - G.res[NODES[NI[b]].res]);
  // In het Sterrentijdperk is sterrenmetaal altijd de hoofdzaak
  const first =
    G.age >= 8 ? 'starmetal' : scarce.length ? scarce[(Math.random() * scarce.length) | 0] : byStock[0];
  const second = byStock.find(k => k !== first) || 'rock';
  return [first, second];
}

function impact(m: Meteor) {
  G.meteor = null;
  const cx = Math.floor(m.x),
    cy = Math.floor(m.y);
  // Klap: explosie, rook en een schudden van het scherm
  G.fx.push({ type: 'boom', x: m.x, y: m.y, life: 0.6, max: 0.6, r: 2.6 });
  for (let k = 0; k < 8; k++)
    burst(m.x + (Math.random() - 0.5) * 3, m.y + (Math.random() - 0.5) * 3, '#5a4a3a');
  if (SET.shake) store.shake = 0.8;
  sfx('boom');

  // Gebouwen vlakbij raken beschadigd, maar storten niet in
  for (const b of G.bs) {
    const s = B[b.type].size;
    if (dist(b.x + s / 2, b.y + s / 2, m.x, m.y) < 2.5 + s / 2) {
      b.hp = Math.max(1, b.hp - bMaxHp(b) * 0.4);
      b.flash = 0.4;
    }
  }

  // De krater: verschroeide grond, en wat er stond is weg
  for (let y = cy - 3; y <= cy + 3; y++)
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (!inb(x, y)) continue;
      const d = dist(x, y, cx, cy),
        i = y * W + x;
      if (d > 3) continue;
      if (d < 1.5 && !bmap[i]) node[i] = 0;
      const k = clamp(1 - d / 3.2, 0, 1) * 0.6;
      for (let c = 0; c < 3; c++) ground[i * 3 + c] = ground[i * 3 + c] * (1 - k) + [52, 40, 34][c] * k;
      markGroundDirty(x, y);
    }

  // Nieuwe ertsen in een ring rond de krater
  const [main, extra] = pickOres();
  let placed = 0;
  for (let y = cy - 5; y <= cy + 5; y++)
    for (let x = cx - 5; x <= cx + 5; x++) {
      const d = dist(x, y, cx, cy);
      if (d < 1.5 || d > 5 || !inb(x, y)) continue;
      const i = y * W + x;
      if (!passable(i) || bmap[i] || road[i] || node[i]) continue;
      const chance = (d < 3.5 ? 0.55 : 0.25) * (hasT('starcharts') ? 1.4 : 1);
      if (Math.random() > chance) continue;
      const k = d < 3.5 ? main : Math.random() < 0.6 ? extra : 'rock';
      const t = NI[k];
      node[i] = t;
      amt[i] = Math.round(NODES[t].amt[1] * 1.4);
      unreach[i] = 0;
      nodeLists[t].push(i);
      placed++;
    }
  computeAvail();
  store.uiDirty = true;
  store.notePos = [cx, cy];
  const names = [...new Set([main, extra].map(k => RES[NODES[NI[k]].res].n.toLowerCase()))];
  toast(
    placed
      ? `Inslag! Rond de krater ligt nu nieuwe ${names.join(' en ')}${isUnl(cx, cy) ? '' : ' (buiten je gebied: breid uit om erbij te kunnen)'}.`
      : 'Inslag! De meteoriet viel op een kale plek.',
    'good',
  );
  note(`Meteoriet ingeslagen: nieuwe ${RES[NODES[NI[main]].res].n.toLowerCase()}.`, 'good');
}

function compassFromHome(x: number, y: number): string {
  const a = (Math.atan2(y - CY, x - CX) * 180) / Math.PI;
  const dirs = [
    'oosten',
    'zuidoosten',
    'zuiden',
    'zuidwesten',
    'westen',
    'noordwesten',
    'noorden',
    'noordoosten',
  ];
  return dirs[((Math.round(a / 45) % 8) + 8) % 8];
}

// Hoogte en positie van de vallende vuurbal, voor de weergave (null als er niets valt)
export function meteorPosition() {
  const m = G.meteor;
  if (!m || m.t > FALL) return null;
  const k = 1 - m.t / FALL; // 0 = net zichtbaar, 1 = inslag
  return { x: m.x + (1 - k) * 10, y: m.y - (1 - k) * 10, h: (1 - k) * 20, k };
}
