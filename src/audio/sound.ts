import { SET } from '../core/settings';

export let MG: GainNode | null = null;
function out() {
    if (!MG) {
        MG = AC!.createGain();
        MG.connect(AC!.destination);
    }
    MG.gain.value = SET.vol;
    return MG;
}
let AC: AudioContext | null = null;
export let sndOn = true;
try {
    sndOn = localStorage.getItem('tijdperken-snd') !== 'off';
}
catch (e) {
}
function ac() {
    if (!AC) {
        try {
            AC = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
        }
        catch (e) {
            return null;
        }
    }
    if (AC.state === 'suspended')
        AC.resume().catch(() => {
        });
    return AC;
}
const sfxT: Record<string, number> = {};
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const a = ac();
    if (!a)
        return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1)
        o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g);
    g.connect(out());
    o.start(t);
    o.stop(t + dur + .02);
}
function noise(dur: number, vol: number, hp = 800, delay = 0) {
    const a = ac();
    if (!a)
        return;
    const n = a.sampleRate * dur, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++)
        d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = a.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(out());
    src.start(a.currentTime + delay);
}
export function sfx(k: string, minGap = .05) {
    if (!sndOn || !AC && !ac())
        return;
    const now = performance.now() / 1000;
    if (sfxT[k] && now - sfxT[k] < minGap)
        return;
    sfxT[k] = now;
    switch (k) {
        case 'tick':
            tone(1400, 900, .05, 'square', .03);
            break;
        case 'place':
            tone(220, 160, .12, 'triangle', .08);
            noise(.08, .05, 1500);
            break;
        case 'done':
            tone(520, 0, .1, 'triangle', .07);
            tone(780, 0, .14, 'triangle', .07, .09);
            break;
        case 'drop':
            tone(880, 1200, .06, 'sine', .035);
            break;
        case 'chop':
            noise(.05, .06, 2500);
            tone(180, 120, .05, 'square', .03);
            break;
        case 'hit':
            noise(.06, .07, 900);
            tone(140, 90, .08, 'sawtooth', .04);
            break;
        case 'shot':
            noise(.04, .08, 2000);
            break;
        case 'alarm':
            for (let i = 0; i < 3; i++) {
                tone(440, 330, .22, 'square', .06, i * .28);
            }
            break;
        case 'age':
            [523, 659, 784, 1046].forEach((f, i) => tone(f, 0, .5, 'triangle', .07, i * .12));
            break;
        case 'upgrade':
            tone(660, 990, .16, 'triangle', .06);
            tone(990, 1320, .2, 'triangle', .05, .1);
            break;
        case 'bad':
            tone(220, 140, .25, 'sawtooth', .05);
            break;
        case 'select':
            tone(1000, 1300, .05, 'sine', .03);
            break;
        case 'boom':
            noise(.3, .12, 200);
            tone(90, 40, .3, 'sine', .1);
            break;
        case 'raidend':
            tone(392, 523, .3, 'triangle', .06);
            break;
    }
}
export function setSound(on: boolean) {
    sndOn = on;
    try {
        localStorage.setItem('tijdperken-snd', on ? 'on' : 'off');
    }
    catch (e) {
    }
    if (on)
        sfx('tick');
}
addEventListener('pointerdown', () => {
    if (sndOn)
        ac();
}, { once: true });
