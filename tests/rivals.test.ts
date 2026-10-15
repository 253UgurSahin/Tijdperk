// Tests voor rivalen: kloppen namen, kleuren, bouwlijsten en getallen, en wonen ze ver genoeg weg?
import { describe, expect, it } from 'vitest';
import { AGES, AGE_UP } from '../src/data/ages';
import { B } from '../src/data/buildings';
import { RES } from '../src/data/resources';
import {
  BUILD_ORDER,
  DEFAULT_RIVALS,
  MAX_RIVALS,
  PERSONALITIES,
  PERSONALITY,
  RIVALS,
  RIVAL_DIFF,
  ageUpValue,
  armyPower,
  armyToAttack,
  attackSize,
  buildOrder,
  cleanRivalCount,
  costValue,
  giftFor,
  homeGuard,
  maxChunks,
  nextBuild,
  rivalCanBuild,
  rivalIncome,
  rivalLineup,
  rivalLoot,
  rivalUnits,
  strengthWord,
  unitPower,
} from '../src/data/rivals';
import { canMake } from '../src/data/succession';
import { UNITS } from '../src/data/units';
import { ico } from '../src/ui/glyphs';
import { generateWorld, isPassable, reachableFrom } from '../src/world/generate';
import { RIVAL_MIN_DIST, pickRivalSites } from '../src/world/rivalsites';

const rgb = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16));
const colourGap = (a, b) => Math.hypot(...rgb(a).map((v, k) => v - rgb(b)[k]));
// Jouw leger is blauw en gewone vijanden zijn rood (zie render/kit.js): rivalen moeten daar duidelijk van verschillen
const TEAM = '#2f6fd6',
  FOE = '#b8352c';

describe('rivalen: namen en kleuren', () => {
  it('elke rivaal heeft een eigen sleutel, een naam, een kleur en een vaandelteken', () => {
    expect(RIVALS.length).toBeGreaterThanOrEqual(MAX_RIVALS);
    expect(new Set(RIVALS.map(r => r.k)).size).toBe(RIVALS.length);
    expect(new Set(RIVALS.map(r => r.n)).size).toBe(RIVALS.length);
    for (const r of RIVALS) {
      expect(r.n.length, r.k).toBeGreaterThan(5);
      expect(r.c, r.k).toMatch(/^#[0-9a-f]{6}$/);
      expect(ico(r.g), r.k).toContain('<svg');
    }
  });

  it('de kleuren zijn goed uit elkaar te houden, ook van jouw blauw en het vijandelijke rood', () => {
    for (let i = 0; i < RIVALS.length; i++) {
      for (let j = i + 1; j < RIVALS.length; j++)
        expect(colourGap(RIVALS[i].c, RIVALS[j].c), `${RIVALS[i].k}–${RIVALS[j].k}`).toBeGreaterThan(80);
      expect(colourGap(RIVALS[i].c, TEAM), RIVALS[i].k).toBeGreaterThan(80);
      expect(colourGap(RIVALS[i].c, FOE), RIVALS[i].k).toBeGreaterThan(80);
    }
  });

  it('het aantal rivalen is 0 tot 3; zonder keuze 0 (oude opslag, uitdagingen)', () => {
    expect(MAX_RIVALS).toBe(3);
    expect(DEFAULT_RIVALS).toBe(1);
    expect(cleanRivalCount(2)).toBe(2);
    expect(cleanRivalCount(undefined)).toBe(0);
    expect(cleanRivalCount(4)).toBe(0);
    expect(cleanRivalCount('2')).toBe(0);
  });

  it('de zaadcode kiest altijd dezelfde rivalen, met elk karakter één keer', () => {
    for (const seed of [1, 42, 123456, 999999]) {
      const a = rivalLineup(seed);
      expect(a).toEqual(rivalLineup(seed));
      expect(a.length).toBe(MAX_RIVALS);
      expect(new Set(a.map(r => r.k)).size).toBe(MAX_RIVALS);
      expect(new Set(a.map(r => r.p))).toEqual(new Set(PERSONALITIES.map(p => p.k)));
    }
  });
});

describe('rivalen: karakters', () => {
  it('drie karakters: bouwer, krijger en handelaar', () => {
    expect(PERSONALITIES.map(p => p.k)).toEqual(['bouwer', 'krijger', 'handelaar']);
    for (const p of PERSONALITIES) {
      expect(p.d.length, p.k).toBeGreaterThan(20);
      expect(p.war, p.k).toBeGreaterThan(0);
      expect(p.war, p.k).toBeLessThan(1);
      // Nooit een aanval vóór dag 4
      expect(p.first, p.k).toBeGreaterThanOrEqual(4);
      for (const slot of p.extra) expect(['home', 'tower', 'eco'], p.k).toContain(slot);
    }
  });

  it('de krijger valt om de 2 dagen aan met 40% grotere legers; de handelaar heeft het zwakste leger', () => {
    const { bouwer, krijger, handelaar } = PERSONALITY;
    expect(krijger.every).toBe(2);
    expect(krijger.army).toBe(1.4);
    expect(handelaar.army).toBeLessThan(bouwer.army);
    expect(handelaar.army).toBeLessThan(krijger.army);
    expect(handelaar.gifts).toBe(true);
    // De bouwer verdient het meest
    expect(bouwer.econ).toBeGreaterThan(krijger.econ);
    expect(bouwer.econ).toBeGreaterThan(handelaar.econ);
  });
});

describe('rivalen: bouwen en trainen', () => {
  it('een bouwlijst per tijdperk, alleen met gebouwen die in dat tijdperk te maken zijn', () => {
    expect(BUILD_ORDER.length).toBe(AGES.length);
    BUILD_ORDER.forEach((order, age) => {
      expect(order.base.length, `tijdperk ${age}`).toBeGreaterThan(2);
      for (const k of [...order.base, order.home, order.tower, order.eco]) {
        expect(B[k], `${k} (tijdperk ${age})`).toBeTruthy();
        expect(rivalCanBuild(k), k).toBe(true);
        expect(canMake(k, age), `${k} in tijdperk ${age}`).toBe(true);
      }
      expect(B[order.tower].def, order.tower).toBeTruthy();
      expect(B[order.home].pop, order.home).toBeGreaterThan(0);
      for (const p of PERSONALITIES)
        expect(buildOrder(age, p.k).length).toBe(order.base.length + p.extra.length);
    });
  });

  it('nextBuild loopt de lijst af, bouwt kapotte gebouwen opnieuw en slaat verouderde over', () => {
    const first = BUILD_ORDER[0].base[0];
    expect(nextBuild(0, 'krijger', {})).toBe(first);
    // Alles van de Steentijd staat: niets meer te bouwen, dus sparen voor de Bronstijd
    const all = {};
    for (const k of buildOrder(0, 'krijger')) all[k] = (all[k] || 0) + 1;
    expect(nextBuild(0, 'krijger', all)).toBeNull();
    // Een kazerne kwijt: die komt terug
    expect(nextBuild(0, 'krijger', { ...all, barracks: 0 })).toBe('barracks');
    // In de IJzertijd bestaat de hut niet meer: die bouwt hij niet opnieuw
    const later = { ...all };
    for (const a of [1, 2]) for (const k of buildOrder(a, 'krijger')) later[k] = (later[k] || 0) + 1;
    expect(nextBuild(2, 'krijger', { ...later, hut: 0 })).toBeNull();
  });

  it('elk tijdperk heeft soldaten om te trainen, zonder de eigen soldaten van een volk', () => {
    for (let age = 0; age < AGES.length; age++) {
      const list = rivalUnits(age);
      expect(list.length, `tijdperk ${age}`).toBeGreaterThan(0);
      for (const k of list) {
        expect(UNITS[k].people, k).toBeUndefined();
        expect(canMake(k, age), k).toBe(true);
      }
    }
    expect(rivalUnits(2)).not.toContain('berserker');
  });
});

describe('rivalen: getallen', () => {
  it('waarde: latere grondstoffen tellen zwaarder, en elk tijdperk kost meer', () => {
    expect(costValue({ food: 100 })).toBe(100);
    expect(costValue({ steel: 100 })).toBeGreaterThan(costValue({ wood: 100 }));
    expect(costValue({})).toBe(0);
    for (let a = 2; a < AGE_UP.length; a++) expect(ageUpValue(a)).toBeGreaterThan(ageUpValue(1));
    expect(ageUpValue(AGES.length)).toBe(Infinity);
  });

  it('inkomen groeit met tijdperk, land en moeilijkheid', () => {
    const at = (age, chunks = 4, diff = 1, p = 'krijger') => rivalIncome(age, chunks, diff, p);
    for (let a = 1; a < AGES.length; a++) expect(at(a)).toBeGreaterThan(at(a - 1));
    expect(at(2, 8)).toBeGreaterThan(at(2, 4));
    // Elk tijdperk mag er één gebied bij, tot 10
    expect(maxChunks(0)).toBe(4);
    expect(maxChunks(3)).toBe(7);
    expect(maxChunks(8)).toBe(10);
    expect(at(0, 4, 0)).toBeCloseTo(at(0) * 0.7);
    expect(at(0, 4, 2)).toBeCloseTo(at(0) * 1.3);
    expect(at(0, 4, 3)).toBeCloseTo(at(0) * 1.5);
    expect(RIVAL_DIFF.length).toBe(4);
  });

  it('aanvallen: de eerste is klein, ze groeien, en nooit meer dan 20 soldaten', () => {
    expect(attackSize(0, 0, 'krijger', 1)).toBeLessThanOrEqual(4);
    expect(attackSize(0, 0, 'handelaar', 1)).toBe(2);
    expect(attackSize(3, 4, 'krijger', 1)).toBeGreaterThan(attackSize(0, 0, 'krijger', 1));
    // De krijger stuurt ongeveer 40% meer dan een gewoon leger (factor 1)
    const krijger = attackSize(6, 6, 'krijger', 1),
      bouwer = attackSize(6, 6, 'bouwer', 1);
    expect(krijger / bouwer).toBeGreaterThan(1.3);
    expect(attackSize(8, 40, 'krijger', 3)).toBe(20);
    expect(attackSize(5, 2, 'krijger', 3)).toBeGreaterThan(attackSize(5, 2, 'krijger', 1));
    expect(homeGuard(0)).toBe(2);
    expect(homeGuard(8)).toBeGreaterThan(homeGuard(0));
  });

  it('aanvallen pas met genoeg thuis: hun wacht plus een groep van minstens 2', () => {
    // Steentijd, eerste aanval van de handelaar: 2 wachters en een groep van 2
    expect(armyToAttack(0, 0, 'handelaar', 1)).toBe(homeGuard(0) + 2);
    for (const p of ['bouwer', 'krijger', 'handelaar'])
      for (const age of [0, 3, 8]) {
        const size = attackSize(age, 3, p, 1);
        const need = armyToAttack(age, 3, p, 1);
        expect(need - homeGuard(age)).toBeGreaterThanOrEqual(2);
        expect(need - homeGuard(age)).toBeLessThanOrEqual(size);
      }
  });

  it('sterkte: meer soldaten is sterker, en het woord klopt', () => {
    const spear = { hp: 70, dmg: 7, rate: 1 };
    expect(unitPower(spear)).toBeCloseTo(Math.sqrt(490));
    expect(armyPower([spear, spear])).toBeCloseTo(2 * unitPower(spear));
    expect(armyPower([])).toBe(0);
    expect(strengthWord(100, 100)).toBe('gelijk');
    expect(strengthWord(300, 100)).toBe('sterker');
    expect(strengthWord(30, 200)).toBe('zwakker');
    // Twee legers van niks zijn gelijk, niet "sterker"
    expect(strengthWord(0, 0)).toBe('gelijk');
  });

  it('buit en geschenken bevatten alleen grondstoffen die in dat tijdperk al bestaan', () => {
    for (let age = 0; age < AGES.length; age++) {
      for (const k of Object.keys(rivalLoot(age)))
        expect(RES[k].age, `buit ${k} @${age}`).toBeLessThanOrEqual(age);
      for (const k of Object.keys(giftFor(age)))
        expect(RES[k].age, `geschenk ${k} @${age}`).toBeLessThanOrEqual(age);
    }
    expect(rivalLoot(5).food).toBeGreaterThan(rivalLoot(0).food);
  });

  it('tempo op Normaal: de bouwer gaat het snelst, en niemand is al na dag 3 in de IJzertijd', () => {
    const reached = p => simulate(p, 1);
    const krijger = reached('krijger'),
      bouwer = reached('bouwer');
    // Bronstijd rond dag 3 tot 5
    expect(krijger[1]).toBeGreaterThanOrEqual(3);
    expect(krijger[1]).toBeLessThanOrEqual(5);
    expect(bouwer[2]).toBeGreaterThan(3);
    // De bouwer is eerder in de Middeleeuwen dan de krijger (die steekt veel in zijn leger)
    expect(bouwer[3]).toBeLessThan(krijger[3]);
    // Het Sterrentijdperk haalt niemand vóór dag 30
    expect(bouwer[8] ?? 99).toBeGreaterThan(30);
  });
});

// Een eenvoudige rekensom zoals game/rivals.js het speelt (zonder kaart): wanneer bereikt hij elk tijdperk?
// Aanvallers sneuvelen allemaal, dus de krijger moet steeds nieuwe soldaten kopen.
function simulate(p, diff) {
  const P = PERSONALITY[p],
    DAY = 200,
    first = ((24 - 7 + 6) / 24) * DAY; // dag 2 begint om 6 uur 's ochtends
  const dayAt = t => (t < first ? 1 : 2 + Math.floor((t - first) / DAY));
  let age = 0,
    bank = 0,
    war = 0,
    army = 2,
    attacks = 0,
    next = P.first;
  const have = {},
    when = {};
  for (let t = 0; t < 60 * DAY && age < AGES.length - 1; t++) {
    const day = dayAt(t);
    if (day >= next && army - homeGuard(age) >= 2) {
      army -= Math.min(army - homeGuard(age), attackSize(age, attacks, p, diff));
      attacks++;
      next = day + P.every;
    }
    const income = rivalIncome(age, Math.min(maxChunks(age), 4 + Math.floor(day / P.grow)), diff, p);
    const short = army < homeGuard(age) + attackSize(age, attacks, p, diff);
    war += short ? income * P.war : 0;
    bank += short ? income * (1 - P.war) : income;
    const unit = rivalUnits(age)[army % rivalUnits(age).length];
    if (short && war >= costValue(UNITS[unit].cost)) {
      war -= costValue(UNITS[unit].cost);
      army++;
    }
    const k = nextBuild(age, p, have);
    if (k && bank >= costValue(B[k].cost)) {
      bank -= costValue(B[k].cost);
      have[k] = (have[k] || 0) + 1;
    } else if (!k && bank >= ageUpValue(age + 1)) {
      bank -= ageUpValue(age + 1);
      age++;
      when[age] = day;
    }
  }
  return when;
}

describe('rivalen: waar ze wonen', () => {
  const W = 256,
    H = 256,
    CS = 16,
    start = [7, 8].flatMap(y => [7, 8].map(x => y * (W / CS) + x));
  for (const [map, seed] of [
    ['continent', 42],
    ['continent', 98765],
    ['islands', 4242],
    ['highlands', 7],
  ])
    it(`${map} ${seed}: drie plekken, ver weg, op bereikbaar land en zonder overlap`, () => {
      const world = generateWorld(seed, W, H, map);
      const sites = pickRivalSites(world.ter, W, H, seed);
      expect(sites).toEqual(pickRivalSites(world.ter, W, H, seed));
      expect(sites.length).toBe(MAX_RIVALS);
      const reach = reachableFrom(world.ter, W, H, (H / 2) * W + W / 2);
      const chunks = sites.flatMap(s => s.chunks);
      expect(new Set(chunks).size).toBe(chunks.length);
      for (const s of sites) {
        expect(Math.hypot(s.x + 1 - W / 2, s.y + 1 - H / 2)).toBeGreaterThanOrEqual(RIVAL_MIN_DIST - 16);
        expect(s.chunks.some(c => start.includes(c))).toBe(false);
        // Het stamhuis (2×2) ligt op begaanbaar land dat je vanaf je eigen stad kunt bereiken
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const i = (s.y + dy) * W + s.x + dx;
          expect(isPassable(world.ter[i])).toBe(true);
          expect(reach[i]).toBe(1);
        }
        // ...en in een van zijn eigen gebieden
        const own = Math.floor(s.y / CS) * (W / CS) + Math.floor(s.x / CS);
        expect(s.chunks).toContain(own);
      }
    });
});
