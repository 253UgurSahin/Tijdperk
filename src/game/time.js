// Dag en nacht, seizoenen en wanneer aanvallen komen.
import { sfx } from '../audio/sound.js';
import { DAYLEN } from '../config.js';
import { difficulty } from '../data/difficulty.js';
import { seasonIndex } from '../data/modifiers.js';
import { raidSize, spawnRaid } from './military.js';
import { dayPace, hasRule } from './mods.js';
import { G } from './state.js';
import { bossFled, liveBoss, pendingBoss } from './bosses.js';
import { isCharging } from './finale.js';
import { bossName } from '../data/bosses.js';
import { FINALE_SIDES } from '../data/finale.js';
import { hasT } from './upgrades.js';
import { note, toast } from '../ui/hud.js';

const SEASONS = [
  { n: 'Lente', food: 1.1, tint: null },
  { n: 'Zomer', food: 1.2, tint: 'rgba(255,220,120,.06)' },
  { n: 'Herfst', food: 1, tint: 'rgba(210,130,50,.09)' },
  { n: 'Winter', food: 0.55, tint: 'rgba(190,210,240,.16)' },
];
// Elk seizoen duurt 4 dagen; met de spelregel Lange winter is het vooral winter (zie data/modifiers.js)
export const season = (day = G.day) => SEASONS[seasonIndex(day, hasRule('longWinter'))];
export function darkness(h = G.clock) {
  if (h >= 6.5 && h < 18) return 0;
  if (h >= 18 && h < 20.5) return ((h - 18) / 2.5) * 0.78;
  if (h >= 4.5 && h < 6.5) return 0.78 * (1 - (h - 4.5) / 2);
  return 0.78;
}
export const isNight = () => darkness() > 0.42;
// Op Zwaar en Meedogenloos elke nacht een aanval, anders om de nacht (zie data/difficulty.js)
// Laadt de sterrenpoort op, dan komt er elke nacht een aanval (zie game/finale.js)
export const raidNight = (day = G.day) =>
  !G.peaceful &&
  day >= 2 &&
  (difficulty(G.diff).everyNight || day % 2 === 0 || G.forceRaid === day || isCharging());
function crossed(p, c, h) {
  return p <= c ? p < h && c >= h : p < h || c >= h;
}
export function advanceClock(dt) {
  const p = G.clock;
  G.clock = (G.clock + (dt * 24 * dayPace()) / DAYLEN) % 24;
  const c = G.clock;
  if (crossed(p, c, 6)) {
    G.day++;
    const sn = season();
    if (G.day > 1 && sn !== season(G.day - 1)) {
      toast(
        `${sn.n} begint.${sn.n === 'Winter' ? ' Akkers en struiken leveren veel minder.' : sn.n === 'Zomer' ? ' Oogsten gaan sneller.' : ''}`,
        'age',
      );
    } else note(`Dag ${G.day} breekt aan.`);
    G.rain = Math.random() < (sn.n === 'Herfst' ? 0.45 : sn.n === 'Lente' ? 0.35 : 0.2) ? 1 : 0;
    if (G.rain) note('Het regent vandaag.');
  }
  if (crossed(p, c, 18.3)) {
    if (G.day === 1)
      toast('De avond valt. Buiten het licht gaan dorpelingen naar huis. Kampvuren houden ze aan het werk.');
    if (raidNight() && !hasT('radio')) toast(raidWarning(false), 'bad');
  }
  if (crossed(p, c, 12) && raidNight() && hasT('radio')) toast(raidWarning(true), 'bad');
  if (crossed(p, c, 21) && raidNight()) spawnRaid();
  // Spelregel Dubbele aanvallen: rond middernacht komt een tweede golf (de dag telt pas om 6 uur verder)
  if (crossed(p, c, 0.5) && raidNight() && hasRule('raidsX2')) spawnRaid();
  if (crossed(p, c, 6.3)) {
    // Het is ochtend en het stamhuis staat nog: de aanval van vannacht is doorstaan.
    // We kijken naar de aanval die echt begon (niet naar het rooster): de vredige modus kan intussen zijn omgezet.
    if (G.stats.raidDay === G.day - 1 && !G.over) G.stats.survived++;
    let n = 0,
      boss = null;
    // (Soldaten van rivalen niet: die gaan pas naar huis als hun eigen aanval voorbij is, zie game/rivals.js)
    for (const f of G.foes)
      if (!f.camp && !f.rival && !f.retreat) {
        f.retreat = true;
        n++;
        if (f.boss) boss = f;
      }
    if (n) {
      toast('De aanvallers trekken zich terug.', 'good');
      sfx('raidend');
    }
    if (boss) bossFled(boss); // de kampioen vlucht mee (zie game/bosses.js)
  }
}
// De waarschuwing voor de aanval van vannacht. Met de radio weet je ook hoe groot hij wordt.
// Tijdens de finale komen ze uit meer richtingen en gaan ze op de sterrenpoort af (zie game/finale.js).
function raidWarning(radio) {
  if (isCharging() && radio)
    return `Radio: vannacht vallen ±${raidSize()} vijanden de sterrenpoort aan, uit ${FINALE_SIDES} richtingen${ledBy()}.`;
  if (isCharging())
    return `Vannacht valt iedereen de sterrenpoort aan, uit ${FINALE_SIDES} richtingen${ledBy()}.`;
  if (radio) return `Radio: vannacht valt een groep van ±${raidSize()} aan${ledBy()}.`;
  return `Er naderen vijanden${ledBy()}. Vannacht volgt een aanval.`;
}
// ", geleid door Grimnar de Verscheurder" als de kampioen meekomt met de aanval van vannacht
function ledBy() {
  const boss = pendingBoss();
  return boss && !liveBoss() ? `, geleid door ${bossName(boss)}` : '';
}
export function hoursUntilRaid() {
  let day = G.day,
    h = G.clock;
  let hours = 0;
  for (let k = 0; k < 6; k++) {
    if (raidNight(day) && (k > 0 || h < 21)) return hours + (21 - h);
    hours += 24 - h;
    h = 0;
    day++;
    if (k === 0) hours -= 0;
  }
  return null;
}
