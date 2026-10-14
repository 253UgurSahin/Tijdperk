// Wat gebouwen elke tik doen: produceren, trainen, stroom maken.
import { store } from '../core/store.js';
import { W } from '../config.js';
import { B } from '../data/buildings.js';
import { NI } from '../data/nodes.js';
import { UNITS } from '../data/units.js';
import { genPower, powerDem, powerRatio, powerSup } from './caches.js';
import { gain, has, pay } from './economy.js';
import { popCap, popNow, spawnUnit, spawnVillager, trainCost } from './entities.js';
import { floater } from './fx.js';
import { fire, nearestFoe } from './military.js';
import { G } from './state.js';
import { add, mul } from './bonus.js';
import { bRate, lvlOf } from './upgrades.js';
import { amt, node } from '../world/world.js';

export function bUpdate(b, dt) {
  if (!b.done) return;
  const d = B[b.type],
    pr = d.power ? powerRatio : 1;
  b.act -= dt;
  if (d.conv && b.on) {
    const mill = b.type === 'windmill' || b.type === 'powdermill' ? mul('mill.speed') : 1;
    b.ct += dt * pr * bRate(b) * mill * mul('conv.speed');
    if (b.ct >= d.conv.t) {
      if (has(d.conv.in)) {
        pay(d.conv.in);
        gain(d.conv.out);
        b.ct = 0;
        b.act = 1.2;
        b.starved = false;
      } else {
        b.ct = d.conv.t;
        b.starved = true;
      }
    }
  }
  if (d.gen) {
    if (!b.on) b.run = false;
    else if (d.gen.solar) b.run = true;
    else {
      b.gt += dt;
      if (b.gt >= d.gen.t) {
        b.gt = 0;
        // Alleen stoken als de stroom echt nodig is: overbodige centrales staan stil en sparen brandstof
        const needed = powerSup - (b.run ? genPower(b) : 0) < powerDem;
        if (needed && has(d.gen.in)) {
          pay(d.gen.in);
          b.run = true;
          b.act = d.gen.t;
        } else b.run = false;
      }
    }
  }
  if (d.pump && b.on) {
    const i = b.y * W + b.x;
    if (node[i] === NI.oil && amt[i] > 0) {
      b.ct += dt * pr * bRate(b) * mul('conv.speed');
      if (b.ct >= d.pump.t) {
        b.ct = 0;
        amt[i]--;
        G.res.oil++;
        b.act = 1;
      }
    }
  }
  if (d.def) {
    b.cd -= dt * pr;
    if (b.cd <= 0) {
      const s = d.size / 2,
        x = b.x + s,
        y = b.y + s,
        f = nearestFoe(
          x,
          y,
          d.def.r + 0.5 * lvlOf(b) + (b.type !== 'townhall' ? add('tower.range') : 0),
          d.def.air,
        );
      if (f) {
        const dmg =
          (b.type === 'townhall' ? d.def.dmg * (1 + G.age * 0.8) : d.def.dmg) *
          (1 + 0.4 * lvlOf(b)) *
          mul('tower.dmg') *
          (d.def.laser ? mul('laser.dmg') : 1);
        fire(b, x, y, f, {
          dmg,
          splash: d.def.splash,
          laser: d.def.laser,
          col: b.type === 'cannon' ? '#ffbd6b' : '#fff3c4',
          big: b.type === 'cannon',
          h0: d.h * 0.8,
          snd: d.snd,
        });
        b.cd = d.def.rate;
        b.aim = Math.atan2(f.y - y, f.x - x);
      } else b.cd = 0.25;
    }
  }
  if (d.train && b.q.length) {
    const U = UNITS[b.q[0]];
    b.blocked = popNow() >= popCap();
    if (!b.blocked) {
      b.qt += dt * pr * (1 + 0.2 * lvlOf(b));
      if (b.qt >= U.t) {
        b.qt = 0;
        const k = b.q.shift(),
          s = d.size,
          u = spawnUnit(k, b.x + s / 2, b.y + s + 0.4);
        const rp = b.rally || {
          x: b.x + s / 2 + (Math.random() - 0.5) * 2,
          y: b.y + s + 1.5 + Math.random(),
        };
        u.gx = rp.x + (Math.random() - 0.5) * 1.4;
        u.gy = rp.y + (Math.random() - 0.5) * 1.4;
        u.order = 'move';
        u.stance = G.stance;
        G.stats.trained++;
        G.stats[k] = (G.stats[k] || 0) + 1; // per soort tellen, voor de doelen
        floater(u.x, u.y, UNITS[k].n, '#ffffff');
        store.uiDirty = true;
      }
    }
  }
  if (b.type === 'townhall') {
    if (!G.training) {
      const c = trainCost();
      if ((G.autoTrain || G.trainQ > 0) && popNow() < popCap() && G.res.food >= c + (G.trainQ > 0 ? 0 : 30)) {
        G.res.food -= c;
        G.training = true;
        G.trainT = 0;
        if (G.trainQ > 0) G.trainQ--;
      }
    } else {
      G.trainT += dt;
      if (G.trainT >= 8) {
        G.training = false;
        const v = spawnVillager(b.x + 1, b.y + 2.3);
        G.stats.born++;
        floater(v.x, v.y, '+1 dorpeling', '#ffffff');
        store.uiDirty = true;
      }
    }
  }
  if (b.act > 0 && (d.conv || (d.gen && !d.gen.solar)) && Math.random() < dt * 3)
    G.fx.push({
      type: 'smoke',
      x: b.x + d.size * 0.62,
      y: b.y + d.size * 0.3,
      z: d.h * 0.9,
      vz: 14,
      life: 2.6,
      max: 2.6,
    });
}
