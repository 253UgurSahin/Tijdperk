// Eén speltik: werkt alles in de wereld een klein stapje bij.
import { store } from '../core/store.js';
import { sfx } from '../audio/sound.js';
import { NODES } from '../data/nodes.js';
import { RKEYS } from '../data/resources.js';
import { TK } from '../data/tech.js';
import { bUpdate } from './buildings.js';
import { computeAvail, computeCaches } from './caches.js';
import { spawnFoe } from './entities.js';
import { makeOffer, th, updateEvents } from './events.js';
import { expireRivalOffer } from './diplomacy.js';
import { fUpdate, isRaider, uUpdate, updateProj } from './military.js';
import { updateRivals } from './rivals.js';
import { G } from './state.js';
import { advanceClock, isNight } from './time.js';
import { add, applyBonusChange, mul } from './bonus.js';
import { hasRule } from './mods.js';
import { bMaxHp, researchTime } from './upgrades.js';
import { vUpdate } from './villagers.js';
import { sigs } from '../ui/header.js';
import { note, toast } from '../ui/hud.js';
import { dist } from '../util/math.js';
import { amt, bmap, node, nodeLists } from '../world/world.js';
import { updateMeteors } from './meteors.js';
import { checkAchievements } from './achievements.js';
import { checkVictory } from './victory.js';
import { makeBoss } from './bosses.js';
import { updateFinale } from './finale.js';

/** Onthoud waar alles stond vóór de volgende speltik, zodat de weergave ertussen kan tekenen. */
export function rememberPositions() {
  for (const list of [G.vs, G.us, G.foes, G.proj])
    for (const e of list) {
      e.prevX = e.x;
      e.prevY = e.y;
    }
}

export function update(dt) {
  if (G.over) return;
  G.t += dt;
  advanceClock(dt);
  // Af en toe komt er een reizende handelaar langs (bij de Hanze vaker, met Gesloten grenzen nooit)
  const tradersCome = !G.offer && !hasRule('noTrade') && G.day >= 2 && !isNight();
  if (tradersCome && Math.random() < (dt / 420) * mul('trader.rate')) makeOffer();
  // Met het Oost-Indisch Huis (bonus 'trader.daily') komt er elke ochtend zeker een handelaar
  const dailyTrader = add('trader.daily') > 0 && G.traderDay !== G.day && G.clock >= 8 && !isNight();
  if (dailyTrader && !G.offer && !hasRule('noTrade')) {
    G.traderDay = G.day;
    makeOffer();
  }
  if (G.offer && G.t > G.offer.until) {
    // Een bericht van een rivaal zonder antwoord telt als nee (zie game/diplomacy.js)
    if (G.offer.from) expireRivalOffer();
    else {
      G.offer = null;
      sigs.offer = null;
      note('De handelaar is verder getrokken.');
    }
  }
  if (G.research) {
    G.research.t += dt;
    const T = TK[G.research.k];
    if (G.research.t >= researchTime(T)) {
      // Via het bonusregister: geeft het onderzoek meer levens, dan groeit wat er al staat mee
      applyBonusChange(() => (G.tech[T.k] = 1));
      G.research = null;
      toast(`Onderzoek klaar: ${T.n}. ${T.d}.`, 'good');
      sfx('upgrade');
      sigs.upg = null;
    }
  }
  // Genezen (bijv. door Kruidenkunde): je volk krijgt elke seconde levens terug
  const heal = add('heal');
  if (heal) for (const v of G.vs) if (!v.hidden) v.hp = Math.min(v.mhp, v.hp + dt * heal);
  // Gebeurtenissen met keuzes, hun vervolgen en tijdelijke bonussen (zie game/events.js)
  updateEvents(dt);
  store.histT -= dt;
  if (store.histT <= 0) {
    store.histT = 10;
    G.hist.push(RKEYS.map(k => Math.round(G.res[k])));
    if (G.hist.length > 60) G.hist.shift();
  }
  store.periodic -= dt;
  if (store.periodic <= 0) {
    store.periodic = 0.5;
    computeCaches();
    checkVictory(); // een gekozen doel gehaald, zoals 30 nachten of de Gouden Eeuw?
  }
  store.slowP -= dt;
  if (store.slowP <= 0) {
    store.slowP = 2;
    computeAvail();
  }
  store.achievementTimer -= dt;
  if (store.achievementTimer <= 0) {
    store.achievementTimer = 3;
    checkAchievements();
  }
  G.res.food -= (G.vs.length * 0.05 + G.us.length * 0.08) * dt;
  if (G.res.food < 0) {
    G.res.food = 0;
    if (!G.hungry) {
      G.hungry = true;
      toast('Er is geen voedsel meer. Je volk werkt half zo snel.', 'bad');
    }
  } else if (G.res.food > 20) G.hungry = false;
  for (const b of G.bs) bUpdate(b, dt);
  for (const v of G.vs) vUpdate(v, dt);
  for (const u of G.us) uUpdate(u, dt);
  for (const f of G.foes) if (!f.dead) fUpdate(f, dt);
  G.foes = G.foes.filter(f => !f.dead);
  if (G.spawnQ.length) {
    const now = G.spawnQ.filter(s => s.at <= G.t);
    if (now.length) {
      for (const s of now) {
        const f = spawnFoe(s.type, s.x, s.y, s.scale);
        // Bonussen kunnen aanvallers sterker of zwakker maken
        f.hp *= mul('raid.hp');
        f.mhp *= mul('raid.hp');
        if (s.boss) makeBoss(f, s.boss); // de kampioen van deze aanval (zie game/bosses.js)
      }
      G.spawnQ = G.spawnQ.filter(s => s.at > G.t);
    }
  }
  updateRivals(dt); // rivaliserende beschavingen: bouwen, trainen, aanvallen (zie game/rivals.js)
  updateFinale(dt); // de sterrenpoort laadt op (zie game/finale.js)
  updateMeteors(dt);
  updateProj(dt);
  for (const e of G.fx) {
    e.life -= dt;
    if (e.type === 'smoke') {
      e.z += e.vz * dt;
      e.x += 0.12 * dt;
      e.y -= 0.12 * dt;
    } else if (e.type === 'float') e.z = (e.z || 0) + dt * 18;
    else if (e.type === 'chip') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.z += e.vz * dt;
      e.vz -= 180 * dt;
      if (e.z < 0) e.z = 0;
    }
  }
  G.fx = G.fx.filter(e => e.life > 0);
  {
    const h = th();
    if (h && h.done && !G.over) {
      const mx = bMaxHp(h);
      // Herstellen zolang er geen aanvallers zijn (kampbewakers en rivalen thuis tellen alleen als ze dichtbij zijn)
      // (helpers van een bondgenoot zijn geen gevaar)
      const threat = f => !f.retreat && !f.helper && (isRaider(f) || dist(f.x, f.y, h.x + 1, h.y + 1) < 12);
      if (h.hp < mx && !G.foes.some(threat)) h.hp = Math.min(mx, h.hp + (mx * dt) / 240);
    }
  }
  if (G.regrow.length && Math.random() < dt)
    G.regrow = G.regrow.filter(r => {
      if (r.at > G.t) return true;
      if (!node[r.i] && !bmap[r.i]) {
        node[r.i] = r.t;
        amt[r.i] = NODES[r.t].amt[0];
        nodeLists[r.t].push(r.i);
      }
      return false;
    });
  if (store.raidPing) {
    store.raidPing.t -= dt;
    if (store.raidPing.t <= 0) store.raidPing = null;
  }
}
