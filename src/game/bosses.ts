// Kampioenen in het spel: wie de eerste aanval na een nieuw tijdperk leidt, en wat je krijgt als je hem verslaat.
import type { Foe } from '../types';
import { store } from '../core/store';
import { sfx } from '../audio/sound';
import { BOSS_DMG, BOSS_HP, bossForAge, bossName } from '../data/bosses';
import type { BossDef } from '../data/bosses';
import { burst, floater, fxRing } from './fx';
import { hasRule } from './mods';
import { G } from './state';
import { note, toast } from '../ui/hud';

/*
 * G.boss: de kampioen die nog moet komen, als { age }, of null. Hij blijft staan tot je hem verslaat:
 * vlucht hij bij zonsopgang (of laad je een opgeslagen spel), dan komt hij terug met de volgende aanval.
 * Een kampioen in het veld is een gewone vijand (in G.foes) met boss: zijn tijdperk.
 */

/** Een nieuw tijdperk: de kampioen van dit tijdperk leidt de volgende aanval (niet in de vredige modus). */
export function bossAfterAgeUp(): void {
  const boss = bossForAge(G.age);
  // Zonder leger (spelregel van een uitdaging) zou hij niet te verslaan zijn
  if (!boss || G.peaceful || hasRule('noArmy')) return;
  G.boss = { age: G.age };
  note(`Er gaan geruchten: ${bossName(boss)} leidt de volgende aanval.`, 'bad');
}

/** De kampioen die nog moet komen, of null. */
export const pendingBoss = (): BossDef | null =>
  G && G.boss && !G.peaceful ? bossForAge(G.boss.age) : null;

/** De kampioen die nu in het veld staat (en niet vlucht), of null. */
export const liveBoss = (): Foe | null =>
  G ? G.foes.find(f => f.boss && !f.dead && !f.retreat) || null : null;

/** Gaat de kampioen mee met deze aanval? Alleen als hij er nog niet is (in het veld of op weg). */
export function bossForRaid(): BossDef | null {
  const boss = pendingBoss();
  if (!boss || liveBoss() || G.spawnQ.some(s => s.boss)) return null;
  return boss;
}

/** Maak van een net verschenen vijand de kampioen: taaier en sterker, met een naam boven zijn hoofd. */
export function makeBoss(f: Foe, age: number): void {
  const boss = bossForAge(age);
  if (!boss) return;
  f.boss = age;
  f.hp *= BOSS_HP;
  f.mhp *= BOSS_HP;
  f.dmg *= BOSS_DMG;
  store.notePos = [f.x, f.y];
  toast(
    `${bossName(boss)} leidt de aanval! ${BOSS_HP}× zoveel levens, ${BOSS_DMG}× zoveel schade. Versla hem voor een extra zegening.`,
    'bad',
  );
  sfx('boss');
  store.uiDirty = true;
}

/** De kampioen is verslagen: je mag een extra zegening kiezen, en hij komt niet meer terug. */
export function bossDefeated(f: Foe): void {
  const boss = bossForAge(f.boss);
  if (!boss) return;
  // Alleen deze kampioen is weg; kwam er intussen een nieuw tijdperk, dan wacht die kampioen nog
  if (G.boss && G.boss.age === f.boss) G.boss = null;
  G.stats.bosses = (G.stats.bosses || 0) + 1;
  // De kaarten van een kampioen zijn anders dan die van het tijdperk zelf (zie ui/blessings.ts).
  // (Er is een kampioen bij f.boss, zie hierboven: dan is het zeker een tijdperk.)
  G.blessingQueue.push({ age: f.boss!, at: G.t + 1.5, boss: true });
  for (let k = 0; k < 8; k++) burst(f.x + Math.random() - 0.5, f.y + Math.random() - 0.5, '#e2b92c');
  fxRing(f.x, f.y, '#e2b92c');
  floater(f.x, f.y, 'KAMPIOEN VERSLAGEN', '#e2b92c');
  store.notePos = [f.x, f.y];
  toast(`${bossName(boss)} is verslagen! Je mag een extra zegening kiezen.`, 'good');
  sfx('bossdown');
  store.uiDirty = true;
}

/**
 * Bij zonsopgang vlucht de kampioen mee met de rest. Meestal komt hij terug met de volgende aanval,
 * maar kwam er intussen een nieuw tijdperk, dan leidt de kampioen van dat tijdperk de volgende aanval.
 */
export function bossFled(f: Foe): void {
  const boss = bossForAge(f.boss);
  if (!boss) return;
  const returns = G.boss && G.boss.age === f.boss;
  toast(`${bossName(boss)} vlucht!${returns ? ' Hij komt terug met de volgende aanval.' : ''}`);
}
