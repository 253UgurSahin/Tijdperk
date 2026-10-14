import * as T3 from 'three';
import { CN, H, W } from '../config.js';
import { G } from '../game/state.js';
import { mat } from './kit.js';
import { S3 } from './scene.js';
import { fbm, hash2, vnoise } from '../util/random.js';
import { road, ter } from '../world/world.js';

const TS=16,TCAN=document.createElement('canvas');TCAN.width=W*TS;TCAN.height=H*TS;export const tctx=TCAN.getContext('2d');export let timg=null;
export const TTEX=new T3.CanvasTexture(TCAN);TTEX.magFilter=T3.LinearFilter;TTEX.minFilter=T3.LinearMipmapLinearFilter;TTEX.anisotropy=4;
export const TMAT=new T3.MeshStandardMaterial({map:TTEX,roughness:.95,flatShading:false});
let TMESH=null;const WMAT=new T3.MeshStandardMaterial({color:'#2f6578',roughness:.22,metalness:.2,transparent:true,opacity:.88});
export const RC=[null,[176,152,108],[168,166,156],[78,82,88]];
export function tileRGB(x,y){const i=y*W+x,t=ter[i],n=vnoise(x/6,y/6,G.seed+9),v=hash2(x,y,5);
  if(t===1)return[40,74,84];if(t===2)return[176+n*14,158+n*12,112+n*10];if(t===3)return[182,186,178];
  const w=fbm(x/22,y/22,G.seed+3);return[70+w*34+n*16+v*6,98+w*26+n*16+v*5,44+w*10+n*8]}
export function paintTile(x,y){const i=y*W+x,[r0,g0,b0]=tileRGB(x,y),lk=!G.unl[(y>>4)*CN+(x>>4)],rd=road[i],d=timg.data,X0=x*TS,Y0=y*TS,WW=W*TS;
  const nb=(dx,dy)=>{const xx=x+dx,yy=y+dy;return xx<0||yy<0||xx>=W||yy>=H?0:road[yy*W+xx]};
  for(let py=0;py<TS;py++)for(let px=0;px<TS;px++){let r=r0,g=g0,b=b0;const h=hash2(X0+px,Y0+py,7);
    if(ter[i]===0){const k=.9+h*.18;r*=k;g*=k;b*=k;if(h>.965){r*=.78;g*=.82;b*=.7}}else if(ter[i]!==1){const k=.94+h*.1;r*=k;g*=k;b*=k}
    if(rd){const ex=(px<3&&!nb(-1,0))||(px>12&&!nb(1,0))||(py<3&&!nb(0,-1))||(py>12&&!nb(0,1));if(!ex){const c=RC[rd],k=.9+h*.16;r=c[0]*k;g=c[1]*k;b=c[2]*k;if(rd===2&&((px+(py>>2)*2)%5===0||py%4===0)){r*=.86;g*=.86;b*=.86}if(rd===3&&py===8&&px%6<3){r=230;g=220;b=150}}}
    if(lk){const m=(r+g+b)/3;r=(r*.35+m*.25)*.62+14;g=(g*.35+m*.25)*.62+18;b=(b*.35+m*.25)*.62+24}
    const o=((Y0+py)*WW+X0+px)*4;d[o]=r;d[o+1]=g;d[o+2]=b;d[o+3]=255}
  // territory border
  if(!lk){const L=(xx,yy)=>xx<0||yy<0||xx>=W||yy>=H||!G.unl[(yy>>4)*CN+(xx>>4)];const put=(px,py)=>{const o=((Y0+py)*WW+X0+px)*4;d[o]=236;d[o+1]=214;d[o+2]=150};
    if(L(x-1,y))for(let p=0;p<TS;p++){put(0,p);put(1,p)}if(L(x+1,y))for(let p=0;p<TS;p++){put(TS-1,p);put(TS-2,p)}if(L(x,y-1))for(let p=0;p<TS;p++){put(p,0);put(p,1)}if(L(x,y+1))for(let p=0;p<TS;p++){put(p,TS-1);put(p,TS-2)}}}
export function paintAll(){timg=tctx.createImageData(W*TS,H*TS);for(let y=0;y<H;y++)for(let x=0;x<W;x++)paintTile(x,y);tctx.putImageData(timg,0,0);TTEX.needsUpdate=true}
export function buildTerrain(){if(TMESH){S3.remove(TMESH);TMESH.geometry.dispose()}
  const g=new T3.PlaneGeometry(W,H,W,H);g.rotateX(-Math.PI/2);g.translate(W/2,0,H/2);const p=g.attributes.position;
  for(let k=0;k<p.count;k++){const x=Math.round(p.getX(k)),z=Math.round(p.getZ(k));let wc=0,n=0;for(const[dx,dz]of[[-1,-1],[0,-1],[-1,0],[0,0]]){const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=W||zz>=H)continue;n++;if(ter[zz*W+xx]===1)wc++}
    p.setY(k,wc===n&&n?-.55:wc?-.32*wc/n:0)}
  g.computeVertexNormals();TMESH=new T3.Mesh(g,TMAT);TMESH.receiveShadow=true;S3.add(TMESH)}
const WATER=new T3.Mesh(new T3.PlaneGeometry(W+400,H+400),WMAT);WATER.rotation.x=-Math.PI/2;WATER.position.set(W/2,-.16,H/2);S3.add(WATER);
{const sk=mat('#3a2f25');for(const[x,z,ry,l]of[[W/2,H,0,W],[W,H/2,Math.PI/2,H],[W/2,0,Math.PI,W],[0,H/2,-Math.PI/2,H]]){const m=new T3.Mesh(new T3.PlaneGeometry(l,6),sk);m.position.set(x,-3,z);m.rotation.y=ry;S3.add(m)}}
