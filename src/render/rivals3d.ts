// Rivalen in 3D: hun gebouwen, met vlag, banieren en daken in hun eigen kleur.
import type { GameState, Rival, RivalBuilding } from '../types';
import * as T3 from 'three';
import { store } from '../core/store';
import { B } from '../data/buildings';
import { RIVAL } from '../data/rivals';
import { G } from '../game/state';
import { quadG } from './decals';
import { disposeMerged, flagpole, isMesh, mat, paint } from './kit';
import { makeBuilding } from './models';
import { LAYER, puff } from './particles';
import { S3 } from './scene';
import { changedAt, scaffold } from './sync';

export const RG3 = new T3.Group();
S3.add(RG3);
/** Wat er per gebouw van een rivaal bewaard wordt: houder (g), model (m), hoogte (h) en grootte (s). */
interface RivalBuildingRec {
  g: T3.Group;
  m: T3.Group;
  /** Verandert de sleutel (soort, tijdperk, klaar), dan wordt het model opnieuw gemaakt. */
  key: string;
  h: number;
  s: number;
  flags: T3.Object3D[];
  fires: T3.Object3D[];
  spins: T3.Object3D[];
}
/** Per gebouw van een rivaal: de 3D-groep en wat er beweegt (vlaggen, vuur, wieken). */
export const rbRec = new Map<number, RivalBuildingRec>();
let lastG: GameState | null = null;

/** Houd de gebouwen van alle rivalen gelijk met de spelstand. */
export function syncRivalBuildings() {
  // Nieuw spel of geladen: alles opnieuw
  if (lastG !== G) {
    for (const r of rbRec.values()) {
      RG3.remove(r.g);
      disposeMerged(r.g);
    }
    rbRec.clear();
    lastG = G;
  }
  const seen = new Set<number>();
  for (const rival of G.rivals || []) {
    if (rival.dead) continue;
    for (const b of rival.bs) {
      seen.add(b.id);
      // Een nieuw model als het gebouw af is, of hun stamhuis met een nieuw tijdperk meegroeit
      const key = `${b.type}|${b.type === 'townhall' ? rival.age : ''}|${b.done ? 1 : 0}`;
      let r = rbRec.get(b.id);
      if (!r || r.key !== key) {
        if (r) {
          RG3.remove(r.g);
          disposeMerged(r.g);
        }
        r = buildModel(b, rival, key);
        rbRec.set(b.id, r);
        // Minikaart en schaduw daar opnieuw, en geen gras en bloemen onder een nieuw gebouw
        changedAt(b.x, b.y, b.x + r.s - 1, b.y + r.s - 1);
      }
      animate(r, b);
    }
  }
  for (const [id, r] of rbRec)
    if (!seen.has(id)) {
      RG3.remove(r.g);
      disposeMerged(r.g);
      rbRec.delete(id);
      // Het midden van het gebouw min de halve grootte: de linkerbovenhoek (zie buildModel)
      const x = r.g.position.x - r.s / 2,
        y = r.g.position.z - r.s / 2;
      changedAt(x, y, x + r.s - 1, y + r.s - 1);
    }
}

function buildModel(b: RivalBuilding, rival: Rival, key: string): RivalBuildingRec {
  const d = B[b.type],
    s = d.size,
    colour = RIVAL[rival.k].c;
  const g = new T3.Group();
  // Banieren en schilden in hun kleur: makeBuilding gebruikt paint.team, dus die zetten we even om
  const before = paint.team;
  paint.team = colour;
  let m;
  try {
    m = makeBuilding(b.type, rival.age, b);
  } finally {
    paint.team = before;
  }
  g.add(m);
  const h = Math.max(0.3, new T3.Box3().setFromObject(m).max.y);
  tintTop(m, colour, h);
  // Hun eigen vlag op een hoek, zodat je van ver ziet van wie het is
  flagpole(g, -s * 0.42, 0, -s * 0.42, Math.min(1.7, h * 0.55 + 0.5), colour);
  if (!b.done) {
    scaffold(g, s, Math.max(0.6, h * 0.85));
    const floor = new T3.Mesh(quadG, mat('#a58a62'));
    floor.scale.set(s * 0.98, 1, s * 0.98);
    floor.position.y = 0.02;
    g.add(floor);
  }
  g.position.set(b.x + s / 2, 0, b.y + s / 2);
  const flags: T3.Object3D[] = [],
    fires: T3.Object3D[] = [],
    spins: T3.Object3D[] = [];
  g.traverse(o => {
    o.userData.rbid = b.id;
    if (o.userData.flag) flags.push(o);
    if (o.userData.fire) fires.push(o);
    if (o.userData.spin) spins.push(o);
  });
  RG3.add(g);
  return { g, m, key, h, s, flags, fires, spins };
}

// Daken en bovenkanten krijgen een tint van hun kleur; onderaan blijven de muren zoals ze zijn
function tintTop(group: T3.Object3D, colour: string, h: number) {
  const c = new T3.Color(colour);
  group.traverse(o => {
    const col = isMesh(o) && (o.geometry.attributes.color as T3.BufferAttribute);
    if (!col) return;
    const pos = o.geometry.attributes.position as T3.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - h * 0.4) / (h * 0.5)));
      const k = t * t * (3 - 2 * t) * 0.5; // zacht oplopend, hoogstens de helft
      col.setXYZ(
        i,
        col.getX(i) + (c.r - col.getX(i)) * k,
        col.getY(i) + (c.g - col.getY(i)) * k,
        col.getZ(i) + (c.b - col.getZ(i)) * k,
      );
    }
    col.needsUpdate = true;
  });
}

function animate(r: RivalBuildingRec, b: RivalBuilding) {
  if (!b.done) {
    // In aanbouw: het gebouw rijst langzaam op binnen de steigers
    const p = Math.min(1, b.prog / b.bt);
    r.m.position.y = -r.h * (1 - (0.12 + 0.88 * p));
  }
  for (const f of r.flags) f.rotation.y = Math.sin(store.TM * 2 + b.id) * 0.25;
  for (const f of r.fires) f.scale.set(1, 0.85 + Math.sin(store.TM * 13 + b.id) * 0.1, 1);
  // (userData.axis is 'x', 'y' of 'z')
  if (b.done)
    for (const o of r.spins)
      o.rotation[(o.userData.axis || 'y') as 'x' | 'y' | 'z'] = store.TM * o.userData.spin + b.id;
  // Geraakt: stof en vonken op de gevel (flash zet game/military.ts bij elke treffer; hier weer op 0)
  if (b.flash) {
    b.flash = 0;
    const p = r.g.position,
      x = p.x + (Math.random() - 0.5) * r.s * 0.8,
      z = p.z + (Math.random() - 0.5) * r.s * 0.8,
      y = 0.2 + Math.random() * r.h * 0.7;
    puff(LAYER.soft, 3, x, y, z, 0.5, 0.4, 0.9, 0.06, 0.22, 0x9a8c76, 0.6);
    puff(LAYER.glow, 3, x, y, z, 1.4, 1.4, 0.3, 0.035, 0.01, 0xffc070, 1, -4);
  }
}
