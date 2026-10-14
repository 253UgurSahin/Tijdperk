import { CN, H, TAU, W } from '../config.js';
import { B } from '../data/buildings.js';
import { NI, NODES } from '../data/nodes.js';
import { G } from '../game/state.js';
import { clamp, dist } from '../util/math.js';
import { fbm, hash2, mulberry32 } from '../util/random.js';

export let ter,node,amt,bmap,tcol,trgb,trgb2,nodeLists,unreach,claims,blk,road;
export function genWorld(seed){
  ter=new Uint8Array(W*H);blk=new Uint8Array(W*H);road=new Uint8Array(W*H);node=new Uint8Array(W*H);amt=new Uint16Array(W*H);bmap=new Int32Array(W*H);
  unreach=new Float32Array(W*H);claims=new Uint8Array(W*H);tcol=new Array(W*H);trgb=new Uint8Array(W*H*3);trgb2=new Uint8Array(W*H*3);
  const R=mulberry32(seed),s=seed%9973,cx=W/2,cy=H/2,elev=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,d=dist(x,y,cx,cy);let e=fbm(x/24,y/24,s);
    if(d<12)e=Math.max(e,.5+(12-d)*.01);
    elev[i]=e;ter[i]=e<.35?1:e<.39?2:0;
    if(ter[i]===0&&d>30&&fbm(x/30,y/30,s+50)>.68)ter[i]=2;
  }
  const blob=(bx,by,r,k,dens)=>{const t=NI[k];for(let y=Math.floor(by-r-1);y<=by+r+1;y++)for(let x=Math.floor(bx-r-1);x<=bx+r+1;x++){
    if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;if(ter[i]===1||dist(x,y,bx,by)>r||R()>dens)continue;
    if(k==='lithium')ter[i]=3;node[i]=t}};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,d=dist(x,y,cx,cy);if(ter[i]!==0)continue;
    if(d>4&&fbm(x/10,y/10,s+100)>.6&&R()<.75){node[i]=NI.tree;continue}
    if(d>3&&fbm(x/7,y/7,s+200)>.72&&R()<.45){node[i]=NI.bush;continue}
    if(d>4&&fbm(x/9,y/9,s+300)>.71&&R()<.55)node[i]=NI.rock;
  }
  blob(cx-10,cy-6,4,'tree',.8);blob(cx+9,cy+7,3,'tree',.75);blob(cx+6,cy-8,2.3,'bush',.7);blob(cx-7,cy+8,2.3,'rock',.75);blob(cx-2,cy+12,1.8,'bush',.6);
  const ORE=[['copper',5,[9,13],[9,45],2],['tin',4,[11,15],[12,48],1.8],['iron',5,[15,21],[15,55],2.2],['gold',3,[21,28],[22,58],1.6],['coal',5,[17,25],[17,58],2.3],['oil',5,[20,30],[20,60],1.5],['lithium',3,[26,34],[26,60],2.2]];
  for(const[k,n,r0,r1,sz]of ORE)for(let j=0;j<n;j++){const rr=j===0?r0:r1,r=rr[0]+R()*(rr[1]-rr[0]),a=R()*TAU;blob(cx+Math.cos(a)*r,cy+Math.sin(a)*r,sz*(.8+R()*.5),k,.72)}
  for(let i=0;i<W*H;i++)if(ter[i]===2&&!node[i]&&R()<.45)node[i]=NI.sand;
  for(let y=cy-3;y<=cy+3;y++)for(let x=cx-3;x<=cx+3;x++)node[y*W+x]=0;
  for(let i=0;i<W*H;i++)if(node[i]){const a=NODES[node[i]].amt;amt[i]=Math.round(a[0]+R()*(a[1]-a[0]))}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,v=hash2(x,y,s+7),n=fbm(x/7,y/7,s+400);let r,g,b;
    if(ter[i]===0){r=178+n*26+v*8;g=198+n*20+v*7;b=140+n*16+v*5}
    else if(ter[i]===1){const dp=clamp((.35-elev[i])*6,0,1);r=150-dp*40+v*4;g=196-dp*30+v*4;b=196-dp*14+v*3}
    else if(ter[i]===2){r=226+n*10+v*5;g=212+n*10+v*4;b=166+n*10}
    else{r=232+v*8;g=236+v*6;b=226+v*6}
    r=clamp(r|0,0,255);g=clamp(g|0,0,255);b=clamp(b|0,0,255);tcol[i]=`rgb(${r},${g},${b})`;trgb[i*3]=r;trgb[i*3+1]=g;trgb[i*3+2]=b;
    let r2,g2,b2;if(ter[i]===0){r2=62+n*24+v*7;g2=90+n*26+v*8;b2=46+n*12}else if(ter[i]===1){const dp=clamp((.35-elev[i])*6,0,1);r2=34-dp*12;g2=80-dp*26+v*3;b2=98-dp*18+v*3}else if(ter[i]===2){r2=186+n*16+v*6;g2=166+n*14+v*5;b2=116+n*10}else{r2=200+v*10;g2=206+v*8;b2=194+v*6}
    trgb2[i*3]=clamp(r2|0,0,255);trgb2[i*3+1]=clamp(g2|0,0,255);trgb2[i*3+2]=clamp(b2|0,0,255);
  }
}
let tcan=null;
function buildTerrainImage(){tcan=document.createElement('canvas');tcan.width=W;tcan.height=H;const x=tcan.getContext('2d'),im=x.createImageData(W,H);for(let i=0;i<W*H;i++){im.data[i*4]=trgb2[i*3];im.data[i*4+1]=trgb2[i*3+1];im.data[i*4+2]=trgb2[i*3+2];im.data[i*4+3]=255}x.putImageData(im,0,0)}
export function buildLists(){buildTerrainImage();nodeLists=NODES.map(()=>[]);for(let i=0;i<W*H;i++)if(node[i])nodeLists[node[i]].push(i)}
export const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
export const isUnl=(x,y)=>inb(x,y)&&G.unl[(y>>4)*CN+(x>>4)]===1;
export const walkable=(x,y)=>isUnl(x,y)&&ter[y*W+x]!==1&&blk[y*W+x]!==1;
export const freeWalk=(x,y)=>inb(x,y)&&ter[y*W+x]!==1&&blk[y*W+x]!==1;
export const foeWalk=(x,y)=>inb(x,y)&&ter[y*W+x]!==1&&!blk[y*W+x];
export function setBlk(b,on){const d=B[b.type];if(!d.wall)return;for(let dy=0;dy<d.size;dy++)for(let dx=0;dx<d.size;dx++)blk[(b.y+dy)*W+b.x+dx]=on?(d.gate?2:1):0}
export function nearestWall(x,y){let best=null,bd=1e9;for(const b of G.bs){if(!b.done||!B[b.type].wall)continue;const d=dist(x,y,b.x+.5,b.y+.5);if(d<bd){bd=d;best=b}}return best}
export const nodeVis=i=>node[i]&&NODES[node[i]].age<=G.age;
