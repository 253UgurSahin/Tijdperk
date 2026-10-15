// Filmisch moment bij een nieuw tijdperk: de camera zweeft rustig uit boven je stad en daarna terug.
// Beweeg je zelf de camera (slepen, zoomen, minikaart), dan stopt het meteen; na schuiven glijdt je eigen
// zoom vanzelf terug. Een klik of toets laat hem snel terugkeren naar waar je was. Met "Animaties" uit
// (instellingen) gebeurt er niets. Hoe het 3D-beeld gedraaid staat (store.yaw) verandert het nooit.
import type { GameState } from '../types';
import { SET } from '../core/settings';
import { G } from '../game/state';
import { ZOOM_MIN } from '../input/input';
import { clampCam } from './camera';
import { cam } from './scene';

const OUT = 1.4, // seconden: uitzoomen naar het stamhuis
  HOLD = 1.7, // even boven de stad blijven hangen (en nog een klein beetje verder uitzoomen)
  BACK = 1.4, // terug naar waar je was
  QUICK = 0.5; // sneller terug na een klik of toets
const FAR_ZOOM = 0.42; // zo ver uitgezoomd dat de stad in beeld past (zelf kun je nog veel verder uitzoomen)
const DRIFT = 0.08; // tijdens het hangen nog 8% verder weg

/** Een stand van de camera: waar hij naar kijkt (x, y) en hoe ver weg hij is (d = 1 / zoom). */
interface Pose {
  x: number;
  y: number;
  d: number;
}
/**
 * Het lopende moment: bij welk spel, wanneer het begon, waar je was (from), waar we heen gaan (over),
 * de snelle terugweg na een klik of toets (quick), en wat we het vorige beeldje zelf zetten (set).
 */
interface Shot {
  game: GameState;
  start: number;
  from: Pose;
  over: Pose;
  quick: { start: number; from: Pose } | null;
  set: { x: number; y: number; z: number } | null;
}
let shot: Shot | null = null;

// Rustig op gang komen en rustig afremmen
const smooth = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Afstand (d = 1 / zoom) mengen in plaats van de zoom zelf: zo voelt uitzoomen gelijkmatig
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  d: a.d + (b.d - a.d) * k,
});

/** Het moment begint (bij een nieuw tijdperk). */
export function startAgeCinematic(): void {
  if (!SET.motion || !G) return;
  const hall = G.bs.find(b => b.type === 'townhall');
  const zoom = cam.tz ?? cam.z;
  // Glijdt de camera nog ergens heen, dan is dat doel de plek om naar terug te keren. Let op: cam.ty blijft
  // na zo'n glijden staan (alleen cam.tx wordt leeg), dus die alleen gebruiken zolang cam.tx er is.
  const gliding = cam.tx != null;
  const from = { x: gliding ? cam.tx! : cam.x, y: gliding ? cam.ty! : cam.y, d: 1 / zoom };
  const over = {
    x: hall ? hall.x + 1 : from.x,
    y: hall ? hall.y + 1 : from.y,
    d: 1 / Math.min(zoom, FAR_ZOOM),
  };
  cam.tx = cam.ty = cam.tz = null;
  shot = { game: G, start: performance.now() / 1000, from, over, quick: null, set: null };
}

/** Een klik of toets tijdens het moment: snel terug naar waar je was. */
function hurryBack(): void {
  if (!shot || shot.quick || !shot.set) return;
  shot.quick = { start: performance.now() / 1000, from: { x: cam.x, y: cam.y, d: 1 / cam.z } };
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, hurryBack, true);

/**
 * Heeft iets anders de camera verplaatst sinds het vorige beeldje? Dan is de camera weer van de speler.
 * 'zoom': de speler zoomde zelf. 'move': hij schoof of sprong naar een plek (minikaart). '': niets.
 */
function playerTookOver(s: Shot): 'zoom' | 'move' | '' {
  const set = s.set;
  if (!set) return '';
  if (cam.tz != null || Math.abs(cam.z - set.z) > 1e-4) return 'zoom';
  if (cam.tx != null || Math.abs(cam.x - set.x) > 1e-3 || Math.abs(cam.y - set.y) > 1e-3) return 'move';
  return '';
}

/** Elk beeldje, vóór de camera wordt neergezet. `now` in seconden. */
export function stepCinematic(now: number): void {
  if (!shot) return;
  // Een ander spel geladen of begonnen: dat zet de camera zelf goed neer
  if (shot.game !== G) {
    shot = null;
    return;
  }
  const took = playerTookOver(shot);
  if (took) {
    // Alleen geschoven? Dan glijdt de zoom vanzelf terug naar die van de speler. Zelf gezoomd: zo laten.
    if (took === 'move') {
      cam.tz = 1 / shot.from.d;
      cam.anchor = null;
    }
    shot = null;
    return;
  }
  const { from, over } = shot;
  // Tijdens het hangen nog iets verder weg, maar nooit verder dan je zelf kunt uitzoomen
  const high = { ...over, d: Math.min(over.d * (1 + DRIFT), 1 / ZOOM_MIN) };
  const t = now - shot.start;
  let pose: Pose,
    done = false;
  if (shot.quick) {
    const k = Math.min(1, (now - shot.quick.start) / QUICK);
    pose = mixPose(shot.quick.from, from, smooth(k));
    done = k >= 1;
  } else if (t < OUT) pose = mixPose(from, over, smooth(t / OUT));
  else if (t < OUT + HOLD) pose = mixPose(over, high, smooth((t - OUT) / HOLD));
  else {
    const k = Math.min(1, (t - OUT - HOLD) / BACK);
    pose = mixPose(high, from, smooth(k));
    done = k >= 1;
  }
  cam.x = pose.x;
  cam.y = pose.y;
  cam.z = 1 / pose.d;
  clampCam();
  shot.set = { x: cam.x, y: cam.y, z: cam.z };
  if (done) shot = null;
}

/** Loopt het moment nog? */
export const inCinematic = (): boolean => !!shot;
