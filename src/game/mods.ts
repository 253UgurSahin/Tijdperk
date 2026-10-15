// Spelregels in het spel: geldt een regel zoals "Geen leger" of "Lange winter" in deze wereld?
import { B } from '../data/buildings';
import { modsHaveRule } from '../data/modifiers';
import { G } from './state';

/** Geldt deze spelregel nu? Bijv. hasRule('noArmy'). De regels staan in G.mods (zie data/modifiers.ts). */
export const hasRule = (flag: string): boolean => !!G && modsHaveRule(G.mods, flag);

/** Mag je dit gebouw bouwen onder de spelregels? Zonder leger geen kazernes en andere trainingsgebouwen. */
export const ruleAllowsBuilding = (k: string): boolean => !(B[k] && B[k].train && hasRule('noArmy'));

/** Hoe snel dag en nacht gaan: met Snelle dagen anderhalf keer zo snel. */
export const dayPace = (): number => (hasRule('fastDays') ? 1.5 : 1);
