// Startpunt van het spel: laadt alle onderdelen en draait de spellus (elk beeldje opnieuw tekenen).
import './styles/index.css';
// Laad alle onderdelen in een vaste volgorde, zodat hun opstartcode (scène, knoppen) draait.
import './config';
import './util/dom';
import './util/math';
import './util/random';
import './core/settings';
import './core/profile';
import './data/achievements';
import './data/ages';
import './data/buildings';
import './data/names';
import './data/nodes';
import './data/resources';
import './data/score';
import './data/tech';
import './data/units';
import './world/pathfinding';
import './world/world';
import './game/achievements';
import './game/buildings';
import './game/caches';
import './game/chapters';
import './game/economy';
import './game/entities';
import './game/events';
import './game/fx';
import './game/military';
import './game/placement';
import './game/save';
import './game/state';
import './game/time';
import './game/update';
import './game/upgrades';
import './game/villagers';
import './render/scene';
import './render/camera';
import './render/kit';
import './render/models';
import './render/decals';
import './render/effects';
import './render/ghost';
import './render/icons';
import './render/lighting';
import './render/minimap';
import './render/nodes';
import './render/overlay';
import './render/people';
import './render/picking';
import './render/render';
import './render/sync';
import './render/terrain';
import './input/cursors';
import './input/input';
import './input/selection';
import './audio/sound';
import './ui/format';
import './ui/achievements';
import './ui/age';
import './ui/blessings';
import './ui/buildmenu';
import './ui/coach';
import './ui/endscreen';
import './ui/event';
import './ui/header';
import './ui/hover';
import './ui/hud';
import './ui/inspector';
import './ui/modals';
import './ui/objectives';
import './ui/panel';
import './ui/peoples';
import './ui/profile';
import './ui/panes/defense';
import './ui/panes/jobs';
import './ui/panes/log';
import './ui/panes/upgrades';
import './ui/rivals';
import './ui/resources';
import { store } from './core/store';
import { SET } from './core/settings';
import { RKEYS } from './data/resources';
import { deserialize, load, save, serialize } from './game/save';
import { G, newGame, sel } from './game/state';
import { rememberPositions, update } from './game/update';
import { drag, keys, mouse } from './input/input';
import { clampCam, panScreen, s2t, updateCamera } from './render/camera';
import { renderMini } from './render/minimap';
import { render } from './render/render';
import { cam, worldEl } from './render/scene';
import { onAgeChange } from './ui/age';
import { checkBlessing } from './ui/blessings';
import { renderCmd } from './ui/buildmenu';
import { updateHeader, updateWorldTop } from './ui/header';
import { updateHover } from './ui/hover';
import { renderInspector } from './ui/inspector';
import { showTitle } from './ui/modals';
import { renderChronicle } from './ui/objectives';
import { renderDefense } from './ui/panes/defense';
import { renderJobs } from './ui/panes/jobs';
import { renderLog } from './ui/panes/log';
import { renderUpgrades } from './ui/panes/upgrades';
import { renderRivals } from './ui/rivals';
import { rate } from './ui/resources';
import { $, isCompact } from './util/dom';
import { measure } from './core/perf';
import { initQuality, tickQuality } from './render/quality';

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
function frame(now: number) {
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
    cam.y += (cam.ty! - cam.y) * k;
    if (Math.abs(cam.tx - cam.x) < 0.02 && Math.abs(cam.ty! - cam.y) < 0.02) cam.tx = null;
  }
  // Vloeiend zoomen: elke beeldje een stukje dichter bij de gewenste zoom
  if (cam.tz != null) {
    const before = cam.anchor && s2t(cam.anchor[0], cam.anchor[1]);
    cam.z += (cam.tz - cam.z) * (1 - Math.pow(0.00002, rdt));
    if (Math.abs(cam.tz - cam.z) < 0.001) cam.z = cam.tz;
    updateCamera();
    if (before) {
      const after = s2t(cam.anchor![0], cam.anchor![1]);
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
    renderLog();
    renderInspector();
    renderCmd();
    checkBlessing(); // ligt er een zegening klaar om te kiezen?
  }
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
    if (!G.over && SET.autosave) save();
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
/** Wat een nieuwe versie van de pagina meekrijgt van de vorige: de spelstand. */
interface HotData {
  save?: string | null;
}
/** Hot-reload van de claude.ai-artifactomgeving: een nieuwe versie speelt verder met de oude spelstand. */
interface HotReload {
  data?: HotData;
  ready?: (start: (data?: HotData) => void) => void;
  snapshot?: (take: () => HotData) => void;
}
// Alleen in de artifactomgeving van claude.ai staat er iets op window.claude.
declare global {
  interface Window {
    claude?: { hot?: HotReload };
  }
}
function start(data?: HotData) {
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
if (import.meta.env.DEV) import('./debug');
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot)
  try {
    hot.snapshot(() => ({ save: G ? serialize() : null }));
  } catch (e) {}
if (hot && hot.ready) hot.ready(start);
else start((hot && hot.data) || {});
