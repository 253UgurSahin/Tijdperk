// Tests voor diplomatie: woorden bij een relatie, kansen, aanvallen, handel, geschenken en oude opslag.
import { describe, expect, it } from 'vitest';
import {
  ALLY_KEEP,
  ALLY_MIN,
  DIFF_REL_STEP,
  HELP_CHANCE,
  LEVELS,
  OFFER_REL,
  OFFER_TIME,
  REL,
  START_REL,
  TRADE_KEEP,
  TRADE_MIN,
  TRADE_RATE,
  TRIBUTE_RATIO,
  WAR_AT,
  allyChance,
  attackWait,
  clampRel,
  cleanDiplomacy,
  diplomacyStart,
  drift,
  giftCost,
  giftEffect,
  helperCount,
  nextAttackDay,
  offerKinds,
  peaceChance,
  powerRatio,
  relText,
  relationLabel,
  relationLevel,
  resValue,
  restingRel,
  rivalTrade,
  scarceRes,
  startRel,
  surplusRes,
  tradeChance,
  tradeDeal,
  tradeWaits,
  tributeChance,
  tributeFor,
} from '../src/data/diplomacy.js';
import { RES } from '../src/data/resources.js';
import { PERSONALITIES, PERSONALITY } from '../src/data/rivals.js';

const KINDS = PERSONALITIES.map(p => p.k);
const RELS = [-100, -70, -50, -30, -15, 0, 19, 20, 40, 59, 60, 80, 100];

describe('diplomatie: relaties in woorden', () => {
  it('begint zoals het karakter: Handelaar +20, Bouwer 0, Krijger −30', () => {
    expect(START_REL).toEqual({ handelaar: 20, bouwer: 0, krijger: -30 });
    for (const k of KINDS) expect(diplomacyStart(k).rel).toBe(START_REL[k]);
  });

  it('vijf woorden: Vijandig, Koel, Neutraal, Vriendelijk en Bondgenoot', () => {
    expect(relationLabel(-100)).toBe('Vijandig');
    expect(relationLabel(-51)).toBe('Vijandig');
    expect(relationLabel(-50)).toBe('Koel');
    expect(relationLabel(-30)).toBe('Koel');
    expect(relationLabel(0)).toBe('Neutraal');
    expect(relationLabel(19)).toBe('Neutraal');
    expect(relationLabel(20)).toBe('Vriendelijk');
    expect(relationLabel(100)).toBe('Vriendelijk');
    // Bondgenoot is een verdrag, geen getal; In oorlog gaat overal voor
    expect(relationLabel(35, true)).toBe('Bondgenoot');
    expect(relationLabel(35, false, true)).toBe('In oorlog');
    expect(relationLabel(80, true, true)).toBe('In oorlog');
    const words = new Set(RELS.map(r => relationLabel(r)).concat(relationLabel(0, true)));
    expect(words.size).toBe(5);
  });

  it('Vriendelijk begint precies waar handel kan; de woorden lopen van laag naar hoog', () => {
    expect(relationLevel(TRADE_MIN).k).toBe('vriendelijk');
    expect(relationLevel(TRADE_MIN - 1).k).not.toBe('vriendelijk');
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].from).toBeGreaterThan(LEVELS[i - 1].from);
  });

  it('op Zwaar en Meedogenloos beginnen de rivalen minder vriendelijk', () => {
    for (const k of KINDS) {
      expect(startRel(k, 0)).toBe(START_REL[k]);
      expect(startRel(k, 1)).toBe(START_REL[k]);
      expect(startRel(k, 2)).toBe(START_REL[k] - DIFF_REL_STEP);
      expect(startRel(k, 3)).toBe(START_REL[k] - 2 * DIFF_REL_STEP);
      expect(diplomacyStart(k, 3).rel).toBe(startRel(k, 3));
      // Ook het rustpunt zakt mee, anders schuift de relatie vanzelf terug naar Normaal
      expect(restingRel({ personality: k, diff: 3 })).toBe(startRel(k, 3));
    }
  });

  it('relaties blijven tussen −100 en 100 en worden netjes geschreven', () => {
    expect(clampRel(250)).toBe(100);
    expect(clampRel(-250)).toBe(-100);
    expect(clampRel(NaN)).toBe(0);
    expect(relText(24.4)).toBe('+24');
    expect(relText(-8)).toBe('−8');
    expect(relText(0)).toBe('0');
  });

  it('de grenzen kloppen: handel vóór een verbond, en oorlog ver onder koel', () => {
    expect(TRADE_MIN).toBeLessThan(ALLY_MIN);
    expect(TRADE_KEEP).toBeLessThan(TRADE_MIN);
    expect(ALLY_KEEP).toBeLessThan(ALLY_MIN);
    expect(WAR_AT).toBeLessThan(START_REL.krijger);
    expect(relationLevel(WAR_AT).k).toBe('vijandig');
  });
});

describe('diplomatie: kansen', () => {
  it('elke kans ligt tussen 0 en 100', () => {
    for (const personality of KINDS)
      for (const rel of RELS) {
        for (const chance of [
          tradeChance({ rel, personality }),
          allyChance({ rel, personality, trade: true }),
          tributeChance({ ratio: 1 + rel / 25, personality }),
          peaceChance({ ratio: 2, warDays: 5, personality, rel }),
        ]) {
          expect(chance).toBeGreaterThanOrEqual(0);
          expect(chance).toBeLessThanOrEqual(100);
          expect(Number.isInteger(chance)).toBe(true);
        }
      }
  });

  it('handelsverdrag: pas vanaf relatie 20, nooit in oorlog, beter bij een hogere relatie', () => {
    for (const personality of KINDS) {
      expect(tradeChance({ rel: TRADE_MIN - 1, personality })).toBe(0);
      expect(tradeChance({ rel: 80, personality, war: true })).toBe(0);
      expect(tradeChance({ rel: TRADE_MIN, personality })).toBeGreaterThan(0);
      expect(tradeChance({ rel: 50, personality })).toBeGreaterThan(tradeChance({ rel: 25, personality }));
    }
    // Een Handelaar handelt het liefst, een Krijger het minst
    const at = personality => tradeChance({ rel: 30, personality });
    expect(at('handelaar')).toBeGreaterThan(at('bouwer'));
    expect(at('bouwer')).toBeGreaterThan(at('krijger'));
  });

  it('bondgenootschap: pas vanaf relatie 60; een verdrag helpt; een Krijger zegt zelden ja', () => {
    for (const personality of KINDS) {
      expect(allyChance({ rel: ALLY_MIN - 1, personality })).toBe(0);
      expect(allyChance({ rel: 100, personality, war: true })).toBe(0);
      expect(allyChance({ rel: 70, personality, trade: true })).toBeGreaterThan(
        allyChance({ rel: 70, personality }),
      );
    }
    // Zelfs met de beste relatie en een verdrag: minder dan de helft
    expect(allyChance({ rel: 100, personality: 'krijger', trade: true })).toBeLessThan(50);
    expect(allyChance({ rel: 80, personality: 'bouwer' })).toBeGreaterThan(
      2 * allyChance({ rel: 80, personality: 'krijger' }),
    );
  });

  it('schatting: alleen als je veel sterker bent, nooit helemaal zeker', () => {
    for (const personality of KINDS) {
      expect(tributeChance({ ratio: TRIBUTE_RATIO - 0.01, personality })).toBe(0);
      expect(tributeChance({ ratio: 3, personality })).toBeGreaterThan(
        tributeChance({ ratio: 2, personality }),
      );
      expect(tributeChance({ ratio: 10, personality })).toBeLessThanOrEqual(95);
    }
    expect(powerRatio(100, 100)).toBe(1);
    expect(powerRatio(0, 0)).toBe(1); // twee lege legers zijn even sterk
    expect(powerRatio(280, 80)).toBe(3);
  });

  it('vrede: pas na een dag oorlog, en makkelijker na een langere oorlog of als je sterker bent', () => {
    const base = { ratio: 1, warDays: 2, personality: 'bouwer', rel: -80 };
    expect(peaceChance({ ...base, warDays: 0 })).toBe(0);
    expect(peaceChance({ ...base, warDays: 5 })).toBeGreaterThan(peaceChance(base));
    expect(peaceChance({ ...base, ratio: 2 })).toBeGreaterThan(peaceChance(base));
    expect(peaceChance({ ...base, rel: -30 })).toBeGreaterThan(peaceChance(base));
    expect(peaceChance({ ...base, personality: 'krijger' })).toBeLessThan(peaceChance(base));
  });
});

describe('diplomatie: wanneer rivalen aanvallen', () => {
  it('in oorlog gewoon, vrienden zelden, bondgenoten nooit', () => {
    expect(attackWait({ rel: 80, war: true })).toBe(1);
    expect(attackWait({ rel: 80, ally: true })).toBe(Infinity);
    const waits = [-80, -30, 0, 40].map(rel => attackWait({ rel }));
    for (let i = 1; i < waits.length; i++) expect(waits[i]).toBeGreaterThan(waits[i - 1]);
  });

  // Alleen de dagen van een karakter (zijn andere velden, zoals 'war', betekenen hier iets anders)
  const days = p => ({ first: PERSONALITY[p].first, every: PERSONALITY[p].every });

  it('nooit vóór dag 4, en met een betere relatie later', () => {
    for (const p of KINDS)
      for (const rel of RELS) {
        const day = nextAttackDay({ ...days(p), attacks: 0, lastAttack: 0, rel });
        expect(day).toBeGreaterThanOrEqual(4);
        const later = nextAttackDay({ ...days(p), attacks: 3, lastAttack: 10, rel });
        expect(later).toBeGreaterThan(10);
      }
    const at = (rel, more = {}) =>
      nextAttackDay({ ...days('krijger'), attacks: 2, lastAttack: 10, rel, ...more });
    expect(at(40)).toBeGreaterThan(at(-30));
    expect(at(-30)).toBeGreaterThan(at(-80));
    expect(at(40, { war: true })).toBe(10 + PERSONALITY.krijger.every);
    expect(at(90, { ally: true })).toBe(Infinity);
  });

  it('een Krijger valt aan het begin eerder aan dan een Bouwer, en die eerder dan een Handelaar', () => {
    const first = p => nextAttackDay({ ...days(p), attacks: 0, lastAttack: 0, rel: START_REL[p] });
    expect(first('krijger')).toBeLessThan(first('bouwer'));
    expect(first('bouwer')).toBeLessThan(first('handelaar'));
  });

  it('op een zwaardere stand komt de eerste aanval nooit later, en bij een Bouwer eerder', () => {
    const first = (p, diff) =>
      nextAttackDay({ ...days(p), attacks: 0, lastAttack: 0, rel: startRel(p, diff) });
    for (const p of KINDS) expect(first(p, 3)).toBeLessThanOrEqual(first(p, 1));
    expect(first('bouwer', 3)).toBeLessThan(first('bouwer', 1));
  });

  it('na vrede (of een betaalde eis) wachten ze weer, ook als ze nog nooit aanvielen', () => {
    // Oorlog op dag 10 met een Handelaar, vrede op dag 11: de relatie is dan Koel (−24)
    const afterPeace = nextAttackDay({ ...days('handelaar'), attacks: 0, lastAttack: 11, rel: -24 });
    expect(afterPeace).toBeGreaterThan(12);
    // Een vroege vrede of betaling maakt de eerste aanval nooit eerder dan zonder
    for (const p of KINDS)
      for (const rel of RELS) {
        const plain = nextAttackDay({ ...days(p), attacks: 0, lastAttack: 0, rel });
        const early = nextAttackDay({ ...days(p), attacks: 0, lastAttack: 2, rel });
        expect(early).toBeGreaterThanOrEqual(plain);
      }
  });

  it('in de beschrijving van elk karakter staat hoe vaak hij als vijand aanvalt', () => {
    for (const p of PERSONALITIES) expect(p.d).toContain(`om de ${p.every} dagen`);
  });
});

describe('diplomatie: vanzelf terug naar het rustpunt', () => {
  it('schuift elke dag een stukje, en nooit voorbij het rustpunt', () => {
    expect(drift(50, 0, 1)).toBeLessThan(50);
    expect(drift(50, 0, 1)).toBeGreaterThan(0);
    expect(drift(-50, 0, 1)).toBeGreaterThan(-50);
    expect(drift(2, 0, 10)).toBe(0);
    expect(drift(-2, 0, 10)).toBe(0);
    expect(drift(10, 10, 3)).toBe(10);
  });

  it('een verdrag of verbond houdt vanzelf stand, bij elk karakter en op elke moeilijkheid', () => {
    for (const personality of KINDS)
      for (const diff of [0, 1, 2, 3]) {
        const rest = more => restingRel({ personality, diff, ...more });
        expect(rest({ ally: true })).toBeGreaterThanOrEqual(ALLY_KEEP + 10);
        expect(rest({ ally: true, trade: true })).toBeGreaterThanOrEqual(ALLY_KEEP + 10);
        expect(rest({ trade: true })).toBeGreaterThanOrEqual(TRADE_KEEP + 10);
        // Een verdrag of verbond maakt het rustpunt nooit lager
        expect(rest({ trade: true })).toBeGreaterThanOrEqual(rest({}));
      }
    expect(restingRel({ personality: 'handelaar', war: true })).toBeLessThan(WAR_AT);
  });
});

describe('diplomatie: geschenken en handel', () => {
  const keys = ['food', 'wood', 'stone'];

  it('waarde: grondstoffen van later tellen zwaarder', () => {
    expect(resValue('food')).toBe(1);
    expect(resValue('gold')).toBeGreaterThan(resValue('iron'));
    expect(surplusRes({ food: 50, wood: 400, stone: 10 }, keys)).toBe('wood');
    expect(scarceRes({ food: 50, wood: 400, stone: 10 }, keys)).toBe('stone');
    expect(scarceRes({ food: 50, wood: 400, stone: 10 }, keys, 'stone')).toBe('food');
    expect(surplusRes({ food: 0, wood: 0, stone: 0 }, keys)).toBe(null);
  });

  it('een geschenk kost je grootste voorraad en doet steeds minder als je er veel achter elkaar geeft', () => {
    const cost = giftCost({ food: 50, wood: 400, stone: 10 }, keys, 0);
    expect(Object.keys(cost)).toEqual(['wood']);
    expect(cost.wood).toBeGreaterThan(0);
    expect(giftCost({ food: 0, wood: 0, stone: 0 }, keys, 0)).toBe(null);
    for (const personality of KINDS) {
      expect(giftEffect(personality, 1)).toBeLessThan(giftEffect(personality, 0));
      expect(giftEffect(personality, 9)).toBeGreaterThanOrEqual(2);
    }
    expect(giftEffect('handelaar')).toBeGreaterThan(giftEffect('krijger'));
  });

  it('een handelsverdrag ruilt je overschot voor wat je tekortkomt, voor 80% van de waarde', () => {
    const deal = tradeDeal({ food: 900, wood: 80, stone: 20, gold: 0 }, [...keys, 'gold'], 3);
    expect(deal.give).toBe('food');
    expect(deal.get).toBe('gold');
    expect(deal.giveAmt).toBeGreaterThan(0);
    const back = (deal.getAmt * resValue(deal.get)) / (deal.giveAmt * resValue(deal.give));
    expect(back).toBeLessThanOrEqual(TRADE_RATE + 0.001);
    expect(back).toBeGreaterThan(TRADE_RATE - 0.1);
    expect(tradeDeal({ food: 0, wood: 0, stone: 0 }, keys, 0)).toBe(null);
  });

  it('een handelsverdrag neemt nooit je laatste voorraad: het wacht tot je weer genoeg hebt', () => {
    const trade = { give: 'food', giveAmt: 30, get: 'stone', getAmt: 24 };
    expect(tradeWaits({ food: 200 }, trade)).toBe(false);
    expect(tradeWaits({ food: 90 }, trade)).toBe(false); // na de ruil nog 60: twee ruilen
    expect(tradeWaits({ food: 89 }, trade)).toBe(true);
    expect(tradeWaits({ food: 0 }, trade)).toBe(true);
  });

  it('een eenmalige ruil van een rivaal: vrienden krijgen een betere prijs', () => {
    const res = { food: 900, wood: 80, stone: 20 };
    const friend = rivalTrade(res, keys, 1, 40),
      stranger = rivalTrade(res, keys, 1, -10);
    expect(friend.give).toBe('food');
    expect(friend.want).toBe('stone');
    expect(friend.amt).toBe(stranger.amt);
    expect(friend.price).toBeLessThan(stranger.price);
  });

  it('schatting bestaat alleen uit grondstoffen van hun tijdperk', () => {
    for (let age = 0; age < 9; age++)
      for (const k of Object.keys(tributeFor(age))) expect(RES[k].age).toBeLessThanOrEqual(age);
  });
});

describe('diplomatie: berichten en hulp', () => {
  it('in oorlog alleen een vredesvoorstel, en pas na een paar dagen', () => {
    expect(offerKinds({ rel: -80, personality: 'bouwer', war: true, warDays: 1, ratio: 2 })).toEqual([]);
    expect(
      offerKinds({ rel: -80, personality: 'bouwer', war: true, warDays: 4, ratio: 2 }).map(k => k[0]),
    ).toEqual(['peace']);
  });

  it('een Krijger stelt nooit zelf een verbond voor; eisen komen alleen van wie sterker is', () => {
    const kinds = o => offerKinds(o).map(k => k[0]);
    expect(kinds({ rel: 90, personality: 'krijger' })).not.toContain('ally');
    expect(kinds({ rel: 90, personality: 'bouwer' })).toContain('ally');
    expect(kinds({ rel: 90, personality: 'bouwer', ally: true })).not.toContain('ally');
    expect(kinds({ rel: -30, personality: 'krijger', ratio: 0.5 })).toContain('demand');
    expect(kinds({ rel: -30, personality: 'krijger', ratio: 2 })).not.toContain('demand');
    expect(kinds({ rel: 30, personality: 'krijger', ratio: 0.5 })).not.toContain('demand');
  });

  it('elk bericht zegt wat ja en nee doen; nee op een eis kost relatie', () => {
    expect(OFFER_TIME).toBeGreaterThan(0);
    for (const k of ['trade', 'ask', 'ally', 'demand', 'peace']) expect(OFFER_REL[k]).toBeTruthy();
    expect(OFFER_REL.demand.no).toBeLessThan(0);
    expect(OFFER_REL.ask.yes).toBeGreaterThan(0);
  });

  it('bondgenoten helpen soms, met 2 tot 6 soldaten', () => {
    for (const k of KINDS) {
      expect(HELP_CHANCE[k]).toBeGreaterThan(0);
      expect(HELP_CHANCE[k]).toBeLessThanOrEqual(100);
    }
    expect(helperCount(0)).toBe(2);
    expect(helperCount(8)).toBe(6);
  });

  it('een aanval zonder oorlogsverklaring is erger dan een treffer in een oorlog', () => {
    expect(REL.attacked).toBeLessThan(REL.attackedAtWar);
    expect(REL.camp).toBeGreaterThan(0);
  });
});

describe('diplomatie: opslag', () => {
  it('opslag van vóór de diplomatie begint met de relatie van het karakter', () => {
    for (const k of KINDS) {
      const d = cleanDiplomacy({}, k, PERSONALITY[k].every);
      expect(d.rel).toBe(START_REL[k]);
      expect(d.trade).toBe(null);
      expect(d.ally).toBe(false);
      expect(d.atWar).toBe(false);
      expect(d.lastAttack).toBe(0);
      expect(d.spareUntil).toBe(0);
      // Op een zwaardere stand: de relatie die daarbij hoort
      expect(cleanDiplomacy({}, k, PERSONALITY[k].every, 3).rel).toBe(startRel(k, 3));
    }
  });

  it('de dag van de laatste aanval volgt uit de oude "volgende aanval"', () => {
    expect(cleanDiplomacy({ attacks: 2, nextAttack: 12 }, 'krijger', 2).lastAttack).toBe(10);
    expect(cleanDiplomacy({ attacks: 0, nextAttack: 4 }, 'krijger', 2).lastAttack).toBe(0);
  });

  it('kapotte gegevens worden netjes: geen vreemd verdrag, geen verbond tijdens oorlog', () => {
    const d = cleanDiplomacy(
      { rel: 900, trade: { give: 'gras', giveAmt: 3, get: 'food', getAmt: 2 }, ally: true, atWar: true },
      'bouwer',
      4,
    );
    expect(d.rel).toBe(100);
    expect(d.trade).toBe(null);
    expect(d.ally).toBe(false);
    expect(d.atWar).toBe(true);
    const ok = cleanDiplomacy(
      { rel: 30, trade: { give: 'food', giveAmt: 30, get: 'stone', getAmt: 24 } },
      'bouwer',
      4,
    );
    expect(ok.trade).toEqual({ give: 'food', giveAmt: 30, get: 'stone', getAmt: 24 });
  });

  it('wat bewaard wordt, komt ongeschonden terug', () => {
    const start = {
      ...diplomacyStart('handelaar'),
      rel: 42,
      ally: true,
      warDay: 3,
      lastAttack: 7,
      raidDay: 6,
      spareUntil: 9,
    };
    const back = cleanDiplomacy(JSON.parse(JSON.stringify(start)), 'handelaar', 5);
    expect(back).toEqual(start);
  });
});
