// Gevechten: soldaten, vijanden, torens en projectielen.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { CN, CX, CY, H, W } from '../config.js';
import { SET } from '../core/settings.js';
import { B } from '../data/buildings.js';
import { difficulty } from '../data/difficulty.js';
import { RES } from '../data/resources.js';
import { FOES, UNITS, bonusMul } from '../data/units.js';
import { endGame } from './achievements.js';
import { computeAvail } from './caches.js';
import { gain } from './economy.js';
import { burst, floater } from './fx.js';
import { G, bById, sel } from './state.js';
import { add, mul } from './bonus.js';
import { armsMul } from './upgrades.js';
import { unhide } from './villagers.js';
import { scrX } from '../render/scene.js';
import { note, toast } from '../ui/hud.js';
import { dist } from '../util/math.js';
import { findPath, follow } from '../world/pathfinding.js';
import { bmap, foeWalk, freeWalk, isUnl, nearestWall, setBlk, walkable } from '../world/world.js';

function tpos(t) {
  if (t.kind === 'b') {
    const s = B[t.type].size;
    return { x: t.x + s / 2, y: t.y + s / 2, rad: s / 2 };
  }
  if (t.kind === 'c') return { x: t.x + 1, y: t.y + 1, rad: 1.2 };
  return { x: t.x, y: t.y, rad: 0.25 };
}
const isDead = t => !t || t.dead || t.hidden || (t.kind === 'c' && !t.alive) || (t.kind === 'f' && t.retreat);
function hit(t, dmg) {
  if (isDead(t)) return;
  t.hp -= dmg;
  t.flash = 0.12;
  if (t.kind === 'b' || t.kind === 'c') sfx('hit', 0.15);
  else sfx('hit', 0.3);
  if (t.hp > 0) return;
  t.dead = true;
  if (t.kind === 'b') destroyBuilding(t);
  else if (t.kind === 'v') {
    G.stats.lost++; // voor de medailles van uitdagingen
    G.vs = G.vs.filter(x => x !== t);
    sel.vs.delete(t.id);
    store.notePos = [t.x, t.y];
    toast(`${t.name} is omgekomen.`, 'bad');
    burst(t.x, t.y, '#b0463a');
  } else if (t.kind === 'u') {
    G.us = G.us.filter(x => x !== t);
    sel.us.delete(t.id);
    burst(t.x, t.y, '#b0463a');
  } else if (t.kind === 'f') {
    G.stats.killed++;
    burst(t.x, t.y, '#7a3a30');
    if (Math.random() < 0.35) {
      const n = 5 + G.age * 3;
      G.res.food += n;
      floater(t.x, t.y, '+' + n, RES.food.c);
    }
  } else if (t.kind === 'c') campDestroyed(t);
}
function destroyBuilding(b) {
  const d = B[b.type];
  b.dead = true;
  setBlk(b, false);
  for (let dy = 0; dy < d.size; dy++) for (let dx = 0; dx < d.size; dx++) bmap[(b.y + dy) * W + b.x + dx] = 0;
  G.bs = G.bs.filter(x => x !== b);
  bById.delete(b.id);
  if (!d.wall) G.stats.lost++; // muren tellen niet: die zijn er juist om stuk te gaan
  if (sel.b === b.id) sel.b = null;
  for (let k = 0; k < 6; k++) burst(b.x + Math.random() * d.size, b.y + Math.random() * d.size, '#8a7a62');
  for (const v of G.vs) if (v.hidden && v.shelter === b.id) unhide(v);
  if (SET.shake) store.shake = d.wall ? 0.15 : 0.5;
  sfx('boom');
  if (b.type === 'townhall') {
    G.over = true;
    endGame(false, 900);
  } else if (d.wall) {
    note(`${d.n} doorbroken.`, 'bad');
  } else {
    store.notePos = [b.x + d.size / 2, b.y + d.size / 2];
    toast(`${d.n} is verwoest.`, 'bad');
  }
  store.uiDirty = true;
}
function campDestroyed(c) {
  c.alive = false;
  G.stats.camps++;
  const L = { food: 250, wood: 200, stone: 150 },
    tier = c.tier;
  if (tier >= 1) {
    L.copper = 80;
    L.tin = 60;
  }
  if (tier >= 2) {
    L.iron = 120;
    L.gold = 60;
    L.powder = 40;
  }
  if (tier >= 3) {
    L.coal = 150;
    L.steel = 60;
  }
  if (tier >= 4) {
    L.oil = 150;
    L.fuel = 60;
  }
  if (tier >= 5) {
    L.chips = 40;
    L.battery = 40;
  }
  for (const k in L) L[k] = Math.round(L[k] * (1 + tier * 0.6) * mul('loot'));
  gain(L);
  const ci = ((c.y + 1) >> 4) * CN + ((c.x + 1) >> 4);
  let extra = '';
  if (!G.unl[ci]) {
    G.unl[ci] = 1;
    extra = ' Het gebied is nu van jou.';
  }
  for (let k = 0; k < 10; k++) burst(c.x + Math.random() * 2, c.y + Math.random() * 2, '#b9822f');
  store.notePos = [c.x + 1, c.y + 1];
  toast(`Vijandelijk kamp veroverd! Buit binnengehaald.${extra}`, 'good');
  sfx('age');
  floater(c.x + 1, c.y + 1, 'BUIT', '#e2b92c');
  if (sel.camp === c.id) sel.camp = null;
  computeAvail();
  store.uiDirty = true;
}
export function fire(from, x, y, t, o) {
  // Geluid hoort bij het wapen (musket, kanon, laser, ...); vijanden iets minder vaak
  sfx(o.snd || 'shot', o.foe ? 0.3 : 0.12);
  if (o.laser) {
    hit(t, o.dmg);
    G.fx.push({ type: 'beam', x, y, x2: t.x, y2: t.y, life: 0.12, col: '#5ff0ff' });
    return;
  }
  const p = tpos(t);
  G.proj.push({
    x,
    y,
    t,
    lx: p.x,
    ly: p.y,
    dmg: o.dmg,
    splash: o.splash || 0,
    spd: o.big ? 11 : 15,
    col: o.col || '#fff3c4',
    foe: !!o.foe,
    big: !!o.big,
    h0: o.h0 || 14,
  });
}
export function updateProj(dt) {
  for (const p of G.proj) {
    if (!isDead(p.t)) {
      const q = tpos(p.t);
      p.lx = q.x;
      p.ly = q.y;
    }
    const dx = p.lx - p.x,
      dy = p.ly - p.y,
      d = Math.hypot(dx, dy),
      st = p.spd * dt;
    if (d <= st + 0.15) {
      p.done = true;
      if (p.splash) {
        const list = p.foe ? [...G.vs, ...G.us] : G.foes;
        for (const e of list) if (!e.hidden && dist(e.x, e.y, p.lx, p.ly) <= p.splash) hit(e, p.dmg);
        if (p.foe && !isDead(p.t) && p.t.kind === 'b') hit(p.t, p.dmg);
        if (!p.foe)
          for (const c of G.camps)
            if (c.alive && dist(c.x + 1, c.y + 1, p.lx, p.ly) <= p.splash + 1) hit(c, p.dmg);
        G.fx.push({ type: 'boom', x: p.lx, y: p.ly, life: 0.35, r: p.splash });
      } else if (!isDead(p.t)) hit(p.t, p.dmg);
    } else {
      p.x += (dx / d) * st;
      p.y += (dy / d) * st;
    }
  }
  G.proj = G.proj.filter(p => !p.done);
}
export function nearestFoe(x, y, r, air) {
  let best = null,
    bd = r;
  for (const f of G.foes) {
    if (f.retreat || f.dead) continue;
    if (f.air && !air) continue;
    const d = dist(x, y, f.x, f.y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}
// Schade van een eigen eenheid tegen doel t: basis × wapens × onderzoek × rol-bonus
function udmg(u, t) {
  return (
    UNITS[u.k].dmg *
    bonusMul(UNITS[u.k], t) *
    armsMul() *
    mul('army.dmg') *
    (u.k === 'drone' || u.k === 'exo' ? mul('robot.dmg') : 1)
  );
}
export function uUpdate(u, dt) {
  const U = UNITS[u.k],
    SP = U.spd * mul('army.speed') * mul('move.all');
  u.anim += dt;
  if (u.flash) u.flash -= dt;
  if (u.swing > 0) u.swing -= dt;
  const restHeal = u.order === 'guard' && !u.tgt ? 1.5 : 0; // rusten op wacht
  const bonusHeal = 2 * add('heal'); // het leger geneest dubbel zo snel als het volk
  u.hp = Math.min(u.mhp, u.hp + dt * (restHeal + bonusHeal));
  if (u.tgt && isDead(u.tgt)) {
    u.tgt = null;
    u.path = null;
    if (u.order === 'attack') u.order = 'guard';
  }
  u.scan -= dt;
  if (u.scan <= 0) {
    u.scan = 0.4;
    if (!u.tgt || u.order !== 'attack') {
      const st = u.stance || 'guard',
        am = u.order === 'amove' || u.order === 'patrol',
        leash = am ? 8 : st === 'hold' ? U.r + 0.3 : st === 'aggr' ? 11 : u.order === 'move' ? 4.5 : 7;
      const f = nearestFoe(u.x, u.y, leash, U.air);
      if (
        f &&
        (st === 'aggr' ||
          u.order !== 'guard' ||
          dist(f.x, f.y, u.gx, u.gy) < (st === 'hold' ? U.r + 0.5 : 11))
      )
        u.tgt = f;
      else if (u.order === 'guard' && !f && u.tgt && dist(u.x, u.y, u.gx, u.gy) > 10) u.tgt = null;
    }
  }
  u.cd -= dt;
  if (u.tgt) {
    const p = tpos(u.tgt),
      d = dist(u.x, u.y, p.x, p.y) - p.rad;
    if (d <= U.r) {
      u.path = null;
      u.dir = scrX(p.x, p.y) < scrX(u.x, u.y) ? -1 : 1;
      if (u.stance === 'hold' && u.order !== 'attack') {
        /* blijf staan */
      }
      if (u.cd <= 0) {
        u.cd = U.rate;
        u.swing = 0.2;
        if (U.proj)
          fire(u, u.x, u.y, u.tgt, {
            dmg: udmg(u, u.tgt),
            splash: U.splash,
            big: U.big,
            col: U.fly ? '#7ff7ff' : U.splash ? '#ffbd6b' : '#fff3c4',
            h0: U.fly ? 22 : 12,
            snd: U.snd,
          });
        else {
          if (U.snd) sfx(U.snd, 0.15);
          hit(u.tgt, udmg(u, u.tgt));
        }
      }
    } else if (u.stance === 'hold' && u.order === 'guard') {
      u.tgt = null;
    } else chase(u, p, dt, SP, U.fly);
    return;
  }
  if (u.order === 'move' || u.order === 'attack' || u.order === 'amove') {
    if (moveToward(u, u.gx, u.gy, dt, SP, U.fly)) u.order = 'guard';
    return;
  }
  if (u.order === 'patrol') {
    if (moveToward(u, u.gx, u.gy, dt, SP, U.fly)) {
      const a = u.gx,
        b2 = u.gy;
      u.gx = u.px;
      u.gy = u.py;
      u.px = a;
      u.py = b2;
      u.path = null;
    }
    return;
  }
  if (dist(u.x, u.y, u.gx, u.gy) > 0.8) moveToward(u, u.gx, u.gy, dt, SP, U.fly);
}
function chase(e, p, dt, spd, fly) {
  if (fly) {
    const dx = p.x - e.x,
      dy = p.y - e.y,
      d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * spd * dt;
    e.y += (dy / d) * spd * dt;
    e.dir = (store.V2 ? dx : dx - dy) < 0 ? -1 : 1;
    return;
  }
  e.pt -= dt;
  const foe = e.kind === 'f',
    mode = foe ? 2 : true;
  if (!e.path || !e.path.length || e.pt <= 0) {
    e.pt = 1.5;
    const pp = findPath(e.x | 0, e.y | 0, Math.floor(p.x), Math.floor(p.y), mode);
    if (pp === null && foe) {
      const w = nearestWall(e.x, e.y);
      if (w && w !== e.tgt) {
        e.tgt = w;
        e.rt = 6;
        e.path = findPath(e.x | 0, e.y | 0, w.x, w.y, 2) || [];
        return;
      }
    }
    e.path = pp || [];
  }
  if (e.path.length) follow(e, dt, spd);
  else {
    const dx = p.x - e.x,
      dy = p.y - e.y,
      d = Math.hypot(dx, dy) || 1;
    const nx = e.x + (dx / d) * spd * dt,
      ny = e.y + (dy / d) * spd * dt;
    if ((foe ? foeWalk : freeWalk)(nx | 0, ny | 0)) {
      e.x = nx;
      e.y = ny;
    }
  }
}
function moveToward(e, x, y, dt, spd, fly) {
  if (dist(e.x, e.y, x, y) < 0.35) {
    e.path = null;
    return true;
  }
  if (fly) {
    const dx = x - e.x,
      dy = y - e.y,
      d = Math.hypot(dx, dy),
      st = spd * dt;
    if (d <= st) {
      e.x = x;
      e.y = y;
      return true;
    }
    e.x += (dx / d) * st;
    e.y += (dy / d) * st;
    e.dir = (store.V2 ? dx : dx - dy) < 0 ? -1 : 1;
    return false;
  }
  if (!e.path) {
    e.path = findPath(e.x | 0, e.y | 0, x | 0, y | 0, e.kind === 'f' ? 2 : true);
    if (!e.path) {
      e.gx = e.x;
      e.gy = e.y;
      return true;
    }
  }
  if (follow(e, dt, spd)) {
    e.path = null;
    if (dist(e.x, e.y, x, y) < 0.7) {
      e.x = x;
      e.y = y;
    }
    return true;
  }
  return false;
}
function foeTarget(f) {
  let best = null,
    bd = f.camp ? 7 : 5.5;
  for (const u of G.us) {
    const d = dist(f.x, f.y, u.x, u.y);
    if (d < bd && (!UNITS[u.k].fly || f.air || f.proj)) {
      bd = d;
      best = u;
    }
  }
  for (const v of G.vs) {
    if (v.hidden) continue;
    const d = dist(f.x, f.y, v.x, v.y);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  if (best || f.camp) return best;
  bd = 1e9;
  for (const b of G.bs) {
    const p = tpos(b);
    const d = dist(f.x, f.y, p.x, p.y) - (B[b.type].def ? 3 : 0);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
export function fUpdate(f, dt) {
  f.anim += dt;
  if (f.flash) f.flash -= dt;
  if (f.swing > 0) f.swing -= dt;
  if (f.retreat) {
    f.alpha -= dt * 0.35;
    const dx = f.x - CX,
      dy = f.y - CY,
      d = Math.hypot(dx, dy) || 1;
    f.x += (dx / d) * f.spd * dt;
    f.y += (dy / d) * f.spd * dt;
    if (f.alpha <= 0) f.dead = true;
    return;
  }
  if (f.camp) {
    const c = G.camps.find(c => c.id === f.camp);
    if (!c || !c.alive) {
      f.camp = 0;
      f.retreat = true;
      return;
    }
    f.rt -= dt;
    if (f.rt <= 0 || isDead(f.tgt)) {
      f.rt = 1;
      f.tgt = foeTarget(f);
      f.aggro = !!f.tgt;
      if (!f.tgt)
        for (const b of G.bs) {
          if (dist(b.x, b.y, c.x, c.y) < 8) {
            f.tgt = b;
            f.aggro = true;
            break;
          }
        }
    }
    if (f.tgt && dist(f.x, f.y, f.hx, f.hy) > 12) {
      f.tgt = null;
      f.aggro = false;
    }
    if (!f.tgt) {
      f.aggro = false;
      moveToward(f, f.hx, f.hy, dt, f.spd * 0.7, f.air);
      return;
    }
  } else {
    f.rt -= dt;
    if (!f.tgt || isDead(f.tgt) || f.rt <= 0) {
      const n = foeTarget(f);
      if (n !== f.tgt) f.path = null;
      f.tgt = n;
      f.rt = 2;
    }
    if (!f.tgt) return;
  }
  const p = tpos(f.tgt),
    d = dist(f.x, f.y, p.x, p.y) - p.rad;
  if (d <= f.r) {
    f.path = null;
    f.dir = scrX(p.x, p.y) < scrX(f.x, f.y) ? -1 : 1;
    f.cd -= dt;
    if (f.cd <= 0) {
      f.cd = f.rate;
      f.swing = 0.2;
      if (f.proj)
        fire(f, f.x, f.y, f.tgt, {
          dmg: f.dmg,
          foe: 1,
          col: f.air ? '#ff6a5a' : '#ff9b6b',
          big: f.big,
          splash: f.big ? 1 : 0,
          h0: f.air ? 22 : 12,
          snd: FOES[f.type].snd,
        });
      else hit(f.tgt, f.dmg);
    }
  } else chase(f, p, dt, f.spd, f.air);
}
export function spawnRaid() {
  G.raids++;
  const a = G.age,
    n = raidSize(),
    // Elke aanval iets taaier, maar niet eindeloos. Op Meedogenloos hebben aanvallers meer levens.
    scale = Math.min(2.5, 1 + G.raids * 0.05) * difficulty(G.diff).raidHp,
    edge = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!walkable(x, y)) continue;
      if (!isUnl(x - 1, y) || !isUnl(x + 1, y) || !isUnl(x, y - 1) || !isUnl(x, y + 1)) edge.push([x, y]);
    }
  if (!edge.length) return;
  G.stats.raidDay = G.day; // voor de prestaties "doorsta ... aanvallen" (zie game/time.js)
  const anchor = edge[(Math.random() * edge.length) | 0],
    near = edge.filter(e => dist(e[0], e[1], anchor[0], anchor[1]) < 7);
  for (let k = 0; k < n; k++) {
    // Meestal vijanden van jouw tijdperk, met wat oudere ertussen; drones komen met pantserwagens
    const type = a === 7 ? (k % 2 ? 7 : 6) : k % 3 === 0 && a > 0 ? a - 1 : a;
    const e = near[(Math.random() * near.length) | 0];
    G.spawnQ.push({ type, x: e[0] + 0.5, y: e[1] + 0.5, scale, at: G.t + k * 0.7 });
  }
  store.notePos = [anchor[0], anchor[1]];
  toast(`Aanval! ${n} × ${FOES[a].n.toLowerCase()} uit het ${compass(anchor[0], anchor[1])}.`, 'bad');
  sfx('alarm');
  store.raidPing = { x: anchor[0], y: anchor[1], t: 8 };
}
// Hoe groot de volgende aanval is: groeit met elke aanval en elk tijdperk, maar blijft te overzien.
// (Latere vijanden zijn per stuk al veel sterker, dus het aantal groeit rustig.)
export function raidSize() {
  const diff = difficulty(G.diff); // Zwaar en Meedogenloos sturen grotere groepen
  const base = 2 + Math.floor((G.raids + 1) * 0.9) + G.age;
  return Math.min(diff.raidMax, Math.round(base * diff.raidSize * mul('raid.size')));
}
function compass(x, y) {
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
