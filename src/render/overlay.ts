// 2D-laag over de wereld: levensbalken en labels.
import type { Foe, Unit } from '../types';
import { store } from '../core/store';
import { CN, CS, TAU } from '../config';
import { SET } from '../core/settings';
import { B } from '../data/buildings';
import { bossForAge, bossName } from '../data/bosses';
import { RES } from '../data/resources';
import { UNITS } from '../data/units';
import { has } from '../game/economy';
import { unitRank } from '../game/army';
import { canBuyChunk, chunkCost } from '../game/placement';
import { rbById } from '../game/rivals';
import { G, sel } from '../game/state';
import { bMaxHp } from '../game/upgrades';
import { drag, hoverChunk } from '../input/input';
import { proj, pxu, t2s } from './camera';
import { rbRec } from './rivals3d';
import { DPR, VH, VW, octx } from './scene';
import { bRec, eRec } from './sync';
import { clamp } from '../util/math';

function obar(x: number, y: number, w: number, f: number, col: string) {
  const c = octx;
  c.fillStyle = 'rgba(10,14,20,.75)';
  c.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  c.fillStyle = col;
  c.fillRect(x - w / 2, y, w * clamp(f, 0, 1), 4);
}
function otext(x: number, y: number, t: string, col: string, size = 12, a = 1) {
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
/** De namen van alle soldaten: een nieuwe soldaat zweeft met zijn naam uit de kazerne. */
const UNIT_NAMES = new Set(Object.values(UNITS).map(u => u.n));
/**
 * Wat er de hele tijd gebeurt, zweeft niet boven de wereld: opbrengst ("+27"), een nieuwe dorpeling of een
 * nieuwe soldaat. Dat zie je al aan de voorraad en het inwonertal bovenaan. Iets bijzonders (een
 * verbetering, buit, een verslagen kampioen, een veteraan) zweeft er wel.
 */
const isRoutine = (txt: string): boolean =>
  /^[+−-]\d+$/.test(txt) || txt === '+1 dorpeling' || UNIT_NAMES.has(txt);
// Een kampioen: zijn naam en een brede levensbalk boven zijn hoofd, in goud omrand
function bossLabel(f: Foe) {
  const boss = bossForAge(f.boss);
  if (!boss) return;
  const top = eRec.get(f.id)?.bossTop ?? 2;
  const [sx, sy, sz] = proj(f.rx ?? f.x, top + 0.15, f.ry ?? f.y);
  if (sz > 1 || sx < -100 || sy < -60 || sx > VW + 100 || sy > VH + 60) return;
  const c = octx,
    w = 84;
  c.fillStyle = '#e2b92c';
  c.fillRect(sx - w / 2 - 2, sy - 2, w + 4, 8);
  obar(sx, sy, w, f.hp / f.mhp, '#e3584a');
  otext(sx, sy - 7, bossName(boss), '#ffe7a0', 13);
}
// Gouden streepjes (rang 1 tot 3) net boven de plek van de levensbalk
function rankChevrons(u: Unit, rank: number) {
  const [sx, sy, sz] = proj(u.rx ?? u.x, UNITS[u.k].fly ? 1.3 : 0.8, u.ry ?? u.y);
  if (sz > 1 || sx < -20 || sy < -20 || sx > VW + 20 || sy > VH + 20) return;
  const c = octx;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (let i = 0; i < rank; i++) {
    const y = sy - 4 - i * 4;
    c.beginPath();
    c.moveTo(sx - 5, y);
    c.lineTo(sx, y - 3.5);
    c.lineTo(sx + 5, y);
    c.strokeStyle = 'rgba(10,14,20,.75)';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = '#f2c94c';
    c.lineWidth = 2;
    c.stroke();
  }
}
// Een rondje met een plus: hier kun je uitbreiden (ver uitgezoomd, als er geen plek is voor tekst)
function plusMark(x: number, y: number, col: string) {
  const c = octx;
  c.fillStyle = 'rgba(10,14,20,.6)';
  c.beginPath();
  c.arc(x, y, 9, 0, TAU);
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x - 4.5, y);
  c.lineTo(x + 4.5, y);
  c.moveTo(x, y - 4.5);
  c.lineTo(x, y + 4.5);
  c.stroke();
}
/** Waar de buurgebieden van een gebied op het scherm liggen: opzij, naar achteren en schuin. */
const NEIGHBOURS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
/**
 * Bij het uitbreiden: op elk gebied dat je kunt kopen staat "Uitbreiden" (rood als je het niet kunt
 * betalen). De prijs staat in de balk onderin en bij het gebied onder de muis. Liggen de gebieden op het
 * scherm dicht op elkaar (ver uitgezoomd, of achteraan in het 3D-beeld), dan alleen een plusje, en nog
 * dichter niets (de gele vlakken laten ze dan zien). Zo vallen de labels nooit over elkaar.
 */
function expandLabels() {
  const cost = chunkCost(),
    col = has(cost) ? '#f3ead2' : '#ff8a7a',
    price = Object.keys(cost)
      .map(k => `${cost[k]} ${RES[k].n.toLowerCase()}`)
      .join(' · ');
  // Zo breed is het woord op het scherm (met wat ruimte ertussen)
  octx.font = '700 15px "Instrument Sans",sans-serif';
  const wordRoom = octx.measureText('Uitbreiden').width + 12;
  for (let cy = 0; cy < CN; cy++)
    for (let cx = 0; cx < CN; cx++) {
      if (!canBuyChunk(cx, cy)) continue;
      const mx = cx * CS + CS / 2,
        my = cy * CS + CS / 2,
        [sx, sy, sz] = proj(mx, 0, my);
      if (sz > 1 || sx < -120 || sy < -40 || sx > VW + 120 || sy > VH + 40) continue;
      if (hoverChunk && hoverChunk[0] === cx && hoverChunk[1] === cy) {
        otext(sx, sy - 6, 'Uitbreiden', col, 15);
        otext(sx, sy + 12, price, '#d8d0bc', 12);
        continue;
      }
      // Past een label van w bij h beeldpunten, zonder over dat van een buurgebied te vallen?
      const steps = NEIGHBOURS.map(([dx, dy]) => {
        const [nx, ny] = proj(mx + dx * CS, 0, my + dy * CS);
        return [Math.abs(nx - sx), Math.abs(ny - sy)];
      });
      const fits = (w: number, h: number) => steps.every(([ax, ay]) => ax >= w || ay >= h);
      if (fits(wordRoom, 24)) otext(sx, sy + 5, 'Uitbreiden', col, 15);
      else if (fits(26, 26)) plusMark(sx, sy, col);
    }
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
    // Geen pijltjes "kan verbeterd worden" meer boven gebouwen: dat werd een zee van pijltjes.
    // Verbeteren zie je in het paneel van het gekozen gebouw en in het paneel Verbeteren.
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
    ...G.foes.filter(f => f.hp < f.mhp && !f.retreat && !f.boss),
  ];
  for (const e of ents) {
    const fly = e.kind === 'u' ? UNITS[e.k].fly : e.kind === 'f' && e.air; // dorpelingen vliegen nooit
    const [sx, sy, sz] = proj(e.rx ?? e.x, fly ? 1.3 : 0.8, e.ry ?? e.y);
    if (sz > 1) continue;
    obar(sx, sy, 22, e.hp / e.mhp, e.kind === 'f' ? '#e3584a' : e.hp / e.mhp > 0.4 ? '#7fd36a' : '#e3a64a');
  }
  // Veteranen: gouden streepjes boven hun hoofd, één per rang (zie game/army.ts). Ver uitgezoomd alleen
  // bij wie je geselecteerd hebt, anders wordt het een rommeltje.
  for (const u of G.us) {
    if (!u.kills) continue; // de meeste soldaten hebben nog niets verslagen: snel overslaan
    const rank = unitRank(u);
    if (rank && (z > 14 || sel.us.has(u.id))) rankChevrons(u, rank);
  }
  for (const f of G.foes) if (f.boss && !f.retreat) bossLabel(f);
  for (const e of G.fx)
    if (e.type === 'float' && !isRoutine(e.txt)) {
      const [sx, sy, sz] = proj(e.x, 0.9 + (e.z || 0) / 40, e.y);
      if (sz < 1) otext(sx, sy, e.txt, e.col, 13, Math.min(1, (e.life / e.max) * 2));
    }
  if (store.expandMode) expandLabels();
  if (store.raidPing) {
    // Waar de aanval begint; tijdens de finale ook waar de groepen uit de andere richtingen komen (raidPing.more)
    const spots = [[store.raidPing.x, store.raidPing.y], ...(store.raidPing.more || [])];
    c.globalAlpha = Math.min(1, store.raidPing.t / 2);
    c.strokeStyle = '#e3584a';
    c.lineWidth = 2.5;
    for (const [x, y] of spots) {
      const [sx, sy] = t2s(x, y);
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.arc(sx, sy, 20 + ((store.TM * 40 + k * 30) % 60), 0, TAU);
        c.stroke();
      }
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
