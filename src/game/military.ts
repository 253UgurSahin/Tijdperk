import type {
  Building,
  Camp,
  Cost,
  Foe,
  GameState,
  Mobile,
  Projectile,
  Target,
  Tile,
  Unit,
  Villager,
} from '../types';
// Gevechten: soldaten, vijanden, torens en projectielen.
import { store } from '../core/store';
import { screenRight } from '../core/view';
import { sfx } from '../audio/sound';
import { CN, CX, CY, H, W } from '../config';
import { SET } from '../core/settings';
import { B } from '../data/buildings';
import { difficulty, raidMatch, type RaidMatch } from '../data/difficulty';
import { RES } from '../data/resources';
import { FOES, UNITS, bonusMul, foodUpkeep } from '../data/units';
import { endGame } from './achievements';
import { computeAvail } from './caches';
import { gain } from './economy';
import { burst, floater } from './fx';
import { G, bById, sel } from './state';
import { add, mul } from './bonus';
import { armsMul } from './upgrades';
import { unhide } from './villagers';
import { scrX } from '../render/scene';
import { hallHit, note, toast } from '../ui/hud';
import { dist } from '../util/math';
import { findPath, follow } from '../world/pathfinding';
import {
  landOwner,
  nearestRivalBuilding,
  nextRivalBuilding,
  rivalBuildingDestroyed,
  rivalHurt,
  rivalThink,
  rbById,
} from './rivals';
import { bmap, foeWalk, freeWalk, isUnl, nearestWall, setBlk, walkable } from '../world/world';
import { wonderDestroyed } from './wonders';
import { bossDefeated, bossForRaid } from './bosses';
import { gateDestroyed, gateHurt, isCharging, raidBoost } from './finale';
import { allyHelp, atWarWith, commonEnemyBeaten, fairTarget, helpersNear, yourPower } from './diplomacy';
import { spreadOut } from '../data/finale';
import { creditKill, veteranMul } from './army';

/** Een schot: schade, spatschade, laser, kleur, groot projectiel, beginhoogte, van een vijand, geluid. */
interface FireOpts {
  dmg: number;
  splash?: number;
  laser?: boolean | 1;
  col?: string;
  big?: boolean | 1;
  h0?: number;
  foe?: boolean | 0 | 1;
  /** Geschoten door een helper van een bondgenoot, en van welke rivaal die is. */
  ally?: boolean;
  allyOf?: number;
  snd?: string;
}

function tpos(t: Target): { x: number; y: number; rad: number } {
  // Een gebouw: van jou ('b') of van een rivaal ('rb')
  if (t.kind === 'b' || t.kind === 'rb') {
    const s = B[t.type].size;
    return { x: t.x + s / 2, y: t.y + s / 2, rad: s / 2 };
  }
  if (t.kind === 'c') return { x: t.x + 1, y: t.y + 1, rad: 1.2 };
  return { x: t.x, y: t.y, rad: 0.25 };
}
export const isDead = (t: Target | null | undefined): boolean | undefined =>
  !t || t.dead || t.hidden || (t.kind === 'c' && !t.alive) || (t.kind === 'f' && t.retreat);
// `by`: de soldaat van jou die raakte (of niets). Versla je zo een vijand, dan telt die overwinning voor hem.
function hit(t: Target, dmg: number, by?: Unit | null) {
  if (isDead(t)) return;
  const hpBefore = t.hp;
  t.hp -= dmg;
  t.flash = 0.12;
  if (t.kind === 'b' || t.kind === 'c' || t.kind === 'rb') sfx('hit', 0.15);
  else sfx('hit', 0.3);
  if ('rival' in t && t.rival) rivalHurt(t); // een rivaal merkt dat je hem aanvalt
  if (t.kind === 'b' && t.type === 'stargate') gateHurt(t, hpBefore); // waarschuwing tijdens de finale
  if (t.kind === 'b' && t.type === 'townhall') hallHit(); // rode flits aan de rand van het scherm
  if (t.hp > 0) return;
  t.dead = true;
  if (t.kind === 'b') destroyBuilding(t);
  else if (t.kind === 'rb') rivalBuildingDestroyed(t);
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
  } else if (t.kind === 'f' && t.helper) {
    burst(t.x, t.y, '#7a3a30'); // een helper van een bondgenoot sneuvelt: geen vijand van jou
  } else if (t.kind === 'f') {
    G.stats.killed++;
    creditKill(by); // na genoeg overwinningen wordt hij veteraan (zie game/army.ts)
    burst(t.x, t.y, '#7a3a30');
    if (t.boss) {
      bossDefeated(t); // een kampioen: extra zegening (zie game/bosses.ts)
      commonEnemyBeaten('boss'); // rivalen waarmee het vrede is, vinden dat goed (zie game/diplomacy.ts)
    }
    if (Math.random() < 0.35) {
      const n = 5 + G.age * 3;
      G.res.food += n;
      floater(t.x, t.y, '+' + n, RES.food.c);
    }
  } else if (t.kind === 'c') campDestroyed(t);
}
function destroyBuilding(b: Building) {
  const d = B[b.type];
  b.dead = true;
  setBlk(b, false);
  for (let dy = 0; dy < d.size; dy++) for (let dx = 0; dx < d.size; dx++) bmap[(b.y + dy) * W + b.x + dx] = 0;
  G.bs = G.bs.filter(x => x !== b);
  // Eerst wie erin schuilde naar buiten (unhide zoekt het gebouw nog op), dan pas uit de lijst
  for (const v of G.vs) if (v.hidden && v.shelter === b.id) unhide(v);
  bById.delete(b.id);
  if (!d.wall) G.stats.lost++; // muren tellen niet: die zijn er juist om stuk te gaan
  if (sel.b === b.id) sel.b = null;
  for (let k = 0; k < 6; k++) burst(b.x + Math.random() * d.size, b.y + Math.random() * d.size, '#8a7a62');
  if (SET.shake) store.shake = d.wall ? 0.15 : 0.5;
  sfx('boom');
  if (b.type === 'townhall') {
    G.over = true;
    endGame(false, 900);
  } else if (d.wonder) {
    wonderDestroyed(b); // het wonder is weer vrij (zie game/wonders.ts)
  } else if (d.win) {
    gateDestroyed(); // de sterrenpoort: de lading is weg (zie game/finale.ts)
  } else if (d.wall) {
    note(`${d.n} doorbroken.`, 'bad');
  } else {
    store.notePos = [b.x + d.size / 2, b.y + d.size / 2];
    toast(`${d.n} is verwoest.`, 'bad');
  }
  store.uiDirty = true;
}
function campDestroyed(c: Camp) {
  c.alive = false;
  G.stats.camps++;
  const L: Cost = { food: 250, wood: 200, stone: 150 },
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
  if (!G.unl[ci] && !landOwner(ci)) {
    G.unl[ci] = 1;
    extra = ' Het gebied is nu van jou.';
  }
  for (let k = 0; k < 10; k++) burst(c.x + Math.random() * 2, c.y + Math.random() * 2, '#b9822f');
  store.notePos = [c.x + 1, c.y + 1];
  toast(`Vijandelijk kamp veroverd! Buit binnengehaald.${extra}`, 'good');
  commonEnemyBeaten('camp'); // een gezamenlijke vijand minder: rivalen vinden dat goed (zie game/diplomacy.ts)
  sfx('age');
  floater(c.x + 1, c.y + 1, 'BUIT', '#e2b92c');
  if (sel.camp === c.id) sel.camp = null;
  computeAvail();
  store.uiDirty = true;
}
export function fire(from: Target, x: number, y: number, t: Target, o: FireOpts) {
  // Geluid hoort bij het wapen (musket, kanon, laser, ...); vijanden iets minder vaak
  sfx(o.snd || 'shot', o.foe ? 0.3 : 0.12);
  const by = from && from.kind === 'u' ? from : null; // een eigen soldaat: hij krijgt de overwinning
  if (o.laser) {
    hit(t, o.dmg, by);
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
    ally: !!o.ally, // geschoten door een helper van een bondgenoot
    allyOf: o.allyOf || 0, // van welke rivaal die helper is (zijn eigen volk raakt hij niet)
    by,
    big: !!o.big,
    h0: o.h0 || 14,
  });
}
export function updateProj(dt: number) {
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
        // Wie in de ontploffing staat: bij een vijandelijk schot jouw mensen, anders vijanden
        const victims = splashVictims(p);
        for (const e of victims)
          if (!e.hidden && dist(e.x, e.y, p.lx, p.ly) <= p.splash) hit(e, p.dmg, p.by);
        // Het doel zelf altijd raken (ook als het niet in de lijst staat, zoals een helper van een bondgenoot)
        if (p.foe && !isDead(p.t) && (p.t.kind === 'b' || !(victims as Mobile[]).includes(p.t as Mobile)))
          hit(p.t, p.dmg);
        if (!p.foe && !p.ally) {
          for (const c of G.camps)
            if (c.alive && dist(c.x + 1, c.y + 1, p.lx, p.ly) <= p.splash + 1) hit(c, p.dmg);
          // Gebouwen van rivalen in de ontploffing (een kopie van de lijst: er kan er een instorten).
          // Alleen van wie je in oorlog bent, of het gebouw waar je op mikte: zo begint geen oorlog per ongeluk.
          for (const b of [...rbById.values()]) {
            if (b !== p.t && !atWarWith(b.rival)) continue;
            const s = B[b.type].size / 2;
            if (dist(b.x + s, b.y + s, p.lx, p.ly) <= p.splash + s) hit(b, p.dmg);
          }
        }
        G.fx.push({ type: 'boom', x: p.lx, y: p.ly, life: 0.35, r: p.splash });
      } else if (!isDead(p.t)) hit(p.t, p.dmg, p.by);
    } else {
      p.x += (dx / d) * st;
      p.y += (dy / d) * st;
    }
  }
  G.proj = G.proj.filter(p => !p.done);
}
/**
 * Wie een ontploffing kan raken. Een vijandelijk schot: jouw mensen. Een schot van een helper van een
 * bondgenoot: jouw aanvallers (niet zijn eigen volk, niet de andere helpers). Jouw schot: vijanden, maar
 * geen helpers en geen soldaten van een rivaal waarmee het vrede is (behalve waar je op mikte).
 */
function splashVictims(p: Projectile): Mobile[] {
  if (p.foe) return [...G.vs, ...G.us];
  if (p.ally)
    return G.foes.filter(
      e => !e.helper && e.rival !== p.allyOf && (!e.rival || isRaider(e) || isMarching(e)),
    );
  return G.foes.filter(e => !e.helper && (e === p.t || fairTarget(e)));
}
export function nearestFoe(x: number, y: number, r: number, air?: boolean | 1): Foe | null {
  let best = null,
    bd = r;
  for (const f of G.foes) {
    if (f.retreat || f.dead) continue;
    if (f.air && !air) continue;
    if (!fairTarget(f)) continue; // niet de soldaten van een rivaal waarmee het vrede is (zie game/diplomacy.ts)
    const d = dist(x, y, f.x, f.y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}
// Schade van een eigen eenheid tegen doel t: basis × wapens × onderzoek × rol-bonus × rang (veteranen).
// Met honger (geen voedsel) doet het leger half zoveel schade.
function udmg(u: Unit, t: Target): number {
  return (
    UNITS[u.k].dmg *
    bonusMul(UNITS[u.k], t) *
    armsMul() *
    mul('army.dmg') *
    (u.k === 'drone' || u.k === 'exo' ? mul('robot.dmg') : 1) *
    veteranMul(u) *
    (armyHungry() ? 0.5 : 1)
  );
}
export function uUpdate(u: Unit, dt: number) {
  const U = UNITS[u.k],
    SP = U.spd * mul('army.speed') * mul('move.all');
  u.anim += dt;
  if (u.flash) u.flash -= dt;
  if (u.swing && u.swing > 0) u.swing -= dt;
  const restHeal = u.order === 'guard' && !u.tgt ? 1.5 : 0; // rusten op wacht
  const bonusHeal = 2 * add('heal'); // het leger geneest dubbel zo snel als het volk
  // Met honger geneest niemand (zie armyHungry)
  if (!armyHungry()) u.hp = Math.min(u.mhp, u.hp + dt * (restHeal + bonusHeal));
  if (u.tgt && isDead(u.tgt)) {
    // Een gebouw van een rivaal is gevallen: meteen door naar het volgende gebouw van hun stad
    const next = u.order === 'attack' && u.tgt.kind === 'rb' ? nextRivalBuilding(u.tgt) : null;
    u.tgt = next;
    u.path = null;
    if (!next && u.order === 'attack') u.order = 'guard';
  }
  u.scan -= dt;
  if (u.scan <= 0) {
    u.scan = 0.4;
    if (!u.tgt || u.order !== 'attack') {
      const st = u.stance || 'guard',
        am = u.order === 'amove' || u.order === 'patrol',
        leash = am ? 8 : st === 'hold' ? U.r + 0.3 : st === 'aggr' ? 11 : u.order === 'move' ? 4.5 : 7;
      const f = nearestFoe(u.x, u.y, leash, U.air);
      // In een aanvalsmars of op aanvallen: ook gebouwen van rivalen in de buurt aanvallen
      // (alleen van rivalen waarmee het oorlog is: zo begin je niet per ongeluk een oorlog)
      const rb =
        !f && !u.tgt && (am || st === 'aggr') ? nearestRivalBuilding(u.x, u.y, leash, 0, true) : null;
      // Op wacht (niet "stand houden") verdedigt hij je land vanzelf: zie nearestIntruder hieronder
      const defender = u.order === 'guard' && st !== 'hold';
      const chasingIntruder = defender && !!u.tgt && u.tgt.kind === 'f' && isIntruder(u.tgt);
      if (rb) u.tgt = rb;
      else if (
        f &&
        (st === 'aggr' ||
          u.order !== 'guard' ||
          dist(f.x, f.y, u.gx, u.gy) < (st === 'hold' ? U.r + 0.5 : 11))
      )
        u.tgt = f;
      else if (u.order === 'guard' && !f && u.tgt && dist(u.x, u.y, u.gx, u.gy) > 10 && !chasingIntruder)
        u.tgt = null;
      // Valt er iemand je land aan? Dan gaat hij erop af, ook ver van zijn post. Daarna loopt hij terug.
      if (!u.tgt && defender) u.tgt = nearestIntruder(u.x, u.y, U.air);
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
          hit(u.tgt, udmg(u, u.tgt), u);
        }
      }
    } else if (u.stance === 'hold' && u.order === 'guard') {
      u.tgt = null;
    } else chase(u, p, dt, SP, U.fly);
    return;
  }
  // In formatie lopen ze samen in het tempo van de langzaamste (zie formationMove in game/army.ts).
  // Vechten doen ze wel op hun eigen snelheid (hierboven).
  const walk = u.pace ? Math.min(SP, u.pace * mul('army.speed') * mul('move.all')) : SP;
  if (u.order === 'move' || u.order === 'attack' || u.order === 'amove') {
    if (moveToward(u, u.gx, u.gy, dt, u.order === 'attack' ? SP : walk, U.fly)) {
      u.order = 'guard';
      u.pace = 0;
    }
    return;
  }
  if (u.order === 'patrol') {
    if (moveToward(u, u.gx, u.gy, dt, walk, U.fly)) {
      const a = u.gx,
        b2 = u.gy;
      // Bij patrouilleren is het tweede punt (px, py) altijd gezet
      u.gx = u.px!;
      u.gy = u.py!;
      u.px = a;
      u.py = b2;
      u.path = null;
    }
    return;
  }
  if (dist(u.x, u.y, u.gx, u.gy) > 0.8) moveToward(u, u.gx, u.gy, dt, SP, U.fly);
}
function chase(e: Unit | Foe, p: { x: number; y: number }, dt: number, spd: number, fly?: boolean | 1) {
  if (fly) {
    const dx = p.x - e.x,
      dy = p.y - e.y,
      d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * spd * dt;
    e.y += (dy / d) * spd * dt;
    e.dir = screenRight(dx, dy) < 0 ? -1 : 1;
    return;
  }
  e.pt -= dt;
  // Vijanden lopen niet door jouw muren; helpers van een bondgenoot lopen zoals jouw eigen mensen
  const foe = e.kind === 'f' && !e.helper,
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
export function moveToward(
  e: Unit | Foe,
  x: number,
  y: number,
  dt: number,
  spd: number,
  fly?: boolean | 1,
): boolean {
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
    e.dir = screenRight(dx, dy) < 0 ? -1 : 1;
    return false;
  }
  if (!e.path) {
    e.path = findPath(e.x | 0, e.y | 0, x | 0, y | 0, e.kind === 'f' && !e.helper ? 2 : true);
    if (!e.path) {
      if (e.kind === 'u') {
        e.gx = e.x;
        e.gy = e.y;
      }
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
/*
 * Snel nakijken of er überhaupt iemand van jou in de buurt is. De kaart is verdeeld in vakken van 8 bij 8
 * tegels; per vak tellen we je soldaten en dorpelingen (ook wie binnen zit). Dat gebeurt één keer per
 * speltik, en opnieuw als er iemand bijkomt of wegvalt. Een bewaker bij een kamp ver weg hoeft dan niet alle
 * soldaten en dorpelingen langs: daar staat toch niemand. Staat er wel iemand dichtbij, dan zoekt foeTarget
 * gewoon zoals altijd.
 */
const CELL = 8;
let peopleGrid = new Uint16Array(0),
  gridCols = 0,
  gridT = -1,
  gridUs: Unit[] | null = null,
  gridUsLen = -1,
  gridVs: Villager[] | null = null,
  gridVsLen = -1;
function buildPeopleGrid() {
  gridCols = Math.ceil(W / CELL);
  const size = gridCols * Math.ceil(H / CELL);
  if (peopleGrid.length !== size) peopleGrid = new Uint16Array(size);
  else peopleGrid.fill(0);
  const put = (x: number, y: number) => {
    const cx = Math.min(gridCols - 1, Math.max(0, (x / CELL) | 0)),
      cy = Math.max(0, (y / CELL) | 0),
      i = cy * gridCols + cx;
    if (i < size) peopleGrid[i]++;
  };
  for (const u of G.us) put(u.x, u.y);
  for (const v of G.vs) put(v.x, v.y);
  gridT = G.t;
  gridUs = G.us;
  gridUsLen = G.us.length;
  gridVs = G.vs;
  gridVsLen = G.vs.length;
}
/** Staat er misschien iemand van jou binnen r tegels van (x, y)? (Met 1 tegel speling: ze lopen ondertussen.) */
function peopleMaybeNear(x: number, y: number, r: number): boolean {
  if (
    gridT !== G.t ||
    gridUs !== G.us ||
    gridUsLen !== G.us.length ||
    gridVs !== G.vs ||
    gridVsLen !== G.vs.length
  )
    buildPeopleGrid();
  const rows = peopleGrid.length / gridCols,
    x0 = Math.max(0, ((x - r - 1) / CELL) | 0),
    x1 = Math.min(gridCols - 1, ((x + r + 1) / CELL) | 0),
    y0 = Math.max(0, ((y - r - 1) / CELL) | 0),
    y1 = Math.min(rows - 1, ((y + r + 1) / CELL) | 0);
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) if (peopleGrid[cy * gridCols + cx]) return true;
  return false;
}
// Een kamp opzoeken op nummer. Elke bewaker vraagt dit elke speltik: daarom een opzoeklijst, die opnieuw
// gemaakt wordt als de lijst met kampen verandert.
let campMap = new Map<number, Camp>(),
  campMapOf: Camp[] | null = null,
  campMapLen = -1;
function campById(id: number): Camp | undefined {
  if (campMapOf !== G.camps || campMapLen !== G.camps.length) {
    campMap = new Map(G.camps.map(c => [c.id, c]));
    campMapOf = G.camps;
    campMapLen = G.camps.length;
  }
  return campMap.get(id);
}
export function foeTarget(f: Foe): Unit | Villager | Building | Foe | null {
  // (een Foe is hier een helper van een bondgenoot, zie hieronder)
  let best: Unit | Villager | Building | Foe | null = null,
    bd = f.camp ? 7 : 5.5;
  // Niemand van jou in de buurt: dan hoeven we je soldaten en dorpelingen niet één voor één langs
  const near = peopleMaybeNear(f.x, f.y, bd);
  if (near)
    for (const u of G.us) {
      const d = dist(f.x, f.y, u.x, u.y);
      if (d < bd && (!UNITS[u.k].fly || f.air || f.proj)) {
        bd = d;
        best = u;
      }
    }
  if (near)
    for (const v of G.vs) {
      if (v.hidden) continue;
      const d = dist(f.x, f.y, v.x, v.y);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
  // Helpers van een bondgenoot vechten mee, dus vallen aanvallers ook hen aan
  for (const h of helpersNear(f.x, f.y, bd)) {
    if (h.rival === f.rival) continue;
    const d = dist(f.x, f.y, h.x, h.y);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  if (best || f.camp) return best;
  bd = 1e9;
  // Tijdens de finale gaan aanvallers liever op de sterrenpoort af (alsof hij 15 tegels dichterbij staat)
  const gateBias = isCharging() ? 15 : 0;
  for (const b of G.bs) {
    const p = tpos(b);
    const d = dist(f.x, f.y, p.x, p.y) - (B[b.type].def ? 3 : 0) - (b.type === 'stargate' ? gateBias : 0);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
export function fUpdate(f: Foe, dt: number) {
  f.anim += dt;
  if (f.flash) f.flash -= dt;
  if (f.swing && f.swing > 0) f.swing -= dt;
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
    const c = campById(f.camp);
    if (!c || !c.alive) {
      f.camp = 0;
      f.retreat = true;
      return;
    }
    f.rt -= dt;
    // (zonder doel wachten we ook even: anders zoekt elke bewaker zonder doel elke tik opnieuw)
    if (f.rt <= 0 || (f.tgt && isDead(f.tgt))) {
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
  } else if (f.rival) {
    // Soldaten van een rivaal: thuis op wacht, onderweg of aanvallend (zie game/rivals.ts)
    if (!rivalThink(f, dt)) return;
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
  // Hier is er altijd een doel: zonder doel ging het hierboven al terug (bij een rivaal: zie rivalThink)
  const p = tpos(f.tgt!),
    d = dist(f.x, f.y, p.x, p.y) - p.rad;
  if (d <= f.r) {
    f.path = null;
    f.dir = scrX(p.x, p.y) < scrX(f.x, f.y) ? -1 : 1;
    f.cd -= dt;
    if (f.cd <= 0) {
      f.cd = f.rate;
      f.swing = 0.2;
      if (f.proj)
        fire(f, f.x, f.y, f.tgt!, {
          dmg: f.dmg,
          foe: f.helper ? 0 : 1, // een helper van een bondgenoot schiet op jouw vijanden
          ally: !!f.helper,
          allyOf: f.helper ? f.rival : 0,
          col: f.air ? '#ff6a5a' : '#ff9b6b',
          big: f.big,
          splash: f.splash ?? (f.big ? 1 : 0),
          h0: f.air ? 22 : 12,
          snd: f.uk ? f.snd : FOES[f.type].snd, // een rivaal heeft gewone soldaten, met hun eigen geluid
        });
      else hit(f.tgt!, f.dmg);
    }
  } else chase(f, p, dt, f.spd, f.air);
}
// Tijdens de finale: zoveel seconden speltijd tussen de groepen uit verschillende richtingen
const WAVE_GAP = 20;
// "noorden", "noorden en westen", "noorden, oosten en zuiden"
const joinWords = (list: string[]): string =>
  list.length > 1 ? `${list.slice(0, -1).join(', ')} en ${list[list.length - 1]}` : list[0];

export function spawnRaid(): void {
  G.raids++;
  const match = raidMatchNow();
  // Oefennacht: de allereerste aanval in je allereerste spel is klein en zwak, zodat je rustig leert hoe
  // een nacht gaat (geen uitdaging: daar gelden de regels van de uitdaging)
  // (het spel van nu telt al mee in games zodra er gespeeld wordt, zie checkAchievements: dus hooguit 1)
  const practice = G.raids === 1 && !G.scenario && !G.peaceful && (store.profile?.games ?? 0) <= 1;
  const a = G.age,
    n = practice ? 2 : raidSize(match),
    // Elke aanval iets taaier, maar niet eindeloos. Op Meedogenloos hebben aanvallers meer levens,
    // en tegen een sterk leger ook (zie raidMatch in data/difficulty.ts).
    scale = Math.min(2.5, 1 + G.raids * 0.05) * difficulty(G.diff).raidHp * match.hp * (practice ? 0.5 : 1),
    edge: Tile[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!walkable(x, y)) continue;
      if (!isUnl(x - 1, y) || !isUnl(x + 1, y) || !isUnl(x, y - 1) || !isUnl(x, y + 1)) edge.push([x, y]);
    }
  if (!edge.length) return;
  G.stats.raidDay = G.day; // voor de prestaties "doorsta ... aanvallen" (zie game/time.ts)
  // Meestal één groep; tijdens de finale drie groepen uit richtingen ver uit elkaar (zie game/finale.ts)
  const anchors = spreadOut(edge, raidBoost().sides, (Math.random() * edge.length) | 0),
    nearby = anchors.map(an => edge.filter(e => dist(e[0], e[1], an[0], an[1]) < 7));
  for (let k = 0; k < n; k++) {
    // Meestal vijanden van jouw tijdperk, met wat oudere ertussen; drones komen met pantserwagens
    const type = a === 7 ? (k % 2 ? 7 : 6) : k % 3 === 0 && a > 0 ? a - 1 : a;
    const near = nearby[k % anchors.length],
      e = near[(Math.random() * near.length) | 0];
    G.spawnQ.push({
      type,
      x: e[0] + 0.5,
      y: e[1] + 0.5,
      scale,
      // Meerdere groepen komen na elkaar, met WAVE_GAP seconden ertussen: zo blijft het te verdedigen
      at: G.t + Math.floor(k / anchors.length) * 0.7 + (k % anchors.length) * WAVE_GAP,
    });
  }
  // Na een nieuw tijdperk leidt een kampioen de aanval: hij komt mee met de eerste groep
  const boss = bossForRaid();
  if (boss) {
    const e = nearby[0][(Math.random() * nearby[0].length) | 0];
    G.spawnQ.push({ type: boss.foe, x: e[0] + 0.5, y: e[1] + 0.5, scale, at: G.t + 2.5, boss: boss.age });
  }
  const anchor = anchors[0];
  const from = [...new Set(anchors.map(an => compass(an[0], an[1])))];
  store.notePos = [anchor[0], anchor[1]];
  toast(
    practice
      ? `Oefennacht: ${n} zwakke ${FOES[a].n.toLowerCase()} uit het ${joinWords(from)}. Je stamhuis houdt ze wel tegen.`
      : `Aanval! ${n} × ${FOES[a].n.toLowerCase()} uit het ${joinWords(from)}.`,
    'bad',
  );
  sfx('alarm');
  store.raidPing = { x: anchor[0], y: anchor[1], t: 8, more: anchors.slice(1) };
  allyHelp(); // bondgenoten sturen misschien soldaten (zie game/diplomacy.ts)
}
// Hoe groot de volgende aanval is: groeit met elke aanval en elk tijdperk, maar blijft te overzien.
// (Latere vijanden zijn per stuk al veel sterker, dus het aantal groeit rustig.)
// Daarna past hij zich aan bij je leger: groter tegen een sterk leger, kleiner tegen een zwak
// (zie raidMatch).
// Tijdens de finale komt daar nog eens keer twee bij, boven op het gewone maximum.
export function raidSize(match: RaidMatch = raidMatchNow()): number {
  const diff = difficulty(G.diff); // Zwaar en Meedogenloos sturen grotere groepen
  const base = 2 + Math.floor((G.raids + 1) * 0.9) + G.age;
  const usual = Math.min(diff.raidMax, Math.round(base * diff.raidSize * mul('raid.size')));
  return Math.round(usual * match.size) * raidBoost().size;
}

/** Hoe zwaar de volgende aanval wordt, vergeleken met de sterkte van jouw leger en torens. */
function raidMatchNow(): RaidMatch {
  return raidMatch(yourPower(), G.age, G.raids);
}
export function compass(x: number, y: number): string {
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

/**
 * Valt deze vijand nu je land aan? Kampbewakers tellen niet. Van een rivaal tellen alleen soldaten
 * die echt aanvallen: niet die thuis op wacht staan, nog onderweg zijn of naar huis lopen.
 */
export const isRaider = (f: Foe): boolean =>
  !f.retreat && !f.dead && !f.camp && !(f.rival && f.mode !== 'raid');

/** Is deze soldaat van een rivaal nog onderweg naar je stad? Dan is hij er nog niet, maar komt hij wel. */
export const isMarching = (f: Foe): boolean => !!f.rival && f.mode === 'march' && !f.retreat && !f.dead;

/**
 * Valt deze vijand je land aan? Ja als het een aanvaller is (zie isRaider) die in je gebied staat,
 * of die jouw gebouwen, volk of leger aanvalt. Soldaten op wacht gaan daar vanzelf op af.
 */
export function isIntruder(f: Foe): boolean {
  if (!isRaider(f)) return false;
  if (isUnl(f.x | 0, f.y | 0)) return true;
  const t = f.tgt;
  return !!t && !isDead(t) && (t.kind === 'b' || t.kind === 'v' || t.kind === 'u');
}

// De aanvallers in je land, één keer per speltik opgezocht: er kunnen veel soldaten tegelijk zoeken
let intruderList: Foe[] = [];
let intruderTime = -1;
let intruderGame: GameState | null = null;
function intruders(): Foe[] {
  if (intruderTime !== G.t || intruderGame !== G) {
    intruderTime = G.t;
    intruderGame = G;
    intruderList = G.foes.filter(isIntruder);
  }
  return intruderList;
}

/** De dichtstbijzijnde aanvaller in je land (zie isIntruder), of null. Zonder `air` geen vliegers. */
function nearestIntruder(x: number, y: number, air?: boolean | 1): Foe | null {
  let best: Foe | null = null,
    bestDist = Infinity;
  for (const f of intruders()) {
    if (f.air && !air) continue;
    const d = dist(x, y, f.x, f.y);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

/** Hoeveel voedsel je leger nu per minuut eet (zie foodUpkeep in data/units.ts). */
export function armyUpkeep(): number {
  let perMinute = 0;
  for (const u of G.us) perMinute += foodUpkeep(UNITS[u.k]);
  return perMinute;
}

/** Heeft je leger honger? Zolang er geen voedsel is, doen soldaten half zoveel schade en genezen ze niet. */
export function armyHungry(): boolean {
  return G.hungry && G.us.length > 0;
}
