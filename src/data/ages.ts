import type { AgeDef, AgeUpDef, Cost } from '../types';

export const AGES: AgeDef[] = [
    { n: 'Steentijd', y: '± 10.000 v.Chr.', r: 'I', title: 'Een klein begin.', sub: 'Maak een thuis aan de rand van de wildernis.', lvl: 'Kampement', acc: '#8a6b2f' },
    { n: 'Bronstijd', y: '± 3000 v.Chr.', r: 'II', title: 'Brons en vuur.', sub: 'Koper en tin smelten samen tot iets sterkers.', lvl: 'Dorp', acc: '#a5602d' },
    { n: 'Middeleeuwen', y: '± 1200 n.Chr.', r: 'III', title: 'Muren van steen.', sub: 'IJzer en goud maken van een dorp een stad.', lvl: 'Burcht', acc: '#8f3d3a' },
    { n: 'Industriële tijd', y: '± 1850', r: 'IV', title: 'Rook en stoom.', sub: 'Kolen en staal veranderen alles, ook de nacht.', lvl: 'Fabrieksstad', acc: '#4d6274' },
    { n: 'Moderne tijd', y: '± 1960', r: 'V', title: 'Olie en asfalt.', sub: 'Onder het zand ligt de brandstof van een nieuwe eeuw.', lvl: 'Metropool', acc: '#5a7738' },
    { n: 'Dronetijdperk', y: '± 2035', r: 'VI', title: 'De zwerm.', sub: 'Chips, accu\'s en een lucht vol drones.', lvl: 'Megastad', acc: '#1b8188' },
];
/** Requirements to reach age i (index 0 unused). */
export const AGE_UP: (AgeUpDef | null)[] = [null,
    { cost: { food: 250, wood: 250, stone: 120 }, pop: 8, need: ['storage', 'farm'] },
    { cost: { food: 500, wood: 500, stone: 350, bronze: 60 }, pop: 14, need: ['foundry'] },
    { cost: { food: 900, wood: 700, stone: 600, iron: 200, gold: 80 }, pop: 22, need: ['smithy'] },
    { cost: { food: 1400, stone: 800, coal: 300, steel: 200, gold: 200 }, pop: 32, need: ['blastfurnace', 'powerplant'] },
    { cost: { food: 2000, steel: 500, fuel: 200, silicon: 150 }, pop: 45, need: ['refinery', 'silicaworks'] },
];
/** Extra material per upgrade level, by target age. */
export const AGE_MAT: (Cost | null)[] = [null, { bronze: 12 }, { iron: 20 }, { steel: 20 }, { silicon: 15 }, { chips: 10 }];
