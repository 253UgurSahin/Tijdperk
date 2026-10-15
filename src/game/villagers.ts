import type { Building, Foe, Tile, VTarget, Villager } from '../types';
// Het brein van de dorpelingen: kiezen wat ze doen, verzamelen, bouwen, schuilen.
import { sfx } from '../audio/sound';
import { W } from '../config';
import { AGE_UP } from '../data/ages';
import { B } from '../data/buildings';
import { NI, NODES, RES_NODES } from '../data/nodes';
import { BASEW, GATHER, HARD, RES } from '../data/resources';
import { wonderBuildRate } from '../data/wonders';
import { avail, demand, farmCnt, litAt, siteCnt, wr } from './caches';
import { completeBuilding } from './entities';
import { chips, floater } from './fx';
import { G, bById } from './state';
import { isNight, season } from './time';
import { mul } from './bonus';
import { bMaxHp, carryMax, farmSlots } from './upgrades';
import { pulseRes } from '../ui/hud';
import { clamp, dist } from '../util/math';
import { findPath, follow } from '../world/pathfinding';
import { amt, claims, isUnl, node, nodeLists, unreach, walkable } from '../world/world';

function nearestDrop(x: number, y: number): Building | null {
  let best = null,
    bd = 1e9;
  for (const b of G.bs) {
    const d = B[b.type];
    if (!b.done || !d.drop) continue;
    const dd = dist(x, y, b.x + d.size / 2, b.y + d.size / 2);
    if (dd < bd) {
      bd = dd;
      best = b;
    }
  }
  return best;
}
function nearestShelter(x: number, y: number): Building | null {
  let best = null,
    bd = 1e9;
  for (const b of G.bs) {
    const d = B[b.type];
    if (!b.done || !d.pop) continue;
    const dd = dist(x, y, b.x + d.size / 2, b.y + d.size / 2);
    if (dd < bd) {
      bd = dd;
      best = b;
    }
  }
  return best;
}
export function walkTo(v: Villager, tx: number, ty: number, on: string): boolean {
  const p = findPath(v.x | 0, v.y | 0, tx, ty, false);
  if (p === null) {
    if (v.tgt && v.tgt.k === 'node') unreach[v.tgt.i] = G.t + 40;
    v.tgt = null;
    v.keep = null;
    v.state = 'idle';
    v.wait = 0.6;
    return false;
  }
  v.path = p;
  v.state = 'walk';
  v.on = on;
  return true;
}
function bTile(b: Building, x: number, y: number): Tile {
  const s = B[b.type].size;
  return [clamp(Math.floor(x), b.x, b.x + s - 1), clamp(Math.floor(y), b.y, b.y + s - 1)];
}
function goDeliver(v: Villager) {
  const d = nearestDrop(v.x, v.y);
  if (!d) {
    v.state = 'idle';
    v.wait = 2;
    return;
  }
  const t = bTile(d, v.x, v.y);
  v.tgt = null;
  walkTo(v, t[0], t[1], 'drop');
}
function goHome(v: Villager) {
  const b = nearestShelter(v.x, v.y);
  if (!b) {
    v.state = 'idle';
    v.wait = 2;
    return;
  }
  const t = bTile(b, v.x, v.y);
  v.tgt = null;
  v.shelter = b.id;
  walkTo(v, t[0], t[1], 'sleep');
}
function goShelter(v: Villager) {
  const b = nearestShelter(v.x, v.y);
  if (!b) return;
  const t = bTile(b, v.x, v.y);
  v.tgt = null;
  v.shelter = b.id;
  walkTo(v, t[0], t[1], 'shelter');
}
function hide(v: Villager, kind: 'sleep' | 'shelter') {
  v.hidden = true;
  v.state = kind;
  v.tgt = null;
  v.path = null;
  v.wait = 3;
}
export function unhide(v: Villager) {
  const b = bById.get(v.shelter!);
  v.hidden = false;
  v.state = 'idle';
  v.wait = Math.random() * 0.6;
  if (b) {
    const s = B[b.type].size;
    v.x = b.x + s / 2 + (Math.random() - 0.5) * 0.6;
    v.y = b.y + s + 0.3;
    if (!walkable(v.x | 0, v.y | 0)) {
      v.x = b.x + 0.5;
      v.y = b.y + 0.5;
    }
  }
}
function farmFree(b: Building, v?: Villager): boolean {
  return (farmCnt.get(b.id) || 0) < farmSlots(b) || !!(v && v.tgt && v.tgt.k !== 'node' && v.tgt.b === b);
}
function pickSite(v: Villager, explicit: boolean, night: boolean): Building | null {
  if (v.prefSite && !v.prefSite.dead && !v.prefSite.done) return v.prefSite;
  let best = null,
    bd = 1e9;
  for (const b of G.bs) {
    if (b.done || b.dead) continue;
    if ((siteCnt.get(b.id) || 0) >= (explicit ? 8 : 3)) continue;
    if (night && !litAt(b.x + 0.5, b.y + 0.5)) continue;
    const d = dist(v.x, v.y, b.x, b.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function pickTarget(v: Villager, res: string, night: boolean): VTarget | null {
  const ok = (x: number, y: number) => !night || litAt(x + 0.5, y + 0.5);
  const k = v.keep;
  if (k) {
    if (
      k.k === 'node' &&
      node[k.i] &&
      NODES[node[k.i]].res === res &&
      amt[k.i] > 0 &&
      unreach[k.i] <= G.t &&
      ok(k.i % W, (k.i / W) | 0) &&
      claims[k.i] < 3
    )
      return k;
    if (k.k === 'farm' && !k.b.dead && k.b.done && res === 'food' && farmFree(k.b, v) && ok(k.b.x, k.b.y))
      return k;
    v.keep = null;
  }
  let best: VTarget | null = null,
    bd = 1e9;
  if (res === 'food')
    for (const b of G.bs) {
      if (b.type !== 'farm' || !b.done || !farmFree(b, v) || !ok(b.x, b.y)) continue;
      const d = dist(v.x, v.y, b.x + 1, b.y + 1) - 6;
      if (d < bd) {
        bd = d;
        best = { k: 'farm', b };
      }
    }
  for (const t of RES_NODES[res] || []) {
    if (NODES[t].age > G.age) continue;
    const L = nodeLists[t];
    for (let j = L.length - 1; j >= 0; j--) {
      const i = L[j];
      if (node[i] !== t || amt[i] === 0) {
        L[j] = L[L.length - 1];
        L.pop();
        continue;
      }
      const x = i % W,
        y = (i / W) | 0;
      if (!isUnl(x, y) || unreach[i] > G.t || !ok(x, y)) continue;
      const d = Math.abs(x - v.x) + Math.abs(y - v.y) + claims[i] * 6;
      if (d < bd) {
        bd = d;
        best = { k: 'node', i };
      }
    }
  }
  return best;
}
function autoOrder() {
  const nx = AGE_UP[G.age + 1],
    arr: [number, string][] = [];
  for (const r of GATHER) {
    if (!avail[r]) continue;
    let w = BASEW[r];
    const st = G.res[r];
    let need = (nx && nx.cost[r]) || 0;
    if (demand[r]) need = Math.max(need, st + 150);
    if (need > st) w *= 1 + Math.min(2, ((need - st) / Math.max(need, 1)) * 2.2);
    if (r === 'food' && st < 60) w *= 2;
    arr.push([w / (1 + st / 260) / (1 + (wr[r] || 0) * 0.5), r]);
  }
  arr.sort((a, b) => b[0] - a[0]);
  return arr.map(a => a[1]);
}
function decide(v: Villager) {
  const night = isNight();
  if (v.job === 'auto' || v.job === 'build') {
    const site = pickSite(v, v.job === 'build', night);
    if (site) {
      if (v.carry.amt) {
        goDeliver(v);
        return;
      }
      v.tgt = { k: 'site', b: site };
      siteCnt.set(site.id, (siteCnt.get(site.id) || 0) + 1);
      const s = B[site.type].size;
      walkTo(v, site.x + (v.id % s), site.y + s - 1, 'build');
      return;
    }
    if (v.job === 'build') {
      idleOrHome(v, night);
      return;
    }
  }
  const order = v.job === 'auto' ? autoOrder() : [v.job];
  for (const res of order) {
    const t = pickTarget(v, res, night);
    if (!t) continue;
    if (v.carry.amt && v.carry.res !== res) {
      goDeliver(v);
      return;
    }
    v.res = res;
    v.tgt = t;
    wr[res] = (wr[res] || 0) + 1;
    let tx, ty;
    if (t.k === 'node') {
      claims[t.i]++;
      tx = t.i % W;
      ty = (t.i / W) | 0;
    } else {
      farmCnt.set(t.b.id, (farmCnt.get(t.b.id) || 0) + 1);
      const sl = v.id % 4;
      tx = t.b.x + (sl & 1);
      ty = t.b.y + (sl >> 1);
    }
    walkTo(v, tx, ty, 'gather');
    return;
  }
  idleOrHome(v, night);
}
function idleOrHome(v: Villager, night: boolean) {
  if (v.carry.amt) {
    goDeliver(v);
    return;
  }
  if (night) goHome(v);
  else {
    v.state = 'idle';
    v.wait = 1.5;
  }
}
function foeNear(x: number, y: number, r: number): Foe | null {
  for (const f of G.foes) {
    if (f.retreat || f.helper) continue; // helpers van een bondgenoot zijn geen gevaar
    if (f.camp && !f.aggro) continue;
    if (Math.abs(f.x - x) < r && Math.abs(f.y - y) < r && dist(f.x, f.y, x, y) < r) return f;
  }
  return null;
}
export function vUpdate(v: Villager, dt: number) {
  v.anim += dt;
  if (v.hidden) {
    v.hp = Math.min(v.mhp, v.hp + dt * 2);
    if (v.state === 'sleep') {
      if (!isNight() && !foeNear(v.x, v.y, 9)) unhide(v);
    } else {
      v.wait -= dt;
      if (v.wait <= 0) {
        if (foeNear(v.x, v.y, 9)) v.wait = 2;
        else unhide(v);
      }
    }
    if (!bById.get(v.shelter!)) unhide(v);
    return;
  }
  v.threat -= dt;
  if (v.threat <= 0) {
    v.threat = 0.4;
    if (v.on !== 'shelter' && foeNear(v.x, v.y, 6)) {
      goShelter(v);
      return;
    }
  }
  switch (v.state) {
    case 'idle':
      if (v.wait > 0) {
        v.wait -= dt;
        break;
      }
      decide(v);
      break;
    case 'walk': {
      // Sjouwen gaat trager; elk tijdperk loopt iets sneller
      const loadSpeed = v.carry.amt ? 1.9 : 2.3;
      const walkSpeed = loadSpeed * (1 + G.age * 0.04) * mul('vill.speed') * mul('move.all');
      if (follow(v, dt, walkSpeed)) arrive(v);
      break;
    }
    case 'gather':
      doGather(v, dt);
      break;
    case 'build':
      doBuild(v, dt);
      break;
    case 'hold':
      v.wait -= dt;
      if (v.wait <= 0) v.state = 'idle';
      break;
  }
}
function arrive(v: Villager) {
  switch (v.on) {
    case 'gather':
      v.state = 'gather';
      v.timer = 0;
      break;
    case 'build':
      v.state = 'build';
      break;
    case 'drop': {
      const r = v.carry.res!,
        a = v.carry.amt;
      if (a) {
        G.res[r] += a;
        G.stats.gathered += a;
        floater(v.x, v.y, '+' + a, RES[r].c);
        pulseRes(r);
        sfx('drop', 0.25);
      }
      v.carry = { res: null, amt: 0 };
      v.state = 'idle';
      v.wait = 0;
      break;
    }
    case 'sleep':
      hide(v, 'sleep');
      break;
    case 'shelter':
      hide(v, 'shelter');
      break;
    case 'hold':
      v.state = 'hold';
      v.wait = 6;
      break;
    default:
      v.state = 'idle';
  }
  v.on = null;
}
function doGather(v: Villager, dt: number) {
  const t = v.tgt;
  if (!t) {
    v.state = 'idle';
    return;
  }
  if ((t.k === 'node' && (node[t.i] === 0 || amt[t.i] === 0)) || (t.k === 'farm' && t.b.dead)) {
    v.tgt = null;
    if (v.carry.amt >= carryMax() * 0.5) goDeliver(v);
    else v.state = 'idle';
    return;
  }
  const night = isNight();
  if (night && !litAt(v.x, v.y)) {
    v.keep = t;
    v.tgt = null;
    if (v.carry.amt) goDeliver(v);
    else goHome(v);
    return;
  }
  v.timer +=
    dt *
    0.95 *
    G.tools *
    (1 + G.age * 0.05) *
    (1 + G.toolLvl * 0.15) *
    HARD[v.res!] *
    (night ? 0.75 : 1) *
    (G.hungry ? 0.5 : 1) *
    resourceBonus(v.res!) *
    (G.rain && t.k === 'node' ? 0.9 : 1) *
    (t.k === 'farm' ? mul('farm') : 1) *
    (t.k === 'farm' ? mul('farm.plow') : 1) *
    mul('gather.all'); // ook tijdelijke bonussen uit gebeurtenissen, zoals een oogstfeest
  while (v.timer >= 1) {
    v.timer -= 1;
    chips(v.x + v.dir * 0.3, v.y, RES[v.res!].c);
    if (t.k === 'node') sfx('chop', 0.4);
    if (t.k === 'node') {
      amt[t.i]--;
      if (amt[t.i] === 0) deplete(t.i);
    }
    v.carry.res = v.res;
    v.carry.amt++;
    if (v.carry.amt >= carryMax() || (t.k === 'node' && amt[t.i] === 0)) {
      v.keep = t;
      goDeliver(v);
      return;
    }
  }
}
// Bonussen voor één soort grondstof: voedsel (ook het seizoen telt mee), hout, of steen en erts
function resourceBonus(res: string): number {
  if (res === 'food') return seasonFood() * mul('gather.food');
  if (res === 'wood') return mul('gather.wood');
  const rock = res === 'stone' || res === 'iron' || res === 'coal' ? mul('gather.rock') : 1;
  return mul('gather.mine') * rock;
}
// Hoeveel voedsel het seizoen geeft. In de winter kan een bonus (zoals bij de Friezen) helpen,
// maar nooit meer dan in een gewoon seizoen.
function seasonFood(): number {
  const sn = season();
  if (sn.n !== 'Winter') return sn.food;
  return Math.min(1, sn.food * mul('winter.food'));
}
function deplete(i: number): void {
  const t = node[i];
  node[i] = 0;
  const w = season().n === 'Winter' ? 1.8 : 1;
  if (t === NI.tree) G.regrow.push({ i, t, at: G.t + 240 * w });
  else if (t === NI.bush) G.regrow.push({ i, t, at: G.t + 150 * w });
}
function doBuild(v: Villager, dt: number) {
  const b = v.tgt && v.tgt.k !== 'node' ? v.tgt.b : null;
  if (!b || b.dead || b.done) {
    v.tgt = null;
    v.prefSite = null;
    v.state = 'idle';
    return;
  }
  if (isNight() && !litAt(b.x + 0.5, b.y + 0.5)) {
    v.tgt = null;
    goHome(v);
    return;
  }
  // Aan een wereldwonder werken bouwers samen: meer bouwers helpen, maar steeds minder (zie data/wonders.ts)
  const rate = B[b.type].wonder ? wonderBuildRate(siteCnt.get(b.id) || 1) : 1 + G.age * 0.1;
  b.prog += dt * rate * mul('build.speed');
  const mh = bMaxHp(b);
  b.hp = Math.min(mh, b.hp + (mh * 0.85 * dt) / b.bt);
  if (b.prog >= b.bt) {
    completeBuilding(b);
    v.prefSite = null;
  }
}
