// De "coach": kiest steeds één duidelijke volgende stap voor de speler.
import { AGES, AGE_UP } from '../data/ages.js';
import { B, BKEYS } from '../data/buildings.js';
import { GATHER, RES } from '../data/resources.js';
import { avail } from '../game/caches.js';
import { built } from '../game/chapters.js';
import { popCap, popNow } from '../game/entities.js';
import { G } from '../game/state.js';
import { hoursUntilRaid, isNight } from '../game/time.js';
import { fmt } from './format.js';
import { canMake } from '../data/succession.js';

export const placed = k => G.bs.some(b => b.type === k);
function bestHouse() {
  return BKEYS.filter(k => B[k].pop && k !== 'townhall' && !B[k].nobuild && canMake(k, G.age)).sort(
    (a, b) => B[b].age - B[a].age,
  )[0];
}
export function lackList(nx) {
  const out = [];
  for (const k in nx.cost)
    if (G.res[k] < nx.cost[k]) out.push(`${fmt(Math.ceil(nx.cost[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
  for (const n of nx.need) if (!built(n)) out.push(`een ${B[n].n.toLowerCase()}`);
  if (popNow() < nx.pop) out.push(`${nx.pop - popNow()} inwoners`);
  return out;
}
export const andJoin = a =>
  a.length > 2 ? a.slice(0, 2).join(', ') + ' en meer' : a.length === 2 ? a[0] + ' en ' + a[1] : a[0] || '';
const bAct = k => ({ l: 'Bouw ' + B[k].n.toLowerCase(), b: k });
const expandAct = r => ({ l: 'Gebied uitbreiden', k: 'expand', r });

// Waar komt grondstof k vandaan? Geeft een stap terug als de speler er iets voor moet doen.
// `left` is hoeveel er nog nodig is, `goal` waarvoor (bijv. "de bronstijd").
function sourceStep(k, left, goal, depth = 0) {
  const name = RES[k].n.toLowerCase();
  // Sterrenmetaal kun je niet zomaar vinden: het valt als meteoriet uit de lucht
  if (k === 'starmetal' && !avail.starmetal)
    return {
      t: 'Wacht op een meteoriet.',
      h: `Sterrenmetaal komt uit meteorieten: na een inslag ligt het rond de krater. Verderop liggen ook oude inslagen; breid uit om erbij te kunnen. Nog ${left} nodig voor ${goal}.`,
      act: expandAct(k),
    };
  if (GATHER.includes(k) && !avail[k])
    return {
      t: 'Breid je gebied uit.',
      h: `Er ligt nog geen ${name} binnen je grenzen. Je hebt er nog ${left} nodig voor ${goal}.`,
      act: expandAct(k),
    };
  // Olie verzamel je niet met de hand: daar is een oliepomp op een oliebron voor
  if (k === 'oil') {
    if (!avail.oil)
      return {
        t: 'Zoek een oliebron.',
        h: 'Olie zit onder woestijnen en kusten. Breid je gebied uit tot er een oliebron in ligt.',
        act: expandAct(k),
      };
    if (!placed('oilpump'))
      return {
        t: 'Plaats een oliepomp.',
        h: `${B.oilpump.desc} De raffinaderij maakt er brandstof van.`,
        tile: 'oilpump',
        act: bAct('oilpump'),
      };
    return null;
  }
  if (!RES[k].cr || depth > 2) return null;
  const mk = BKEYS.find(b => B[b].conv && B[b].conv.out[k]);
  if (!mk) return null;
  if (!placed(mk))
    return {
      t: `Bouw een ${B[mk].n.toLowerCase()}.`,
      h: `Daar maak je ${name}, nodig voor ${goal}.${B[mk].desc ? ' ' + B[mk].desc : ''}`,
      tile: mk,
      act: bAct(mk),
    };
  // Wacht de fabriek op iets dat je eerst moet regelen? Dan dát als stap.
  const inp = Object.keys(B[mk].conv.in).filter(r => G.res[r] < 5);
  for (const r of inp) {
    const step = sourceStep(r, 'wat', goal, depth + 1);
    if (step) return step;
  }
  return {
    t: `Nog ${left} ${name} nodig.`,
    h: inp.length
      ? `De ${B[mk].n.toLowerCase()} wacht op ${inp.map(r => RES[r].n.toLowerCase()).join(' en ')}.`
      : `De ${B[mk].n.toLowerCase()} maakt het vanzelf. Een tweede ${B[mk].n.toLowerCase()} gaat twee keer zo snel.`,
  };
}
export function coach() {
  const nx = AGE_UP[G.age + 1],
    NA = nx && AGES[G.age + 1].n.toLowerCase(),
    pn = popNow(),
    cap = popCap();
  const raid = G.foes.filter(f => !f.camp && !f.retreat).length;
  if (raid)
    return {
      t: 'Aanval!',
      h: `${raid} vijanden in je land. Je dorpelingen schuilen. Torens en soldaten verdedigen.`,
      act: { l: 'Bekijk de aanval', k: 'alarm' },
    };
  const lit = G.bs.some(b => b.type !== 'townhall' && B[b.type].light && !B[b.type].gen);
  const dark = G.vs.filter(v => v.state === 'sleep' || (v.state === 'walk' && v.on === 'sleep')).length;
  const lamp = BKEYS.find(k => B[k].cat === 'light' && B[k].light && !B[k].gen && canMake(k, G.age));
  if (isNight() && dark && !lit && lamp)
    return {
      t: `Het is donker: ${dark} ${dark === 1 ? 'dorpeling stopt' : 'dorpelingen stoppen'} met werken.`,
      h: `Bij een ${B[lamp].n.toLowerCase()} werken ze ’s nachts door. Zet het bij de bomen of akkers.`,
      tile: lamp,
      act: bAct(lamp),
    };
  const hrs = hoursUntilRaid();
  if (!G.peaceful && hrs != null && hrs < 7.5) {
    const def = G.bs.some(b => b.type !== 'townhall' && B[b.type].def);
    const bar = G.bs.find(b => b.type === 'barracks' && b.done);
    if (!def && G.us.length < 3) {
      if (bar)
        return {
          t: 'Vannacht komt een aanval.',
          h: 'Train een paar soldaten in de kazerne, of bouw een toren bij het stamhuis.',
          act: { l: 'Naar de kazerne', k: 'sel', id: bar.id },
        };
      const tw = BKEYS.filter(k => B[k].def && B[k].cat === 'mil' && !B[k].nobuild && canMake(k, G.age)).sort(
        (a, b) => B[b].age - B[a].age,
      )[0];
      if (tw)
        return {
          t: 'Vannacht komt een aanval.',
          h: `Bouw een ${B[tw].n.toLowerCase()} bij het stamhuis om je dorp te verdedigen.`,
          tile: tw,
          act: bAct(tw),
        };
    }
  }
  if (G.age === 0) {
    if (!placed('hut'))
      return {
        t: 'Bouw een hut.',
        h: `Je stam zit vol (${pn}/${cap}). Met een hut is er plek voor nieuwe dorpelingen.`,
        tile: 'hut',
        act: bAct('hut'),
      };
    if (!placed('farm'))
      return {
        t: 'Leg een akker aan.',
        h: 'Een akker geeft voedsel dat nooit opraakt.',
        tile: 'farm',
        act: bAct('farm'),
      };
    if (!placed('storage'))
      return {
        t: 'Bouw een opslagplaats.',
        h: 'Zet hem bij de bomen: dan lopen je dorpelingen minder ver. Nodig voor de bronstijd.',
        tile: 'storage',
        act: bAct('storage'),
      };
    if (!placed('campfire'))
      return {
        t: 'Steek een kampvuur aan.',
        h: 'In het licht werken dorpelingen ook ’s nachts door.',
        tile: 'campfire',
        act: bAct('campfire'),
      };
    if (!G.peaceful && !placed('barracks'))
      return {
        t: 'Bouw een kazerne.',
        h: 'Vanaf de tweede nacht vallen vijanden aan. In de kazerne train je verdedigers.',
        tile: 'barracks',
        act: bAct('barracks'),
      };
  }
  if (!nx) {
    if (!placed('stargate')) {
      const cost = B.stargate.cost;
      for (const k in cost) {
        if (G.res[k] >= cost[k]) continue;
        const step = sourceStep(k, fmt(Math.ceil(cost[k] - G.res[k])), 'de sterrenpoort');
        if (step) return step;
      }
      const miss = Object.keys(cost)
        .filter(k => G.res[k] < cost[k])
        .map(k => `${fmt(Math.ceil(cost[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
      return {
        t: 'Bouw de sterrenpoort.',
        h: miss.length
          ? `Daarmee voltooi je je beschaving. Nog ${andJoin(miss)} nodig.`
          : 'Daarmee voltooi je je beschaving.',
        tile: 'stargate',
        act: bAct('stargate'),
      };
    }
    return {
      t: G.won ? 'Je beschaving is voltooid.' : 'De sterrenpoort wordt gebouwd.',
      h: G.won ? 'Bouw gerust verder.' : 'Nog even geduld.',
    };
  }
  for (const n of nx.need)
    if (!placed(n)) {
      // Kun je het gebouw nog niet betalen? Zeg dan eerst waar de ontbrekende grondstof vandaan komt.
      const cost = B[n].cost;
      for (const k in cost) {
        if (G.res[k] >= cost[k]) continue;
        const step = sourceStep(k, fmt(Math.ceil(cost[k] - G.res[k])), `een ${B[n].n.toLowerCase()}`);
        if (step) return step;
      }
      return {
        t: `Bouw een ${B[n].n.toLowerCase()}.`,
        h: `Nodig voor de ${NA}.${B[n].desc ? ' ' + B[n].desc : ''}`,
        tile: n,
        act: bAct(n),
      };
    }
  if (pn < nx.pop && pn >= cap) {
    const h = bestHouse();
    return {
      t: `Bouw een ${B[h].n.toLowerCase()}.`,
      h: `Er is geen plek voor meer inwoners (${pn}/${cap}). De ${NA} vraagt er ${nx.pop}.`,
      tile: h,
      act: bAct(h),
    };
  }
  for (const k in nx.cost) {
    if (G.res[k] >= nx.cost[k]) continue;
    const step = sourceStep(k, fmt(Math.ceil(nx.cost[k] - G.res[k])), `de ${NA}`);
    if (step) return step;
  }
  if (pn < nx.pop)
    return {
      t: `Je stam groeit: ${pn} van ${nx.pop} inwoners.`,
      h: G.autoTrain
        ? 'Het stamhuis traint vanzelf dorpelingen zolang er voedsel is.'
        : 'Train dorpelingen in het stamhuis.',
    };
  const miss = lackList(nx);
  if (miss.length)
    return {
      t: `Op weg naar de ${NA}.`,
      h: `Nog ${andJoin(miss)} nodig. Je dorpelingen verzamelen vanzelf.`,
    };
  return {
    t: `Klaar voor de ${NA}!`,
    h: 'Alles is binnen. Zet de stap naar een nieuw tijdperk.',
    act: { l: `Naar de ${NA}`, k: 'age' },
  };
}
