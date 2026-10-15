import type { AgeUpDef, CoachAct, Foe } from '../types';
// De "coach": kiest steeds één duidelijke volgende stap voor de speler.
import { AGES, AGE_UP } from '../data/ages';
import { B, BKEYS } from '../data/buildings';
import { GATHER, RES } from '../data/resources';
import { avail } from '../game/caches';
import { built } from '../game/chapters';
import { popCap, popNow } from '../game/entities';
import { compass, isMarching, isRaider } from '../game/military';
import { arrivalHour, clockText, rivalById } from '../game/rivals';
import { RIVAL, verb } from '../data/rivals';
import { ruleAllowsBuilding } from '../game/mods';
import { G } from '../game/state';
import { hoursUntilRaid, isNight } from '../game/time';
import { fmt } from './format';
import { VICTORY } from '../data/victories';
import { victoryGoals } from '../game/victory';
import { canMake } from '../data/succession';
import { bossForAge, bossName } from '../data/bosses';
import { chargeFrac, chargePercent, nightsLeft } from '../data/finale';
import { liveBoss } from '../game/bosses';
import { finishedGate, gateHealth, isCharging } from '../game/finale';

export const placed = (k: string): boolean => G.bs.some(b => b.type === k);
function bestHouse() {
  return BKEYS.filter(k => B[k].pop && k !== 'townhall' && !B[k].nobuild && canMake(k, G.age)).sort(
    (a, b) => B[b].age - B[a].age,
  )[0];
}
export function lackList(nx: AgeUpDef): string[] {
  const out: string[] = [];
  for (const k in nx.cost)
    if (G.res[k] < nx.cost[k]) out.push(`${fmt(Math.ceil(nx.cost[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
  for (const n of nx.need) if (!built(n)) out.push(`een ${B[n].n.toLowerCase()}`);
  if (popNow() < nx.pop) out.push(`${nx.pop - popNow()} inwoners`);
  return out;
}
export const andJoin = (a: string[]): string =>
  a.length > 2 ? a.slice(0, 2).join(', ') + ' en meer' : a.length === 2 ? a[0] + ' en ' + a[1] : a[0] || '';
const bAct = (k: string): CoachAct => ({ l: 'Bouw ' + B[k].n.toLowerCase(), b: k });
const expandAct = (r: string): CoachAct => ({ l: 'Gebied uitbreiden', k: 'expand', r });

/** Eén stap van de coach: titel, uitleg, eventueel een gebouw om aan te wijzen, een knop en alarm. */
interface CoachStep {
  t: string;
  h: string;
  tile?: string;
  /** De knop; leeg (of null) = geen knop. */
  act?: CoachAct | null;
  alarm?: boolean;
}

// Waar komt grondstof k vandaan? Geeft een stap terug als de speler er iets voor moet doen.
// `left` is hoeveel er nog nodig is, `goal` waarvoor (bijv. "de bronstijd").
function sourceStep(k: string, left: string, goal: string, depth = 0): CoachStep | null {
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
  // (mk is hierboven gevonden omdat hij iets maakt, dus conv bestaat zeker)
  const inp = Object.keys(B[mk].conv!.in).filter(r => G.res[r] < 5);
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
// Een aanval tijdens de finale: de poort moet heel blijven, dus laat zien hoe hij ervoor staat
function finaleRaidStep(raid: number, boss: Foe | null): CoachStep {
  const gate = finishedGate(),
    health = gateHealth();
  // (een kampioen in het veld hoort altijd bij een tijdperk met een kampioen: zie makeBoss)
  const led = boss ? `, geleid door ${bossName(bossForAge(boss.boss)!)},` : '';
  const left = health ? ` De poort is nog ${Math.round((health.hp / health.max) * 100)}% heel.` : '';
  return {
    t: 'Verdedig de sterrenpoort!',
    h: `${raid} vijanden${led} vallen aan.${left} Herstel hem op tijd met de knop op de balk bovenaan.`,
    act: gate ? { l: 'Bekijk de poort', k: 'sel', id: gate.id } : { l: 'Bekijk de aanval', k: 'alarm' },
    alarm: true,
  };
}
export function coach(): CoachStep {
  const nx = AGE_UP[G.age + 1],
    NA = nx && AGES[G.age + 1].n.toLowerCase(),
    pn = popNow(),
    cap = popCap();
  const raid = G.foes.filter(isRaider).length;
  const boss = liveBoss();
  if (raid && isCharging()) return finaleRaidStep(raid, boss);
  // (een kampioen in het veld hoort altijd bij een tijdperk met een kampioen: zie makeBoss)
  if (raid && boss)
    return {
      t: `Aanval, geleid door ${bossName(bossForAge(boss.boss)!)}!`,
      h: `${raid} vijanden in je land. Versla de kampioen met je hele leger: dat levert een extra zegening op.`,
      act: { l: 'Bekijk de aanval', k: 'alarm' },
      alarm: true,
    };
  if (raid)
    return {
      t: 'Aanval!',
      h: `${raid} vijanden in je land. Je dorpelingen schuilen. Torens en soldaten verdedigen.`,
      act: { l: 'Bekijk de aanval', k: 'alarm' },
      alarm: true,
    };
  const marching = G.foes.filter(isMarching);
  if (marching.length) return marchStep(marching);
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
    // Zonder leger (spelregel van een uitdaging) is er geen kazerne om te bouwen
    if (!G.peaceful && ruleAllowsBuilding('barracks') && !placed('barracks'))
      return {
        t: 'Bouw een kazerne.',
        h: 'Vanaf de tweede nacht vallen vijanden aan. In de kazerne train je verdedigers.',
        tile: 'barracks',
        act: bAct('barracks'),
      };
  }
  if (!nx) return lastAgeStep();
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

// Soldaten van een rivaal zijn onderweg naar je stad: wie, hoeveel, uit welke richting en hoe laat
function marchStep(marching: Foe[]): CoachStep {
  const lead = marching[0],
    r = rivalById(lead.rival),
    n = marching.length;
  const oneRival = r && marching.every(f => f.rival === lead.rival);
  const who = oneRival ? `${RIVAL[r.k].n} ${verb(RIVAL[r.k], 'is', 'zijn')}` : 'Rivalen zijn';
  const soldiers = `${n} ${n === 1 ? 'soldaat' : 'soldaten'}`;
  const when = clockText(arrivalHour(marching));
  return {
    t: 'Aanval op komst!',
    h: `${who} onderweg: ${soldiers} uit het ${compass(lead.x, lead.y)}, rond ${when} hier.`,
    act: { l: 'Bekijk ze', k: 'alarm' },
    alarm: true,
  };
}

/** De stap in het laatste tijdperk: de sterrenpoort bouwen, of het doel dat nog over is. */
function lastAgeStep(): CoachStep {
  // In een uitdaging telt alleen het doel van de uitdaging, niet de sterrenpoort
  if (G.scenario && G.won) return { t: 'Uitdaging gehaald.', h: 'Bouw gerust verder.' };
  const stargateGoal = G.opts.victories.includes('stargate');
  // Echt klaar: gewonnen met de sterrenpoort, of met een ander doel als de sterrenpoort niet meetelt
  if (G.won && (VICTORY[G.wonBy]?.full || !stargateGoal))
    return { t: 'Je hebt gewonnen.', h: 'Bouw gerust verder.' };
  if (!stargateGoal) {
    // Winnen met de sterrenpoort staat uit: wijs naar het doel dat nog over is (zoals overleven)
    const goal = victoryGoals().find(g => g.frac < 1);
    return {
      t: goal ? `${goal.v.d}.` : 'Bouw gerust verder.',
      h: `${goal ? `Nu: ${goal.text}. ` : ''}Winnen met de sterrenpoort staat uit in deze wereld.`,
    };
  }
  if (isCharging()) {
    // De finale: de poort laadt op en moet heel blijven tot de zon opkomt
    const gate = finishedGate();
    const act: CoachAct | null = gate ? { l: 'Bekijk de poort', k: 'sel', id: gate.id } : null;
    const percent = chargePercent(chargeFrac(G.finale));
    // isCharging() hierboven: dan is er zeker een finale
    const nights = nightsLeft(G.clock, G.finale!.need - G.finale!.hours, G.finale!.hours);
    // In de vredige modus komen er geen aanvallen: dan is er niets te verdedigen
    if (G.peaceful) {
      const when = nights > 1 ? `Bij zonsopgang na ${nights} nachten` : 'Bij de volgende zonsopgang';
      return {
        t: `De sterrenpoort laadt op: ${percent}%`,
        h: `${when} gaat hij open. Bouw gerust verder.`,
        act,
      };
    }
    const hold = nights > 1 ? `Houd nog ${nights} nachten stand.` : 'Houd stand tot zonsopgang.';
    return {
      t: `Verdedig de sterrenpoort: ${percent}% opgeladen.`,
      h: `${hold} Wordt hij verwoest, dan begint het opladen opnieuw. Herstel hem op tijd met de knop op de balk bovenaan.`,
      act,
    };
  }
  if (built('stargate')) return { t: 'De sterrenpoort staat.', h: 'Bouw gerust verder.' };
  if (placed('stargate')) return { t: 'De sterrenpoort wordt gebouwd.', h: 'Nog even geduld.' };
  const cost = B.stargate.cost;
  for (const k in cost) {
    if (G.res[k] >= cost[k]) continue;
    const step = sourceStep(k, fmt(Math.ceil(cost[k] - G.res[k])), 'de sterrenpoort');
    if (step) return step;
  }
  const miss = Object.keys(cost)
    .filter(k => G.res[k] < cost[k])
    .map(k => `${fmt(Math.ceil(cost[k] - G.res[k]))} ${RES[k].n.toLowerCase()}`);
  // Al gewonnen met een kort doel? Dan telt de sterrenpoort nog voor de prestaties (zie game/victory.ts)
  const why = G.won ? 'Dan telt je winst ook voor de prestaties.' : 'Daarmee voltooi je je beschaving.';
  return {
    t: 'Bouw de sterrenpoort.',
    h: miss.length ? `${why} Nog ${andJoin(miss)} nodig.` : why,
    tile: 'stargate',
    act: bAct('stargate'),
  };
}
