import type { Tile } from '../types';
// Muis, touch en toetsenbord.
import { store } from '../core/store';
import { setSound, sfx, sndOn } from '../audio/sound';
import { CS, TAU } from '../config';
import { B } from '../data/buildings';
import { placeLine } from '../game/placement';
import { G, bById, sel } from '../game/state';
import { canDemolish, noDemolishText } from '../game/wonders';
import { CUR } from './cursors';
import {
  boxSelect,
  clearSel,
  leftClick,
  rightClick,
  selectSameType,
  selUnits,
  unitAt,
  villAt,
} from './selection';
import {
  TURN_STEP,
  centerOn,
  clampCam,
  resetTurn,
  s2iso,
  s2t,
  turnCamera,
  turnCameraSmooth,
  updateCamera,
} from '../render/camera';
import { cam, cv } from '../render/scene';
import { bigMapOpen, setBigMap } from '../render/minimap';
import { setTab } from '../ui/buildmenu';
import { sigs } from '../ui/header';
import { lastSpeed, setExpand, setSpeed, toast } from '../ui/hud';
import { demolish, selCmds } from '../ui/inspector';
import { closeModal, openPause, showHelp } from '../ui/modals';
import { togglePanel } from '../ui/panel';
import { assignGroup, selectGroup } from '../ui/army';
import { $, isCompact } from '../util/dom';
import { clamp, dist } from '../util/math';
import { SET } from '../core/settings';

export const mouse = { sx: 0, sy: 0, X: 0, Y: 0, tx: 0, ty: 0, in: false, moved: true, touch: false };
/** Wat je met de muis of vinger aan het doen bent op de kaart. */
export type Drag = PinchDrag | PressDrag | LineDrag;
/** Knijpen met twee vingers om te zoomen: afstand tussen de vingers (d0) en zoom (z0) bij het begin. */
interface PinchDrag {
  mode: 'pinch';
  d0: number;
  z0: number;
  /** Het punt tussen de twee vingers op het scherm. */
  mx: number;
  my: number;
  /**
   * Draaien met twee vingers (in 3D): de hoek tussen de vingers bij het begin en de vorige keer,
   * en of het beeld al meedraait.
   */
  a0: number;
  ang: number;
  twist: boolean;
}
/** Wat een klik of sleep met één knop of vinger bijhoudt: beginpunt (sx, sy) en laatste punt (lx, ly). */
interface Press {
  btn: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
  shift: boolean;
  ctrl: boolean;
  /** Hoeveel pixels er al gesleept is. */
  moved: number;
}
/**
 * Klikken (nog niet beslist), de kaart verschuiven, een selectiekader trekken of het beeld draaien
 * (middelste muisknop in 3D); t0 = wanneer het begon.
 */
interface PressDrag extends Press {
  mode: 'pending' | 'pan' | 'box' | 'turn';
  t0: number;
}
/** Een muur of weg trekken, van tegel t0 naar tegel t1. */
interface LineDrag extends Press {
  mode: 'line';
  t0: Tile;
  t1: Tile;
}
export let drag: Drag | null = null,
  hoverChunk: [number, number] | null = null;
export const ptrs = new Map<number, { x: number; y: number }>(),
  keys = new Set<string>();
function local(e: MouseEvent): [number, number] {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
// Het verschil tussen twee hoeken, tussen -180° en +180°
const angleDiff = (a: number, b: number) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
// Zo ver draait het beeld per pixel slepen met de middelste muisknop
const TURN_PER_PX = 0.008;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  const [sx, sy] = local(e);
  ptrs.set(e.pointerId, { x: sx, y: sy });
  mouse.touch = e.pointerType === 'touch';
  if (ptrs.size === 2) {
    const [p, q] = [...ptrs.values()],
      ang = Math.atan2(q.y - p.y, q.x - p.x);
    drag = {
      mode: 'pinch',
      d0: dist(p.x, p.y, q.x, q.y),
      z0: cam.z,
      mx: (p.x + q.x) / 2,
      my: (p.y + q.y) / 2,
      a0: ang,
      ang,
      twist: false,
    };
    return;
  }
  drag = {
    mode: 'pending',
    btn: e.button,
    sx,
    sy,
    lx: sx,
    ly: sy,
    shift: e.shiftKey,
    ctrl: e.ctrlKey || e.metaKey,
    moved: 0,
    t0: performance.now(),
  };
  // Middelste muisknop: in 3D draaien, in het bovenaanzicht schuiven
  if (e.button === 1) drag.mode = store.V2 ? 'pan' : 'turn';
  if (e.button === 0 && e.shiftKey && !store.placing && !store.expandMode) drag.mode = 'box';
  // Muur of weg trekken: t0 is dan de begintegel in plaats van de begintijd.
  if (e.button === 0 && store.placing && (B[store.placing].wall || B[store.placing].road)) {
    const t = s2t(sx, sy),
      t0: Tile = [Math.floor(t[0]), Math.floor(t[1])];
    drag = { ...drag, mode: 'line', t0, t1: t0 };
  }
});
cv.addEventListener('pointermove', e => {
  const [sx, sy] = local(e);
  mouse.sx = sx;
  mouse.sy = sy;
  mouse.in = true;
  mouse.moved = true;
  mouse.touch = e.pointerType === 'touch';
  [mouse.X, mouse.Y] = s2iso(sx, sy);
  [mouse.tx, mouse.ty] = s2t(sx, sy);
  hoverChunk = [Math.floor(mouse.tx / CS), Math.floor(mouse.ty / CS)];
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: sx, y: sy });
  if (!drag) return;
  if (drag.mode === 'pinch') {
    if (ptrs.size !== 2) return;
    // Zoom rond het punt tussen de vingers en schuif mee met de vingers
    const [p, q] = [...ptrs.values()],
      mx = (p.x + q.x) / 2,
      my = (p.y + q.y) / 2,
      before = s2t(drag.mx, drag.my);
    setZoom((drag.z0 * dist(p.x, p.y, q.x, q.y)) / drag.d0);
    // Draaien met twee vingers (alleen in 3D). Pas na een duidelijke draai, zodat knijpen gewoon zoomt.
    const ang = Math.atan2(q.y - p.y, q.x - p.x);
    if (!drag.twist && Math.abs(angleDiff(ang, drag.a0)) > 0.2) {
      drag.twist = true;
      drag.ang = ang;
    }
    if (drag.twist) {
      turnCamera(angleDiff(ang, drag.ang));
      drag.ang = ang;
    }
    updateCamera();
    const after = s2t(mx, my);
    cam.tx = null;
    cam.x += before[0] - after[0];
    cam.y += before[1] - after[1];
    clampCam();
    updateCamera();
    drag.mx = mx;
    drag.my = my;
    return;
  }
  if (drag.mode === 'line') {
    drag.t1 = [Math.floor(mouse.tx), Math.floor(mouse.ty)];
    return;
  }
  // Vanaf hier: slepen met één knop of vinger. (Een knijpgebaar waarvan al een vinger los is,
  // komt hier ook langs; daarmee gebeurt verder niets.)
  const press = drag as PressDrag;
  const dx = sx - press.lx,
    dy = sy - press.ly;
  press.moved += Math.abs(dx) + Math.abs(dy);
  // Slepen begint: wordt het een selectiekader of verschuiven we de kaart?
  // Muis: linkerknop = kader (tenzij uitgezet in de instellingen), rechter/middelste knop = schuiven.
  // Touch: gewoon slepen = schuiven, eerst even vasthouden en dan slepen = kader.
  if (press.mode === 'pending' && press.moved > 7) {
    const held = performance.now() - press.t0 > 450;
    const box = mouse.touch ? held : press.btn === 0 && SET.dragSelect !== false;
    press.mode = box && !store.placing && !store.expandMode ? 'box' : 'pan';
    if (press.mode === 'pan') cv.style.cursor = 'grabbing';
  }
  if (press.mode === 'turn') {
    turnCamera(dx * TURN_PER_PX);
    updateCamera();
    cv.style.cursor = 'ew-resize';
  }
  if (press.mode === 'pan') {
    const a0 = s2t(press.lx, press.ly),
      b0 = s2t(sx, sy);
    cam.tx = null;
    cam.x += a0[0] - b0[0];
    cam.y += a0[1] - b0[1];
    clampCam();
    updateCamera();
  }
  press.lx = sx;
  press.ly = sy;
});
cv.addEventListener('pointerup', e => {
  ptrs.delete(e.pointerId);
  if (!drag) return;
  if (drag.mode === 'pinch') {
    // Nog één vinger op het scherm: daarmee verder schuiven (telt nooit als tik)
    const rest = [...ptrs.values()][0];
    drag = rest
      ? {
          mode: 'pan',
          btn: 0,
          sx: rest.x,
          sy: rest.y,
          lx: rest.x,
          ly: rest.y,
          shift: false,
          ctrl: false,
          moved: 99,
          t0: 0,
        }
      : null;
    return;
  }
  const [sx, sy] = local(e);
  if (drag.mode === 'pending') {
    if (drag.btn === 0) leftClick(sx, sy, drag.shift, drag.ctrl);
    else if (drag.btn === 2) rightClick(sx, sy);
  } else if (drag.mode === 'box') boxSelect(drag.sx, drag.sy, sx, sy, drag.shift);
  else if (drag.mode === 'line' && store.placing) placeLine(drag.t0, drag.t1);
  drag = null;
  cv.style.cursor = CUR.def;
});
cv.addEventListener('pointercancel', e => {
  ptrs.delete(e.pointerId);
  drag = null;
});
cv.addEventListener('pointerleave', () => {
  mouse.in = false;
  $('#hovertip').hidden = true;
});
// Dubbelklik (of dubbeltik) op een eenheid: alles van dat soort dat in beeld is
cv.addEventListener('dblclick', e => {
  const [sx, sy] = local(e),
    [X, Y] = s2iso(sx, sy),
    hit = unitAt(X, Y) || villAt(X, Y);
  if (hit) selectSameType(hit);
});

cv.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    const [sx, sy] = local(e),
      dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1); // muiswiel in regels of pagina's
    zoomTo((cam.tz ?? cam.z) * Math.exp(dy * (SET.invertZoom ? 0.0015 : -0.0015)), sx, sy);
  },
  { passive: false },
);
// Zo ver kun je uitzoomen (ZOOM_MIN: dan zie je bijna een hele gewone kaart) en inzoomen
export const ZOOM_MIN = 0.12,
  ZOOM_MAX = 2.4;
/** Direct zoomen (bij knijpen met twee vingers en bij laden). */
export function setZoom(z: number) {
  cam.z = clamp(z, ZOOM_MIN, ZOOM_MAX);
  cam.tz = null;
}
/** Vloeiend zoomen naar z. Met sx, sy blijft dat punt op het scherm op dezelfde plek in de wereld. */
export function zoomTo(z: number, sx?: number, sy?: number) {
  cam.tz = clamp(z, ZOOM_MIN, ZOOM_MAX);
  cam.anchor = sx == null ? null : [sx, sy!];
}
$('#zIn').onclick = () => zoomTo((cam.tz ?? cam.z) * 1.25);
$('#zOut').onclick = () => zoomTo((cam.tz ?? cam.z) / 1.25);
$('#zHome').onclick = () => {
  const t = G.bs.find(b => b.type === 'townhall');
  if (t) centerOn(t.x + 1, t.y + 1);
};
// Knoppen op de minikaart: 2D of 3D, draaien, en het kompas zet de draaiing terug
$('#view2d').onclick = () => {
  if (!store.V2) setView(true);
};
$('#view3d').onclick = () => {
  if (store.V2) setView(false);
};
$('#rotL').onclick = () => turnCameraSmooth(-TURN_STEP);
$('#rotR').onclick = () => turnCameraSmooth(TURN_STEP);
$('#compass').onclick = () => resetTurn();
// Hoe je draait, in een paar woorden: met vingers op een touchscherm, anders met muis en toetsen
const TURN_HOW = matchMedia('(pointer:coarse)').matches
  ? 'draai met twee vingers'
  : 'draai met de middelste muisknop of met , en .';
/** Bovenaanzicht (2D, true) of 3D-aanzicht (false). Wordt onthouden in de browser. */
export function setView(v2: boolean, quiet?: boolean) {
  store.V2 = !!v2;
  document.body.classList.toggle('v2', store.V2);
  $('#view2d').setAttribute('aria-pressed', String(store.V2));
  $('#view3d').setAttribute('aria-pressed', String(!store.V2));
  try {
    localStorage.setItem('tijdperken-view', store.V2 ? '2d' : '3d');
  } catch (e) {}
  if (!quiet) toast(store.V2 ? 'Bovenaanzicht (2D) aan.' : `3D-aanzicht aan: ${TURN_HOW}.`);
  store.uiDirty = true;
}
addEventListener('keydown', e => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && !/^f[1-5]$/.test(k)) return;
  if (!$('#modal').hidden) {
    if (k === 'escape' && !G.over && !store.modalLocked) closeModal();
    return;
  }
  if (!$('#title').hidden) return;
  // Esc sluit eerst de grote kaart (zie render/minimap.ts)
  if (k === 'escape' && bigMapOpen()) {
    setBigMap(false);
    return;
  }
  keys.add(k);
  if (k === 'escape') {
    const busy =
      store.placing ||
      store.expandMode ||
      store.cmdMode ||
      store.demoMode ||
      sel.us.size ||
      sel.vs.size ||
      sel.b ||
      sel.camp ||
      sel.rb ||
      sel.rival ||
      sel.node >= 0;
    store.placing = null;
    store.cmdMode = null;
    store.demoMode = false;
    setExpand(false);
    clearSel();
    if (isCompact()) togglePanel();
    if (!busy) openPause();
    store.uiDirty = true;
  } else if (k === 'f' && sel.us.size) {
    store.cmdMode = 'amove';
    store.uiDirty = true;
  } else if (k === 'r' && sel.us.size) {
    store.cmdMode = 'patrol';
    store.uiDirty = true;
  } else if (k === 'delete' && !sel.b) {
    store.demoMode = !store.demoMode;
    store.placing = null;
    store.uiDirty = true;
  } else if (k === ' ') {
    e.preventDefault();
    setSpeed(G.speed ? 0 : lastSpeed);
  } else if (k === ']') {
    setSpeed(G.speed === 0 ? 1 : G.speed === 1 ? 2 : 4);
  } else if (k === '[') {
    setSpeed(G.speed === 4 ? 2 : G.speed === 2 ? 1 : 1);
  } else if (/^f[1-5]$/.test(k)) {
    // Groepen 1 tot 5: met Ctrl+Shift maken, zonder kiezen; twee keer = ernaartoe (zie ui/army.ts).
    // We noemen Ctrl+Shift, want Ctrl+F4 en Alt+F4 sluiten de browser en dat kan een spel niet tegenhouden.
    e.preventDefault();
    const g = k.slice(1);
    if (e.ctrlKey || e.metaKey) assignGroup(g);
    else selectGroup(g, e.shiftKey);
  } else if (k === 's' && !e.ctrlKey && sel.us.size) {
    selUnits().forEach(u => {
      u.tgt = null;
      u.order = 'guard';
      u.path = null;
      u.gx = u.x;
      u.gy = u.y;
    });
    sfx('tick');
  } else if (k === 'h' || k === '?') showHelp();
  else if (k === 'e') setExpand(!store.expandMode);
  else if (k === 'v') setView(!store.V2);
  // Draaien met , en . (zie main.ts); in het bovenaanzicht gaat eerst het 3D-aanzicht aan
  else if ((k === ',' || k === '.') && store.V2) setView(false);
  else if (k === 'm') setSound(!sndOn);
  else if (k === 'z' || k === 'x' || k === 'c' || k === 'b' || k === 'n') {
    const t = { z: 'home', x: 'eco', c: 'light', b: 'mil', n: 'wonder' }[k];
    if (selCmds != null && !sel.vs.size) clearSel();
    setTab(t);
  } else if (k === 'p') {
    togglePanel('left');
  } else if (k === 'q') selectArmy();
  else if (/^[1-9]$/.test(k) && !e.ctrlKey) {
    const tiles = [...document.querySelectorAll<HTMLElement>('#cmdgrid .gb[data-b]')],
      t = tiles[+k - 1];
    if (t) {
      t.click();
    }
  } else if (k === 'i') selectIdle();
  else if ((k === 'delete' || k === 'backspace') && sel.b) {
    e.preventDefault();
    const b = bById.get(sel.b);
    // Het stamhuis, een af wereldwonder en een sterrenpoort die oplaadt breek je niet af
    if (b && !canDemolish(b)) toast(noDemolishText(b));
    else if (b) {
      if (store.demolishArm === b.id) demolish(b);
      else {
        store.demolishArm = b.id;
        sigs.ins = null;
        toast(`Druk nogmaals om ${B[b.type].n.toLowerCase()} af te breken.`);
        setTimeout(() => {
          if (store.demolishArm === b.id) {
            store.demolishArm = 0;
            sigs.ins = null;
            store.uiDirty = true;
          }
        }, 3000);
      }
    }
  } else if (k === '+' || k === '=') zoomTo((cam.tz ?? cam.z) * 1.25);
  else if (k === '-') zoomTo((cam.tz ?? cam.z) / 1.25);
  else if (k === 'home') $('#zHome').click();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
export function selectArmy() {
  clearSel();
  G.us.forEach(u => sel.us.add(u.id));
  if (!G.us.length) toast('Je hebt nog geen leger. Bouw een kazerne.');
  store.uiDirty = true;
}
export function selectIdle() {
  const idle = G.vs.filter(v => !v.hidden && v.state === 'idle');
  clearSel();
  if (idle.length) {
    idle.forEach(v => sel.vs.add(v.id));
    centerOn(idle[0].x, idle[0].y);
  } else toast('Niemand staat stil. Iedereen is aan het werk.');
  store.uiDirty = true;
}
