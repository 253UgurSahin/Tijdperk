// 2D-laag over de wereld: levensbalken en labels.
import { store } from '../core/store.js';
import { CN, CS, TAU } from '../config.js';
import { SET } from '../core/settings.js';
import { B } from '../data/buildings.js';
import { RES } from '../data/resources.js';
import { UNITS } from '../data/units.js';
import { has } from '../game/economy.js';
import { canBuyChunk, chunkCost } from '../game/placement.js';
import { rbById } from '../game/rivals.js';
import { G, sel } from '../game/state.js';
import { bMaxHp, canUpg, upgCost } from '../game/upgrades.js';
import { drag } from '../input/input.js';
import { proj, pxu, t2s } from './camera.js';
import { rbRec } from './rivals3d.js';
import { DPR, VH, VW, octx } from './scene.js';
import { bRec } from './sync.js';
import { clamp } from '../util/math.js';

function obar(x, y, w, f, col) {
  const c = octx;
  c.fillStyle = 'rgba(10,14,20,.75)';
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col;
  c.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4);
}
function otext(x, y, t, col, size = 12, a = 1) {
  const c = octx;
  c.globalAlpha = a;
  c.font = `700 ${size}px "Instrument Sans",sans-serif`;
  c.textAlign = 'center';
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(10,14,20,.7)';
  c.strokeText(t, x, y);
  c.fillStyle = col;
  c.fillText(t, x, y);
  c.globalAlpha = 1;
}
export function drawOverlay() {
  const c = octx;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, VW, VH);
  const z = pxu();
  for (const b of G.bs) {
    const r = bRec.get(b.id);
    if (!r) continue;
    const d = B[b.type],
      s = d.size,
      [sx, sy, sz] = proj(b.x + s / 2, r.h * (b.done ? 1 : 0.6) + 0.25, b.y + s / 2);
    if (sz > 1 || sx < -50 || sy < -50 || sx > VW + 50 || sy > VH + 50) continue;
    if (!b.done) {
      obar(sx, sy, Math.min(60, s * z * 0.8), b.prog / b.bt, '#e2b92c');
      continue;
    }
    const mh = bMaxHp(b);
    if ((SET.hp && !d.wall) || b.hp < mh)
      obar(sx, sy, Math.min(52, s * z * 0.7), b.hp / mh, b.hp / mh > 0.4 ? '#7fd36a' : '#e3584a');
    if (z > 18 && canUpg(b) && has(upgCost(b))) {
      const by = sy - 14 + Math.sin(store.TM * 3 + b.id) * 2;
      c.fillStyle = '#e2b92c';
      c.beginPath();
      c.arc(sx, by, 7, 0, TAU);
      c.fill();
      c.strokeStyle = '#2a1d05';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx - 3.4, by + 1.6);
      c.lineTo(sx, by - 2);
      c.lineTo(sx + 3.4, by + 1.6);
      c.stroke();
    }
    if (d.conv && b.starved && b.on) {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(sx + 14, sy - 12, 8, 0, TAU);
      c.fill();
      otext(sx + 14, sy - 8, '!', '#c0392b', 12);
    }
  }
  // Gebouwen van rivalen: een rode levensbalk zodra ze geraakt zijn, zodat je ziet of je aanval werkt
  for (const b of rbById.values()) {
    const r = rbRec.get(b.id);
    if (!r || !b.done || b.hp >= b.mhp) continue;
    const s = B[b.type].size,
      [sx, sy, sz] = proj(b.x + s / 2, r.h + 0.25, b.y + s / 2);
    if (sz > 1 || sx < -50 || sy < -50 || sx > VW + 50 || sy > VH + 50) continue;
    obar(sx, sy, Math.min(52, s * z * 0.7), b.hp / b.mhp, '#e3584a');
  }
  const ents = [
    ...G.vs.filter(v => !v.hidden && (v.hp < v.mhp || sel.vs.has(v.id))),
    ...G.us.filter(u => u.hp < u.mhp || sel.us.has(u.id) || SET.hp),
    ...G.foes.filter(f => f.hp < f.mhp && !f.retreat),
  ];
  for (const e of ents) {
    const fly = e.kind === 'u' ? UNITS[e.k].fly : e.air;
    const [sx, sy, sz] = proj(e.rx ?? e.x, fly ? 1.3 : 0.8, e.ry ?? e.y);
    if (sz > 1) continue;
    obar(sx, sy, 22, e.hp / e.mhp, e.kind === 'f' ? '#e3584a' : e.hp / e.mhp > 0.4 ? '#7fd36a' : '#e3a64a');
  }
  for (const e of G.fx)
    if (e.type === 'float') {
      const [sx, sy, sz] = proj(e.x, 0.9 + (e.z || 0) / 40, e.y);
      if (sz < 1) otext(sx, sy, e.txt, e.col, 13, Math.min(1, (e.life / e.max) * 2));
    }
  if (store.expandMode) {
    const cc = chunkCost(),
      ok = has(cc);
    for (let cy2 = 0; cy2 < CN; cy2++)
      for (let cx2 = 0; cx2 < CN; cx2++) {
        if (!canBuyChunk(cx2, cy2)) continue;
        const [sx, sy, sz] = proj(cx2 * CS + 8, 0, cy2 * CS + 8);
        if (sz > 1) continue;
        otext(sx, sy - 6, 'Uitbreiden', ok ? '#f3ead2' : '#ff8a7a', 15);
        otext(
          sx,
          sy + 12,
          Object.keys(cc)
            .map(k => `${cc[k]} ${RES[k].n.toLowerCase()}`)
            .join(' · '),
          '#d8d0bc',
          12,
        );
      }
  }
  if (store.raidPing) {
    const [sx, sy] = t2s(store.raidPing.x, store.raidPing.y);
    c.globalAlpha = Math.min(1, store.raidPing.t / 2);
    c.strokeStyle = '#e3584a';
    c.lineWidth = 2.5;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      c.arc(sx, sy, 20 + ((store.TM * 40 + k * 30) % 60), 0, TAU);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  if (drag && drag.mode === 'box') {
    const x = Math.min(drag.sx, drag.lx),
      y = Math.min(drag.sy, drag.ly),
      w = Math.abs(drag.lx - drag.sx),
      h = Math.abs(drag.ly - drag.sy);
    // Selectiekader: zachte vulling, dunne lijn en stevige hoeken
    c.fillStyle = 'rgba(159,226,138,.10)';
    c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(159,226,138,.55)';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w, h);
    const k = Math.min(14, w / 3, h / 3);
    c.strokeStyle = '#c9f5b4';
    c.lineWidth = 2.5;
    c.beginPath();
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ]) {
      c.moveTo(cx + dx * k, cy);
      c.lineTo(cx, cy);
      c.lineTo(cx, cy + dy * k);
    }
    c.stroke();
  }
}
