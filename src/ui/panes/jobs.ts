// Paneel "Volk": hoeveel dorpelingen welk werk doen.
import { store } from '../../core/store';
import { B } from '../../data/buildings';
import { GATHER, RES } from '../../data/resources';
import { avail, computeCaches } from '../../game/caches';
import { popCap, popNow, trainCost } from '../../game/entities';
import { G } from '../../game/state';
import { selectIdle } from '../../input/input';
import { resetV } from '../../input/selection';
import { costHTML, gem } from '../format';
import { setHTML, sigs } from '../header';
import { CB } from '../inspector';
import { $ } from '../../util/dom';

export function renderJobs() {
  const counts = { auto: 0, build: 0 };
  for (const v of G.vs) counts[v.job] = (counts[v.job] || 0) + 1;
  const rows = ['build', ...GATHER.filter(r => RES[r].age <= G.age)],
    inside = G.vs.filter(v => v.hidden).length;
  $('#popSect').textContent = `${G.vs.length} dorpelingen`;
  const sig = JSON.stringify([
    counts,
    rows,
    G.autoTrain,
    G.training,
    G.trainQ,
    popNow(),
    popCap(),
    G.res.food >= trainCost(),
    inside,
    Object.keys(avail).join(),
  ]);
  const adv = G.age >= 1 || G.vs.length >= 12;
  setHTML(
    $('#jobs'),
    'jobs',
    sig + adv,
    () => `<div class="jobrow auto"><i class="gem" style="--c:#cfc6b0"></i><span>Werken vanzelf</span><span></span><b>${counts.auto}</b><span></span></div>
    ${
      !adv
        ? ''
        : rows
            .map(r => {
              const c = counts[r] || 0,
                col = r === 'build' ? '#d9773a' : RES[r].c,
                n = r === 'build' ? 'Bouwers' : RES[r].n,
                av = r === 'build' || avail[r];
              return `<div class="jobrow">${r === 'build' ? `<i class="gem" style="--c:${col}"></i>` : gem(r)}<span class="${av ? '' : 'na'}">${n}</span><button data-minus="${r}" ${c ? '' : 'disabled'} aria-label="Minder ${n}">−</button><b>${c}</b><button data-plus="${r}" ${counts.auto ? '' : 'disabled'} aria-label="Meer ${n}">+</button></div>`;
            })
            .join('')
    }${adv ? '' : '<p class="why" style="margin:6px 0 0">Je dorpelingen kiezen zelf het werk dat het hardst nodig is.</p>'}
    <div class="cmd" style="margin-top:10px">${CB('data-act="train"', '☺', 'Trainen', { dis: !(popNow() < popCap() && G.res.food >= trainCost()), cost: costHTML({ food: trainCost() }), tip: 'Train een dorpeling in het stamhuis' })}${adv ? CB('data-act="idle"', '☉', 'Zonder werk', { tip: 'Selecteer wie niets doet' }) + CB('data-act="auto"', '↻', G.autoTrain ? 'Vanzelf trainen: aan' : 'Vanzelf trainen: uit', { on: G.autoTrain, tip: 'Het stamhuis traint vanzelf dorpelingen als er voedsel en plek is' }) : ''}</div>
    <div class="statline ${popNow() >= popCap() && G.bs.some(b => b.type !== 'townhall' && B[b.type].pop && b.done) ? 'warn' : ''}"><i class="dot"></i>${popNow() >= popCap() ? (G.bs.some(b => b.type !== 'townhall' && B[b.type].pop) ? 'Vol: bouw meer woningen' : 'Bouw een hut voor meer inwoners') : G.training ? `Traint${G.trainQ ? ` · ${G.trainQ} in wachtrij` : ''}` : `${inside ? inside + ' binnen · ' : ''}${G.vs.filter(v => !v.hidden && v.state === 'idle').length} stilstaand`}</div>`,
  );
}
$('#jobs').addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.plus) {
    const v = G.vs
      .filter(v => v.job === 'auto')
      .sort((a, b) => (a.carry.amt ? 1 : 0) - (b.carry.amt ? 1 : 0))[0];
    if (v) {
      v.job = t.dataset.plus;
      resetV(v);
    }
  } else if (t.dataset.minus) {
    const v = G.vs.find(v => v.job === t.dataset.minus);
    if (v) {
      v.job = 'auto';
      resetV(v);
    }
  } else if (t.dataset.act === 'train') G.trainQ++;
  else if (t.dataset.act === 'idle') selectIdle();
  else if (t.dataset.act === 'auto') G.autoTrain = !G.autoTrain;
  sigs.jobs = null;
  computeCaches();
  store.uiDirty = true;
});
