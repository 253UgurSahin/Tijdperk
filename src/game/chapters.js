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
    t: 'Muren van steen',
    s: 'IJzererts en goud liggen verder weg. Breid je land uit.',
    o: [
      ['Bouw een smidse', () => built('smithy')],
      ['Open een markt', () => built('market')],
      ['Bouw een kasteeltoren', () => built('castletower')],
      ['Train een ridder', () => G.stats.knight > 0],
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
    t: 'De laatste grens',
    s: 'Bouw de zwerm en voltooi het Commandocentrum.',
    o: [
      ['Bouw een chipfabriek', () => built('chipfab')],
      ['Bouw een accufabriek', () => built('batteryfab')],
      ['Bouw een drone-hangar', () => built('hangar')],
      ['Voltooi het Commandocentrum', () => built('command')],
    ],
  },
];
