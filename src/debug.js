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
