// Venster "Kies een zegening": drie grote kaarten, kiezen met een klik of met de toetsen 1, 2 en 3.
import { store } from '../core/store';
import { SET } from '../core/settings';
import { sfx } from '../audio/sound';
import { AGES } from '../data/ages';
import { BLESSING, BLESSING_CATS, type BlessingDef } from '../data/blessings';
import { blessingChoices, skipBlessing, takeBlessing, waitingBlessing } from '../game/blessings';
import { G } from '../game/state';
import { TOUCH } from './format';
import { ico } from './glyphs';
import { sigs } from './header';
import { toast } from './hud';
import { closeModal, openModal } from './modals';
import { $ } from '../util/dom';

// Zo lang na het openen tellen klikken en toetsen nog niet: wie net op 1 of 2 drukte om iets te
// bouwen, kiest dan niet per ongeluk een kaart.
const SAFE_DELAY = 500;
let openedAt = 0;
// true zodra er een kaart gekozen is, zodat een tweede klik of toets niets meer doet
let alreadyChosen = false;

/** Bij elke verversing van de interface: ligt er een keuze klaar en is het scherm vrij? Laat dan de kaarten zien. */
export function checkBlessing() {
  if (!G || G.over || !waitingBlessing()) return;
  // Niet over het titelscherm, een ander venster of de banner van een nieuw tijdperk heen
  if (!$('#title').hidden || !$('#modal').hidden || !$('#banner').hidden) return;
  showBlessingChoice();
}

/** Eén kaart: pictogram, soort, naam en wat hij doet. */
function cardHTML(blessing: BlessingDef, nr: number) {
  // Labels staan meteen naast de soort, zodat je een nadeel ziet voordat je de uitleg leest
  let tags = '';
  if (blessing.risk) tags += '<span class="btag risk">Riskant</span>';
  if (blessing.oneoff) tags += '<span class="btag now">Meteen</span>';
  return `<button class="bless ${blessing.risk ? 'risk' : ''}" data-bless="${blessing.k}" aria-keyshortcuts="${nr}">
    ${TOUCH ? '' : `<kbd class="bkey" aria-hidden="true">${nr}</kbd>`}
    <span class="bic">${ico(blessing.g)}</span>
    <span class="bhead"><span class="bcat">${BLESSING_CATS[blessing.cat]}</span>${tags}</span>
    <b>${blessing.n}</b>
    <span class="bd">${blessing.d}.</span>
  </button>`;
}

function showBlessingChoice() {
  const cards = blessingChoices();
  if (!cards.length) {
    skipBlessing(); // alles is al gekozen: niets meer te kiezen
    return;
  }
  // Er liggen kaarten klaar, dus er wacht ook een keuze
  const next = waitingBlessing()!;
  const age = AGES[next.age];
  const eyebrow = next.age === 0 ? 'Een nieuw begin' : `Hoofdstuk ${age.r} · ${age.n}`;
  const howTo = TOUCH ? 'Tik op een kaart.' : 'Klik op een kaart, of druk op 1, 2 of 3.';
  alreadyChosen = false;
  openedAt = performance.now();
  openModal(
    `<div class="eyebrow">${eyebrow}</div><h1>Kies een zegening</h1>
    <p>Een zegening geldt de rest van het spel. ${howTo}</p>
    <div class="blessgrid">${cards.map((b, i) => cardHTML(b, i + 1)).join('')}</div>`,
    { locked: true, cls: 'blesssheet' },
  );
  sfx('select');
}

function choose(k: string) {
  if (alreadyChosen || performance.now() - openedAt < SAFE_DELAY) return;
  const blessing = takeBlessing(k);
  if (!blessing) return;
  alreadyChosen = true;
  sfx('upgrade');
  // De gekozen kaart licht even op en de andere vervagen; daarna gaat het spel verder
  $('#sheet .blessgrid').classList.add('done');
  $(`#sheet [data-bless="${k}"]`).classList.add('picked');
  setTimeout(
    () => {
      closeModal();
      toast(`Zegening gekozen: ${blessing.n}. Je vindt hem terug onder Verbeteren.`, 'good');
      sigs.upg = null;
      store.uiDirty = true;
    },
    SET.motion ? 520 : 0,
  );
}

$('#modal').addEventListener('click', e => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('[data-bless]');
  // Gevonden met [data-bless], dus de sleutel staat erop
  if (card) choose(card.dataset.bless!);
});

addEventListener('keydown', e => {
  if (e.repeat || $('#modal').hidden || !$('#sheet .blessgrid')) return;
  const nr = Number(e.key);
  const cards = document.querySelectorAll<HTMLElement>('#sheet [data-bless]');
  if (nr >= 1 && nr <= cards.length) {
    e.preventDefault();
    choose(cards[nr - 1].dataset.bless!);
  }
});

/** Lijstje voor het paneel Verbeteren: de zegeningen die je hebt, met wat ze doen. */
export function blessingListHTML() {
  const mine = G.blessings.map(k => BLESSING[k]).filter(Boolean);
  if (!mine.length)
    return `<p class="small">Bij het begin en bij elk nieuw tijdperk kies je een zegening. Die geldt de rest van het spel.</p>`;
  return `<ul class="blesslist">${mine
    .map(
      b =>
        `<li class="${b.risk ? 'risk' : ''}"><span class="g">${ico(b.g)}</span><b>${b.n}</b><span class="d">${b.d}</span></li>`,
    )
    .join('')}</ul>`;
}
