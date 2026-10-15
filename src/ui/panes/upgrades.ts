// Paneel "Onderzoek".
import { store } from '../../core/store';
import { sfx } from '../../audio/sound';
import { AGES } from '../../data/ages';
import { B } from '../../data/buildings';
import { TECH, TK } from '../../data/tech';
import { has, pay } from '../../game/economy';
import { G } from '../../game/state';
import {
  armsCost,
  canUpg,
  hasT,
  toolCost,
  upgCost,
  upgrade,
  upgradeArms,
  upgradeTools,
} from '../../game/upgrades';
import { costHTML, esc } from '../format';
import { setHTML, sigs } from '../header';
import { toast } from '../hud';
import { CB } from '../inspector';
import { $ } from '../../util/dom';

export function renderUpgrades() {
  const up = G.bs.filter(canUpg),
    aff = up.filter(b => has(upgCost(b))),
    types: Record<string, number> = {};
  up.forEach(b => (types[b.type] = (types[b.type] || 0) + 1));
  $('#upgSect').textContent =
    up.length + G.age * 2 - G.toolLvl - G.armsLvl > 0
      ? `${up.length + (G.age - G.toolLvl) + (G.age - G.armsLvl)} open`
      : 'alles bij';
  const sig = JSON.stringify([
    G.age,
    G.toolLvl,
    G.armsLvl,
    has(toolCost()),
    has(armsCost()),
    types,
    aff.length,
    Object.keys(G.tech),
    G.research && [G.research.k, Math.floor(G.research.t / 2)],
    TECH.map(T => (has(T.cost) ? 1 : 0)).join(''),
  ]);
  setHTML($('#upgrades'), 'upg', sig, () => {
    const pips = (l: number, t: number) =>
      `<span class="pips">${Array.from({ length: 6 }, (_, i) => `<i class="${i <= l ? 'on' : i <= t ? 'av' : ''}"></i>`).join('')}</span>`;
    let h = `<div class="cmd">${CB('data-g="tools"', '⚒', `Werktuig ${G.toolLvl + 1}`, { dis: G.toolLvl >= G.age || !has(toolCost()), cost: G.toolLvl < G.age ? costHTML(toolCost()) : '<span class="lk">max</span>', tip: 'Sneller verzamelen, meer dragen' })}${CB('data-g="arms"', '⛨', `Pantser ${G.armsLvl + 1}`, { dis: G.armsLvl >= G.age || !has(armsCost()), cost: G.armsLvl < G.age ? costHTML(armsCost()) : '<span class="lk">max</span>', tip: 'Sterker leger' })}${CB(
      'data-g="all"',
      '▲',
      `Gebouwen (${up.length})`,
      {
        dis: !aff.length,
        tip: up.length
          ? `${aff.length} betaalbaar: ${Object.keys(types)
              .map(k => B[k].n + ' ×' + types[k])
              .join(', ')}`
          : 'Alle gebouwen zijn bij',
      },
    )}</div>
    <div class="lvrow">${pips(G.toolLvl, G.age)}<span>werktuigen</span></div><div class="lvrow">${pips(G.armsLvl, G.age)}<span>wapens en pantser</span></div>`;
    h += `<div class="sect" style="margin-top:16px">Onderzoek <span>${Object.keys(G.tech).length}/${TECH.length}</span></div>`;
    let lastAge = -1;
    for (const T of TECH) {
      if (T.age > G.age + 1) continue;
      if (T.age !== lastAge) {
        h += `<div class="agehd">${AGES[T.age].r} · ${AGES[T.age].n}</div>`;
        lastAge = T.age;
      }
      const done = hasT(T.k),
        run = G.research && G.research.k === T.k,
        lock = T.age > G.age,
        can = !done && !run && !lock && !G.research && has(T.cost);
      h += `<button class="tech ${done ? 'done' : run ? 'run' : lock ? 'lock' : ''}" data-tech="${T.k}" ${can ? '' : 'disabled'} title="${esc(T.d)}"><span class="g">${done ? '✓' : T.g}</span><b>${T.n}</b><span class="d">${T.d}</span>${done ? '' : run ? `<div class="bar acc"><i style="width:${(G.research!.t / T.t) * 100}%"></i></div>` : lock ? `<span class="d">Vanaf de ${AGES[T.age].n.toLowerCase()}</span>` : costHTML(T.cost)}</button>`;
    }
    return h;
  });
}
$('#upgrades').addEventListener('click', e => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t || t.disabled) return;
  sfx('tick');
  if (t.dataset.tech) {
    const T = TK[t.dataset.tech];
    if (!G.research && has(T.cost)) {
      pay(T.cost);
      G.research = { k: T.k, t: 0 };
      toast(`Onderzoek gestart: ${T.n} (${T.t}s).`);
    }
    sigs.upg = null;
    store.uiDirty = true;
    return;
  }
  if (t.dataset.g === 'tools') upgradeTools();
  else if (t.dataset.g === 'arms') upgradeArms();
  else if (t.dataset.g === 'all') {
    let n = 0;
    for (const b of G.bs
      .filter(canUpg)
      .sort(
        (a, c) =>
          Object.values(upgCost(a)).reduce((x, y) => x + y, 0) -
          Object.values(upgCost(c)).reduce((x, y) => x + y, 0),
      ))
      if (upgrade(b, true)) n++;
    toast(
      n ? `${n} ${n === 1 ? 'gebouw' : 'gebouwen'} verbeterd.` : 'Te weinig grondstoffen.',
      n ? 'good' : 'bad',
    );
  }
  sigs.upg = null;
  store.uiDirty = true;
});
