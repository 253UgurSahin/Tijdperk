// Het zijpaneel (Volk / Leger / Onderzoek / Logboek).
import { sfx } from '../audio/sound.js';
import { B } from '../data/buildings.js';
import { G } from '../game/state.js';
import { measureHud } from '../main.js';
import { renderChart } from './panes/log.js';
import { $ } from '../util/dom.js';

// Zijpaneel (Volk / Leger / Onderzoek / Logboek)
let ptab = null;
const PT = { pop: 'Volk', def: 'Leger', upg: 'Onderzoek', log: 'Logboek' };
function setPane(k) {
  ptab = k;
  $('#panel').hidden = !k;
  document.body.classList.toggle('panelopen', !!k);
  document.querySelectorAll('#sidebtns button').forEach(b => b.classList.toggle('on', b.dataset.p === k));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === k));
  if (k) $('#panelTitle').textContent = PT[k];
  renderChart();
}
$('#sidebtns').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) {
    sfx('tick');
    setPane(ptab === b.dataset.p && innerWidth > 900 ? null : b.dataset.p);
  }
});
$('#panelClose').onclick = () => {
  sfx('tick');
  setPane(null);
};
export function updateTabs() {
  const vis = {
    pop: 1,
    def:
      G.us.length ||
      G.raids > 0 ||
      G.bs.some(b => b.type === 'barracks' || (B[b.type].def && b.type !== 'townhall')) ||
      G.foes.some(f => !f.camp),
    upg: G.age >= 1 || G.day >= 3 || Object.keys(G.tech).length,
    log: G.day >= 2,
  };
  document.querySelectorAll('#sidebtns button').forEach(b => {
    b.hidden = !vis[b.dataset.p];
  });
  if (ptab && !vis[ptab]) setPane(null);
  const s4 = document.querySelector('#speed [data-s="4"]');
  s4.hidden = !(G.age >= 1 || G.day >= 3 || G.speed === 4);
}
export function togglePanel(side) {
  if (side === undefined) {
    setPane(null);
    document.body.classList.remove('showmap');
    return;
  }
  if (side === 'left') setPane(ptab ? null : 'pop');
  else if (side === 'goal') {
    document.body.classList.toggle('showgoal');
    measureHud();
  } else document.body.classList.toggle('showmap');
}
