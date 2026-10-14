import type { FoeDef, UnitDef } from '../types';

export const UNITS: Record<string, UnitDef> = {
    spear: { n: 'Speerdrager', src: 'barracks', age: 0, hp: 70, dmg: 7, r: .9, rate: 1, spd: 2.2, cost: { food: 40, wood: 20 }, t: 7 },
    slinger: { n: 'Slingeraar', src: 'barracks', age: 0, hp: 45, dmg: 5, r: 3.5, rate: 1.3, spd: 2.2, cost: { food: 30, stone: 20 }, t: 7, proj: 1 },
    warrior: { n: 'Bronzen krijger', src: 'barracks', age: 1, hp: 120, dmg: 12, r: .9, rate: 1, spd: 2.1, cost: { food: 50, bronze: 10 }, t: 8 },
    archer: { n: 'Boogschutter', src: 'barracks', age: 2, hp: 85, dmg: 11, r: 5, rate: 1.2, spd: 2.2, cost: { food: 50, wood: 40 }, t: 8, proj: 1 },
    knight: { n: 'Ridder', src: 'barracks', age: 2, hp: 240, dmg: 20, r: .9, rate: 1.1, spd: 3, cost: { food: 80, iron: 30, gold: 10 }, t: 11 },
    rifle: { n: 'Fuselier', src: 'barracks', age: 3, hp: 160, dmg: 18, r: 5, rate: 1.3, spd: 2.2, cost: { food: 60, steel: 10 }, t: 9, proj: 1 },
    fieldgun: { n: 'Veldkanon', src: 'workshop', age: 3, hp: 220, dmg: 45, r: 6, rate: 3, spd: 1.4, cost: { steel: 40, coal: 20 }, t: 14, proj: 1, splash: 1.3 },
    soldier: { n: 'Soldaat', src: 'barracks', age: 4, hp: 220, dmg: 8, r: 5.5, rate: .35, spd: 2.4, cost: { food: 70, steel: 15, fuel: 5 }, t: 9, proj: 1, air: 1 },
    tank: { n: 'Tank', src: 'workshop', age: 4, hp: 950, dmg: 60, r: 6, rate: 2.4, spd: 1.8, cost: { steel: 120, fuel: 40 }, t: 18, proj: 1, splash: 1.4, big: 1 },
    exo: { n: 'Exo-soldaat', src: 'barracks', age: 5, hp: 380, dmg: 14, r: 6, rate: .35, spd: 2.6, cost: { food: 80, steel: 30, battery: 8 }, t: 11, proj: 1, air: 1 },
    drone: { n: 'Gevechtsdrone', src: 'hangar', age: 5, hp: 130, dmg: 12, r: 4, rate: .4, spd: 4.2, cost: { chips: 6, battery: 6, steel: 10 }, t: 8, proj: 1, air: 1, fly: 1 },
};
export const FOES: FoeDef[] = [
    { n: 'Wolven', hp: 30, dmg: 4, spd: 2.3, r: .9, rate: 1 },
    { n: 'Plunderaars', hp: 65, dmg: 7, spd: 1.7, r: .9, rate: 1.1 },
    { n: 'Roofridders', hp: 140, dmg: 12, spd: 2, r: .9, rate: 1.2 },
    { n: 'Huurlingen', hp: 130, dmg: 10, spd: 1.6, r: 3.5, rate: 1.4, proj: 1 },
    { n: 'Pantserwagens', hp: 420, dmg: 28, spd: 1.3, r: 4.5, rate: 2.2, proj: 1, big: 1 },
    { n: 'Vijandelijke drones', hp: 95, dmg: 11, spd: 3.1, r: 3, rate: 1, proj: 1, air: 1 },
];
