// Hulpjes om getallen, kosten en pictogrammen als HTML te tonen.
import { RES } from '../data/resources.js';
import { G } from '../game/state.js';

export const fmt = n => {
  n = Math.floor(n);
  return n >= 100000
    ? Math.round(n / 1000) + 'k'
    : n >= 10000
      ? (n / 1000).toFixed(1) + 'k'
      : n.toLocaleString('nl-NL');
};
const SHAPE = {
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
export const gem = k => `<i class="gem" style="--c:${RES[k].c};--clip:${SHAPE[k] || 'none'}"></i>`;
export const hy = s =>
  String(s).replace(
    /^(.{4,}?)(woning|menten|lantaarn|fabriek|batterij|centrum|gieterij|centrale|afweer|plaats|toren|koepel|schutter|drager|drone|hangar|punt|werker)$/i,
    '$1\u00AD$2',
  );
export const TOUCH = matchMedia('(pointer:coarse)').matches;
export function costHTML(c) {
  return (
    '<span class="cost">' +
    Object.keys(c)
      .map(
        k => `<span class="${G && G.res[k] < c[k] ? 'no' : ''}" title="${RES[k].n}">${gem(k)}${c[k]}</span>`,
      )
      .join('') +
    '</span>'
  );
}
export const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
