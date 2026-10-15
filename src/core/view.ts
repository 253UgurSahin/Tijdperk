// Hoe het beeld gedraaid staat. Zonder three.js, zodat ook spelregels en tests het kunnen gebruiken.
import { store } from './store';

/** De standaard draaiing van het 3D-aanzicht: schuin van rechtsonder, zoals het spel ontworpen is. */
export const DEFAULT_YAW = Math.PI / 4;

/** De draaiing van het beeld nu: 0 in het bovenaanzicht (noorden boven), anders die van de 3D-camera. */
export const viewYaw = (): number => (store.V2 ? 0 : store.yaw);

/**
 * Hoe ver een stap (dx, dy) op de kaart naar rechts gaat op het scherm. Alleen het teken telt:
 * daarmee kijken figuren naar links of naar rechts.
 */
export function screenRight(dx: number, dy: number): number {
  const a = viewYaw(),
    v = dx * Math.cos(a) - dy * Math.sin(a);
  // Recht omhoog of omlaag telt als 0 (cos en sin van 45° verschillen een heel klein beetje)
  return Math.abs(v) < 1e-9 ? 0 : v;
}
