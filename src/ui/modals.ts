import { MG, setSound, sfx, sndOn } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $, compact } from '../core/dom';
import { SET, saveSet } from '../core/settings';
import { fmt } from '../core/util';
import { AGES } from '../data/ages';
import { load, newGame, save, wipe } from '../game/session';
import { V2, setView } from '../render/camera';
import { SKEY } from '../sim/save';
import { G, placeName } from '../sim/state';
import { setMissionOpen } from './chronicle';
import { setSpeed, toast } from './hud';
import { measureHud } from './layout';
import { togglePanel } from './panels';

/** Settings that are shown as on/off toggles. */
type Flag = 'edge' | 'hp' | 'shake';
let prevSpeed = 1;
function openModal(html: string) {
    $('#sheet').innerHTML = html;
    if ($('#modal').hidden)
        prevSpeed = G.speed;
    $('#modal').hidden = false;
    setSpeed(0);
}
export function closeModal() {
    $('#modal').hidden = true;
    setSpeed($('#title').hidden ? prevSpeed : 0);
}
$('#modal').addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-m],[data-view],[data-snd],[data-set]');
    if ((e.target as HTMLElement).id === 'modal' && !G.over) {
        closeModal();
        return;
    }
    if (!t)
        return;
    const m = t.dataset.m;
    if (m === 'close')
        closeModal();
    else if (m === 'save')
        save(true);
    else if (m === 'load') {
        if (load()) {
            prevSpeed = 1;
            closeModal();
            toast('Spel geladen.');
        }
        else
            toast('Geen opgeslagen spel gevonden.', 'bad');
    }
    else if (m === 'new') {
        t.dataset.m = 'newok';
        t.querySelector('span') ? t.querySelector('span')!.textContent = 'Zeker? Klik nogmaals' : t.textContent = 'Zeker? Klik nogmaals';
    }
    else if (m === 'newok') {
        wipe();
        newGame(undefined, G.diff);
        prevSpeed = 1;
        closeModal();
    }
    else if (m === 'help')
        showHelp();
    else if (m === 'settings')
        showSettings();
    else if (m === 'title') {
        save();
        $('#modal').hidden = true;
        showTitle();
    }
    else if (m === 'pause') {
        if ($('#title').hidden)
            openPause();
        else
            closeModal();
    }
    else if (m === 'pl' || m === 'pr' || m === 'pg') {
        closeModal();
        if (m === 'pg') {
            document.body.classList.add('showgoal');
            setMissionOpen(true);
            sigs.mission = null;
            measureHud();
        }
        else
            togglePanel(m === 'pl' ? 'left' : 'right');
    }
    else if (t.dataset.view !== undefined) {
        setView(!V2, true);
        t.classList.toggle('on', V2);
    }
    else if (t.dataset.snd !== undefined) {
        setSound(!sndOn);
        t.classList.toggle('on', sndOn);
    }
    else if (t.dataset.set) {
        const k = t.dataset.set as Flag;
        SET[k] = !SET[k];
        saveSet();
        t.classList.toggle('on', SET[k]);
        if (k === 'hp')
            bus.uiDirty = true;
    }
});
$('#modal').addEventListener('input', e => {
    if ((e.target as HTMLInputElement).id === 'vol') {
        SET.vol = +(e.target as HTMLInputElement).value / 100;
        saveSet();
        if (MG)
            MG.gain.value = SET.vol;
        sfx('tick', .1);
    }
});
export function openPause() {
    openModal(`<div class="eyebrow">${placeName()} · dag ${G.day} · ${AGES[G.age].n}</div><h1>Gepauzeerd</h1>
  <p>${fmt(G.stats.gathered)} grondstoffen · ${G.stats.killed} vijanden verslagen · ${G.stats.camps} kampen veroverd · ${Object.keys(G.tech).length} uitvindingen</p>
  <div class="mstack" style="margin-top:18px"><button class="mbtn primary" data-m="close"><span>Hervatten</span><small>terug naar het spel</small></button>${compact() ? `<button class="mbtn" data-m="pg"><span>Volgend tijdperk</span><small>wat er nog nodig is</small></button><button class="mbtn" data-m="pr"><span>Kaart</span><small>overzicht · uitbreiden</small></button><button class="mbtn" data-m="pl"><span>Volk en leger</span><small>dorpelingen · verdediging · onderzoek</small></button>` : ''}<button class="mbtn" data-m="save"><span>Opslaan</span><small>automatisch elke minuut</small></button><button class="mbtn" data-m="load"><span>Laden</span><small>laatste opslag</small></button><button class="mbtn" data-m="settings"><span>Instellingen</span><small>geluid · weergave</small></button><button class="mbtn" data-m="help"><span>Uitleg</span><small>besturing</small></button><button class="mbtn" data-m="title"><span>Hoofdmenu</span><small>slaat eerst op</small></button></div>`);
}
function showSettings() {
    const tg = (k: Flag, l: string, d: string) => `<div class="setrow"><div><b>${l}</b><small>${d}</small></div><button class="tog ${SET[k] ? 'on' : ''}" data-set="${k}" aria-label="${l}"></button></div>`;
    openModal(`<button class="quiet x" data-m="pause" aria-label="Terug">×</button><div class="eyebrow">Instellingen</div><h1>Spel en camera</h1>
  <div class="setrow"><div><b>Volume</b><small>Effecten en signalen</small></div><input type="range" id="vol" min="0" max="100" value="${Math.round(SET.vol * 100)}" aria-label="Volume"></div>
  <div class="setrow"><div><b>Geluid</b><small>Effecten aan of uit</small></div><button class="tog ${sndOn ? 'on' : ''}" data-snd="1" aria-label="Geluid"></button></div>
  <div class="setrow"><div><b>Bovenaanzicht</b><small>Camera recht van boven in plaats van schuin</small></div><button class="tog ${V2 ? 'on' : ''}" data-view="1" aria-label="Bovenaanzicht"></button></div>
  ${tg('edge', 'Randscrollen', 'Kaart schuift als de muis de rand van het scherm raakt')}${tg('hp', 'Levensbalken altijd tonen', 'Ook bij gezonde eenheden en gebouwen')}${tg('shake', 'Schermschudden', 'Bij instortende gebouwen')}
  <div class="row"><button class="primary" data-m="pause">Terug</button></div>`);
}
export function showTitle() {
    const has_ = (() => {
        try {
            return !!localStorage.getItem(SKEY);
        }
        catch (e) {
            return false;
        }
    })();
    let diff = G ? G.diff : 1;
    const el = $('#title');
    setSpeed(0);
    el.hidden = false;
    document.body.classList.add('titled');
    const D = [['Vredig', 'Geen aanvallen. Alleen bouwen.'], ['Normaal', 'Om de nacht een aanval.'], ['Zwaar', 'Elke nacht, grotere groepen.']];
    const draw = () => {
        el.innerHTML = `<div class="tw"><div class="tag">Van vuursteen tot drone</div><div class="logo">TIJD<br>PERKEN</div><div class="agesrow">${AGES.map((a, i) => `<span style="background:${['#d9a441', '#d08b3c', '#d6705f', '#8fb2c9', '#a6c25c', '#46d3d6'][i]}" title="${a.n}">${a.r}</span>`).join('')}</div>
    <div class="mstack">${has_ ? `<button class="mbtn primary" data-t="cont"><span>Verder spelen</span><small>${placeName()} · dag ${G.day} · ${AGES[G.age].n}</small></button>` : ''}<button class="mbtn ${has_ ? '' : 'primary'}" data-t="new"><span>${has_ ? 'Nieuwe wereld' : 'Begin'}</span><small>${D[diff][0].toLowerCase()}</small></button></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Moeilijkheid</div><div class="diff">${D.map((d, i) => `<button class="${i === diff ? 'on' : ''}" data-d="${i}"><b>${d[0]}</b><small>${d[1]}</small></button>`).join('')}</div></div>
    <div class="mstack"><button class="mbtn" data-t="help"><span>Uitleg</span><small>besturing</small></button><button class="mbtn" data-t="settings"><span>Instellingen</span><small>geluid · camera</small></button></div>
    <div class="tfoot">Zes tijdperken · seizoenen · muren · onderzoek · voortgang wordt in deze browser bewaard</div></div>`;
    };
    draw();
    el.onclick = e => {
        const t = (e.target as HTMLElement).closest('button');
        if (!t)
            return;
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
            }
            else {
                G.diff = diff;
                G.peaceful = diff === 0;
                Object.assign(G.res, diff === 2 ? { food: 150, wood: 120, stone: 40 } : { food: 200, wood: 160, stone: 60 });
            }
        }
        el.hidden = true;
        document.body.classList.remove('titled');
        setSpeed(1);
    };
}
$('#menuBtn').onclick = () => openPause();
export function showHelp() {
    openModal(`<button class="quiet x" data-m="close" aria-label="Sluiten">×</button><div class="eyebrow">Welkom in ${placeName()}</div><h1>Bouw. Groei. Overleef.</h1>
  <p>Leid je stam van de <b>steentijd</b> naar het <b>dronetijdperk</b>, in zes hoofdstukken. Elk tijdperk onthult nieuwe grondstoffen op de kaart: koper en tin, ijzer en goud, kolen, olie en zand, en tot slot lithium.</p>
  <p>Je <b>dorpelingen</b> werken vanzelf op wat het hardst nodig is. Wil je regie, geef ze dan een vaste taak in het paneel Volk, of selecteer ze en klik op een boom, ader of bouwplaats.</p>
  <p>'s <b>Nachts</b> gaan dorpelingen buiten het licht naar huis. Elke tweede nacht vallen vijanden aan. Bouw torens, train een <b>leger</b> en verover de kampen op de kaart voor buit en grond.</p>
  <p><b>Muren</b> houden vijanden echt tegen: ze moeten erdoorheen hakken. Bouw een <b>poort</b> zodat je eigen volk erdoor kan. <b>Wegen</b> laten iedereen sneller lopen. In het paneel <b>Onderzoek</b> doe je uitvindingen per tijdperk, en soms vraagt een <b>gebeurtenis</b> om een keuze.</p>
  <p>Elk nieuw tijdperk ontgrendelt <b>verbeteringen</b> voor wat je al hebt: gebouwen gaan een niveau omhoog, je volk krijgt betere werktuigen en je leger beter pantser. Een pijltje boven een gebouw betekent dat er een verbetering klaarstaat.</p>
  <div class="keys"><kbd>Slepen</kbd><span>Kaart verschuiven · scroll om te zoomen</span><kbd>Klik</kbd><span>Bekijken en selecteren</span><kbd>Shift + slepen</kbd><span>Groep selecteren</span><kbd>Rechtsklik</kbd><span>Opdracht: lopen, aanvallen, verzamelen</span><kbd>Q · I</kbd><span>Hele leger · stilstaande dorpelingen</span><kbd>E</kbd><span>Gebied uitbreiden</span><kbd>V</kbd><span>Bovenaanzicht aan of uit</span><kbd>Spatie · [ ]</kbd><span>Pauze · langzamer / sneller</span><kbd>1 – 9</kbd><span>Gebouw uit de bouwbalk kiezen</span><kbd>Ctrl+F1 – F5 · F1 – F5</kbd><span>Groep instellen · groep selecteren (twee keer: ernaartoe)</span><kbd>S · F · R</kbd><span>Leger: stop · aanvalsmars · patrouille</span><kbd>Shift-klik trainen</kbd><span>Vijf eenheden tegelijk in de wachtrij</span><kbd>Slepen bij muur of weg</kbd><span>Hele lijn in één keer bouwen</span><kbd>Delete</kbd><span>Sloopmodus (of: geselecteerd gebouw afbreken)</span><kbd>Z X C B</kbd><span>Bouwcategorie wisselen</span><kbd>P · M</kbd><span>Paneel · geluid</span><kbd>Esc</kbd><span>Annuleren</span></div>
  <div class="row"><button class="primary" data-m="close">Op avontuur →</button></div>`);
}
export function showVictory() {
    openModal(`<div class="eyebrow">Hoofdstuk VI voltooid</div><h1>Van vuursteen tot drone.</h1><p>${placeName()} doorliep de hele geschiedenis in ${G.day} dagen. ${fmt(G.stats.gathered)} grondstoffen verzameld, ${G.stats.killed} vijanden verslagen, ${G.stats.camps} kampen veroverd.</p><div class="row"><button class="primary" data-m="close">Verder bouwen</button><button data-m="new">Nieuwe wereld</button></div>`);
}
export function showGameOver() {
    openModal(`<div class="eyebrow">Dag ${G.day}</div><h1>Het stamhuis is gevallen.</h1><p>${placeName()} hield ${G.day} dagen stand en bereikte de ${AGES[G.age].n.toLowerCase()}. Bouw volgende keer eerder torens en een leger, of speel in de vredige modus.</p><div class="row"><button class="primary" data-m="newok">Nieuwe wereld</button></div>`);
}
