import { sfx } from '../audio/sound.js';
import { DAYLEN } from '../config.js';
import { raidSize, spawnRaid } from './military.js';
import { G } from './state.js';
import { hasT } from './upgrades.js';
import { note, toast } from '../ui/hud.js';

const SEASONS=[{n:'Lente',food:1.1,tint:null},{n:'Zomer',food:1.2,tint:'rgba(255,220,120,.06)'},{n:'Herfst',food:1,tint:'rgba(210,130,50,.09)'},{n:'Winter',food:.55,tint:'rgba(190,210,240,.16)'}];
export const season=()=>SEASONS[Math.floor((G.day-1)/4)%4];
export function darkness(h=G.clock){if(h>=6.5&&h<18)return 0;if(h>=18&&h<20.5)return(h-18)/2.5*.78;if(h>=4.5&&h<6.5)return .78*(1-(h-4.5)/2);return .78}
export const isNight=()=>darkness()>.42;
export const raidNight=(day=G.day)=>!G.peaceful&&day>=2&&(G.diff===2||day%2===0||G.forceRaid===day);
function crossed(p,c,h){return p<=c?(p<h&&c>=h):(p<h||c>=h)}
export function advanceClock(dt){
  const p=G.clock;G.clock=(G.clock+dt*24/DAYLEN)%24;const c=G.clock;
  if(crossed(p,c,6)){G.day++;const sn=season();if((G.day-1)%4===0&&G.day>1){toast(`${sn.n} begint.${sn.n==='Winter'?' Akkers en struiken leveren veel minder.':sn.n==='Zomer'?' Oogsten gaan sneller.':''}`,'age')}else note(`Dag ${G.day} breekt aan.`);G.rain=Math.random()<(sn.n==='Herfst'?.45:sn.n==='Lente'?.35:.2)?1:0;if(G.rain)note('Het regent vandaag.')}
  if(crossed(p,c,18.3)){
    if(G.day===1)toast('De avond valt. Buiten het licht gaan dorpelingen naar huis. Kampvuren houden ze aan het werk.');
    if(raidNight()&&!hasT('radio'))toast('Er naderen vijanden. Vannacht volgt een aanval.','bad');
  }
  if(crossed(p,c,12)&&raidNight()&&hasT('radio'))toast(`Radio: vannacht valt een groep van ±${raidSize()} aan.`,'bad');
  if(crossed(p,c,21)&&raidNight())spawnRaid();
  if(crossed(p,c,6.3)){let n=0;for(const f of G.foes)if(!f.camp&&!f.retreat){f.retreat=true;n++}if(n){toast('De aanvallers trekken zich terug.','good');sfx('raidend')}}
}
export function hoursUntilRaid(){let day=G.day,h=G.clock;let hours=0;for(let k=0;k<6;k++){if(raidNight(day)&&(k>0||h<21))return hours+(21-h);hours+=24-h;h=0;day++;if(k===0)hours-=0}return null}
