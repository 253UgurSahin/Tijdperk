// Gedeelde toestand die door meerdere onderdelen wordt aangepast.
// (Een geïmporteerde variabele kun je niet overschrijven, daarom staan ze samen in één object.)
import type { CoachAct, Tile } from '../types';
import type { Profile } from '../types';
/** Alle gedeelde toestand op één plek (zie de uitleg hierboven). */
export interface Store {
  mapVersion: number;
  placing: string | null;
  expandMode: boolean;
  demolishArm: number;
  lastGroup: string | null;
  cmdMode: 'amove' | 'patrol' | null;
  demoMode: boolean;
  /** Waar een aanval begint; tijdens de finale (`more`) ook de plekken van de andere groepen. */
  raidPing: { x: number; y: number; t: number; more?: Tile[] } | null;
  periodic: number;
  slowP: number;
  histT: number;
  shake: number;
  TM: number;
  /** Bovenaanzicht (2D) aan? Anders het 3D-aanzicht. */
  V2: boolean;
  /** Draaiing van de 3D-camera rond het midden van het beeld (radialen), en waar hij naartoe draait. */
  yaw: number;
  tyaw: number | null;
  nodeSnap: Uint8Array | null;
  nodeAge: number;
  seasonSig: string;
  uiDirty: boolean;
  tab: string;
  curAge: number;
  notePos: [number, number] | null;
  rateSnap: { t: number; r: Record<string, number> } | null;
  rateT: number;
  resMax: number;
  missionOpen: boolean;
  coachTile: string | null;
  coachAct: CoachAct | null;
  modalLocked: boolean;
  profile: Profile | null;
  achievementTimer: number;
  /** Hoe ver we tussen de vorige en de volgende speltik zitten (0-1), voor vloeiend tekenen. */
  alpha: number;
  /** Waar de muis boven hangt. */
  hover: { kind: string; id: number } | null;
  /** Beeldkwaliteit: resolutie-factor, maximum aantal pixels, gekozen stand en meetwaarden. */
  resScale?: number;
  pixelBudget?: number;
  quality?: string;
  perf?: Record<string, number>;
  /** Geen deeltjes (rook, vonken): uitgezet in de instellingen of bij lage kwaliteit (zie render/quality.ts). */
  noParticles?: boolean;
  /** Tijdstip (performance.now) van de lichtflits als de sterrenpoort gaat opladen of opengaat. */
  finaleFlash?: number;
}
export const store: Store = {
  mapVersion: 0, // telt op als er iets op de kaart verandert (voor de minikaart)
  placing: null,
  expandMode: false,
  demolishArm: 0,
  lastGroup: null,
  cmdMode: null,
  demoMode: false,
  raidPing: null,
  periodic: 0,
  slowP: 0,
  histT: 0,
  shake: 0,
  TM: 0,
  V2: false,
  yaw: Math.PI / 4, // het vaste schuine aanzicht van vroeger (zie core/view.ts)
  tyaw: null,
  nodeSnap: null,
  nodeAge: -1,
  seasonSig: '',
  uiDirty: true,
  tab: 'home',
  curAge: -1,
  notePos: null,
  rateSnap: null,
  rateT: 0,
  resMax: 14,
  missionOpen: true,
  coachTile: null,
  coachAct: null,
  modalLocked: false, // het open venster gaat niet dicht met Esc of een klik ernaast
  profile: null, // spelersprofiel met prestaties en scores (zie core/profile.ts); leeg = alleen vrije volken
  achievementTimer: 0, // tijd tot het spel weer kijkt of je een prestatie hebt gehaald
  alpha: 1,
  hover: null,
};
