// Kleine visuele effecten in de spelstand (zwevende tekst, vonken).
import { G } from './state';

export function chips(x: number, y: number, col: string) {
  for (let k = 0; k < 3; k++)
    G.fx.push({
      type: 'chip',
      x,
      y,
      z: 10,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
      vz: 30 + Math.random() * 30,
      life: 0.5,
      max: 0.5,
      col,
    });
}
export function floater(x: number, y: number, txt: string, col: string) {
  G.fx.push({ type: 'float', x, y, z: 16, txt, col, life: 1.5, max: 1.5 });
}
export function burst(x: number, y: number, col: string) {
  for (let k = 0; k < 5; k++)
    G.fx.push({
      type: 'smoke',
      x: x + (Math.random() - 0.5) * 0.6,
      y: y + (Math.random() - 0.5) * 0.6,
      z: 6,
      vz: 10 + Math.random() * 10,
      life: 0.9,
      max: 0.9,
      col,
    });
}
export function fxRing(x: number, y: number, col: string) {
  G.fx.push({ type: 'ring', x, y, life: 0.6, max: 0.6, col });
}
