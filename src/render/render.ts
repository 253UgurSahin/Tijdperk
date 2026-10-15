// Tekent één beeldje van de wereld.
import * as T3 from 'three';
import { store } from '../core/store';
import { CN, CS, W } from '../config';
import { B } from '../data/buildings';
import { canBuyChunk } from '../game/placement';
import { G, bById, sel } from '../game/state';
import { darkness } from '../game/time';
import { drag, hoverChunk, mouse } from '../input/input';
import { isFar, updateCamera } from './camera';
import { pool, poolsBegin, poolsEnd, quadAt, rangeAt, ringAt } from './decals';
import { drawFx, drawRain } from './effects';
import { drawFinaleFx } from './finalefx';
import { stepDying } from './animate';
import { stepParticles } from './particles';
import { drawAmbient } from './ambient';
import { drawPlacement } from './ghost';
import { flagpole } from './kit';
import { applySeason, lighting } from './lighting';
import { drawOverlay } from './overlay';

import { bRec, cRec, checkWorld, eRec, syncBuildings, syncCamps, syncEntities } from './sync';
import { rbRec, syncRivalBuildings } from './rivals3d';
import { rbById, rivalById } from '../game/rivals';
import { inb } from '../world/world';
import { outlinesOn, renderFrame, setOutlined } from './post';
import { applyPendingResize } from './scene';
import { updateScatter } from './scatter';
import { updateGroundShade } from './terrainlook';
import { animateWater } from './water';
import { WIND } from './nodes';
import { entitiesInBox } from '../input/selection';

// Omlijning: geselecteerde dingen (groen) en wat je aanwijst of in je selectiekader hebt (licht).
// Alleen bij middel/hoog; op laag blijven alleen de cirkels op de grond.
const MAX_OUTLINED = 120;
function objectFor(kind: string, id: number): T3.Group | undefined {
  if (kind === 'b') return bRec.get(id)?.g;
  if (kind === 'c') return cRec.get(id)?.g;
  if (kind === 'rb') return rbRec.get(id)?.g;
  return eRec.get(id)?.body;
}
function updateOutlines() {
  if (!outlinesOn()) return;
  // Ver uitgezoomd geen omlijning: die tekent de hele wereld nog eens, en de cirkels op de grond zie je beter
  if (isFar()) {
    setOutlined([], []);
    return;
  }
  const selected: T3.Object3D[] = [],
    hovered: T3.Object3D[] = [];
  const add = (list: T3.Object3D[], o: T3.Object3D | undefined) =>
    o && list.length < MAX_OUTLINED && list.push(o);
  if (sel.b) add(selected, objectFor('b', sel.b));
  if (sel.camp) add(selected, objectFor('c', sel.camp));
  if (sel.rb) add(selected, objectFor('rb', sel.rb));
  for (const id of sel.us) add(selected, objectFor('u', id));
  for (const id of sel.vs) add(selected, objectFor('v', id));
  if (drag && drag.mode === 'box') {
    const { us, vs } = entitiesInBox(drag.sx, drag.sy, drag.lx, drag.ly);
    for (const e of [...us, ...vs]) add(hovered, objectFor(e.kind, e.id));
  } else if (store.hover) {
    const o = objectFor(store.hover.kind, store.hover.id);
    if (o && !selected.includes(o)) add(hovered, o);
  }
  setOutlined(selected, hovered);
}

export function render() {
  applyPendingResize();
  store.TM = performance.now() / 1000;
  animateWater(store.TM);
  WIND.value = store.TM;
  const dk = darkness();
  updateCamera(); // eerst de camera: checkWorld kijkt welk stuk wereld in beeld is (zie nodes.ts)
  checkWorld();
  applySeason();
  poolsBegin();
  syncBuildings();
  syncEntities();
  syncCamps();
  syncRivalBuildings();
  updateGroundShade(store.TM, b => bRec.get(b.id)?.h);
  updateScatter();
  stepDying();
  drawFx();
  drawFinaleFx(); // lichtzuil uit de sterrenpoort tijdens de finale
  drawRain();
  drawAmbient(dk);
  stepParticles(store.TM);
  drawPlacement();
  lighting(dk);
  // Cirkels onder geselecteerde dingen
  const sb = sel.b && bById.get(sel.b);
  if (sb) {
    const d = B[sb.type],
      s = d.size,
      cx = sb.x + s / 2,
      cz = sb.y + s / 2;
    quadAt(cx, cz, s + 0.15, s + 0.15, '#9fe28a', 0.28, 0.025);
    for (const r of [d.def && d.def.r, d.light].filter(Boolean)) rangeAt(cx, cz, r!, '#ffffff');
    if (sb.rally) {
      ringAt(sb.rally.x, sb.rally.y, 0.35, '#ffffff', 0.9);
      const f = pool('rally', () => {
        const g = new T3.Group();
        flagpole(g, 0, 0, 0, 0.8);
        return g;
      });
      f.position.set(sb.rally.x, 0, sb.rally.y);
      // Stippellijn van het gebouw naar het verzamelpunt; de stippen lopen langzaam mee
      const dx = sb.rally.x - cx,
        dz = sb.rally.y - cz,
        len = Math.hypot(dx, dz),
        start = s * 0.55,
        step = 0.45,
        shift = (store.TM * 0.8) % step;
      for (let t = start + shift; t < len - 0.3; t += step)
        quadAt(cx + (dx / len) * t, cz + (dz / len) * t, 0.12, 0.12, '#ffffff', 0.7, 0.04);
    }
  }
  if (sel.camp) {
    const c = G.camps.find(c => c.id === sel.camp);
    if (c) ringAt(c.x + 1, c.y + 1, 1.7, '#e3584a', 0.9);
  }
  // Een gebouw van een rivaal: een rode rand, en het bereik als het een toren is
  const rb = sel.rb && rbById.get(sel.rb);
  if (rb) {
    const d = B[rb.type],
      s = d.size;
    quadAt(rb.x + s / 2, rb.y + s / 2, s + 0.15, s + 0.15, '#e3584a', 0.28, 0.025);
    if (d.def) rangeAt(rb.x + s / 2, rb.y + s / 2, d.def.r, '#ff9b8b');
  }
  // Een rivaal zelf: een ring om zijn stamhuis
  const rival = sel.rival && rivalById(sel.rival);
  if (rival && !rival.dead) ringAt(rival.x + 1, rival.y + 1, 1.8, '#e3584a', 0.9);
  if (sel.node >= 0) ringAt((sel.node % W) + 0.5, ((sel.node / W) | 0) + 0.5, 0.45, '#ffffff', 0.9);
  if (
    mouse.in &&
    !drag &&
    !store.placing &&
    !store.expandMode &&
    inb(Math.floor(mouse.tx), Math.floor(mouse.ty)) &&
    !mouse.touch
  )
    quadAt(Math.floor(mouse.tx) + 0.5, Math.floor(mouse.ty) + 0.5, 0.96, 0.96, '#ffffff', 0.12, 0.02);
  if (store.expandMode)
    for (let cy2 = 0; cy2 < CN; cy2++)
      for (let cx2 = 0; cx2 < CN; cx2++) {
        if (!canBuyChunk(cx2, cy2)) continue;
        const hov = hoverChunk && hoverChunk[0] === cx2 && hoverChunk[1] === cy2;
        quadAt(
          cx2 * CS + 8,
          cy2 * CS + 8,
          CS - 0.6,
          CS - 0.6,
          hov ? '#ffe6a8' : '#d6b46c',
          hov ? 0.42 : 0.3,
          0.06,
        );
      }
  poolsEnd();
  updateOutlines();
  renderFrame();
  drawOverlay();
}
