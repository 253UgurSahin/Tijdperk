// Loose coupling between the simulation and the presentation layer.
// The simulation only talks to these hooks; the interface and audio plug in
// the real implementations at start-up (see main.ts).
export const hooks = {
    toast: (_msg: string, _kind?: string): void => {},
    note: (_msg: string, _kind?: string): void => {},
    sfx: (_name: string, _minGap?: number): void => {},
    pulseRes: (_res: string): void => {},
    showVictory: (): void => {},
    showGameOver: (): void => {},
};
export const toast = (msg: string, kind?: string) => hooks.toast(msg, kind);
export const note = (msg: string, kind?: string) => hooks.note(msg, kind);
export const sfx = (name: string, minGap?: number) => hooks.sfx(name, minGap);
export const pulseRes = (res: string) => hooks.pulseRes(res);
export const showVictory = () => hooks.showVictory();
export const showGameOver = () => hooks.showGameOver();

export const bus = {
    uiDirty: true,
    notePos: null as [number, number] | null,
    shake: 0,
};
/** Last rendered signature per UI block; clearing an entry forces a redraw. */
export const sigs: Record<string, string | null> = {};
