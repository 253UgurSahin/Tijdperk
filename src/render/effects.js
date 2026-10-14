import * as T3 from 'three';
import { store } from '../core/store.js';
import { G } from '../game/state.js';
import { camDist } from './camera.js';
import { pool, ringAt } from './decals.js';
import { GB, gIco, mat } from './kit.js';
import { S3, cam } from './scene.js';
import { hash2 } from '../util/random.js';

const sphM=()=>new T3.Mesh(gIco(0),new T3.MeshBasicMaterial({color:'#fff',transparent:true,depthWrite:false}));
export function drawFx(){for(const p of G.proj){const m=pool(p.big?'shell':'arrow',()=>p.big?new T3.Mesh(gIco(0),mat('#2a2a2a')):new T3.Mesh(GB,new T3.MeshBasicMaterial({color:'#fff3c4'})));
    const dx=p.lx-p.x,dy=p.ly-p.y,l=Math.hypot(dx,dy)||1;m.position.set(p.x,.55,p.y);if(p.big)m.scale.setScalar(.08);else{m.scale.set(.03,.03,.38);m.rotation.set(0,Math.atan2(dx,dy),0);m.material.color.set(p.col||'#fff3c4')}}
  for(const e of G.fx){const k=e.life/e.max;
    if(e.type==='smoke'){const m=pool('smoke',sphM);m.material.color.set(e.col||'#e9ebe4');m.material.opacity=k*.5;m.position.set(e.x,.2+(e.z||0)/32,e.y);m.scale.setScalar(.12+(1-k)*.35)}
    else if(e.type==='chip'){const m=pool('chip',()=>new T3.Mesh(GB,mat('#fff')));m.material=mat(e.col||'#bbb');m.position.set(e.x,(e.z||0)/32,e.y);m.scale.setScalar(.06)}
    else if(e.type==='ring')ringAt(e.x,e.y,.3+(1-k)*1.2,e.col||'#fff',k*.9,.06);
    else if(e.type==='boom'){const m=pool('boom',()=>{const o=sphM();o.material.blending=T3.AdditiveBlending;return o});m.material.color.set('#ffaa46');const kk=Math.max(0,e.life/.35);m.material.opacity=kk*.7;m.position.set(e.x,.3,e.y);m.scale.setScalar((e.r||.5)*(1.3-kk*.6))}
    else if(e.type==='beam'){const m=pool('beam',()=>new T3.Mesh(GB,new T3.MeshBasicMaterial({color:'#5ff',transparent:true,depthWrite:false})));const dx=e.x2-e.x,dy=e.y2-e.y,l=Math.hypot(dx,dy)||1;m.material.color.set(e.col||'#5ff');m.material.opacity=Math.max(0,e.life/.12);m.position.set(e.x,.9,e.y);m.scale.set(.05,.05,l);m.rotation.set(0,Math.atan2(dx,dy),0);m.geometry=GB;m.position.set((e.x+e.x2)/2,.7,(e.y+e.y2)/2);m.translateZ(-l/2)}}}
let RAIN=null;export function drawRain(){if(!G.rain){if(RAIN)RAIN.visible=false;return}if(!RAIN){const n=900,g=new T3.BufferGeometry(),p=new Float32Array(n*6);g.setAttribute('position',new T3.BufferAttribute(p,3));RAIN=new T3.LineSegments(g,new T3.LineBasicMaterial({color:'#cfe0ee',transparent:true,opacity:.45}));RAIN.frustumCulled=false;S3.add(RAIN)}
  RAIN.visible=true;const p=RAIN.geometry.attributes.position.array,R=camDist()*.8;for(let i=0;i<p.length/6;i++){const x=cam.x+(hash2(i,1,2)-.5)*R*2,z=cam.y+(hash2(i,3,4)-.5)*R*2,y=((hash2(i,5,6)*20-store.TM*14*(1+hash2(i,7,8)*.3))%20+20)%20;p.set([x,y,z,x-.08,y+.5,z+.08],i*6)}RAIN.geometry.attributes.position.needsUpdate=true}
