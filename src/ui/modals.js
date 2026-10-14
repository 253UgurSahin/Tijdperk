// Schermen: titelscherm, pauze, instellingen, hulp, winst en verlies.
import { store } from '../core/store.js';
import { setSound, setVolume, sfx, sndOn } from '../audio/sound.js';
import { SET, applyLayoutSettings, resetSet, saveSet } from '../core/settings.js';
import { AGES } from '../data/ages.js';
import { SKEY, load, save, wipe } from '../game/save.js';
import { G, newGame, placeName } from '../game/state.js';
import { setView } from '../input/input.js';
import { measureHud } from '../main.js';
import { ageTimeline, fmt } from './format.js';
import { ico } from './glyphs.js';
import { sigs } from './header.js';
import { setSpeed, toast } from './hud.js';
import { togglePanel } from './panel.js';
import { $, isCompact } from '../util/dom.js';
import { LEVELS, setQuality } from '../render/quality.js';

let prevSpeed = 1;
function openModal(html) {
  $('#sheet').innerHTML = html;
  if ($('#modal').hidden) prevSpeed = G.speed;
  $('#modal').hidden = false;
  setSpeed(0);
}
export function closeModal() {
  $('#modal').hidden = true;
  setSpeed($('#title').hidden ? prevSpeed : 0);
}
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' && !G.over) {
    closeModal();
    return;
  }
  // Knoppen in de instellingen
  const sb = e.target.closest('[data-tab],[data-set],[data-seg]');
  if (sb) {
    if (sb.dataset.tab) setTab = sb.dataset.tab;
    else if (sb.dataset.set) changeSetting(sb.dataset.set);
    else {
      const raw = sb.dataset.v;
      changeSetting(sb.dataset.seg, isNaN(+raw) ? raw : +raw);
    }
    sfx('tick');
    showSettings();
    return;
  }
  const t = e.target.closest('[data-m]');
  if (!t) return;
  const m = t.dataset.m;
  if (m === 'close') closeModal();
  else if (m === 'save') save(true);
  else if (m === 'load') {
    if (load()) {
      prevSpeed = 1;
      closeModal();
      toast('Spel geladen.');
    } else toast('Geen opgeslagen spel gevonden.', 'bad');
  } else if (m === 'new') {
    t.dataset.m = 'newok';
    t.querySelector('span')
      ? (t.querySelector('span').textContent = 'Zeker? Klik nogmaals')
      : (t.textContent = 'Zeker? Klik nogmaals');
  } else if (m === 'newok') {
    wipe();
    newGame(undefined, G.diff);
    prevSpeed = 1;
    closeModal();
  } else if (m === 'help') showHelp();
  else if (m === 'settings') showSettings();
  else if (m === 'title') {
    save();
    $('#modal').hidden = true;
    showTitle();
  } else if (m === 'pause') {
    if ($('#title').hidden) openPause();
    else closeModal();
  } else if (m === 'pl' || m === 'pr' || m === 'pg') {
    closeModal();
    if (m === 'pg') {
      document.body.classList.add('showgoal');
      store.missionOpen = true;
      sigs.mission = null;
      measureHud();
    } else togglePanel(m === 'pl' ? 'left' : 'right');
  } else if (m === 'resetset') {
    resetSet();
    if (!sndOn) setSound(true);
    setVolume(SET.vol);
    setQuality(SET.quality);
    store.uiDirty = true;
    setTimeout(measureHud, 30);
    toast('Instellingen staan weer op standaard.');
    showSettings();
  }
});
$('#modal').addEventListener('input', e => {
  // Schuifjes: waarde direct toepassen en het getal ernaast bijwerken
  const k = e.target.dataset.range;
  if (!k) return;
  const pct = +e.target.value;
  e.target.nextElementSibling.textContent = pct + '%';
  if (k === 'vol') {
    setVolume(pct / 100);
    sfx('tick', 0.1);
  } else if (k === 'camSpeed') {
    SET.camSpeed = pct / 100;
    saveSet();
  } else if (k === 'gfx.scale') {
    SET.gfx.scale = pct / 100;
    saveSet();
    setQuality('custom');
  }
});
$('#modal').addEventListener('change', e => {
  if (e.target.id === 'peace') {
    G.peaceful = e.target.checked;
    toast(G.peaceful ? 'Vredige modus aan: geen nachtelijke aanvallen.' : 'Aanvallen staan weer aan.');
    sigs.def = null;
  }
});
export function openPause() {
  openModal(`<div class="eyebrow">${placeName()} · dag ${G.day} · ${AGES[G.age].n}</div><h1>Gepauzeerd</h1>
  <p>${fmt(G.stats.gathered)} grondstoffen · ${G.stats.killed} vijanden verslagen · ${G.stats.camps} kampen veroverd · ${Object.keys(G.tech).length} uitvindingen</p>
  <div class="mstack" style="margin-top:18px"><button class="mbtn primary" data-m="close"><span>Hervatten</span><small>terug naar het spel</small></button>${isCompact() ? `<button class="mbtn" data-m="pg"><span>Volgend tijdperk</span><small>wat er nog nodig is</small></button><button class="mbtn" data-m="pr"><span>Kaart</span><small>overzicht · uitbreiden</small></button><button class="mbtn" data-m="pl"><span>Volk en leger</span><small>dorpelingen · verdediging · onderzoek</small></button>` : ''}<button class="mbtn" data-m="save"><span>Opslaan</span><small>automatisch elke minuut</small></button><button class="mbtn" data-m="load"><span>Laden</span><small>laatste opslag</small></button><button class="mbtn" data-m="settings"><span>Instellingen</span><small>geluid · weergave</small></button><button class="mbtn" data-m="help"><span>Uitleg</span><small>besturing</small></button><button class="mbtn" data-m="title"><span>Hoofdmenu</span><small>slaat eerst op</small></button></div>`);
}
// Instellingen: vier tabbladen. Elke knop zegt met data-* wat hij verandert, zodat één
// klik-afhandeling (hieronder) alles kan doen.
let setTab = 'game';
const SET_TABS = [
  ['game', 'Spel'],
  ['view', 'Beeld'],
  ['sound', 'Geluid'],
  ['control', 'Besturing'],
];
function showSettings() {
  const row = (l, d, ctrl) => `<div class="setrow"><div><b>${l}</b><small>${d}</small></div>${ctrl}</div>`;
  const tog = (k, l, d, on = SET[k]) =>
    row(
      l,
      d,
      `<button class="tog ${on ? 'on' : ''}" data-set="${k}" role="switch" aria-checked="${!!on}" aria-label="${l}"></button>`,
    );
  const seg = (k, l, d, opts, cur = SET[k]) =>
    row(
      l,
      d,
      `<div class="seg" role="radiogroup" aria-label="${l}">${opts
        .map(
          ([v, t]) =>
            `<button class="${cur === v ? 'on' : ''}" data-seg="${k}" data-v="${v}" role="radio" aria-checked="${cur === v}">${t}</button>`,
        )
        .join('')}</div>`,
    );
  const slider = (k, l, d, min, max, step, val, show) =>
    row(
      l,
      d,
      `<span class="rng"><input type="range" data-range="${k}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${l}"><output>${show}</output></span>`,
    );
  const inGame = $('#title').hidden && G && !G.over;
  const gfx = SET.gfx;
  const custom = SET.quality === 'custom';
  const nowLevel =
    store.quality === 'custom' ? 'aangepast' : (LEVELS[store.quality] || LEVELS.high).name.toLowerCase();
  const tabs = {
    game:
      tog('coach', 'Tutorial', 'Stap-voor-stap hulp: "volgende stap" en oplichtende knoppen') +
      tog('tips', 'Uitleg bij de muis', 'Tooltips als je over iets heen beweegt') +
      tog('hp', 'Levensbalken altijd tonen', 'Ook bij gezonde eenheden en gebouwen') +
      tog('autosave', 'Automatisch opslaan', 'Elke minuut, en als je het tabblad verlaat') +
      (inGame
        ? tog('peaceful', 'Vredige modus', "Geen aanvallen 's nachts: alleen bouwen", G.peaceful)
        : '') +
      `<div class="setbtns"><button data-m="help">Uitleg en sneltoetsen</button></div>`,
    view:
      seg(
        'quality',
        'Beeldkwaliteit',
        SET.quality === 'auto'
          ? `Past zich aan je apparaat aan (nu: ${nowLevel})`
          : custom
            ? 'Kies hieronder zelf'
            : 'Vaste kwaliteit',
        [
          ['auto', 'Auto'],
          ['low', 'Laag'],
          ['mid', 'Middel'],
          ['high', 'Hoog'],
          ['custom', 'Eigen'],
        ],
      ) +
      (custom
        ? `<div class="setsub">${
            slider(
              'gfx.scale',
              'Resolutie',
              'Lager = sneller, maar wat waziger',
              50,
              100,
              5,
              Math.round(gfx.scale * 100),
              Math.round(gfx.scale * 100) + '%',
            ) +
            tog('gfx.shadows', 'Schaduwen', 'Zon en gebouwen werpen schaduw', gfx.shadows) +
            tog('gfx.bloom', 'Gloed', 'Zachte gloed rond vuur en lampen', gfx.bloom) +
            tog('gfx.outline', 'Omlijning', 'Rand om wat je selecteert of aanwijst', gfx.outline)
          }</div>`
        : '') +
      tog('V2', 'Bovenaanzicht', 'Camera recht van boven in plaats van schuin', store.V2) +
      tog('shake', 'Schermschudden', 'Bij inslagen en instortende gebouwen') +
      tog('motion', 'Animaties in menu’s', 'Uit: rustiger, zonder bewegende knoppen') +
      seg('uiScale', 'Grootte interface', 'Maakt panelen en tekst groter of kleiner', [
        [0.9, 'S'],
        [1, 'M'],
        [1.15, 'L'],
        [1.3, 'XL'],
      ]) +
      (innerWidth / innerHeight > 2.15
        ? tog('hudWide', 'HUD over volle breedte', 'Ultrabreed scherm: panelen in de hoeken')
        : '') +
      tog('fps', 'Beeldjes per seconde', 'Toon een teller rechtsboven'),
    sound:
      tog('sound', 'Geluid', 'Alle geluid aan of uit (sneltoets M)', sndOn) +
      slider(
        'vol',
        'Volume',
        'Hoe hard alles klinkt',
        0,
        100,
        5,
        Math.round(SET.vol * 100),
        Math.round(SET.vol * 100) + '%',
      ) +
      tog('alerts', 'Meldingen', 'Alarm bij aanvallen en vallende meteorieten') +
      tog('uiSounds', 'Klikgeluiden', 'Tikjes bij knoppen en selecteren') +
      tog('muteHidden', 'Stil op de achtergrond', 'Geen geluid als je een ander tabblad bekijkt'),
    control:
      tog('dragSelect', 'Slepen = selecteren', 'Uit: linkermuis slepen verschuift de kaart') +
      tog('edge', 'Randscrollen', 'Kaart schuift als de muis de rand van het scherm raakt') +
      slider(
        'camSpeed',
        'Camerasnelheid',
        'Voor WASD, pijltjes en randscrollen',
        50,
        200,
        10,
        Math.round(SET.camSpeed * 100),
        Math.round(SET.camSpeed * 100) + '%',
      ) +
      tog('invertZoom', 'Zoomen omkeren', 'Muiswiel de andere kant op'),
  };
  openModal(`<button class="quiet x" data-m="pause" aria-label="Terug">${ico('✕')}</button><div class="eyebrow">Instellingen</div><h1>Zoals jij het wilt</h1>
  <div class="settabs" role="tablist">${SET_TABS.map(([k, l]) => `<button role="tab" aria-selected="${setTab === k}" class="${setTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
  <div class="setpane" role="tabpanel">${tabs[setTab]}</div>
  <div class="row"><button class="primary" data-m="pause">Klaar</button><button class="quiet" data-m="resetset">Standaard herstellen</button></div>`);
}

/** Een instelling omzetten of kiezen, en meteen laten werken. */
function changeSetting(k, v) {
  if (k === 'sound') return setSound(!sndOn);
  if (k === 'V2') return setView(!store.V2, true);
  if (k === 'peaceful') {
    G.peaceful = !G.peaceful;
    toast(G.peaceful ? 'Vredige modus aan: geen nachtelijke aanvallen.' : 'Aanvallen staan weer aan.');
    sigs.def = null;
    return;
  }
  if (k === 'quality') return setQuality(v);
  if (k.startsWith('gfx.')) {
    const g = k.slice(4);
    SET.gfx[g] = v === undefined ? !SET.gfx[g] : v;
    saveSet();
    return setQuality('custom');
  }
  SET[k] = v === undefined ? !SET[k] : v;
  saveSet();
  applyLayoutSettings();
  if (k === 'hp') store.uiDirty = true;
  if (k === 'coach' || k === 'uiScale' || k === 'hudWide') setTimeout(measureHud, 30);
}

export function showTitle() {
  const has_ = (() => {
    try {
      return !!localStorage.getItem(SKEY);
    } catch (e) {
      return false;
    }
  })();
  let diff = G ? G.diff : 1;
  const el = $('#title');
  setSpeed(0);
  el.hidden = false;
  document.body.classList.add('titled');
  const D = [
    ['Vredig', 'Geen aanvallen. Alleen bouwen.'],
    ['Normaal', 'Om de nacht een aanval.'],
    ['Zwaar', 'Elke nacht, grotere groepen.'],
  ];
  const draw = () => {
    el.innerHTML = `<div class="tw"><div class="tag">Van vuursteen tot sterrenpoort</div><div class="logo">Tijdperken</div><div class="agesrow">${ageTimeline(has_ ? G.age : 0, true)}<div class="tlends"><span>vuursteen</span><span>sterrenpoort</span></div></div>
    <div class="mstack">${has_ ? `<button class="mbtn primary" data-t="cont"><span>Verder spelen</span><small>${placeName()} · dag ${G.day} · ${AGES[G.age].n}</small></button>` : ''}<button class="mbtn ${has_ ? '' : 'primary'}" data-t="new"><span>${has_ ? 'Nieuwe wereld' : 'Begin'}</span><small>${D[diff][0].toLowerCase()}</small></button></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Moeilijkheid</div><div class="diff">${D.map((d, i) => `<button class="${i === diff ? 'on' : ''}" data-d="${i}"><b>${d[0]}</b><small>${d[1]}</small></button>`).join('')}</div></div>
    <div class="mstack"><button class="mbtn" data-t="help"><span>Uitleg</span><small>besturing</small></button><button class="mbtn" data-t="settings"><span>Instellingen</span><small>geluid · camera</small></button></div>
    <div class="tfoot">Negen tijdperken · seizoenen · muren · onderzoek · voortgang wordt in deze browser bewaard</div></div>`;
  };
  draw();
  el.onclick = e => {
    const t = e.target.closest('button');
    if (!t) return;
    sfx('tick');
    if (t.dataset.d !== undefined) {
      diff = +t.dataset.d;
      draw();
      return;
    }
    if (t.dataset.t === 'help') {
      showHelp();
      return;
    }
    if (t.dataset.t === 'settings') {
      showSettings();
      return;
    }
    if (t.dataset.t === 'new') {
      if (has_ || G.t > 5) {
        wipe();
        newGame(undefined, diff);
      } else {
        G.diff = diff;
        G.peaceful = diff === 0;
        Object.assign(
          G.res,
          diff === 2 ? { food: 150, wood: 120, stone: 40 } : { food: 200, wood: 160, stone: 60 },
        );
      }
    }
    el.hidden = true;
    document.body.classList.remove('titled');
    setSpeed(1);
  };
}
$('#menuBtn').onclick = () => openPause();
export function showHelp() {
  openModal(`<button class="quiet x" data-m="close" aria-label="Sluiten">${ico('✕')}</button><div class="eyebrow">Welkom in ${placeName()}</div><h1>Bouw. Groei. Overleef.</h1>
  <p>Leid je stam van de <b>steentijd</b> naar het <b>sterrentijdperk</b>, in negen hoofdstukken. Elk tijdperk onthult nieuwe grondstoffen op de kaart: koper en tin, ijzer, goud, kolen, olie en zand, lithium en tot slot sterrenmetaal uit meteorieten. In de Gouden Eeuw maak je buskruit in een kruitmolen.</p>
  <p>Je <b>dorpelingen</b> werken vanzelf op wat het hardst nodig is. Wil je regie, geef ze dan een vaste taak in het paneel Volk, of selecteer ze en klik op een boom, ader of bouwplaats.</p>
  <p>'s <b>Nachts</b> gaan dorpelingen buiten het licht naar huis. Elke tweede nacht vallen vijanden aan. Bouw torens, train een <b>leger</b> en verover de kampen op de kaart voor buit en grond.</p>
  <p>Herken iedereen aan de schijf eronder: <b>blauw</b> is jouw leger, <b>rood</b> is de vijand, licht zijn je dorpelingen. Soms valt er een <b>meteoriet</b>: rond de krater liggen daarna nieuwe ertsen.</p>
  <p><b>Muren</b> houden vijanden echt tegen: ze moeten erdoorheen hakken. Bouw een <b>poort</b> zodat je eigen volk erdoor kan. <b>Wegen</b> laten iedereen sneller lopen. In het paneel <b>Onderzoek</b> doe je uitvindingen per tijdperk, en soms vraagt een <b>gebeurtenis</b> om een keuze.</p>
  <p>Elk nieuw tijdperk ontgrendelt <b>verbeteringen</b> voor wat je al hebt: gebouwen gaan een niveau omhoog, je volk krijgt betere werktuigen en je leger beter pantser. Een pijltje boven een gebouw betekent dat er een verbetering klaarstaat.</p>
  <div class="keys"><kbd>Slepen</kbd><span>Selectiekader (met Shift: erbij)</span><kbd>Rechts slepen · WASD</kbd><span>Kaart verschuiven · scroll om te zoomen</span><kbd>Klik</kbd><span>Bekijken en selecteren</span><kbd>Dubbelklik · Ctrl-klik</kbd><span>Alles van dat soort in beeld</span><kbd>Rechtsklik</kbd><span>Opdracht: lopen, aanvallen, verzamelen</span><kbd>Q · I</kbd><span>Hele leger · stilstaande dorpelingen</span><kbd>E</kbd><span>Gebied uitbreiden</span><kbd>V</kbd><span>Bovenaanzicht aan of uit</span><kbd>Spatie · [ ]</kbd><span>Pauze · langzamer / sneller</span><kbd>1 – 9</kbd><span>Gebouw uit de bouwbalk kiezen</span><kbd>Ctrl+F1 – F5 · F1 – F5</kbd><span>Groep instellen · groep selecteren (twee keer: ernaartoe)</span><kbd>S · F · R</kbd><span>Leger: stop · aanvalsmars · patrouille</span><kbd>Shift-klik trainen</kbd><span>Vijf eenheden tegelijk in de wachtrij</span><kbd>Slepen bij muur of weg</kbd><span>Hele lijn in één keer bouwen</span><kbd>Delete</kbd><span>Sloopmodus (of: geselecteerd gebouw afbreken)</span><kbd>Z X C B</kbd><span>Bouwcategorie wisselen</span><kbd>P · M</kbd><span>Paneel · geluid</span><kbd>Esc</kbd><span>Annuleren</span></div>
  <div class="row"><button class="primary" data-m="close">Op avontuur →</button></div>`);
}
export function showVictory() {
  openModal(
    `<div class="eyebrow">Hoofdstuk ${AGES[AGES.length - 1].r} voltooid</div><h1>Van vuursteen tot sterrenpoort.</h1><div class="sheettl">${ageTimeline(AGES.length - 1, true)}</div><p>${placeName()} doorliep de hele geschiedenis in ${G.day} dagen. ${fmt(G.stats.gathered)} grondstoffen verzameld, ${G.stats.killed} vijanden verslagen, ${G.stats.camps} kampen veroverd.</p><div class="row"><button class="primary" data-m="close">Verder bouwen</button><button data-m="new">Nieuwe wereld</button></div>`,
  );
}
export function showGameOver() {
  openModal(
    `<div class="eyebrow">Dag ${G.day}</div><h1>Het stamhuis is gevallen.</h1><div class="sheettl">${ageTimeline(G.age, true)}</div><p>${placeName()} hield ${G.day} dagen stand en bereikte de ${AGES[G.age].n.toLowerCase()}. Bouw volgende keer eerder torens en een leger, of speel in de vredige modus.</p><div class="row"><button class="primary" data-m="newok">Nieuwe wereld</button></div>`,
  );
}
