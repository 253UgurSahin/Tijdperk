// Startpunt van het spel: laadt alle onderdelen en draait de spellus (elk beeldje opnieuw tekenen).
import './styles/index.css';
// Laad alle onderdelen in een vaste volgorde, zodat hun opstartcode (scène, knoppen) draait.
import './config.js';
import './util/dom.js';
import './util/math.js';
import './util/random.js';
import './core/settings.js';
import './core/profile.js';
import './data/achievements.js';
import './data/ages.js';
import './data/buildings.js';
import './data/names.js';
import './data/nodes.js';
import './data/resources.js';
import './data/score.js';
import './data/tech.js';
import './data/units.js';
import './world/pathfinding.js';
import './world/world.js';
import './game/achievements.js';
import './game/buildings.js';
import './game/caches.js';
import './game/chapters.js';
import './game/economy.js';
import './game/entities.js';
import './game/events.js';
import './game/fx.js';
import './game/military.js';
import './game/placement.js';
import './game/save.js';
import './game/state.js';
import './game/time.js';
import './game/update.js';
import './game/upgrades.js';
import './game/villagers.js';
import './render/scene.js';
import './render/camera.js';
import './render/kit.js';
import './render/models.js';
import './render/decals.js';
import './render/effects.js';
import './render/ghost.js';
import './render/icons.js';
import './render/lighting.js';
import './render/minimap.js';
import './render/nodes.js';
import './render/overlay.js';
import './render/people.js';
import './render/picking.js';
import './render/render.js';
import './render/sync.js';
import './render/terrain.js';
import './input/cursors.js';
import './input/input.js';
import './input/selection.js';
import './audio/sound.js';
import './ui/format.js';
import './ui/achievements.js';
import './ui/age.js';
import './ui/blessings.js';
import './ui/buildmenu.js';
import './ui/coach.js';
import './ui/endscreen.js';
import './ui/event.js';
import './ui/header.js';
import './ui/hover.js';
import './ui/hud.js';
import './ui/inspector.js';
import './ui/modals.js';
import './ui/objectives.js';
import './ui/panel.js';
import './ui/peoples.js';
import './ui/profile.js';
import './ui/panes/defense.js';
import './ui/panes/jobs.js';
import './ui/panes/log.js';
import './ui/panes/upgrades.js';
import './ui/rivals.js';
import './ui/resources.js';
import { store } from './core/store.js';
import { SET } from './core/settings.js';
import { RKEYS } from './data/resources.js';
import { deserialize, load, save, serialize } from './game/save.js';
import { G, newGame, sel } from './game/state.js';
import { rememberPositions, update } from './game/update.js';
import { drag, keys, mouse } from './input/input.js';
import { clampCam, panScreen, s2t, updateCamera } from './render/camera.js';
import { renderMini } from './render/minimap.js';
import { render } from './render/render.js';
import { cam, worldEl } from './render/scene.js';
import { onAgeChange } from './ui/age.js';
import { checkBlessing } from './ui/blessings.js';
import { renderCmd } from './ui/buildmenu.js';
import { updateHeader, updateWorldTop } from './ui/header.js';
import { updateHover } from './ui/hover.js';
import { renderInspector } from './ui/inspector.js';
import { renderGroups } from './ui/army.js';
import { showTitle } from './ui/modals.js';
import { renderChronicle } from './ui/objectives.js';
import { renderDefense } from './ui/panes/defense.js';
import { renderJobs } from './ui/panes/jobs.js';
import { renderLog } from './ui/panes/log.js';
import { renderUpgrades } from './ui/panes/upgrades.js';
import { renderRivals } from './ui/rivals.js';
import { renderTopBars } from './ui/finale.js';
import { rate, tickResourceNumbers } from './ui/resources.js';
import { $, isCompact } from './util/dom.js';
import { measure } from './core/perf.js';
import { initQuality, tickQuality } from './render/quality.js';

let lastT = performance.now(),
  acc = 0,
  uiT = 0,
  miniT = 0,
  saveT = 0;
const edge = { x: -1, y: -1 };
addEventListener('mousemove', e => {
  edge.x = e.clientX;
  edge.y = e.clientY;
});
document.addEventListener('mouseleave', () => {
  edge.x = -1;
});
addEventListener('blur', () => {
  edge.x = -1;
});
function frame(now) {
  const rdt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  if ($('#modal').hidden) {
    const pp = 900 * rdt * (SET.camSpeed || 1);
    let kx = 0,
      ky = 0;
    if (keys.has('w') || keys.has('arrowup')) ky -= 1;
    if ((keys.has('s') && !sel.us.size) || keys.has('arrowdown')) ky += 1;
    if (keys.has('a') || keys.has('arrowleft')) kx += 1;
    if (keys.has('d') || keys.has('arrowright')) kx -= 1;
    if (SET.edge && edge.x >= 0 && !drag && !mouse.touch && $('#title').hidden) {
      const m = 10;
      if (edge.x < m) kx += 1;
      else if (edge.x > innerWidth - m) kx -= 1;
      if (edge.y < m) ky -= 1;
      else if (edge.y > innerHeight - m) ky += 1;
    }
    if (kx || ky) panScreen(kx * pp, ky * pp);
  }
  if (!$('#title').hidden) {
    cam.x += Math.cos(now / 9000) * 0.4 * rdt;
    cam.y += Math.sin(now / 7000) * 0.3 * rdt;
    clampCam();
  }
  if (cam.tx != null) {
    const k = 1 - Math.pow(0.002, rdt);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    if (Math.abs(cam.tx - cam.x) < 0.02 && Math.abs(cam.ty - cam.y) < 0.02) cam.tx = null;
  }
  // Vloeiend zoomen: elke beeldje een stukje dichter bij de gewenste zoom
  if (cam.tz != null) {
    const before = cam.anchor && s2t(cam.anchor[0], cam.anchor[1]);
    cam.z += (cam.tz - cam.z) * (1 - Math.pow(0.00002, rdt));
    if (Math.abs(cam.tz - cam.z) < 0.001) cam.z = cam.tz;
    updateCamera();
    if (before) {
      const after = s2t(cam.anchor[0], cam.anchor[1]);
      cam.x += before[0] - after[0];
      cam.y += before[1] - after[1];
      cam.tx = null;
      clampCam();
    }
    if (cam.z === cam.tz) cam.tz = null;
  }
  if (store.shake > 0) store.shake = Math.max(0, store.shake - rdt);
  let t0 = performance.now();
  if (G.speed && !G.over) {
    acc += rdt * G.speed;
    let n = 0;
    while (acc >= 1 / 30 && n < 16) {
      rememberPositions();
      update(1 / 30);
      acc -= 1 / 30;
      n++;
    }
    if (n >= 16) acc = 0;
  }
  // Hoe ver we tussen twee speltikken zitten (0..1): figuren worden daar tussenin getekend,
  // zodat ze ook op een 120 Hz-scherm vloeiend lopen terwijl het spel 30 keer per seconde rekent.
  store.alpha = G.speed && !G.over ? Math.min(1, acc * 30) : 1;
  measure('sim', t0);
  t0 = performance.now();
  render();
  tickQuality(rdt);
  if (SET.fps) showFps(rdt);
  measure('render', t0);
  t0 = performance.now();
  updateHover();
  uiT -= rdt;
  if (uiT <= 0 || store.uiDirty) {
    uiT = 0.25;
    store.uiDirty = false;
    if (store.curAge !== G.age) onAgeChange();
    updateHeader();
    updateWorldTop();
    renderChronicle();
    renderUpgrades();
    renderJobs();
    renderDefense();
    renderRivals();
    renderTopBars(); // balken bovenaan: de sterrenpoort die oplaadt en een kampioen
    renderLog();
    renderInspector();
    renderGroups(); // groepenbalk boven de onderbalk (zie ui/army.js)
    renderCmd();
    checkBlessing(); // ligt er een zegening klaar om te kiezen?
  }
  tickResourceNumbers(rdt); // grondstofgetallen tellen vloeiend op
  measure('ui', t0);
  miniT -= rdt;
  if (miniT <= 0) {
    miniT = 0.4;
    t0 = performance.now();
    renderMini();
    measure('mini', t0);
  }
  store.rateT -= rdt;
  if (store.rateT <= 0) {
    store.rateT = 5;
    if (store.rateSnap) {
      const gt = G.t - store.rateSnap.t;
      if (gt > 0)
        for (const k of RKEYS) {
          const r = ((G.res[k] - store.rateSnap.r[k]) / gt) * 60;
          rate[k] = rate[k] === undefined ? r : rate[k] * 0.6 + r * 0.4;
        }
    }
    store.rateSnap = { t: G.t, r: { ...G.res } };
  }
  saveT += rdt;
  if (saveT > 60) {
    saveT = 0;
    // Niet op het titelscherm: daar ligt soms een wereld waarin je nog niet speelt
    if (!G.over && SET.autosave && $('#title').hidden) save();
  }
  requestAnimationFrame(frame);
}
// Teller met beeldjes per seconde (aan te zetten in de instellingen)
const fpsEl = Object.assign(document.createElement('div'), { id: 'fps', hidden: !SET.fps });
document.body.appendChild(fpsEl);
let fpsFrames = 0,
  fpsTime = 0;
function showFps(rdt) {
  fpsFrames++;
  fpsTime += rdt;
  if (fpsTime < 0.5) return;
  fpsEl.textContent = Math.round(fpsFrames / fpsTime) + ' fps';
  fpsFrames = fpsTime = 0;
}
export function measureHud() {
  const ds = document.documentElement.style,
    w = worldEl.getBoundingClientRect();
  if (isCompact()) {
    const bt = Math.max(
      ...['#ageplate', '#resPanel', '#objectives'].map(s => $(s).getBoundingClientRect().bottom),
    );
    ds.setProperty('--topH', Math.round(bt - w.top) + 'px');
    ds.setProperty('--barH', $('#bar').offsetHeight + 'px');
  } else {
    ds.removeProperty('--topH');
    ds.removeProperty('--barH');
    // Zo breed is het blok met tijd en tijdperk: de grondstoffenstrook blijft links daarvan (zie clarity.css)
    ds.setProperty('--agew', Math.ceil($('#ageplate').getBoundingClientRect().width) + 'px');
  }
}
try {
  const ro = new ResizeObserver(measureHud);
  for (const s of ['#ageplate', '#resPanel', '#objectives', '#bar']) ro.observe($(s));
} catch (e) {
  addEventListener('resize', measureHud);
}
function start(data) {
  initQuality(); // kiest de beeldkwaliteit en zet daarna de schermgrootte
  try {
    if (localStorage.getItem('tijdperken-view') === '2d') store.V2 = true;
  } catch (e) {}
  document.body.classList.toggle('v2', store.V2);
  let ok = false;
  if (data && data.save) {
    try {
      ok = deserialize(data.save);
    } catch (e) {
      ok = false;
    }
  }
  const fromHot = ok;
  if (!ok) ok = load();
  if (!ok) newGame();
  if (!fromHot) showTitle();
  measureHud();
  requestAnimationFrame(frame);
}
if (import.meta.env.DEV) import('./debug.js');
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot)
  try {
    hot.snapshot(() => ({ save: G ? serialize() : null }));
  } catch (e) {}
if (hot && hot.ready) hot.ready(start);
else start((hot && hot.data) || {});
