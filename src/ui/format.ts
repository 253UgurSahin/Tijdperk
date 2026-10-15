import type { Cost } from '../types';
// Hulpjes om getallen, kosten en pictogrammen als HTML te tonen.
import { AGES } from '../data/ages';
import { RES } from '../data/resources';
import { G } from '../game/state';

export const fmt = (n: number): string => {
  n = Math.floor(n);
  return n >= 100000
    ? Math.round(n / 1000) + 'k'
    : n >= 10000
      ? (n / 1000).toFixed(1) + 'k'
      : n.toLocaleString('nl-NL');
};
const SHAPE: Record<string, string> = {
  food: 'circle(50%)',
  wood: 'polygon(50% 0,100% 88%,0 88%)',
  stone: 'polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)',
  copper: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  tin: 'inset(8% round 2px)',
  bronze: 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)',
  iron: 'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',
  gold: 'polygon(50% 0,62% 35%,100% 36%,69% 58%,80% 95%,50% 73%,20% 95%,31% 58%,0 36%,38% 35%)',
  coal: 'polygon(22% 0,100% 22%,78% 100%,0 78%)',
  steel: 'polygon(0 22%,100% 22%,100% 78%,0 78%)',
  oil: 'polygon(50% 0,86% 55%,78% 88%,50% 100%,22% 88%,14% 55%)',
  sand: 'polygon(18% 28%,82% 28%,100% 92%,0 92%)',
  fuel: 'polygon(0 8%,100% 8%,50% 100%)',
  silicon: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)',
  lithium:
    'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)',
  chips: 'polygon(0 0,100% 0,100% 100%,0 100%,0 62%,22% 62%,22% 38%,0 38%)',
  battery: 'polygon(38% 0,62% 0,62% 14%,86% 14%,86% 100%,14% 100%,14% 14%,38% 14%)',
};
export const gem = (k: string): string =>
  `<i class="gem" style="--c:${RES[k].c};--clip:${SHAPE[k] || 'none'}"></i>`;
export const hy = (s: string): string =>
  String(s).replace(
    /^(.{4,}?)(woning|menten|lantaarn|fabriek|batterij|centrum|gieterij|centrale|afweer|plaats|toren|koepel|schutter|drager|drone|hangar|punt|werker|pand|soldaat|werper|molen|poort|smidse|reactor|werf|fort|wagen|vechter|centrum|wapen|seum|station|werken)$/i,
    '$1\u00AD$2',
  );
export const TOUCH = matchMedia('(pointer:coarse)').matches;
// Kort getal voor op een kleine tegel: 1200 wordt "1,2k", 15000 wordt "15k"
export const fmtShort = n => {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'k';
  return Math.round(n / 1000) + 'k';
};
// Kosten als rijtje fiches. Met "tight" worden de getallen kort, zodat ze op een tegel passen.
export function costHTML(c, tight = false) {
  return (
    `<span class="cost${tight ? ' tight' : ''}">` +
    Object.keys(c)
      .map(k => {
        const short = G && G.res[k] < c[k] ? 'no' : '';
        const label = `${RES[k].n}: ${c[k]}${short ? ' (te weinig)' : ''}`;
        return `<span class="${short}" title="${label}">${gem(k)}${tight ? fmtShort(c[k]) : fmt(c[k])}</span>`;
      })
      .join('') +
    '</span>'
  );
}
export const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// De tijdlijn: één kraal per tijdperk. Voorbij = gevuld, nu = groot, nog te komen = open.
export function ageTimeline(cur, big = false) {
  const beads = AGES.map((a, i) => {
    const state = i < cur ? 'done' : i === cur ? 'now' : 'next';
    return `<li class="${state}" style="--c:${a.acc}" title="${a.n} · ${a.y}"><span>${big ? a.r : ''}</span></li>`;
  });
  return `<ol class="tl${big ? ' big' : ''}" aria-label="Tijdlijn van de tijdperken">${beads.join('')}</ol>`;
}

/*
 * Vergelijking "nu → straks" voor een verbetering, als tabelletje.
 * rows = [[naam, nu, straks], ...] (zie upgradeRows in game/upgrades.js).
 */
export function compareHTML(rows) {
  return (
    '<table class="cmp"><tbody>' +
    rows
      .map(
        ([n, a, b]) =>
          `<tr><th>${n}</th><td>${a}</td><td class="arr" aria-label="wordt">→</td><td class="nx">${b}</td></tr>`,
      )
      .join('') +
    '</tbody></table>'
  );
}
/** Dezelfde vergelijking als korte tekst, voor in een tooltip. */
export const compareText = rows => rows.map(([n, a, b]) => `${n}: ${a} → ${b}`).join(' · ');
