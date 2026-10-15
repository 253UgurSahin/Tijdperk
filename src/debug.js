// Alleen tijdens ontwikkelen (npm run dev): handige hulpjes in de browserconsole
// en voor automatische tests, bijv. window.__tp.G of __tp.place('hut', x, y).
import { store } from './core/store.js';
import { B } from './data/buildings.js';
import { G, newGame } from './game/state.js';
import { placeBuilding } from './game/entities.js';
import { cam } from './render/scene.js';
import { centerOn } from './render/camera.js';
import * as world from './world/world.js';

window.__tp = {
  get G() {
    return G;
  },
  store,
  B,
  cam,
  world,
  // newGame() of newGame({ seed, people, diff, map, victories }); een getal is de seed
  newGame: o => newGame(typeof o === 'number' ? { seed: o } : o),
  centerOn,
  place: (type, x, y) => placeBuilding(type, x, y, true),
};
import { GLOWS } from './render/decals.js';
window.__tp.GLOWS = GLOWS;
import * as caches from './game/caches.js';
window.__tp.caches = caches;
import * as config from './config.js';
window.__tp.config = config;
// Laat binnen een tel een meteoriet aankondigen
window.__tp.meteor = () => {
  window.__tp.G.nextMeteor = window.__tp.G.t;
};
import * as nodes3d from './render/nodes.js';
import * as terrain3d from './render/terrain.js';
window.__tp.nodes3d = nodes3d;
window.__tp.terrain3d = terrain3d;
import { sel } from './game/state.js';
import { proj } from './render/camera.js';
window.__tp.sel = sel;
window.__tp.proj = proj;
// Spring naar een tijdperk, krijg veel grondstoffen, of zet een eenheid neer
import { onAgeChange } from './ui/age.js';
import { RKEYS } from './data/resources.js';
import { spawnUnit, spawnFoe } from './game/entities.js';
import { computeAvail } from './game/caches.js';
window.__tp.setAge = n => {
  G.age = n;
  computeAvail();
  onAgeChange();
};
window.__tp.rich = (n = 5000) => RKEYS.forEach(k => (G.res[k] = n));
window.__tp.unit = (k, x, y) => spawnUnit(k, x, y);
window.__tp.foe = (type, x, y) => spawnFoe(type, x, y, 1);
// Bonusregister bekijken, en onderzoek meteen klaar zetten: __tp.tech('forging')
import * as bonus from './game/bonus.js';
window.__tp.bonus = bonus;
window.__tp.tech = k => bonus.applyBonusChange(() => (G.tech[k] = 1));
// Zegeningen: meteen naar het volgende tijdperk (met banner en keuze), of nu een keuze krijgen
import { enterNextAge } from './ui/age.js';
import { earnBlessing } from './game/blessings.js';
window.__tp.ageUp = () => enterNextAge();
window.__tp.bless = () => earnBlessing();
// Opslaan en laden testen zonder de opslag van de browser: __tp.saves.deserialize(__tp.saves.serialize())
import * as saves from './game/save.js';
window.__tp.saves = saves;
// Volken: speel alle volken vrij (zonder nep-prestaties in je profiel te zetten), of begin meteen als een volk
import { PEOPLES } from './data/peoples.js';
import * as profile from './core/profile.js';
window.__tp.unlockPeoples = () => {
  for (const p of PEOPLES) {
    if (p.locked) profile.addPeople(store.profile, p.k);
  }
  profile.saveProfile();
};
window.__tp.playAs = (people, diff = 1) => newGame({ people, diff });
// Prestaties en score: het profiel bekijken, alles kijken wat je nu haalt, of meteen winnen of verliezen
import * as achievements from './game/achievements.js';
window.__tp.profile = profile;
window.__tp.achievements = achievements;
window.__tp.checkAchievements = () => achievements.checkAchievements();
window.__tp.endGame = (won = true, by = 'stargate') => {
  if (won) {
    G.won = true;
    G.wonBy = by;
  } else G.over = true;
  achievements.endGame(won, 0);
};
// Winnen: kijk nu of een gekozen doel gehaald is, of spring naar een dag (bijv. __tp.day(31) voor 30 nachten)
import * as victory from './game/victory.js';
window.__tp.victory = victory;
window.__tp.day = n => (G.day = n);
// Uitdagingen: begin er meteen een (__tp.challenge('siege') of __tp.challenge('daily')), of spring in de tijd
import * as scenarios from './data/scenarios.js';
import * as challenge from './game/scenario.js';
window.__tp.scenarios = scenarios;
window.__tp.challengeState = challenge;
window.__tp.challenge = (k, people) =>
  newGame({ scenario: { k, date: k === 'daily' ? scenarios.dateKey() : '' }, people });
window.__tp.time = t => (G.t = t);
// Gebeurtenissen: laat er meteen één zien (__tp.event('tulips')), of zet een vervolg klaar voor vandaag
import { EVENT } from './data/events.js';
import * as events from './game/events.js';
window.__tp.events = events;
window.__tp.event = k => {
  G.event = null;
  return events.startEvent(EVENT[k]);
};
window.__tp.followNow = k => G.followups.push({ k, day: G.day, from: 'traveler' });
// Rivalen: bekijk ze (__tp.rivals), laat er een meteen aanvallen of een tijdperk verder gaan,
// of laat de tijd snel lopen zonder te tekenen (__tp.run(200) = één dag)
import * as rivals from './game/rivals.js';
import { rememberPositions, update } from './game/update.js';
window.__tp.rivals = rivals;
window.__tp.run = (seconds = 60) => {
  for (let t = 0; t < seconds && !G.over; t += 1 / 30) {
    rememberPositions();
    update(1 / 30);
  }
};
window.__tp.rivalHome = (i = 0) => {
  const r = G.rivals[i];
  if (r) centerOn(r.x + 1, r.y + 1, true);
};
window.__tp.rivalAge = (i = 0) => rivals.rivalAgeUp(G.rivals[i]);
window.__tp.rivalAttack = (i = 0, n = 4) => {
  const r = G.rivals[i];
  // Te weinig soldaten thuis? Dan eerst een paar laten verschijnen
  const units = rivals.rivalUnitsFor(r);
  while (rivals.rivalArmy(r).filter(f => f.mode === 'home').length < n) rivals.spawnRivalUnit(r, units[0]);
  rivals.launchAttack(
    r,
    rivals
      .rivalArmy(r)
      .filter(f => f.mode === 'home')
      .slice(0, n),
  );
};
// Wereldwonderen: bekijk wie wat heeft (__tp.wonders), geef een rivaal (Bouwer) meteen genoeg spaargeld
// voor zijn volgende wonder (__tp.rivalWonder()), of zet een wonder van jou meteen neer (__tp.myWonder('pyramid'))
import * as wonders from './game/wonders.js';
import { costValue } from './data/rivals.js';
import { WONDERS, wonderStartDay } from './data/wonders.js';
window.__tp.wonders = wonders;
window.__tp.rivalWonder = (i = G.rivals.findIndex(r => r.p === 'bouwer')) => {
  const r = G.rivals[i];
  if (!r) return null;
  r.wonderPot = Math.max(...WONDERS.map(k => costValue(B[k].cost)));
  r.wonderWait = 0;
  // Rivalen sparen pas vanaf een vaste dag: spring daarom zo nodig vooruit naar die dag
  G.day = Math.max(G.day, wonderStartDay(WONDERS[r.age]));
  return r;
};
window.__tp.myWonder = (k, x, y) => placeBuilding(k, x, y, true);
// Finale en kampioenen: zet meteen een afgebouwde sterrenpoort neer (de finale begint), zet de lading
// (__tp.charge(0.9) = 90%), of laat nu een aanval komen met de kampioen van dit tijdperk (__tp.bossRaid())
import { spawnRaid } from './game/military.js';
import * as finale from './game/finale.js';
import * as bosses from './game/bosses.js';
window.__tp.finale = finale;
window.__tp.bosses = bosses;
window.__tp.gate = (x = G.bs[0].x + 5, y = G.bs[0].y - 3) => placeBuilding('stargate', x, y, true);
window.__tp.charge = frac => {
  if (G.finale && G.finale.need > 0) G.finale.hours = G.finale.need * frac;
};
window.__tp.bossRaid = (age = Math.max(1, G.age)) => {
  G.boss = { age };
  spawnRaid();
};
// Diplomatie: zet een relatie (__tp.rel(0, 70)), laat een rivaal een bericht sturen (__tp.rivalOffer(0, 'ask')),
// open het venster (__tp.diplo()), of laat een bondgenoot meteen helpen (__tp.allyHelp(0))
import * as diplomacy from './game/diplomacy.js';
import { showDiplomacy } from './ui/diplomacy.js';
window.__tp.diplomacy = diplomacy;
window.__tp.rel = (i = 0, value = 0) => {
  const r = G.rivals[i];
  if (r) diplomacy.changeRelation(r, value - r.rel);
  return r;
};
window.__tp.rivalOffer = (i = 0, kind = 'trade') => {
  G.offer = null;
  return diplomacy.makeRivalOffer(G.rivals[i], kind);
};
window.__tp.diplo = (i = -1) => showDiplomacy(G.rivals[i]?.id || 0);
window.__tp.allyHelp = (i = 0) => {
  const r = G.rivals[i];
  if (!r) return;
  r.ally = true;
  r.atWar = false;
  diplomacy.sendHelpers(r);
};
// Legerbesturing: groepen, veteranen en formatie (__tp.army.formationMove(__tp.G.us, x, y, 'move')),
// of geef een soldaat meteen overwinningen: __tp.kills(u, 8) maakt hem elite
import * as army from './game/army.js';
import * as armyUI from './ui/army.js';
window.__tp.army = army;
window.__tp.armyUI = armyUI;
window.__tp.kills = (u, n = 3) => {
  for (let k = 0; k < n; k++) army.creditKill(u);
  return u;
};
