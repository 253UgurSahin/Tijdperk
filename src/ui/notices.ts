import { sfx } from '../audio/sound';
import { bus, sigs } from '../core/bus';
import { $ } from '../core/dom';
import { esc } from '../core/util';
import { RES } from '../data/resources';
import { EVENTS, resolveEvent } from '../sim/events';
import { has, pay } from '../sim/rules';
import { G } from '../sim/state';
import { costHTML, gem, setHTML } from './fmt';
import { note, pulseRes, toast } from './hud';

// event card
export function renderEvent() {
    const ev = G.event, el = $('#event');
    if (!ev) {
        el.hidden = true;
        sigs.ev = null;
        return;
    }
    const d = EVENTS.find(e => e.id === ev.id)!;
    el.hidden = false;
    const sig = 'e' + ev.id + ev.until + (ev.ca ? has(ev.ca) : 1) + Math.floor((ev.until - G.t) / 3);
    setHTML(el, 'ev', sig, () => `<div class="eh"><div class="ic">${d.g}</div><div><b>${d.t}</b><p>${esc(ev.text!)}</p></div></div><div class="ch"><button class="primary" data-ev="a" ${ev.ca && !has(ev.ca) ? 'disabled' : ''}>${d.a.l}${ev.ca ? costHTML(ev.ca) : ''}</button><button data-ev="b">${d.b.l}<span class="cost">standaard na ${Math.ceil(ev.until - G.t)}s</span></button></div><div class="bar acc"><i style="width:${(ev.until - G.t) / 45 * 100}%"></i></div>`);
}
$('#event').addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t || t.disabled)
        return;
    resolveEvent(t.dataset.ev!);
});
export function renderOffer() {
    const o = G.offer, el = $('#offer');
    if (!o) {
        el.hidden = true;
        sigs.offer = null;
        return;
    }
    el.hidden = false;
    const sig = 'o' + o.until + has({ [o.give]: o.price }) + Math.floor((o.until - G.t) / 5);
    setHTML(el, 'offer', sig, () => `<div class="ic">⚖</div><div class="t"><b>Reizende handelaar</b>${gem(o.want)} ${o.amt} ${RES[o.want].n} voor ${gem(o.give)} ${o.price} ${RES[o.give].n}<div class="bar acc"><i style="width:${(o.until - G.t) / 70 * 100}%"></i></div></div><button class="primary" data-o="ok" ${has({ [o.give]: o.price }) ? '' : 'disabled'}>Ruil</button><button class="quiet" data-o="no" aria-label="Afslaan">✕</button>`);
}
$('#offer').addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest('button');
    if (!t || t.disabled || !G.offer)
        return;
    const o = G.offer;
    if (t.dataset.o === 'ok') {
        pay({ [o.give]: o.price });
        G.res[o.want] += o.amt;
        pulseRes(o.want);
        toast(`Geruild: ${o.amt} ${RES[o.want].n.toLowerCase()} ontvangen.`, 'good');
        sfx('upgrade');
    }
    else
        note('Aanbod van de handelaar afgeslagen.');
    G.offer = null;
    sigs.offer = null;
    bus.uiDirty = true;
});
