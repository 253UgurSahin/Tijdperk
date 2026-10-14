import * as T3 from 'three';
import { store } from '../core/store.js';
import { CN, CS, W } from '../config.js';
import { B } from '../data/buildings.js';
import { canBuyChunk } from '../game/placement.js';
import { G, bById, sel } from '../game/state.js';
import { darkness } from '../game/time.js';
import { drag, hoverChunk, mouse } from '../input/input.js';
import { updateCamera } from './camera.js';
import { pool, poolsBegin, poolsEnd, quadAt, rangeAt, ringAt } from './decals.js';
import { drawFx, drawRain } from './effects.js';
import { drawPlacement } from './ghost.js';
import { flagpole } from './kit.js';
import { applySeason, lighting } from './lighting.js';
import { drawOverlay } from './overlay.js';
import { CAM3, R3, S3 } from './scene.js';
import { checkWorld, syncBuildings, syncCamps, syncEntities } from './sync.js';
import { inb } from '../world/world.js';

export function render(){store.TM=performance.now()/1000;const dk=darkness();
  checkWorld();applySeason();updateCamera();poolsBegin();
  syncBuildings();syncEntities();syncCamps();drawFx();drawRain();drawPlacement();lighting(dk);
  // selection decals
  const sb=sel.b&&bById.get(sel.b);
  if(sb){const d=B[sb.type],s=d.size,cx=sb.x+s/2,cz=sb.y+s/2;quadAt(cx,cz,s+.15,s+.15,'#9fe28a',.28,.025);for(const r of[d.def&&d.def.r,d.light].filter(Boolean))rangeAt(cx,cz,r,'#ffffff');if(sb.rally){ringAt(sb.rally.x,sb.rally.y,.35,'#ffffff',.9);const f=pool('rally',()=>{const g=new T3.Group();flagpole(g,0,0,0,.8);return g});f.position.set(sb.rally.x,0,sb.rally.y)}}
  if(sel.camp){const c=G.camps.find(c=>c.id===sel.camp);if(c)ringAt(c.x+1,c.y+1,1.7,'#e3584a',.9)}
  if(sel.node>=0)ringAt(sel.node%W+.5,((sel.node/W)|0)+.5,.45,'#ffffff',.9);
  if(mouse.in&&!drag&&!store.placing&&!store.expandMode&&inb(Math.floor(mouse.tx),Math.floor(mouse.ty))&&!mouse.touch)quadAt(Math.floor(mouse.tx)+.5,Math.floor(mouse.ty)+.5,.96,.96,'#ffffff',.12,.02);
  if(store.expandMode)for(let cy2=0;cy2<CN;cy2++)for(let cx2=0;cx2<CN;cx2++){if(!canBuyChunk(cx2,cy2))continue;const hov=hoverChunk&&hoverChunk[0]===cx2&&hoverChunk[1]===cy2;quadAt(cx2*CS+8,cy2*CS+8,CS-.6,CS-.6,hov?'#ffe6a8':'#d6b46c',hov?.42:.3,.06)}
  poolsEnd();R3.render(S3,CAM3);drawOverlay()}
