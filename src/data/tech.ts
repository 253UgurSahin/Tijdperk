import type { TechDef } from '../types';

export const TECH: TechDef[] = [
    { k: 'agri', age: 0, n: 'Landbouw', g: '❀', d: 'Akkers: +1 boer en +20% oogst', cost: { food: 80, wood: 80 }, t: 30 },
    { k: 'fire', age: 0, n: 'Vuurbeheersing', g: '✹', d: 'Lichtbronnen schijnen 1,5 verder', cost: { wood: 100 }, t: 25 },
    { k: 'wheel', age: 1, n: 'Het wiel', g: '◎', d: 'Dorpelingen lopen 15% sneller', cost: { wood: 150, bronze: 20 }, t: 40 },
    { k: 'masonry', age: 1, n: 'Metselwerk', g: '▦', d: 'Gebouwen en muren +25% levenspunten', cost: { stone: 200, bronze: 15 }, t: 45 },
    { k: 'ballistics', age: 2, n: 'Ballistiek', g: '➶', d: 'Torens: +1 bereik en +20% schade', cost: { wood: 200, iron: 60 }, t: 50 },
    { k: 'medicine', age: 2, n: 'Kruidenkunde', g: '✚', d: 'Volk en leger genezen vanzelf', cost: { food: 250, gold: 40 }, t: 50 },
    { k: 'steam', age: 3, n: 'Stoomkracht', g: '♨', d: 'Fabrieken en pompen 25% sneller', cost: { coal: 150, steel: 60 }, t: 60 },
    { k: 'rail', age: 3, n: 'Spoorwegen', g: '═', d: 'Wegen geven 40% meer snelheid', cost: { steel: 100, coal: 80 }, t: 55 },
    { k: 'radio', age: 4, n: 'Radioverbinding', g: '⌁', d: 'Leger 20% sneller, aanvallen eerder gemeld', cost: { steel: 150, silicon: 40 }, t: 60 },
    { k: 'electric', age: 4, n: 'Elektrificatie', g: 'ϟ', d: 'Centrales leveren 25% meer stroom', cost: { steel: 200, fuel: 60 }, t: 60 },
    { k: 'automation', age: 5, n: 'Automatisering', g: '⚙', d: 'Verzamelen gaat 25% sneller', cost: { chips: 40, steel: 200 }, t: 70 },
    { k: 'swarm', age: 5, n: 'Zwermintelligentie', g: '✦', d: 'Drones, exo-soldaten en lasers +30% schade', cost: { chips: 60, battery: 60 }, t: 70 },
];
export const TK: Record<string, TechDef> = {};
TECH.forEach(t => TK[t.k] = t);
