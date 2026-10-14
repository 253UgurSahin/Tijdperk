import * as T3 from 'three';
import { H, TAU, W } from '../config.js';
import { NODES } from '../data/nodes.js';
import { RES } from '../data/resources.js';
import { G } from '../game/state.js';
import { C, M_, gCyl, gDod, gIco, gOct, mat } from './kit.js';
import { S3 } from './scene.js';
import { hash2 } from '../util/random.js';
import { bmap, isUnl, node } from '../world/world.js';

function bakePart(geo,m,x,y,z,sx,sy,sz){const g=geo.clone();g.applyMatrix4(new T3.Matrix4().compose(new T3.Vector3(x,y,z),new T3.Quaternion(),new T3.Vector3(sx,sy,sz)));return{geo:g,mat:M_(m)}}
export const FOL={pine:mat('#3f6b3f'),pine2:mat('#4a7a45'),birch:mat('#8fbf5a'),oak:mat('#4f8a3c'),bush:mat('#4d7d38')};
const NVAR={
  pine:[bakePart(gCyl(.06,.07,6),C.woodd,0,0,0,1,.4,1),bakePart(gCyl(0,.42,7),FOL.pine,0,.28,0,1,.62,1),bakePart(gCyl(0,.32,7),FOL.pine2,0,.62,0,1,.55,1)],
  birch:[bakePart(gCyl(.045,.055,6),'#e8e4d8',0,0,0,1,.7,1),bakePart(gIco(0),FOL.birch,0,.9,0,.3,.42,.3)],
  oak:[bakePart(gCyl(.06,.08,6),'#6e5537',0,0,0,1,.45,1),bakePart(gIco(0),FOL.oak,0,.78,0,.44,.38,.44),bakePart(gIco(0),FOL.oak,.18,.62,.1,.26,.24,.26)],
  bush:[bakePart(gIco(0),FOL.bush,0,.14,0,.24,.18,.24),bakePart(gIco(0),'#c43c3c',.08,.28,.06,.05,.05,.05),bakePart(gIco(0),'#c43c3c',-.1,.24,.02,.05,.05,.05)],
  rock:[bakePart(gDod(),'#9a9c92',0,.1,0,.3,.22,.28)],
  coal:[bakePart(gDod(),'#3e4146',0,.1,0,.32,.24,.3),bakePart(gDod(),'#2a2c30',.18,.06,.12,.14,.12,.14)],
  oil:[bakePart(gCyl(.4,.4,10),'#1c1820',0,0,0,1,.025,1),bakePart(gCyl(.12,.12,8),'#4d3d5c',.1,.02,.05,1,.01,1)],
  sand:[bakePart(gIco(0),'#c9b07c',0,-.02,0,.42,.1,.38)],
};
for(const k of['copper','tin','iron','gold','lithium'])NVAR[k]=[bakePart(gDod(),k==='lithium'?'#d9dcd6':'#7b7d78',0,.1,0,.3,.22,.28),bakePart(gOct(),RES[k].c,.05,.3,0,.1,.18,.1),bakePart(gOct(),RES[k].c,-.12,.22,.08,.07,.12,.07)];
const NGROUP=new T3.Group();S3.add(NGROUP);let NI3={},unlSnap='';
const nodeVar=i=>{const k=NODES[node[i]].k;if(k!=='tree')return k;const h=hash2(i%W,(i/W)|0,21);return h<.45?'pine':h<.72?'birch':'oak'};
const _m4=new T3.Matrix4(),_q=new T3.Quaternion(),_v=new T3.Vector3(),_s=new T3.Vector3(),_e=new T3.Euler(),_c=new T3.Color();
export function rebuildNodes(full){
  if(full){for(const k in NI3)for(const m of NI3[k])NGROUP.remove(m);NI3={};const cnt={};for(let i=0;i<W*H;i++)if(node[i]){const v=nodeVar(i);cnt[v]=(cnt[v]||0)+1}
    for(const v in NVAR){const cap=(cnt[v]||0)+40;NI3[v]=NVAR[v].map(p=>{const m=new T3.InstancedMesh(p.geo,p.mat,cap);m.castShadow=v!=='oil'&&v!=='sand';m.receiveShadow=true;m.count=0;m.instanceMatrix.setUsage(T3.DynamicDrawUsage);m.frustumCulled=false;NGROUP.add(m);return m})}}
  const n={};for(const v in NI3)n[v]=0;
  for(let i=0;i<W*H;i++){const t=node[i];if(!t||bmap[i]||NODES[t].age>G.age)continue;const v=nodeVar(i),arr=NI3[v];if(!arr)continue;const k=n[v];if(k>=arr[0].instanceMatrix.count)continue;
    const x=i%W,y=(i/W)|0,h1=hash2(x,y,31),h2=hash2(x,y,32),h3=hash2(x,y,33),sc=v==='oil'||v==='sand'?1:.82+h3*.38;
    _v.set(x+.5+(h1-.5)*.3,0,y+.5+(h2-.5)*.3);_q.setFromEuler(_e.set(0,h1*TAU,0));_s.set(sc,sc*(v==='pine'?.9+h2*.4:1),sc);_m4.compose(_v,_q,_s);
    const lk=!isUnl(x,y);_c.setRGB(lk?.5:1,lk?.52:1,lk?.56:1);
    for(const m of arr){m.setMatrixAt(k,_m4);m.setColorAt(k,_c)}n[v]=k+1}
  for(const v in NI3)for(const m of NI3[v]){m.count=n[v];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}}
