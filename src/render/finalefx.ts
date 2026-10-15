// De finale in 3D: een lichtzuil uit de sterrenpoort die feller wordt naarmate hij oplaadt, met opstijgende vonken.
import * as T3 from 'three';
import { store } from '../core/store';
import { chargeFrac } from '../data/finale';
import { isCharging } from '../game/finale';
import { G } from '../game/state';
import { pool } from './decals';
import { LAYER, emit } from './particles';

// Een open cilinder (zonder deksels) met de onderkant op de grond, voor de lichtzuil
const BEAM = new T3.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0);
const beamMesh = () =>
  new T3.Mesh(
    BEAM,
    new T3.MeshBasicMaterial({
      color: '#b89cff',
      transparent: true,
      depthWrite: false,
      side: T3.DoubleSide,
      blending: T3.AdditiveBlending,
      fog: false,
    }),
  );
let sparkT = 0,
  lastTM = 0;

/** Elk beeldje: zolang de poort oplaadt (of open is) staat er een lichtzuil boven, die pulseert. */
export function drawFinaleFx() {
  const dt = Math.min(0.1, store.TM - lastTM);
  lastTM = store.TM;
  const open = !!(G.finale && G.finale.done);
  if (!isCharging() && !open) return;
  const gate = G.bs.find(b => b.type === 'stargate' && b.done);
  if (!gate) return;
  const x = gate.x + 1,
    z = gate.y + 1,
    charge = chargeFrac(G.finale),
    pulse = 0.5 + Math.sin(store.TM * (2 + charge * 4)) * 0.5;
  // Twee lagen: een brede zachte gloed en een smalle felle kern. Hoe voller, hoe breder en feller.
  // Per laag: naam, straal, kleur en doorzichtigheid.
  const layers: [string, number, string, number][] = [
    ['gateglow', 0.5 + charge * 0.7, '#8a5cff', 0.08 + charge * 0.14 + pulse * 0.05],
    ['gatecore', 0.14 + charge * 0.2, '#e6dcff', 0.25 + charge * 0.4 + pulse * 0.1],
  ];
  for (const [name, radius, colour, opacity] of layers) {
    const m = pool(name, beamMesh);
    m.material.color.set(colour);
    m.material.opacity = open ? Math.min(1, opacity * 1.6) : opacity;
    m.position.set(x, 1.1, z);
    m.scale.set(radius, 60, radius);
  }
  // Vonken die langs de zuil omhoog stijgen, meer naarmate hij voller is
  sparkT -= dt * (6 + charge * 20);
  while (sparkT < 0) {
    sparkT += 1;
    const a = Math.random() * Math.PI * 2,
      r = 0.3 + Math.random() * 0.9;
    emit(
      LAYER.glow,
      x + Math.cos(a) * r,
      0.4,
      z + Math.sin(a) * r,
      0,
      2 + Math.random() * 2,
      0,
      2.2,
      0.06,
      0.01,
      0xcbb8ff,
      0.9,
    );
  }
}
