import * as THREE from 'three';
import { LIGHT } from './setup';
import { TAU } from '../core/constants';
import { B } from '../data/buildings';
import { bx } from './kit';
import { makeBuilding } from './models';
import { RC } from './terrain';
import { FOEK, makeUnit, makeVillager } from './units';
import { roadTier } from '../sim/rules';
import { G } from '../sim/state';

// ---- icons & portraits (rendered from the 3D models) ----
// IS and ICAM are created together with IR on first use
let IR: THREE.WebGLRenderer | null = null, IS: THREE.Scene = null!, ICAM: THREE.OrthographicCamera = null!;
function snap(obj: THREE.Object3D, size = 128, zoom = 1): string {
    if (!IR) {
        IR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        IR.outputColorSpace = THREE.LinearSRGBColorSpace;
        IR.setPixelRatio(1);
        IS = new THREE.Scene();
        IS.add(new THREE.HemisphereLight(0xffffff, 0x6a7a58, .95 * LIGHT));
        const dl = new THREE.DirectionalLight(0xfff2dd, .95 * LIGHT);
        dl.position.set(-3, 6, 4);
        IS.add(dl);
        ICAM = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    }
    IR.setSize(size, size, false);
    IS.add(obj);
    const bb = new THREE.Box3().setFromObject(obj), sp2 = bb.getBoundingSphere(new THREE.Sphere()), r = sp2.radius * 1.02 / zoom;
    ICAM.left = -r;
    ICAM.right = r;
    ICAM.top = r;
    ICAM.bottom = -r;
    ICAM.updateProjectionMatrix();
    const c = sp2.center;
    ICAM.position.set(c.x + r * 3, c.y + r * 2.6, c.z + r * 3);
    ICAM.lookAt(c);
    IR.setClearColor(0x000000, 0);
    IR.render(IS, ICAM);
    const url = IR.domElement.toDataURL();
    IS.remove(obj);
    return url;
}
const iconCache: Record<string, string> = {};
export function iconFor(type: string): string {
    const key = type + (type === 'townhall' || type === 'road' ? G.age : '');
    if (iconCache[key])
        return iconCache[key];
    let g: THREE.Group;
    if (B[type].road) {
        g = new THREE.Group();
        const t = roadTier();
        bx(g, 1, .04, 1, `rgb(${RC[t].join(',')})`);
        bx(g, 1, .03, .08, '#5a7a3a', 0, 0, .55);
        bx(g, 1, .03, .08, '#5a7a3a', 0, 0, -.55);
    }
    else
        g = makeBuilding(type, G.age, null);
    return iconCache[key] = snap(g);
}
/** `key` is the job for 'v', the unit key for 'u' and the foe type (index into FOEK) for 'f'. */
export function portrait(kind: string, key: string | number): string {
    const ck = 'p' + kind + key;
    if (iconCache[ck])
        return iconCache[ck];
    const g = kind === 'v' ? makeVillager(key as string) : kind === 'u' ? makeUnit(key as string, false) : makeUnit(FOEK[key as number] || 'plunder', true);
    g.rotation.y = -.5;
    return iconCache[ck] = snap(g, 128, 1.25);
}
export function circ(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
    c.fillStyle = col;
    c.beginPath();
    c.arc(x, y, Math.max(.1, r), 0, TAU);
    c.fill();
}
