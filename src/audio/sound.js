// Geluidseffecten, gemaakt met de Web Audio API (geen geluidsbestanden).
import { SET, saveSet } from '../core/settings.js';

export let MG = null;
function out() {
  if (!MG) {
    MG = AC.createGain();
    MG.connect(AC.destination);
  }
  MG.gain.value = SET.vol;
  return MG;
}
export let AC = null,
  sndOn = SET.sound !== false;
// Welke geluiden bij "meldingen" horen en welke bij "klikjes" (zie de instellingen)
const ALERTS = new Set(['alarm', 'raidend', 'meteor', 'bad']);
const UI_SOUNDS = new Set(['tick', 'select']);
function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
const sfxT = {};
function tone(f0, f1, dur, type, vol, delay = 0) {
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
function noise(dur, vol, hp = 800, delay = 0) {
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
export function sfx(k, minGap = 0.05) {
  if (!sndOn || (!SET.alerts && ALERTS.has(k)) || (!SET.uiSounds && UI_SOUNDS.has(k))) return;
  if (!AC && !ac()) return;
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
    case 'musket':
      // Knal van buskruit: een scherpe klap met een doffe nagalm
      noise(0.14, 0.1, 1200);
      tone(160, 60, 0.12, 'square', 0.04);
      break;
    case 'gun':
      // Kort, droog salvo van een modern geweer
      noise(0.05, 0.07, 2500);
      tone(320, 120, 0.04, 'square', 0.025);
      break;
    case 'cannon':
      // Zware kanonslag: veel lage tonen
      noise(0.5, 0.13, 120);
      tone(75, 30, 0.5, 'sine', 0.14);
      break;
    case 'thud':
      // Een blijde: hout kraakt en een steen zoeft weg
      tone(130, 60, 0.22, 'triangle', 0.08);
      noise(0.12, 0.05, 300);
      break;
    case 'rocket':
      noise(0.5, 0.06, 500);
      tone(380, 950, 0.4, 'sawtooth', 0.025);
      break;
    case 'laser':
      tone(1800, 300, 0.15, 'sawtooth', 0.035);
      tone(2400, 700, 0.1, 'square', 0.015);
      break;
    case 'rail':
      // Railgun: zoem die oploopt, dan een klap
      tone(200, 2600, 0.18, 'sawtooth', 0.045);
      noise(0.18, 0.1, 600, 0.17);
      tone(90, 40, 0.3, 'sine', 0.1, 0.17);
      break;
    case 'creak':
      // Windmolen: houten wieken die gaan draaien
      tone(180, 140, 0.4, 'triangle', 0.03);
      tone(215, 170, 0.35, 'triangle', 0.025, 0.3);
      noise(0.6, 0.02, 900, 0.1);
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
    case 'achieve':
      // Prestatie behaald: twee snelle klokjes omhoog, dan een heldere, lange toon met wat glinstering
      tone(880, 0, 0.12, 'sine', 0.06);
      tone(1175, 0, 0.12, 'sine', 0.06, 0.08);
      tone(1568, 0, 0.7, 'sine', 0.07, 0.16);
      tone(2349, 0, 0.5, 'triangle', 0.02, 0.18);
      noise(0.4, 0.015, 6000, 0.16);
      break;
  }
}
export function setSound(on) {
  sndOn = on;
  SET.sound = on;
  saveSet();
  if (on) sfx('tick');
}
/** Volume direct aanpassen (schuifje in de instellingen). */
export function setVolume(v) {
  SET.vol = v;
  saveSet();
  if (MG) MG.gain.value = v;
}
// Naar een ander tabblad: geluid even stil (als die instelling aan staat)
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden && SET.muteHidden) AC.suspend().catch(() => {});
  else if (!document.hidden && sndOn) AC.resume().catch(() => {});
});
addEventListener(
  'pointerdown',
  () => {
    if (sndOn) ac();
  },
  { once: true },
);
