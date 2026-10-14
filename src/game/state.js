import { CN, TAU, W } from '../config.js';
import { PLACES } from '../data/names.js';
import { RKEYS } from '../data/resources.js';
import { placeBuilding, spawnFoe, spawnVillager } from './entities.js';
import { afterLoad } from './save.js';
import { clearSel } from '../input/selection.js';
import { centerOn } from '../render/camera.js';
import { cam } from '../render/scene.js';
import { note } from '../ui/hud.js';
import { dist } from '../util/math.js';
import { mulberry32 } from '../util/random.js';
import { buildLists, genWorld, inb, node, ter } from '../world/world.js';

export let G=null;export const bById=new Map();
export const sel={vs:new Set(),us:new Set(),b:null,camp:null,node:-1};
export function baseState(seed){
  const g={seed,age:0,res:{},t:0,clock:7,day:1,speed:1,unl:new Array(CN*CN).fill(0),
    bs:[],vs:[],us:[],foes:[],proj:[],fx:[],regrow:[],camps:[],spawnQ:[],log:[],nid:1,raids:0,tools:1,carryCap:10,
    autoTrain:true,trainQ:0,toolLvl:0,armsLvl:0,rain:0,groups:{},hist:[],offer:null,stance:'guard',diff:1,tech:{},research:null,buff:{},forceRaid:0,event:null,lastEvent:0,training:false,trainT:0,peaceful:false,won:false,over:false,bought:0,hungry:false,
    stats:{gathered:0,killed:0,born:0,camps:0,trained:0,knight:0}};
  RKEYS.forEach(k=>g.res[k]=0);return g;
}
export function newGame(seed,diff=1){
  seed=seed||((Math.random()*1e9)|0);
  G=baseState(seed);G.diff=diff;G.peaceful=diff===0;Object.assign(G.res,diff===2?{food:150,wood:120,stone:40}:{food:200,wood:160,stone:60});
  for(const c of[[3,3],[4,3],[3,4],[4,4]])G.unl[c[1]*CN+c[0]]=1;
  genWorld(seed);buildLists();bById.clear();
  placeBuilding('townhall',63,63,true);
  for(let k=0;k<5;k++)spawnVillager(63+(k%3)*.7,65.5+(k>2?.8:0));
  genCamps(seed);
  clearSel();
  centerOn(64,64,true);cam.z=1;
  note(`Je stam vestigt zich in ${placeName()}.`);
  afterLoad();
}
export const placeName=()=>PLACES[G.seed%PLACES.length];
function genCamps(seed){
  const R=mulberry32(seed+77),RANGES=[[22,28],[27,35],[33,42],[39,48],[45,54],[50,58]];
  for(let tier=0;tier<6;tier++){
    for(let tries=0;tries<200;tries++){
      const a=R()*TAU,r=RANGES[tier][0]+R()*(RANGES[tier][1]-RANGES[tier][0]);
      const x=Math.round(64+Math.cos(a)*r),y=Math.round(64+Math.sin(a)*r);
      if(!inb(x-1,y-1)||!inb(x+2,y+2))continue;let ok=true;
      for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++){if(ter[(y+dy)*W+x+dx]===1)ok=false}
      if(!ok||G.camps.some(c=>dist(c.x,c.y,x,y)<14))continue;
      for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++)node[(y+dy)*W+x+dx]=0;
      const camp={id:G.nid++,kind:'c',x,y,tier,hp:500*(1+tier*1.2),mhp:500*(1+tier*1.2),alive:true};
      G.camps.push(camp);spawnCampGuards(camp);break;
    }
  }
}
function spawnCampGuards(c){const n=3+c.tier*2;for(let k=0;k<n;k++){const a=k/n*TAU;spawnFoe(c.tier===5&&k%2?5:Math.min(c.tier,4),c.x+1+Math.cos(a)*2,c.y+1+Math.sin(a)*2,1+c.tier*.15,c)}}
export function setGame(v){G=v;return v}
