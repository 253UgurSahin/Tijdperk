// Vuurwerk als je wint: vuurpijlen stijgen op in beeld en spatten uiteen in gekleurde vonken.
// Staan effecten uit (lage kwaliteit), dan is er geen vuurwerk; de fanfare en de gouden gloed blijven wel.
import { sfx } from '../audio/sound.js';
import { store } from '../core/store.js';
import { TAU } from '../config.js';
import { G } from '../game/state.js';
import { camDist } from './camera.js';
import { LAYER, emit } from './particles.js';
import { cam } from './scene.js';

const SHOW = 8; // seconden lang nieuwe vuurpijlen
const COLOURS = [0xffd36a, 0xff7a5c, 0x7fd7ff, 0xc29cff, 0xa6f08a, 0xfff4dc];

// Het lopende vuurwerk: bij welk spel, wanneer het begon, wanneer de volgende pijl gaat, en de pijlen in de lucht
let show = null,
  lastT = 0;

/** Het vuurwerk begint (bij winst). Zonder effecten niet: anders hoor je knallen zonder iets te zien. */
export function startFireworks() {
  if (store.noParticles) return;
  show = { game: G, start: store.TM, next: store.TM, rockets: [] };
}

// Hoe groot alles is: verder uitgezoomd = grotere pijlen en vonken, zodat het overal goed te zien is
const scale = () => camDist() / 27;

/** Een nieuwe vuurpijl op een willekeurige plek rond het midden van het beeld. */
function launch() {
  const s = scale();
  show.rockets.push({
    x: cam.x + (Math.random() - 0.5) * 22 * s,
    z: cam.y + (Math.random() - 0.5) * 16 * s,
    y: 0.2,
    vy: (8 + Math.random() * 3) * s,
    top: (4.5 + Math.random() * 3.5) * s,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
  });
  sfx('launch', 0.12);
}

/** De pijl spat uiteen: een felle flits en een bol vonken die langzaam naar beneden zakken. */
function burst(rocket) {
  const s = scale();
  emit(LAYER.glow, rocket.x, rocket.y, rocket.z, 0, 0, 0, 0.25, 0.3 * s, 1.4 * s, 0xffffff, 0.9);
  for (let k = 0; k < 56; k++) {
    // Een willekeurige richting op een bol: hoogte u van -1 tot 1, dan rondom
    const u = Math.random() * 2 - 1,
      around = Math.random() * TAU,
      flat = Math.sqrt(1 - u * u),
      speed = (3.4 + Math.random()) * s;
    emit(
      LAYER.glow,
      rocket.x,
      rocket.y,
      rocket.z,
      flat * Math.cos(around) * speed,
      u * speed,
      flat * Math.sin(around) * speed,
      1.3 + Math.random() * 0.5,
      0.16 * s,
      0.05 * s,
      k % 6 === 0 ? 0xffffff : rocket.colour,
      1,
      -2.2 * s,
    );
  }
  sfx('firework', 0.08);
}

/** Elk beeldje: pijlen laten stijgen, uiteen laten spatten en nieuwe afschieten. */
export function stepFireworks() {
  const now = store.TM,
    dt = lastT ? Math.min(0.1, now - lastT) : 0;
  lastT = now;
  // Al een nieuw spel begonnen (Opnieuw of Volgende uitdaging)? Dan hoort het vuurwerk daar niet bij.
  if (show && show.game !== G) show = null;
  if (!show) return;
  const age = now - show.start;
  if (age < SHOW && now >= show.next) {
    show.next = now + 0.2 + Math.random() * 0.4;
    launch();
  }
  const s = scale();
  for (let i = show.rockets.length - 1; i >= 0; i--) {
    const rocket = show.rockets[i];
    rocket.y += rocket.vy * dt;
    // Een staartje vonken achter de pijl aan
    emit(LAYER.glow, rocket.x, rocket.y, rocket.z, 0, -0.4 * s, 0, 0.35, 0.05 * s, 0.01 * s, 0xffe2a0, 0.8);
    if (rocket.y >= rocket.top) {
      burst(rocket);
      show.rockets.splice(i, 1);
    }
  }
  if (age >= SHOW && !show.rockets.length) show = null;
}
