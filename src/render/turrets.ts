// Geschut op torens draait mee naar de vijand waarop het schiet, schokt even terug bij elk schot, en
// kijkt rustig rond als er niemand in de buurt is.
import type * as T3 from 'three';

/** Hoe het geschut van één toren er nu bij staat. */
export interface TurretState {
  /** De draaibare delen (zie turret() in models.ts), met waar hun loop in het model naartoe wijst (1 of -1). */
  parts: T3.Object3D[];
  /** De richting waarin het geschut nu wijst (draaiing om de hoogte-as). */
  ang: number;
  /** Wanneer het laatste schot viel, en de wachttijd van de toren bij het vorige beeldje (om een schot te zien). */
  shotAt: number;
  cdPrev: number;
  /** Tijd van het vorige beeldje. */
  last: number;
}
/** Wat het geschut van een toren (van jou of een rivaal) uit de spelstand leest. */
interface Shooter {
  id: number;
  /** Richting van het laatste doel, als hoek in de spelwereld (zie game/buildings.ts). */
  aim?: number;
  /** Tijd tot het volgende schot: springt omhoog bij elk schot. */
  cd?: number;
}

// Zo snel draait het geschut (radialen per seconde), zo lang na een schot blijft het op het doel gericht,
// en zo ver en zo kort schokt het terug
const TURN_SPEED = 5,
  HOLD = 4,
  KICK = 0.06,
  KICK_TIME = 0.25;

/** Zoek de draaibare delen in een nieuw model. Geen delen: dan is er niets te doen (null). */
export function findTurrets(root: T3.Object3D, id: number): TurretState | null {
  const parts: T3.Object3D[] = [];
  root.traverse(o => {
    if (o.userData.turret) {
      o.userData.p0 = o.position.clone(); // de rustplek, voor het terugschokken
      parts.push(o);
    }
  });
  if (!parts.length) return null;
  // Elke toren begint in een iets andere richting, dan staan ze niet allemaal precies gelijk
  return { parts, ang: (id * 2.4) % (Math.PI * 2), shotAt: -99, cdPrev: 0, last: -1 };
}

// Het verschil tussen twee hoeken, tussen -π en π (de korte kant op)
const turnDiff = (to: number, from: number) => {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

/** Elk beeldje: het geschut naar het doel draaien (of rustig rondkijken) en terugschokken na een schot. */
export function aimTurrets(st: TurretState, b: Shooter, now: number): void {
  const dt = st.last < 0 ? 0 : Math.min(0.25, now - st.last);
  st.last = now;
  const cd = b.cd || 0;
  // De wachttijd springt omhoog: er is net geschoten
  if (cd > st.cdPrev + 0.05) st.shotAt = now;
  st.cdPrev = cd;
  // De richting in de spelwereld (x, y) wordt in 3D (x, z); de draaiing om y wijst de loop daarheen
  const aimed = b.aim != null ? Math.atan2(Math.cos(b.aim), Math.sin(b.aim)) : st.ang;
  const busy = now - st.shotAt < HOLD;
  // Niemand in de buurt: langzaam heen en weer kijken rond de laatste richting
  const want = busy ? aimed : aimed + Math.sin(now * 0.35 + b.id) * 0.9;
  const step = TURN_SPEED * (busy ? 1 : 0.15) * dt;
  const d = turnDiff(want, st.ang);
  st.ang += Math.abs(d) <= step ? d : Math.sign(d) * step;
  const kick = Math.max(0, 1 - (now - st.shotAt) / KICK_TIME) * KICK;
  for (const t of st.parts) {
    const forward = t.userData.turret as number;
    // Wijst de loop in het model naar achteren, dan een halve slag extra
    t.rotation.y = st.ang + (forward < 0 ? Math.PI : 0);
    // Terugschokken: even een stukje tegen de schietrichting in
    const p0 = t.userData.p0 as T3.Vector3;
    t.position.set(p0.x - Math.sin(st.ang) * kick, p0.y, p0.z - Math.cos(st.ang) * kick);
  }
}
