// Geluidseffecten, gemaakt met de Web Audio API (geen geluidsbestanden).
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
export let AC: AudioContext | null = null,
  sndOn = true;
try {
  sndOn = localStorage.getItem('tijdperken-snd') !== 'off';
} catch (e) {}
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    } catch (e) {
      return null;
    }
  }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
const sfxT: Record<string, number> = {};
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator(),
    g = a.createGain(),
    t = a.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out());
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur: number, vol: number, hp = 800, delay = 0) {
  const a = ac();
  if (!a) return;
  const n = a.sampleRate * dur,
    buf = a.createBuffer(1, n, a.sampleRate),
    d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
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
  if (!sndOn || (!AC && !ac())) return;
  const now = performance.now() / 1000;
  if (sfxT[k] && now - sfxT[k] < minGap) return;
  sfxT[k] = now;
  switch (k) {
    case 'tick':
      tone(1400, 900, 0.05, 'square', 0.03);
      break;
    case 'place':
      tone(220, 160, 0.12, 'triangle', 0.08);
      noise(0.08, 0.05, 1500);
      break;
    case 'done':
      tone(520, 0, 0.1, 'triangle', 0.07);
      tone(780, 0, 0.14, 'triangle', 0.07, 0.09);
      break;
    case 'drop':
      tone(880, 1200, 0.06, 'sine', 0.035);
      break;
    case 'chop':
      noise(0.05, 0.06, 2500);
      tone(180, 120, 0.05, 'square', 0.03);
      break;
    case 'hit':
      noise(0.06, 0.07, 900);
      tone(140, 90, 0.08, 'sawtooth', 0.04);
      break;
    case 'shot':
      noise(0.04, 0.08, 2000);
      break;
    case 'alarm':
      for (let i = 0; i < 3; i++) {
        tone(440, 330, 0.22, 'square', 0.06, i * 0.28);
      }
      break;
    case 'age':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0, 0.5, 'triangle', 0.07, i * 0.12));
      break;
    case 'upgrade':
      tone(660, 990, 0.16, 'triangle', 0.06);
      tone(990, 1320, 0.2, 'triangle', 0.05, 0.1);
      break;
    case 'bad':
      tone(220, 140, 0.25, 'sawtooth', 0.05);
      break;
    case 'select':
      tone(1000, 1300, 0.05, 'sine', 0.03);
      break;
    case 'boom':
      noise(0.3, 0.12, 200);
      tone(90, 40, 0.3, 'sine', 0.1);
      break;
    case 'meteor':
      // Aanzwellend gesuis van een vallende vuurbal
      noise(3.4, 0.05, 300);
      tone(600, 80, 3.4, 'sawtooth', 0.03);
      break;
    case 'raidend':
      tone(392, 523, 0.3, 'triangle', 0.06);
      break;
  }
}
export function setSound(on: boolean) {
  sndOn = on;
  try {
    localStorage.setItem('tijdperken-snd', on ? 'on' : 'off');
  } catch (e) {}
  if (on) sfx('tick');
}
addEventListener(
  'pointerdown',
  () => {
    if (sndOn) ac();
  },
  { once: true },
);
