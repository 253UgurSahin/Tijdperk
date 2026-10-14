import { W } from '../config.js';
import { B } from '../data/buildings.js';
import { NODES, RES_NODES } from '../data/nodes.js';
import { GATHER, RES } from '../data/resources.js';
import { G } from './state.js';
import { darkness } from './time.js';
import { bLight, bRate, hasT } from './upgrades.js';
import { dist } from '../util/math.js';
import { amt, claims, isUnl, node, nodeLists } from '../world/world.js';

export let lights=[],powerRatio=1,powerSup=0,powerDem=0,avail={},wr={},siteCnt=new Map(),farmCnt=new Map(),demand={};
export function computeCaches(){
  powerSup=0;powerDem=0;
  for(const b of G.bs){if(!b.done)continue;const d=B[b.type];
    if(d.gen&&b.on){const pw=d.gen.power*bRate(b)*(hasT('electric')?1.25:1);if(d.gen.solar)powerSup+=pw*(darkness()>.3?.15:1);else if(b.run)powerSup+=pw}
    if(d.power&&b.on)powerDem+=d.power}
  powerRatio=powerDem?Math.min(1,powerSup/powerDem):1;
  lights=[];
  for(const b of G.bs){if(!b.done)continue;const d=B[b.type];if(!d.light)continue;
    if(d.power&&powerRatio<.3)continue;if(d.gen&&!d.gen.solar&&!b.run)continue;
    lights.push({x:b.x+d.size/2,y:b.y+d.size/2,r:bLight(b),warm:b.type==='campfire'||b.type==='lantern'||(b.type==='townhall'&&G.age<3)})}
  claims.fill(0);wr={};siteCnt.clear();farmCnt.clear();
  for(const v of G.vs){if(v.hidden)continue;const t=v.tgt;
    if(t){if(t.k==='node')claims[t.i]=Math.min(255,claims[t.i]+1);else if(t.k==='farm')farmCnt.set(t.b.id,(farmCnt.get(t.b.id)||0)+1);else if(t.k==='site')siteCnt.set(t.b.id,(siteCnt.get(t.b.id)||0)+1)}
    if(v.res&&(v.state==='gather'||v.state==='walk'))wr[v.res]=(wr[v.res]||0)+1}
  demand={};
  for(const b of G.bs){if(!b.done||!b.on)continue;const d=B[b.type];const inp=d.conv?d.conv.in:d.gen&&d.gen.in;if(inp)for(const k in inp)demand[k]=1}
  if(G.us.length||G.bs.some(b=>b.q.length))demand.food=1;
}
export function computeAvail(){
  avail={};
  for(const r of GATHER){if(RES[r].age>G.age)continue;
    if(r==='food'&&G.bs.some(b=>b.type==='farm'&&b.done)){avail.food=1;continue}
    for(const t of RES_NODES[r]){if(NODES[t].age>G.age)continue;const L=nodeLists[t];
      for(let j=0;j<L.length;j++){const i=L[j];if(node[i]===t&&amt[i]>0&&isUnl(i%W,(i/W)|0)){avail[r]=1;break}}
      if(avail[r])break}}
}
export function litAt(x,y){for(const L of lights)if(dist(x,y,L.x,L.y)<=L.r-.3)return true;return false}
