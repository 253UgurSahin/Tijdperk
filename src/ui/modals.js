// Schermen: titelscherm, pauze, instellingen en hulp. (Winst en verlies: zie ui/endscreen.js.)
import { store } from '../core/store.js';
import { setSound, setVolume, sfx, sndOn } from '../audio/sound.js';
import { SET, applyLayoutSettings, resetSet, saveSet } from '../core/settings.js';
import { AGES } from '../data/ages.js';
import { MAP } from '../data/maps.js';
import { DEFAULT_PEOPLE, isPeopleUnlocked } from '../data/peoples.js';
import { DIFF_NAMES } from '../data/score.js';
import { DAILY, SCENARIOS, goalText } from '../data/scenarios.js';
import { filledCount, latestSlot, replaceWarningText, savedAtText, slotTitle } from '../data/saveslots.js';
import { currentMeta, isLiveGame, liveGameAtRisk, listSlots, loadSlot, save, wipe } from '../game/save.js';
import { currentChallenge } from '../game/scenario.js';
import { G, newGame, placeName } from '../game/state.js';
import { setView } from '../input/input.js';
import { measureHud } from '../main.js';
import { dailyLine, medalCount, modsHTML, showChallenges } from './challenges.js';
import { ageTimeline, fmt } from './format.js';
import { ico } from './glyphs.js';
import { sigs } from './header.js';
import { setSpeed, toast } from './hud.js';
import { togglePanel } from './panel.js';
import { newGameDraft, showNewGame } from './newgame.js';
import { peopleBarHTML, playerProfile } from './peoples.js';
import { achievementCount, showProfile } from './profile.js';
import { showLoadScreen, showSaveScreen } from './saveslots.js';
import { $, isCompact } from '../util/dom.js';
import { LEVELS, setQuality } from '../render/quality.js';

let prevSpeed = 1;
// Wat er moet gebeuren als het open venster dichtgaat (op welke manier dan ook), of null
let onModalClose = null;
/**
 * Open een venster en zet het spel stil. Met `locked` gaat het niet dicht met Esc of een klik
 * ernaast: je moet echt iets kiezen (zoals een zegening). `cls` geeft het blad een extra class.
 * `onClose` draait als dit venster dichtgaat, ook met Esc of een klik ernaast.
 */
export function openModal(html, { locked = false, cls = '', onClose = null } = {}) {
  $('#sheet').innerHTML = html;
  $('#sheet').className = cls ? `sheet ${cls}` : 'sheet';
  store.modalLocked = locked;
  onModalClose = onClose;
  if ($('#modal').hidden) prevSpeed = G.speed;
  $('#modal').hidden = false;
  // Een nieuw venster begint bovenaan, ook als het vorige naar beneden was gescrold.
  // (Pas na het tonen: in een verborgen venster telt de scrollpositie niet.)
  $('#sheet').scrollTop = 0;
  setSpeed(0);
}
/** Venster dicht en het spel op gewone snelheid verder (na het laden van een opslag). */
export function closeModalAndPlay() {
  prevSpeed = 1;
  closeModal();
}
export function closeModal() {
  $('#modal').hidden = true;
  store.modalLocked = false;
  setSpeed($('#title').hidden ? prevSpeed : 0);
  // Eerst leegmaken: zo kan onClose zelf weer een venster openen of sluiten
  const afterClose = onModalClose;
  onModalClose = null;
  if (afterClose) afterClose();
}
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' && !G.over && !store.modalLocked) {
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
  else if (m === 'save') showSaveScreen();
  else if (m === 'load') showLoadScreen();
  else if (m === 'new') {
    t.dataset.m = 'newok';
    t.querySelector('span')
      ? (t.querySelector('span').textContent = 'Zeker? Klik nogmaals')
      : (t.textContent = 'Zeker? Klik nogmaals');
  } else if (m === 'newok') {
    // Naar het nieuw-spelscherm. Een verloren spel hoeft niet bewaard; anders kun je nog terug ("Verder spelen").
    if (G.over) wipe();
    else save();
    prevSpeed = 1;
    closeModal();
    showTitle({ setup: true });
  } else if (m === 'help') showHelp();
  else if (m === 'settings') showSettings();
  else if (m === 'profile') showProfile({ back: openPause });
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
  if (e.target.id === 'peace') setPeaceful(e.target.checked);
});

/** Vredige modus aan of uit. Eén keer aan is genoeg om de score van dit spel half te laten tellen. */
function setPeaceful(on) {
  G.peaceful = on;
  if (on) G.stats.peaceUsed = true;
  toast(
    on ? 'Vredige modus aan: geen aanvallen meer. Je score telt dit spel half.' : 'Aanvallen staan weer aan.',
  );
  sigs.def = null;
}
/** Korte regel voor de knop Laden, zoals "laatste: vandaag 14:32". */
function lastSaveLine() {
  const slots = listSlots(),
    latest = latestSlot(slots);
  return latest ? `laatste: ${savedAtText(slots[latest].at)}` : 'nog niets opgeslagen';
}
/** Korte regel voor de knop Prestaties, zoals "12 van 40 gehaald". */
function achievementsLine() {
  const { got, total } = achievementCount();
  return `${got} van ${total} gehaald`;
}
export function openPause() {
  const stats = [
    `${fmt(G.stats.gathered)} grondstoffen`,
    `${G.stats.killed} vijanden verslagen`,
    `${G.stats.camps} kampen veroverd`,
    `${Object.keys(G.tech).length} uitvindingen`,
    `${G.blessings.length} ${G.blessings.length === 1 ? 'zegening' : 'zegeningen'}`,
  ].join(' · ');
  // Op een smal scherm staan de panelen niet open: dan kun je ze hier openen
  const panelButtons = isCompact()
    ? `<button class="mbtn" data-m="pg"><span>Volgend tijdperk</span><small>wat er nog nodig is</small></button>
      <div class="mpair">
        <button class="mbtn" data-m="pr"><span>Kaart</span><small>overzicht · uitbreiden</small></button>
        <button class="mbtn" data-m="pl"><span>Dorp en leger</span><small>verdediging · onderzoek</small></button>
      </div>`
    : '';
  // Je wereld in één regel, zodat je de zaadcode kunt delen (in een uitdaging staat de naam ervoor)
  const challenge = currentChallenge();
  const world = `${challenge ? `${challenge.n} · ` : ''}Zaadcode <b>${G.opts.seedCode}</b> · ${MAP[G.opts.map].n} · ${DIFF_NAMES[G.diff]}`;
  // In een uitdaging: het doel en wat elke spelregel doet, zodat je het ook op een telefoon kunt nalezen
  const challengeInfo = challenge
    ? `<div class="sect">Doel: ${goalText(challenge.goal)}</div>${modsHTML(challenge)}`
    : '';
  openModal(`<div class="eyebrow">${placeName()} · dag ${G.day} · ${AGES[G.age].n}</div><h1>Gepauzeerd</h1>
  <p>${stats}</p>
  <p class="pworld">${world}</p>
  ${challengeInfo}
  ${peopleBarHTML()}
  <div class="mstack" style="margin-top:18px">
    <button class="mbtn primary" data-m="close"><span>Hervatten</span><small>terug naar het spel</small></button>
    ${panelButtons}
    <div class="mpair">
      <button class="mbtn" data-m="save"><span>Opslaan</span><small>kies uit 3 plekken</small></button>
      <button class="mbtn" data-m="load"><span>Laden</span><small>${lastSaveLine()}</small></button>
    </div>
    <div class="mpair">
      <button class="mbtn" data-m="profile"><span>Prestaties</span><small>${achievementsLine()}</small></button>
      <button class="mbtn" data-m="help"><span>Uitleg</span><small>besturing</small></button>
    </div>
    <div class="mpair">
      <button class="mbtn" data-m="settings"><span>Instellingen</span><small>geluid · weergave</small></button>
      <button class="mbtn" data-m="title"><span>Hoofdmenu</span><small>slaat eerst op</small></button>
    </div>
  </div>`);
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
  // In een uitdaging kun je de vredige modus niet aanzetten: dan zou het doel te makkelijk worden
  const peaceToggle = inGame && !G.scenario;
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
      (peaceToggle
        ? tog(
            'peaceful',
            'Vredige modus',
            "Geen aanvallen 's nachts · je score telt dit spel half",
            G.peaceful,
          )
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
            tog('gfx.outline', 'Omlijning', 'Rand om wat je selecteert of aanwijst', gfx.outline) +
            tog('gfx.particles', 'Effecten', 'Rook, stof en vonken', gfx.particles !== false)
          }</div>`
        : '') +
      tog('V2', 'Bovenaanzicht', 'Camera recht van boven in plaats van schuin', store.V2) +
      tog('shake', 'Schermschudden', 'Bij inslagen en instortende gebouwen') +
      tog(
        'motion',
        'Animaties',
        'Uit: rustiger. Geen bewegende knoppen, geen camerazwaai bij een nieuw tijdperk, getallen springen meteen',
      ) +
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
  if (k === 'peaceful') return setPeaceful(!G.peaceful);
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

/**
 * Het titelscherm: verder spelen, een nieuwe wereld, uitdagingen, prestaties, uitleg en instellingen.
 * Met `setup` opent meteen het nieuw-spelscherm (zie ui/newgame.js), met `challenges` de lijst met
 * uitdagingen (zie ui/challenges.js); `focus` is dan de uitdaging die open staat.
 */
export function showTitle({ setup = false, challenges = false, focus = null } = {}) {
  // Is er iets om mee verder te spelen: het spel dat nu draait (na Hoofdmenu), of een opslag?
  const has_ = isLiveGame() || !!latestSlot(listSlots());
  // Zonder opslag ligt er al een verse wereld achter het titelscherm: die zaadcode bieden we als eerste aan
  const fresh = !has_ && G && G.t <= 5;
  const draft = newGameDraft(fresh);
  const el = $('#title');
  setSpeed(0);
  el.hidden = false;
  document.body.classList.add('titled');
  const leaveTitle = () => {
    el.hidden = true;
    document.body.classList.remove('titled');
    setSpeed(1);
  };
  const drawHome = () => {
    // "Verder spelen": het spel dat nu draait, anders de nieuwste opslag. Bij een uitdaging staat haar naam
    // erbij, anders de naam van je stad.
    const slots = listSlots();
    const newest = latestSlot(slots);
    const next = isLiveGame() ? currentMeta() : newest && slots[newest];
    const continueButton = next
      ? `<button class="mbtn primary" data-t="cont"><span>Verder spelen</span><small>${slotTitle(next)} · dag&nbsp;${next.day} · ${AGES[next.age].n}</small></button>`
      : '';
    // Laden staat naast Prestaties als er iets opgeslagen is
    const saved = filledCount(slots);
    const profileButton = `<button class="mbtn" data-t="profile"><span>Prestaties</span><small>${achievementsLine()}</small></button>`;
    const profileRow = saved
      ? `<div class="mpair"><button class="mbtn" data-t="load"><span>Laden</span><small class="whole">${saved} ${saved === 1 ? 'opslag' : 'opslagen'}</small></button>${profileButton}</div>`
      : profileButton;
    el.innerHTML = `<div class="tw">
    <div class="tag">Van vuursteen tot sterrenpoort</div>
    <div class="logo">Tijdperken</div>
    <div class="agesrow">${ageTimeline(next ? next.age : 0, true)}<div class="tlends"><span>vuursteen</span><span>sterrenpoort</span></div></div>
    <div class="mstack">
      ${continueButton}
      <button class="mbtn ${next ? '' : 'primary'}" data-t="new"><span>Nieuwe wereld</span><small class="whole">volk · kaart · doel</small></button>
      <div class="mpair">
        <button class="mbtn" data-t="challenges"><span>Uitdagingen</span><small class="whole">${medalCount()}/${SCENARIOS.length} medailles</small></button>
        <button class="mbtn" data-t="daily"><span>Wereld van de dag</span><small class="whole">${dailyLine()}</small></button>
      </div>
    </div>
    <div class="mstack">
      ${profileRow}
      <div class="mpair">
        <button class="mbtn" data-t="help"><span>Uitleg</span><small>besturing</small></button>
        <button class="mbtn" data-t="settings"><span>Instellingen</span><small>geluid · camera</small></button>
      </div>
    </div>
    <div class="tfoot">Negen tijdperken · seizoenen · muren · onderzoek · voortgang wordt in deze browser bewaard</div>
    </div>`;
    el.onclick = onHomeClick;
    el.oninput = el.onchange = el.onkeydown = null;
  };
  // Een nieuwe wereld of uitdaging beginnen: nieuwe wereld, meteen bewaren, titelscherm dicht
  const startGame = opts => {
    // Voor de zekerheid: nooit beginnen met een volk dat (weer) op slot zit
    if (opts.people && !isPeopleUnlocked(opts.people, playerProfile())) opts.people = DEFAULT_PEOPLE;
    newGame(opts);
    save(); // de nieuwe wereld meteen bewaren: hij komt op de automatische plek, in plaats van het vorige spel
    leaveTitle();
  };
  // Staat je spel van nu alleen op de automatische plek? Dan zegt een zin onder Begin dat het daarna weg is.
  const replaceWarning = () => (liveGameAtRisk() ? replaceWarningText(currentMeta()) : '');
  const openSetup = () =>
    showNewGame(el, draft, { warning: replaceWarning(), onBack: drawHome, onStart: startGame });
  const openChallenges = (focusOn = null) =>
    showChallenges(el, { focus: focusOn, warning: replaceWarning(), onBack: drawHome, onStart: startGame });
  const onHomeClick = e => {
    const t = e.target.closest('button');
    if (!t) return;
    sfx('tick');
    if (t.dataset.t === 'help') showHelp();
    else if (t.dataset.t === 'settings') showSettings();
    // Hoe het venster ook dichtgaat (Klaar, Esc of een klik ernaast): daarna het titelscherm opnieuw tekenen
    else if (t.dataset.t === 'profile') showProfile({ onClose: drawHome });
    else if (t.dataset.t === 'new') openSetup();
    else if (t.dataset.t === 'challenges') openChallenges();
    else if (t.dataset.t === 'daily') openChallenges(DAILY);
    else if (t.dataset.t === 'load') showLoadScreen({ onLoaded: leaveTitle, onClose: drawHome });
    else if (t.dataset.t === 'cont') continueGame();
  };
  // Verder met het spel dat nu draait, of de nieuwste opslag laden (bijv. na een verloren spel).
  // Lukt laden niet, dan meteen het laadscherm met de melding erin: een gewone melding valt achter het titelscherm.
  const continueGame = () => {
    const newest = latestSlot(listSlots());
    if (!isLiveGame() && !(newest && loadSlot(newest))) {
      showLoadScreen({
        onLoaded: leaveTitle,
        onClose: drawHome,
        message: 'Deze opslag kon niet geladen worden. Kies een andere plek.',
      });
      return;
    }
    leaveTitle();
  };
  if (setup) openSetup();
  else if (challenges) openChallenges(focus);
  else drawHome();
}
$('#menuBtn').onclick = () => openPause();
export function showHelp() {
  openModal(`<button class="quiet x" data-m="close" aria-label="Sluiten">${ico('✕')}</button><div class="eyebrow">Welkom in ${placeName()}</div><h1>Bouw. Groei. Overleef.</h1>
  <p>Leid je stam van de <b>steentijd</b> naar het <b>sterrentijdperk</b>, in negen hoofdstukken. Elk tijdperk onthult nieuwe grondstoffen op de kaart: koper en tin, ijzer, goud, kolen, olie en zand, lithium en tot slot sterrenmetaal uit meteorieten. In de Gouden Eeuw maak je buskruit in een kruitmolen.</p>
  <p>Je <b>dorpelingen</b> werken vanzelf op wat het hardst nodig is. Wil je regie, geef ze dan een vaste taak in het paneel <b>Dorp</b>, of selecteer ze en klik op een boom, ader of bouwplaats.</p>
  <p>'s <b>Nachts</b> gaan dorpelingen buiten het licht naar huis. Elke tweede nacht vallen vijanden aan. Bouw torens, train een <b>leger</b> en verover de kampen op de kaart voor buit en grond.</p>
  <p>Herken iedereen aan de schijf eronder: <b>blauw</b> is jouw leger, <b>rood</b> is de vijand, licht zijn je dorpelingen. Soms valt er een <b>meteoriet</b>: rond de krater liggen daarna nieuwe ertsen.</p>
  <p><b>Je leger besturen.</b> Maak van een selectie een <b>groep</b>: klik op de <b>+</b> rechts boven de onderbalk (of Ctrl+Shift+F1 – F5). Daarna kies je de groep met één klik of F1 – F5; nog een keer klikken brengt je ernaartoe. Groep veranderen: selecteer eenheden en rechtsklik of Ctrl-klik op de groep (telefoon: vasthouden). Een rood stipje betekent: die groep vecht. Lopen ze samen, dan gaan ze in <b>formatie</b>: de voorhoede voorop, schutters erachter en geschut achteraan, en ze komen tegelijk aan in het tempo van de traagste. Met <b>Naar huis</b> rent iedereen op volle snelheid. Wie vecht, wordt beter: na 3, 8 en 15 verslagen vijanden wordt een soldaat <b>veteraan</b>, <b>elite</b> en <b>held</b>, telkens met 10% meer schade en leven. Je ziet het aan de gouden streepjes boven zijn hoofd.</p>
  <p><b>Muren</b> houden vijanden echt tegen: ze moeten erdoorheen hakken. Bouw een <b>poort</b> zodat je eigen mensen erdoor kunnen. <b>Wegen</b> laten iedereen sneller lopen. In het paneel <b>Verbeteren</b> zie je per verbetering precies wat ze oplevert (nu → straks): werktuigen, wapens, gebouwen en uitvindingen, en soms vraagt een <b>gebeurtenis</b> om een keuze.</p>
  <p>Elk nieuw tijdperk ontgrendelt <b>verbeteringen</b> voor wat je al hebt: gebouwen gaan een niveau omhoog, je dorpelingen krijgen betere werktuigen en je leger beter pantser. Een pijltje boven een gebouw betekent dat er een verbetering klaarstaat.</p>
  <p>Zin in iets anders? Onder <b>Uitdagingen</b> staan opdrachten met eigen regels, zoals een lange winter of geen leger, en een doel binnen een tijd. Haal je het, dan krijg je een medaille. De <b>wereld van de dag</b> is elke dag nieuw en voor iedereen hetzelfde.</p>
  <p>Bij een <b>nieuwe wereld</b> kies je je volk, de moeilijkheid, de kaart en hoe je wint: de sterrenpoort bouwen, 30 nachten overleven, een kort spel tot de Gouden Eeuw of alle rivalen verslaan (Verovering). Je doelen staan op de doelenkaart onder <b>Winnen</b> (op een telefoon: knop <b>Doel</b>). Met dezelfde <b>zaadcode</b> krijg je dezelfde wereld; je vindt hem onder <b>Menu</b>.</p>
  <p><b>Rivalen</b> zijn andere volken op de kaart (je kiest er 0 tot 3 bij een nieuwe wereld). Ze bouwen en gaan door de tijdperken net als jij, en vallen soms overdag aan. Hun land heeft hun kleur; in het paneel <b>Leger</b> zie je hoe sterk ze zijn. Verwoest hun stamhuis: dan zijn ze verslagen en wordt hun land van jou. Versla ze allemaal en je wint met <b>Verovering</b>.</p>
  <p>Elk tijdperk heeft één <b>wereldwonder</b>, zoals het Hunebed of de Eiffeltoren (bouwcategorie <b>Wonderen</b>). Elk wonder bestaat maar één keer per wereld en geeft een sterke bonus. Een rivaal met het karakter Bouwer bouwt ook wonderen. Op de doelenkaart zie je als hij ervoor spaart of eraan bouwt: sloop zijn bouwplaats of wees sneller. Is hij eerder klaar, dan is het wonder bezet tot je het verwoest of hem verslaat. Met vier wonderen tegelijk kun je winnen.</p>
  <p>Elk <b>volk</b> heeft eigen voordelen; je ziet ze onder <b>Menu</b>, en in het overzicht onderin als je niets hebt geselecteerd.</p>
  <p>Onderweg haal je <b>prestaties</b>, zoals een nieuw tijdperk of een veroverd kamp. Sommige spelen een nieuw volk vrij. Aan het eind krijg je een <b>score</b> en misschien een medaille. Alles staat onder <b>Prestaties</b> in het menu.</p>
  <p><b>Opslaan</b> gaat vanzelf, elke minuut. Wil je een moment bewaren, kies dan onder <b>Menu → Opslaan</b> een van drie plekken; onder <b>Laden</b> ga je daar weer naartoe.</p>
  <p>Na je eerste minuut en bij elk nieuw tijdperk kies je een <b>zegening</b>: één van drie kaarten met een voordeel voor de rest van het spel. Sommige hebben ook een nadeel. Je zegeningen staan bovenaan <b>Verbeteren</b>.</p>
  <div class="keys"><kbd>Slepen</kbd><span>Selectiekader (met Shift: erbij)</span><kbd>Rechts slepen · WASD</kbd><span>Kaart verschuiven · scroll om te zoomen</span><kbd>Klik</kbd><span>Bekijken en selecteren</span><kbd>Dubbelklik · Ctrl-klik</kbd><span>Alles van dat soort in beeld</span><kbd>Rechtsklik</kbd><span>Opdracht: lopen, aanvallen, verzamelen</span><kbd>Q · I</kbd><span>Hele leger · stilstaande dorpelingen</span><kbd>E</kbd><span>Gebied uitbreiden</span><kbd>V</kbd><span>Bovenaanzicht aan of uit</span><kbd>Spatie · [ ]</kbd><span>Pauze · langzamer / sneller</span><kbd>1 – 9</kbd><span>Gebouw uit de bouwbalk kiezen</span><kbd>Ctrl+Shift+F1 – F5 · F1 – F5</kbd><span>Groep maken · groep kiezen (twee keer: ernaartoe). Of met de knoppen rechts boven de onderbalk</span><kbd>S · F · R</kbd><span>Leger: stop · aanvalsmars · patrouille</span><kbd>Shift-klik trainen</kbd><span>Vijf eenheden tegelijk in de wachtrij</span><kbd>Slepen bij muur of weg</kbd><span>Hele lijn in één keer bouwen</span><kbd>Delete</kbd><span>Sloopmodus (of: geselecteerd gebouw afbreken)</span><kbd>Z X C B N</kbd><span>Bouwcategorie wisselen (N: wereldwonderen)</span><kbd>P · M</kbd><span>Paneel · geluid</span><kbd>Esc</kbd><span>Annuleren</span></div>
  <div class="row"><button class="primary" data-m="close">Op avontuur →</button></div>`);
}
