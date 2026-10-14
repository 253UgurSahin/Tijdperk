import * as T3 from 'three';
import { S3 } from './scene.js';

// Light pools fade to black (not to transparent) and blend with MAX, so overlapping
// lights never add up into a white-hot blob: the brightest one simply wins.
function radialTex(r,g,b){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),gr=x.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,`rgb(${r},${g},${b})`);gr.addColorStop(.45,`rgb(${r*.55|0},${g*.55|0},${b*.55|0})`);gr.addColorStop(1,'rgb(0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);return new T3.CanvasTexture(c)}
const GLOWTEX=radialTex(255,180,100),GLOWTEXC=radialTex(200,225,255);
export const GLOWS=[];export function glow(i,warm){let m=GLOWS[i];if(!m){m=new T3.Mesh(new T3.CircleGeometry(1,40),new T3.MeshBasicMaterial({map:GLOWTEX,blending:T3.CustomBlending,blendEquation:T3.MaxEquation,depthWrite:false,fog:false}));m.rotation.x=-Math.PI/2;m.renderOrder=2;S3.add(m);GLOWS[i]=m}m.material.map=warm?GLOWTEX:GLOWTEXC;m.visible=true;return m}
export const RINGG=new T3.RingGeometry(.86,1,40);RINGG.rotateX(-Math.PI/2);
const POOLS={};export function pool(name,make){const P=POOLS[name]||(POOLS[name]={list:[],n:0,make});if(P.n>=P.list.length){const o=make();S3.add(o);P.list.push(o)}const o=P.list[P.n++];o.visible=true;return o}
export function poolsBegin(){for(const k in POOLS)POOLS[k].n=0}
export function poolsEnd(){for(const k in POOLS){const P=POOLS[k];for(let i=P.n;i<P.list.length;i++)P.list[i].visible=false}}
const ringMesh=()=>{const m=new T3.Mesh(RINGG,new T3.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.9,depthWrite:false}));m.renderOrder=3;return m};
export const quadG=new T3.PlaneGeometry(1,1);quadG.rotateX(-Math.PI/2);
const quadMesh=()=>{const m=new T3.Mesh(quadG,new T3.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.4,depthWrite:false}));m.renderOrder=2;return m};
export function ringAt(x,y,r,col,op=.9,h=.04){const m=pool('ring',ringMesh);m.position.set(x,h,y);m.scale.set(r,1,r);m.material.color.set(col);m.material.opacity=op;return m}
export function quadAt(x,y,w,d,col,op=.4,h=.03){const m=pool('quad',quadMesh);m.position.set(x,h,y);m.scale.set(w,1,d);m.material.color.set(col);m.material.opacity=op;return m}
// thin range circle
const RANGEG=new T3.RingGeometry(.985,1,72);RANGEG.rotateX(-Math.PI/2);
export function rangeAt(x,y,r,col){const m=pool('range',()=>{const o=new T3.Mesh(RANGEG,new T3.MeshBasicMaterial({color:'#fff',transparent:true,opacity:.6,depthWrite:false}));o.renderOrder=3;return o});m.position.set(x,.05,y);m.scale.set(r,1,r);m.material.color.set(col);return m}
