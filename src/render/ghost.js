import * as T3 from 'three';
import { store } from '../core/store.js';
import { B } from '../data/buildings.js';
import { canPlace, ghostPos, lineTiles } from '../game/placement.js';
import { G } from '../game/state.js';
import { drag, mouse } from '../input/input.js';
import { quadAt, rangeAt } from './decals.js';
import { makeBuilding } from './models.js';
import { S3 } from './scene.js';

const ghostCache={};const GHOK=new T3.MeshStandardMaterial({color:'#6fe08a',transparent:true,opacity:.55,flatShading:true,depthWrite:false}),GHBAD=new T3.MeshStandardMaterial({color:'#ff6a58',transparent:true,opacity:.55,flatShading:true,depthWrite:false});
function ghost(type){if(ghostCache[type])return ghostCache[type];const g=makeBuilding(type,G.age,null);g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.renderOrder=4}});S3.add(g);return ghostCache[type]=g}
function hideGhosts(except){for(const k in ghostCache)if(k!==except)ghostCache[k].visible=false}
export function drawPlacement(){
  if(!store.placing||!mouse.in||mouse.touch){hideGhosts();return}
  const d=B[store.placing];
  if(drag&&drag.mode==='line'){hideGhosts();let budget={...G.res};for(const[x,y]of lineTiles(drag.t0,drag.t1)){const err=canPlace(store.placing,x,y,true);let ok=!err;if(ok){for(const k in d.cost)if(budget[k]<d.cost[k])ok=false;if(ok)for(const k in d.cost)budget[k]-=d.cost[k]}quadAt(x+.5,y+.5,.96,.96,ok?'#59d27a':'#e5584a',.55)}return}
  const[gx,gy]=ghostPos(),err=canPlace(store.placing,gx,gy),s=d.size;hideGhosts(store.placing);
  if(!d.road){const g=ghost(store.placing);g.visible=true;g.position.set(gx+s/2,0,gy+s/2);g.traverse(o=>{if(o.isMesh)o.material=err?GHBAD:GHOK})}
  for(let dy=0;dy<s;dy++)for(let dx=0;dx<s;dx++)quadAt(gx+dx+.5,gy+dy+.5,.94,.94,err?'#e5584a':'#59d27a',.5);
  if(d.def||d.light)rangeAt(gx+s/2,gy+s/2,d.def?d.def.r:d.light,'#ffffff')}
