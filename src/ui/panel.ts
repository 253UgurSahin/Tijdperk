// Het zijpaneel (Volk / Leger / Onderzoek / Logboek).
import { sfx } from '../audio/sound';
import { B } from '../data/buildings';
import { G } from '../game/state';
import { measureHud } from '../main';
import { renderChart } from './panes/log';
import { $ } from '../util/dom';

// Zijpaneel (Volk / Leger / Onderzoek / Logboek)
let ptab = null;
const PT = { pop: 'Volk', def: 'Leger', upg: 'Onderzoek', log: 'Logboek' };
function setPane(k: string | null) {
  ptab = k;
  if (k) document.body.classList.remove('showmap', 'showgoal');
  $('#panel').hidden = !k;
  document.body.classList.toggle('panelopen', !!k);
  document.querySelectorAll('#sidebtns button').forEach(b => b.classList.toggle('on', b.dataset.p === k));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === k));
  if (k) $('#panelTitle').textContent = PT[k];
  renderChart();
}
$('#sidebtns').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  sfx('tick');
  // Kaart en Doel zijn alleen op telefoon/tablet zichtbaar; ze klappen iets open in plaats van een paneel
  if (b.dataset.p === 'map') togglePanel('map');
  else if (b.dataset.p === 'goal') togglePanel('goal');
  else setPane(ptab === b.dataset.p ? null : b.dataset.p);
  markMobileButtons();
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
  vis.map = vis.goal = 1;
  document.querySelectorAll('#sidebtns button').forEach(b => {
    b.hidden = !vis[b.dataset.p];
  });
  markMobileButtons();
  if (ptab && !vis[ptab]) setPane(null);
  const s4 = document.querySelector('#speed [data-s="4"]');
  s4.hidden = !(G.age >= 1 || G.day >= 3 || G.speed === 4);
}
// Laat zien of de kaart of het doel open staat
function markMobileButtons() {
  const body = document.body.classList;
  document.querySelector('#sidebtns [data-p="map"]').classList.toggle('on', body.contains('showmap'));
  document.querySelector('#sidebtns [data-p="goal"]').classList.toggle('on', body.contains('showgoal'));
}

// Op telefoon/tablet staat er steeds maar één ding open: een paneel, de kaart of het doel
export function togglePanel(side: string) {
  const body = document.body.classList;
  if (side === undefined) {
    setPane(null);
    body.remove('showmap');
    markMobileButtons();
    return;
  }
  if (side === 'left') setPane(ptab ? null : 'pop');
  else if (side === 'goal') {
    const open = !body.contains('showgoal');
    body.toggle('showgoal', open);
    if (open) {
      body.remove('showmap');
      setPane(null);
    }
    measureHud();
  } else {
    const open = !body.contains('showmap');
    body.toggle('showmap', open);
    if (open) {
      body.remove('showgoal');
      setPane(null);
      measureHud();
    }
  }
  markMobileButtons();
}
