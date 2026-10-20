// Achtergrondmuziek, ter plekke gemaakt met de Web Audio API (geen geluidsbestanden): een zacht, langzaam
// akkoordentapijt met af en toe een losse toon erbovenop. Overdag licht en open, 's nachts lager en rustiger,
// tijdens een aanval wat donkerder. Nooit opdringerig: het mag uren aan staan.
import { SET, saveSet } from '../core/settings';
import { AC, MG, ensureAudio } from './sound';

/** Toonhoogtes van een pentatonische toonladder (geen valse noten, hoe je ze ook stapelt), in Hz. */
const BASE = 110; // A2
const SCALE_DAY = [0, 2, 4, 7, 9]; // grote pentatonische ladder: open en vrolijk
const SCALE_NIGHT = [0, 3, 5, 7, 10]; // kleine pentatonische: rustiger, donkerder
const hz = (semitones: number) => BASE * Math.pow(2, semitones / 12);

let bus: GainNode | null = null, // alles van de muziek gaat hierdoorheen (volume, aan/uit)
  filter: BiquadFilterNode | null = null, // een lage doorlaat: hoe donkerder de sfeer, hoe doffer
  nextChordAt = 0, // wanneer het volgende akkoord begint (in audiotijd)
  nextNoteAt = 0,
  chordRoot = 0, // de grondtoon van het akkoord van nu (halve tonen boven BASE)
  running = false;
/** Hoe de muziek nu moet klinken: 0 = dag, 1 = nacht; en of er een aanval is. */
const mood = { night: 0, alarm: false };

function setup(): boolean {
  if (bus) return true;
  if (!AC || !MG) return false;
  bus = AC.createGain();
  bus.gain.value = 0;
  filter = AC.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1600;
  filter.Q.value = 0.4;
  bus.connect(filter);
  filter.connect(MG);
  return true;
}

// Eén zachte toon: langzaam aanzwellen, lang uitsterven (als een strijker of een orgelpijp)
function pad(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle') {
  const o = AC!.createOscillator(),
    g = AC!.createGain();
  o.type = type;
  o.frequency.value = freq;
  // Heel licht ontstemd en zacht vibrato: dan klinkt het warm in plaats van als een pieptoon
  o.detune.value = (Math.random() - 0.5) * 8;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(bus!);
  o.start(at);
  o.stop(at + dur + 0.05);
}
// Een losse hoge toon, als een klokje of een harp
function pluck(freq: number, at: number, vol: number) {
  const o = AC!.createOscillator(),
    g = AC!.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.2);
  o.connect(g);
  g.connect(bus!);
  o.start(at);
  o.stop(at + 2.3);
}

const CHORD_LEN = 6; // seconden per akkoord
/** Elk beeldje aanroepen (goedkoop): plant alleen vooruit wat de komende seconden moet klinken. */
export function tickMusic(night: number, alarm: boolean) {
  mood.night = night;
  mood.alarm = alarm;
  if (!SET.music || SET.sound === false) {
    if (running) stopMusic();
    return;
  }
  if (!AC || AC.state !== 'running' || !setup()) return;
  const now = AC.currentTime;
  if (!running) {
    running = true;
    nextChordAt = now + 0.1;
    nextNoteAt = now + 2;
    bus!.gain.cancelScheduledValues(now);
    bus!.gain.setValueAtTime(0.0001, now);
    bus!.gain.exponentialRampToValueAtTime(Math.max(0.0001, SET.musicVol), now + 4);
  }
  // Sfeer: 's nachts en bij alarm doffer (lagere doorlaat)
  const dark = Math.max(night, alarm ? 0.7 : 0);
  filter!.frequency.setTargetAtTime(1600 - dark * 1000, now, 1.5);
  // Akkoorden ruim vooruit plannen (hooguit één per aanroep)
  if (nextChordAt < now + 1) {
    const scale = night > 0.5 ? SCALE_NIGHT : SCALE_DAY;
    // Een nieuwe grondtoon uit de ladder, nooit twee keer dezelfde achter elkaar
    let root = scale[(Math.random() * scale.length) | 0];
    if (root === chordRoot) root = scale[(scale.indexOf(root) + 2) % scale.length];
    chordRoot = root;
    const at = Math.max(nextChordAt, now);
    // Grondtoon laag, kwint en octaaf erboven: een open klank die bij elke ladder past
    pad(hz(root), at, CHORD_LEN + 2, alarm ? 0.05 : 0.045, 'triangle');
    pad(hz(root + 7), at + 0.4, CHORD_LEN + 1.6, 0.03, 'sine');
    pad(hz(root + 12), at + 0.8, CHORD_LEN + 1.2, 0.022, 'sine');
    if (!alarm && night < 0.5) pad(hz(root + 16), at + 1.2, CHORD_LEN, 0.014, 'sine'); // terts: overdag
    nextChordAt = at + CHORD_LEN;
  }
  // Losse tonen: overdag af en toe een klokje uit de ladder, 's nachts minder, bij alarm niet
  if (!alarm && nextNoteAt < now + 0.5) {
    const scale = night > 0.5 ? SCALE_NIGHT : SCALE_DAY;
    const step = scale[(Math.random() * scale.length) | 0];
    pluck(hz(chordRoot + 24 + step), Math.max(nextNoteAt, now), 0.02 + Math.random() * 0.015);
    nextNoteAt = now + 2.5 + Math.random() * (night > 0.5 ? 6 : 3.5);
  }
}

/** Muziek zacht laten wegsterven (uit gezet, of het geluid gaat helemaal uit). */
export function stopMusic() {
  running = false;
  if (!bus || !AC) return;
  const now = AC.currentTime;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
}

/** Muziek aan of uit (instelling). */
export function setMusic(on: boolean) {
  SET.music = on;
  saveSet();
  if (on) ensureAudio();
  else stopMusic();
}
/** Volume van de muziek (0..1), los van het hoofdvolume. */
export function setMusicVolume(v: number) {
  SET.musicVol = v;
  saveSet();
  if (bus && AC && running) bus.gain.setTargetAtTime(Math.max(0.0001, v), AC.currentTime, 0.2);
}
