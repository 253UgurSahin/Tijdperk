// Filmisch moment bij een nieuw tijdperk: de camera zweeft rustig uit boven je stad en daarna terug.
// Beweeg je zelf de camera (slepen, zoomen, minikaart), dan stopt het meteen. Een klik of toets laat hem
// snel terugkeren naar waar je was. Met "Animaties" uit (instellingen) gebeurt er niets.
import { SET } from '../core/settings.js';
import { G } from '../game/state.js';
import { clampCam } from './camera.js';
import { cam } from './scene.js';

const OUT = 1.4, // seconden: uitzoomen naar het stamhuis
  HOLD = 1.7, // even boven de stad blijven hangen (en nog een klein beetje verder uitzoomen)
  BACK = 1.4, // terug naar waar je was
  QUICK = 0.5; // sneller terug na een klik of toets
const FAR_ZOOM = 0.42; // zo ver uitgezoomd (de kleinste zoom van het spel is 0.35)
const DRIFT = 0.08; // tijdens het hangen nog 8% verder weg

// Het lopende moment: begin, waar je was, waar we heen gaan, en wat we het vorige beeldje zelf zetten
let shot = null;

// Rustig op gang komen en rustig afremmen
const smooth = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Afstand (d = 1 / zoom) mengen in plaats van de zoom zelf: zo voelt uitzoomen gelijkmatig
const mixPose = (a, b, k) => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  d: a.d + (b.d - a.d) * k,
});

/** Het moment begint (bij een nieuw tijdperk). */
export function startAgeCinematic() {
  if (!SET.motion || !G) return;
  const hall = G.bs.find(b => b.type === 'townhall');
  const zoom = cam.tz ?? cam.z;
  // Glijdt de camera nog ergens heen, dan is dat doel de plek om naar terug te keren. Let op: cam.ty blijft
  // na zo'n glijden staan (alleen cam.tx wordt leeg), dus die alleen gebruiken zolang cam.tx er is.
  const gliding = cam.tx != null;
  const from = { x: gliding ? cam.tx : cam.x, y: gliding ? cam.ty : cam.y, d: 1 / zoom };
  const over = {
    x: hall ? hall.x + 1 : from.x,
    y: hall ? hall.y + 1 : from.y,
    d: 1 / Math.min(zoom, FAR_ZOOM),
  };
  cam.tx = cam.ty = cam.tz = null;
  shot = { start: performance.now() / 1000, from, over, quick: null, set: null };
}

/** Een klik of toets tijdens het moment: snel terug naar waar je was. */
function hurryBack() {
  if (!shot || shot.quick || !shot.set) return;
  shot.quick = { start: performance.now() / 1000, from: { x: cam.x, y: cam.y, d: 1 / cam.z } };
}
for (const type of ['pointerdown', 'keydown']) addEventListener(type, hurryBack, true);

// Heeft iets anders de camera verplaatst sinds het vorige beeldje? Dan is de camera weer van de speler.
function movedByPlayer() {
  const s = shot.set;
  if (!s) return false;
  if (cam.tx != null || cam.tz != null) return true;
  return Math.abs(cam.x - s.x) > 1e-3 || Math.abs(cam.y - s.y) > 1e-3 || Math.abs(cam.z - s.z) > 1e-4;
}

/** Elk beeldje, vóór de camera wordt neergezet. `now` in seconden. */
export function stepCinematic(now) {
  if (!shot) return;
  if (movedByPlayer()) {
    shot = null;
    return;
  }
  const { from, over } = shot;
  const high = { ...over, d: over.d * (1 + DRIFT) };
  const t = now - shot.start;
  let pose,
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
export const inCinematic = () => !!shot;
