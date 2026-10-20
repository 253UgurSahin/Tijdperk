import type { Building, Cost } from '../types';
// Wat gebouwen elke tik doen: produceren, trainen, stroom maken.
import { store } from '../core/store';
import { W } from '../config';
import { B } from '../data/buildings';
import { NI } from '../data/nodes';
import { UNITS } from '../data/units';
import { adjustPowerSup, genPower, goal, powerDem, powerRatio, powerSup } from './caches';
import { gain, has, pay } from './economy';
import { popCap, popNow, spawnUnit, spawnVillager, trainCost } from './entities';
import { floater } from './fx';
import { fire, nearestFoe } from './military';
import { G } from './state';
import { add, mul } from './bonus';
import { bRate, lvlOf } from './upgrades';
import { amt, node } from '../world/world';

export function bUpdate(b: Building, dt: number): void {
  if (b.flash) b.flash -= dt; // de treffer-flits loopt af (zie hit in military.ts)
  if (!b.done) return;
  const d = B[b.type],
    pr = d.power ? powerRatio : 1;
  b.act -= dt;
  // Een fabriek pauzeert vanzelf als er genoeg is van wat hij maakt (b.plenty, zie game/caches.ts)
  if (d.conv && b.on && !b.plenty) {
    const mill = b.type === 'windmill' || b.type === 'powdermill' ? mul('mill.speed') : 1;
    b.ct += dt * pr * bRate(b) * mill * mul('conv.speed');
    if (b.ct >= d.conv.t) {
      // Wat het volgende tijdperk kost, gebruikt hij niet: dat bewaart hij (b.saving)
      b.saving = keptForGoal(d.conv.in);
      if (has(d.conv.in) && !b.saving) {
        pay(d.conv.in);
        gain(d.conv.out);
        b.ct = 0;
        b.act = 1.2;
        b.starved = false;
      } else {
        b.ct = d.conv.t;
        b.starved = !has(d.conv.in);
      }
    }
  } else if (d.conv && b.plenty) {
    b.starved = false;
    b.saving = '';
  }
  if (d.gen) {
    if (!b.on) b.run = false;
    else if (d.gen.solar) b.run = true;
    else {
      // Een centrale zonder zonlicht heeft altijd een stooktijd (t) en brandstof (in), zie data/buildings
      b.gt += dt;
      if (b.gt >= d.gen.t!) {
        b.gt = 0;
        // Alleen stoken als de stroom echt nodig is: overbodige centrales staan stil en sparen brandstof
        const needed = powerSup - (b.run ? genPower(b) : 0) < powerDem;
        const wasRunning = b.run;
        if (needed && has(d.gen.in!)) {
          pay(d.gen.in!);
          b.run = true;
          b.act = d.gen.t!;
        } else b.run = false;
        // Meteen doorgeven: anders beslissen twee centrales in dezelfde tik allebei hetzelfde en gaan ze
        // om de beurt samen aan en uit
        if (b.run !== wasRunning) adjustPowerSup((b.run ? 1 : -1) * genPower(b));
      }
    }
  }
  // Ook een pomp pauzeert als er genoeg olie is: zo raakt de bron niet voor niets leeg
  if (d.pump && b.on && !b.plenty) {
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
      b.qt += dt * pr * (1 + 0.2 * lvlOf(b)) * mul('train.speed');
      if (b.qt >= U.t) {
        b.qt = 0;
        const k = b.q.shift()!,
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
        // Per soort tellen, voor de doelen (de eerste keer staat er nog niets: dan 0)
        const count = G.stats[k];
        G.stats[k] = (typeof count === 'number' ? count : 0) + 1;
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
      // Pas als er nog plek is komt de dorpeling eruit (intussen kan een soldaat de laatste plek hebben genomen)
      if (G.trainT >= 8 && popNow() >= popCap()) G.trainT = 8;
      else if (G.trainT >= 8) {
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

/**
 * De eerste grondstof uit `input` die een fabriek bewaart voor het volgende tijdperk: hem gebruiken zou de
 * voorraad onder de kosten van dat tijdperk brengen. Leeg als hij alles mag gebruiken.
 */
function keptForGoal(input: Cost): string {
  for (const k in input) {
    const need = goal[k] || 0;
    if (need > 0 && G.res[k] >= input[k] && G.res[k] - input[k] < need) return k;
  }
  return '';
}
