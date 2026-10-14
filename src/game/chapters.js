// De doelen per tijdperk ("hoofdstukken").
import { G } from './state.js';

export const built = k => G.bs.some(b => b.type === k && b.done);
export const CHAPTERS = [
  {
    t: 'Een vuur in de wildernis',
    s: 'Elke beschaving begint met een paar goede keuzes.',
    o: [
      ['Bouw een hut', () => built('hut')],
      ['Leg een akker aan', () => built('farm')],
      ['Bouw een opslagplaats', () => built('storage')],
      ['Steek een kampvuur aan', () => built('campfire')],
      ['Train je eerste krijger', () => G.stats.trained > 0],
    ],
  },
  {
    t: 'Het geheim van brons',
    s: 'In de heuvels liggen koper en tin. Samen worden ze sterker dan steen.',
    o: [
      ['Bouw een bronsgieterij', () => built('foundry')],
      ['Bouw een leemhuis', () => built('house')],
      ['Bouw een bronzen toren', () => built('bronzetower')],
      ['Verover een vijandelijk kamp', () => G.stats.camps > 0],
    ],
  },
  {
    t: 'Vonken in de smidse',
    s: 'IJzer ligt aan de voet van de bergen. Wie het kan smeden, is sterker.',
    o: [
      ['Bouw een smidse', () => built('smithy')],
      ['Bouw een stenen huis', () => built('stonehouse')],
      ['Bouw een heuvelfort', () => built('hillfort')],
      ['Train een zwaardvechter', () => G.stats.swordsman > 0],
    ],
  },
  {
    t: 'Muren van steen',
    s: 'Goud ligt bij het water. Breid je land uit en open een markt.',
    o: [
      ['Open een markt', () => built('market')],
      ['Bouw een kasteeltoren', () => built('castletower')],
      ['Bouw een belegeringswerf', () => built('siegeworks')],
      ['Train een ridder', () => G.stats.knight > 0],
    ],
  },
  {
    t: 'Wind in de zeilen',
    s: 'Molens malen vanzelf, en buskruit verandert de oorlog.',
    o: [
      ['Bouw een windmolen', () => built('windmill')],
      ['Bouw een kruitmolen', () => built('powdermill')],
      ['Bouw een grachtenpand', () => built('canalhouse')],
      ['Train een musketier', () => G.stats.musketeer > 0],
    ],
  },
  {
    t: 'Rook boven de vallei',
    s: "Een kolencentrale verlicht de straten. Je volk werkt nu ook 's nachts.",
    o: [
      ['Bouw een hoogoven', () => built('blastfurnace')],
      ['Bouw een kolencentrale', () => built('powerplant')],
      ['Zet een straatlantaarn neer', () => built('streetlamp')],
      ['Bouw een voertuigfabriek', () => built('workshop')],
    ],
  },
  {
    t: 'Zwart goud',
    s: 'Olie en zand drijven de moderne wereld aan.',
    o: [
      ['Plaats een oliepomp', () => built('oilpump')],
      ['Bouw een raffinaderij', () => built('refinery')],
      ['Bouw een siliciumfabriek', () => built('silicaworks')],
      ['Bouw luchtafweer', () => built('aa')],
    ],
  },
  {
    t: 'De zwerm',
    s: 'Chips en accu’s maken een leger dat vliegt.',
    o: [
      ['Bouw een chipfabriek', () => built('chipfab')],
      ['Bouw een accufabriek', () => built('batteryfab')],
      ['Bouw een drone-hangar', () => built('hangar')],
      ['Voltooi het commandocentrum', () => built('command')],
    ],
  },
  {
    t: 'Naar de sterren',
    s: 'Meteorieten brengen sterrenmetaal. Bouw er de sterrenpoort mee.',
    o: [
      ['Bouw een sterrensmidse', () => built('starforge')],
      ['Bouw een fusiereactor', () => built('fusionplant')],
      ['Bouw een mechwerf', () => built('mechbay')],
      ['Voltooi de sterrenpoort', () => built('stargate')],
    ],
  },
];
