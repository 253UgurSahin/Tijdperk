import * as T3 from 'three';
import { RES } from '../data/resources.js';
import { C, CYANM, FOE, GB, TEAM, TEAMD, bx, cn, cy, gIco, mat, mk, sp } from './kit.js';

const SKIN=['#e2b48c','#c99470','#a8754f','#f0c8a0'];
const JOBCOL={auto:'#cdbf9c',build:'#d9773a',food:'#c9a14a',wood:'#8a6a44',stone:'#8b8f88',sand:'#d8c184'};
function person(g,o){const sk=SKIN[o.skin||0];const lL=new T3.Group(),lR=new T3.Group(),aL=new T3.Group(),aR=new T3.Group();
  lL.position.set(-.05,.2,0);lR.position.set(.05,.2,0);bx(lL,.06,.2,.07,o.pants||'#4a4038',0,-.2,0);bx(lR,.06,.2,.07,o.pants||'#4a4038',0,-.2,0);
  bx(g,.18,.2,.11,o.shirt,0,.2,0);if(o.sash)bx(g,.185,.05,.115,o.sash,0,.32,0);sp(g,.075,sk,0,.47,0,0);
  if(o.hat==='helmet')sp(g,.085,o.hatc||'#8e979f',0,.5,0,0,.7);else if(o.hat==='cap')bx(g,.15,.05,.15,o.hatc||'#5b6644',0,.52,0);else if(o.hat==='hood')cn(g,.1,.16,o.hatc||'#6b5a40',0,.48,0,6);else if(o.hat==='hair')sp(g,.078,'#3b2a1a',0,.5,-.01,0,.6);
  aL.position.set(-.12,.38,0);aR.position.set(.12,.38,0);bx(aL,.05,.18,.06,o.shirt,0,-.18,0);bx(aR,.05,.18,.06,o.shirt,0,-.18,0);
  if(o.tool){const t=new T3.Group();t.position.set(0,-.17,.04);aR.add(t);
    if(o.tool==='spear'){cy(t,.012,.6,C.woodd,0,-.2,0,4);cn(t,.025,.08,'#c9ccce',0,.4,0,4)}else if(o.tool==='axe'){cy(t,.012,.26,C.woodd,0,-.05,0,4);bx(t,.08,.06,.02,'#b8bcbf',.03,.15,0)}else if(o.tool==='pick'){cy(t,.012,.26,C.woodd,0,-.05,0,4);bx(t,.16,.025,.025,'#9a9ea2',0,.19,0)}else if(o.tool==='hoe'){cy(t,.012,.3,C.woodd,0,-.08,0,4);bx(t,.06,.02,.06,'#9a9ea2',0,.2,.02)}else if(o.tool==='hammer'){cy(t,.012,.2,C.woodd,0,-.03,0,4);bx(t,.07,.05,.05,'#6e6a64',0,.15,0)}else if(o.tool==='bow'){bx(t,.015,.34,.015,C.woodd,0,-.05,.05)}else if(o.tool==='sword'){bx(t,.02,.26,.01,'#d4d8db',0,0,0)}else if(o.tool==='gun'){bx(t,.03,.03,.32,'#2e3236',0,.02,.1)}else if(o.tool==='sling'){bx(t,.01,.12,.01,'#7a5a36',0,0,0)}}
  if(o.shield)bx(aL,.02,.16,.12,o.shield,-.03,-.24,0);
  g.add(lL,lR,aL,aR);g.userData.limbs={lL,lR,aL,aR};
  const cr=new T3.Mesh(GB,mat('#8a6a44'));cr.scale.set(.12,.12,.08);cr.position.set(0,.22,-.1);cr.visible=false;g.add(cr);g.userData.carry=cr;return g}
const JOBTOOL={wood:'axe',stone:'pick',copper:'pick',tin:'pick',iron:'pick',gold:'pick',coal:'pick',lithium:'pick',sand:'hoe',food:'hoe',build:'hammer'};
export function makeVillager(job){const g=new T3.Group();g.scale.setScalar(1.3);person(g,{shirt:JOBCOL[job]||(RES[job]?RES[job].c:'#cdbf9c'),sash:TEAM,tool:JOBTOOL[job],hat:job==='build'?'cap':'hair',hatc:'#c9a14a',skin:(job||'').length%4});return g}
export function makeUnit(k,foe){const g=new T3.Group(),T=foe?FOE:TEAM,TD=foe?'#7a2a24':TEAMD;
  if(k==='tank'){bx(g,.7,.22,.44,foe?'#5a3a32':'#5b6644',0,.06,0);bx(g,.74,.1,.12,'#2e3236',0,0,.2);bx(g,.74,.1,.12,'#2e3236',0,0,-.2);bx(g,.34,.16,.3,foe?'#6a3a32':'#6b7650',0,.28,0);const b=bx(g,.5,.05,.05,'#3a3f33',.3,.34,0);bx(g,.14,.04,.14,T,0,.44,0);return g}
  if(k==='fieldgun'){const b=cy(g,.05,.55,'#2e3236',0,.22,0,8);b.rotation.z=Math.PI/2-.2;b.position.x=.1;for(const z of[-.15,.15]){const w=cy(g,.14,.04,C.woodd,0,.14,z,10);w.rotation.x=Math.PI/2}bx(g,.3,.04,.04,C.woodd,-.25,.08,0);const p=new T3.Group();p.position.x=-.35;person(p,{shirt:T,hat:'cap',hatc:TD});g.add(p);return g}
  if(k==='drone'){const b=new T3.Group();b.position.y=.9;bx(b,.22,.06,.22,foe?'#7a2a24':'#1b8188',0,0,0);for(const[x,z]of[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]]){bx(b,.2,.02,.03,C.dmetal,x/2,.02,z/2,Math.atan2(z,x));const r=cy(b,.09,.01,'#cfd6da',x,.05,z,8);r.userData.rotor=1}mk(gIco(0),foe?mat('#ff4a3a',{e:'#ff4a3a'}):CYANM,b,0,-.03,0,.04,.04,.04);g.add(b);g.userData.fly=b;return g}
  if(k==='knight'){bx(g,.16,.2,.46,'#6b4a32',0,.24,0);for(const[x,z]of[[-.06,-.16],[.06,-.16],[-.06,.16],[.06,.16]])bx(g,.05,.24,.05,'#5a3e2a',x,0,z);bx(g,.08,.18,.1,'#6b4a32',0,.36,.22);const p=new T3.Group();p.position.y=.28;person(p,{shirt:'#9aa3ae',sash:T,hat:'helmet',tool:'spear',shield:T});g.add(p);g.userData.rider=p;return g}
  if(k==='raider'){bx(g,.16,.2,.46,'#4a3a2a',0,.24,0);for(const[x,z]of[[-.06,-.16],[.06,-.16],[-.06,.16],[.06,.16]])bx(g,.05,.24,.05,'#3a2a1e',x,0,z);const p=new T3.Group();p.position.y=.28;person(p,{shirt:'#7a3434',hat:'helmet',hatc:'#5d5f63',tool:'sword',shield:FOE});g.add(p);return g}
  if(k==='wolf'){bx(g,.14,.14,.4,'#7d7466',0,.14,0);bx(g,.11,.11,.14,'#8a8274',0,.2,.24);cn(g,.03,.06,'#6d6458',.03,.3,.24,4);cn(g,.03,.06,'#6d6458',-.03,.3,.24,4);for(const[x,z]of[[-.05,-.13],[.05,-.13],[-.05,.13],[.05,.13]])bx(g,.04,.14,.04,'#6d6458',x,0,z);bx(g,.04,.04,.18,'#6d6458',0,.2,-.26);return g}
  if(k==='armored'){bx(g,.62,.3,.4,'#5a3a32',0,.08,0);for(const[x,z]of[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){const w=cy(g,.09,.05,'#1e1e1e',x,.1,z,8);w.rotation.x=Math.PI/2}bx(g,.18,.1,.16,'#4a2e28',0,.38,0);bx(g,.3,.04,.04,'#2e2e2e',.2,.42,0);return g}
  const U={spear:{shirt:'#b89363',tool:'spear',hat:'hair'},slinger:{shirt:'#a08a5e',tool:'sling',hat:'hood'},warrior:{shirt:'#b9853a',tool:'sword',hat:'helmet',hatc:'#b9853a',shield:T},archer:{shirt:'#6f8f45',tool:'bow',hat:'hood',hatc:'#4f6a34'},rifle:{shirt:'#3f5f8a',tool:'gun',hat:'cap',hatc:'#2b3f5e',pants:'#e8e4d8'},soldier:{shirt:'#5f6b3c',tool:'gun',hat:'helmet',hatc:'#4a5530'},exo:{shirt:'#3c4a52',tool:'gun',hat:'helmet',hatc:'#2a3238',pants:'#2a3238'},plunder:{shirt:'#8a4b37',tool:'axe',hat:'hood',hatc:'#5a3020'},merc:{shirt:'#6d4a3a',tool:'gun',hat:'cap',hatc:'#4a3a2a'}}[k]||{shirt:'#8a8a8a',tool:'spear'};
  person(g,Object.assign({sash:T},U));g.scale.setScalar(k==='exo'?1.6:1.3);return g}
export const FOEK=['wolf','plunder','raider','merc','armored','drone'];
