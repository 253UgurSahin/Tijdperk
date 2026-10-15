// Legerbesturing in het spel: groepen, veteranen (rangen na overwinningen) en lopen in formatie.
import type { Unit, Villager } from '../types';
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { markTip, tipSeen } from '../core/tips';
import {
  RANK_AT,
  arrivalPaces,
  closeTogether,
  formationGoals,
  rankFromKills,
  rankMul,
  rankName,
  unitRole,
} from '../data/army';
import { UNITS } from '../data/units';
import { floater } from './fx';
import { G } from './state';
import { note, toast } from '../ui/hud';
import { freeWalk } from '../world/world';

/* ---------- Groepen ---------- */

/** Wie er nog leeft in groep g: { us: soldaten, vs: dorpelingen }. */
export function groupMembers(g: string): { us: Unit[]; vs: Villager[] } {
  const ids = new Set(G.groups[g] || []);
  return { us: G.us.filter(u => ids.has(u.id)), vs: G.vs.filter(v => !v.hidden && ids.has(v.id)) };
}

/** Haal groepen weg waarvan niemand meer leeft (dorpelingen die binnen schuilen leven nog). */
export function pruneGroups(): void {
  for (const g of Object.keys(G.groups)) {
    const ids = new Set(G.groups[g]);
    if (!G.us.some(u => ids.has(u.id)) && !G.vs.some(v => ids.has(v.id))) delete G.groups[g];
  }
}

/** Maak van deze soldaten en dorpelingen groep g (een lege lijst haalt de groep weg). */
export function setGroup(g: string, ids: number[]): void {
  if (ids.length) G.groups[g] = [...ids];
  else delete G.groups[g];
}

/* ---------- Veteranen ---------- */

/** De rang van een soldaat: 0 (rekruut) tot 3 (held). */
export const unitRank = (u: Unit): number => rankFromKills(u.kills || 0);

/** Hoeveel sterker een soldaat is door zijn rang (schade en levens). */
export const veteranMul = (u: Unit): number => rankMul(unitRank(u));

/**
 * Een soldaat versloeg een vijand. Na 3, 8 en 15 overwinningen stijgt hij een rang:
 * dan krijgt hij 10% meer levens (en via veteranMul ook meer schade).
 */
export function creditKill(u: Unit | null | undefined): void {
  if (!u || u.kind !== 'u' || u.dead) return;
  const before = unitRank(u);
  u.kills = (u.kills || 0) + 1;
  const after = unitRank(u);
  if (after === before) return;
  const grow = rankMul(after) / rankMul(before);
  u.mhp *= grow;
  u.hp *= grow;
  floater(u.x, u.y, rankName(after) + '!', '#e2b92c');
  sfx('upgrade', 0.4);
  store.notePos = [u.x, u.y];
  // De allereerste veteraan: leg dan één keer uit hoe rangen werken. Daarna alleen een regel in het logboek.
  if (!tipSeen('veteran')) {
    markTip('veteran');
    toast(
      `Je eerste veteraan! Na ${RANK_AT[0]}, ${RANK_AT[1]} en ${RANK_AT[2]} overwinningen stijgt een soldaat een rang: telkens +10% schade en leven.`,
      'good',
    );
  } else note(`${UNITS[u.k].n} is nu ${rankName(after).toLowerCase()}: +10% schade en leven.`, 'good');
  store.uiDirty = true;
}

/** Na het laden: het aantal overwinningen terugzetten, met de extra levens van zijn rang. */
export function restoreKills(u: Unit, kills: number | undefined): void {
  // Number.isInteger geeft alleen true bij een heel getal: dan is kills er zeker
  u.kills = Number.isInteger(kills) && kills! > 0 ? kills! : 0;
  u.mhp *= veteranMul(u);
}

/* ---------- Formatie ---------- */

/**
 * Laat soldaten naar (tx, ty) lopen met opdracht `order` ('move', 'amove' of 'patrol').
 * Met twee of meer gaan ze in formatie: voorhoede voorop, schutters erachter, geschut achteraan.
 * Staan ze bij elkaar, dan komen ze samen aan in het tempo van de traagste (u.pace, zie uUpdate in
 * game/military.ts). Met `keepPace: false` (zoals bij Naar huis) loopt iedereen op volle snelheid.
 */
export function formationMove(
  units: Unit[],
  tx: number,
  ty: number,
  order: 'move' | 'amove' | 'patrol',
  { keepPace = true }: { keepPace?: boolean } = {},
): void {
  const many = units.length > 1;
  const goals = many
    ? formationGoals(
        units.map(u => ({ x: u.x, y: u.y, role: unitRole(UNITS[u.k]) })),
        tx,
        ty,
      )
    : units.map(() => ({ x: tx, y: ty }));
  // Een plek in het water of in een berg? Dan een plek vlakbij, of anders het doel zelf.
  const spots = units.map((u, k) => {
    if (UNITS[u.k].fly) return goals[k];
    return landNear(goals[k].x, goals[k].y) || { x: tx, y: ty };
  });
  // Samen oplopen kan alleen als ze bij elkaar beginnen; verspreid over de kaart loopt ieder op eigen tempo
  const together = many && keepPace && closeTogether(units);
  const paces = together
    ? arrivalPaces(
        units.map((u, k) => ({
          dist: Math.hypot(spots[k].x - u.x, spots[k].y - u.y),
          spd: UNITS[u.k].spd,
        })),
      )
    : units.map(() => 0);
  units.forEach((u, k) => {
    u.tgt = null;
    u.path = null;
    u.order = order;
    u.px = u.x;
    u.py = u.y;
    u.gx = spots[k].x;
    u.gy = spots[k].y;
    u.pace = paces[k];
  });
}

// Een begaanbare plek op of vlak bij (x, y), of null als er binnen twee tegels niets is
function landNear(x: number, y: number): { x: number; y: number } | null {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  if (freeWalk(ix, iy)) return { x, y };
  let best: { x: number; y: number } | null = null,
    bestDist = Infinity;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      if (!freeWalk(ix + dx, iy + dy)) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = { x: ix + dx + 0.5, y: iy + dy + 0.5 };
      }
    }
  return best;
}
