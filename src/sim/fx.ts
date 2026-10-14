import { G } from './state';

export function chips(x: number, y: number, col: string) {
    for (let k = 0; k < 3; k++)
        G.fx.push({ type: 'chip', x, y, z: 10, vx: (Math.random() - .5) * 1.4, vy: (Math.random() - .5) * 1.4, vz: 30 + Math.random() * 30, life: .5, max: .5, col });
}
export function floater(x: number, y: number, txt: string, col: string) {
    G.fx.push({ type: 'float', x, y, z: 16, txt, col, life: 1.5, max: 1.5 });
}
export function burst(x: number, y: number, col: string) {
    for (let k = 0; k < 5; k++)
        G.fx.push({ type: 'smoke', x: x + (Math.random() - .5) * .6, y: y + (Math.random() - .5) * .6, z: 6, vz: 10 + Math.random() * 10, life: .9, max: .9, col });
}
export function fxRing(x: number, y: number, col: string) {
    G.fx.push({ type: 'ring', x, y, life: .6, max: .6, col });
}
