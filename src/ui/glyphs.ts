// Kleine lijnpictogrammen (SVG) voor de HUD, zodat ze er op elk apparaat hetzelfde uitzien.
// Unicode-tekens zoals ⚔ of ⌂ zien er per lettertype anders uit; hier tekenen we ze zelf.

// Elk pictogram is getekend op een raster van 24 bij 24, met ronde lijnen in de tekstkleur.
const PATHS: Record<string, string> = {
  // omhoog: een niveau hoger
  '▲': '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
  // hamer en werktuigen
  '⚒': '<path d="M4 20l9-9"/><path d="M10.5 6.5l3-3 6 6-3 3z"/><path d="M14 10l-1.5-1.5"/>',
  // vlag voor het verzamelpunt
  '⚑': '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  // schild: verdedigen en pantser
  '⛨': '<path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6z"/><path d="M12 7v10"/>',
  // kruisje: afbreken of sluiten
  '✕': '<path d="M6 6l12 12M18 6L6 18"/>',
  '×': '<path d="M6 6l12 12M18 6L6 18"/>',
  // stoppen
  '■': '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  // twee gekruiste zwaarden
  '⚔': '<path d="M4 4l11 11M20 4L9 15"/><path d="M12.5 17.5l5-5M6.5 12.5l5 5"/><path d="M16 16l4 4M8 16l-4 4"/>',
  // heen en weer lopen
  '⇄': '<path d="M4 8h15M15 4l4 4-4 4"/><path d="M20 16H5M9 12l-4 4 4 4"/>',
  // huisje
  '⌂': '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  // blijf staan: een vak met een stip
  '▣': '<rect x="5" y="5" width="14" height="14" rx="3"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  // achtervolgen: een pijl die vooruit schiet
  '➶': '<path d="M5 19L18 6"/><path d="M10 6h8v8"/>',
  // aan/uit
  '⏻': '<path d="M12 3v8"/><path d="M7.2 6.5a7 7 0 1 0 9.6 0"/>',
  '⏼': '<path d="M12 3v8"/><path d="M7.2 6.5a7 7 0 1 0 9.6 0"/>',
  // richten en bekijken
  '◎': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  // iemand ergens heen sturen
  '➜': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  // gebied uitbreiden: vier hoekjes
  '⬚': '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  // olie
  '⛽': '<path d="M12 3c4 5 6 8.2 6 11a6 6 0 0 1-12 0c0-2.8 2-6 6-11z"/>',
  // een poppetje: inwoners en dorpelingen
  '☺': '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20c.6-4 3.3-6.5 7-6.5s6.4 2.5 7 6.5"/>',
  // tandwiel: gebouwen die iets maken
  '⚙': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  // bliksem: stroom
  ϟ: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  // ruit: gebied
  '◇': '<path d="M12 3l8 9-8 9-8-9z"/>',
  // vinkje
  '✓': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  // plus: herstellen
  '✚': '<path d="M12 5v14M5 12h14"/>',
  // weegschaal: handel
  '⚖': '<path d="M12 4v16M8 20h8M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/>',
  // snelheid
  '»': '<path d="M5 6l6 6-6 6M13 6l6 6-6 6"/>',
  // vliegtuigje: raakt drones
  '✈': '<path d="M12 3v18M4 13l8-4 8 4M9 20l3-2 3 2"/>',
  // pijltjes in een rondje: vanzelf
  '↻': '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4h-4"/>',
  // zon: niets te doen
  '☉': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',

  // Voor zegeningen en uitvindingen
  // kiemplantje: akkers en oogst
  '⚘': '<path d="M12 21v-9"/><path d="M12 12c0-4.5-2.5-7-7-7 0 4.5 2.5 7 7 7z"/><path d="M12 15c0-4 2.2-6.5 7-6.5 0 4-2.5 6.5-7 6.5z"/>',
  // vis: jagen en vissen
  '⋈': '<path d="M3 12c2.5-4 7.5-6 12-2.5L21 6v12l-6-3.5C10.5 18 5.5 16 3 12z"/><circle cx="8" cy="11.3" r=".5" fill="currentColor"/>',
  // boom: hout
  '♣': '<path d="M12 3l6 7h-3l4 5H5l4-5H6z"/><path d="M12 15v6"/>',
  // houweel: steen en erts
  '⛏': '<path d="M3 9c5-4.5 13-4.5 18 0"/><path d="M12 5.6V21"/>',
  // mand: meer dragen
  '◡': '<path d="M4 10h16l-1.8 9.2a1 1 0 0 1-1 .8H6.8a1 1 0 0 1-1-.8z"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M9 14v3M12 14v3M15 14v3"/>',
  // pen: onderzoek
  '✎': '<path d="M4 20l1.5-5L16 4.5a2.1 2.1 0 0 1 3 3L8.5 18z"/><path d="M14 6.5l3 3"/>',
  // molenwieken
  '✣': '<path d="M12 12V3h3M12 12h9v3M12 12v9H9M12 12H3V9"/>',
  // hart: levens
  '♥': '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  // schatkist: buit
  '⛁': '<rect x="3.5" y="10" width="17" height="10" rx="1.5"/><path d="M3.5 10V9a5 4 0 0 1 5-4h7a5 4 0 0 1 5 4v1"/><path d="M3.5 14h17M12 13v3"/>',
  // akker met voren: meer boeren per akker
  '▤': '<path d="M3 20l3.5-11h11L21 20z"/><path d="M10 9l-1.5 11M14 9l1.5 11"/><path d="M12 9V4M12 6.5c-1-1.6-2.4-2-3.5-2M12 6.5c1-1.6 2.4-2 3.5-2"/>',
  // stukje muur met een munt: goedkopere muren
  '⛀': '<path d="M3 11h12v9H3z"/><path d="M3 15.5h12M9 11v4.5M6 15.5V20M12 15.5V20"/><circle cx="18" cy="7" r="3.5"/><path d="M16.6 7h2.8"/>',
  // bakstenen: muren
  '▦': '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M12 9.7v4.6M9 14.3V19M15 14.3V19"/>',
  // weg met een middenstreep
  '═': '<path d="M9 3L5 21M15 3l4 18"/><path d="M12 5v2.5M12 11v2.5M12 17v2.5"/>',
  // stralend licht
  '✹': '<circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  // vallende ster
  '☄': '<circle cx="15.5" cy="8.5" r="4"/><path d="M12.5 11.5L4 20M11.6 8.2L6 13.8M15.8 12.4L10.2 18"/>',

  // Voor volken
  // tent: de Nomaden
  '⛺': '<path d="M3 20L12 5l9 15z"/><path d="M12 5V3M9 20l3-6 3 6"/>',
  // hangslot: nog op slot
  '⚿': '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 14.5v2"/>',

  // Voor prestaties
  // ster: gewonnen
  '★': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  // zandloper: snel
  '⌛': '<path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9"/>',
  // kroon: alle volken
  '♛': '<path d="M4 18L3 7.5l5 4 4-6.5 4 6.5 5-4L20 18z"/><path d="M4 21h16"/>',
  // Voor het nieuw-spelscherm
  // een stuk land: de kaartsoort Continent
  '⬟': '<path d="M5 8.5c2-3.5 6.5-4.5 9.5-2.5s6.5 1 6 5.5-2.5 7-6.5 7-4.5 1.8-7.5.8S2.8 15.5 3.3 12.5 4 10 5 8.5z"/>',
  // twee eilandjes in de golven: de kaartsoort Eilanden
  '≈': '<path d="M3.5 13c1.3-3.6 5.7-3.6 7 0M13 11c1.3-3.4 5.2-3.4 6.5 0"/><path d="M2 17c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/>',
  // bergen met sneeuw: de kaartsoort Bergland
  '⛰': '<path d="M2 20l7-13 4 6.5 2.5-3.5L22 20z"/><path d="M6.6 11.5l2.4 1.5 2-1.5"/>',
  // dobbelsteen: een willekeurige wereld
  '⚄': '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.8" cy="8.8" r="1.1" fill="currentColor"/><circle cx="15.2" cy="8.8" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.8" cy="15.2" r="1.1" fill="currentColor"/><circle cx="15.2" cy="15.2" r="1.1" fill="currentColor"/>',
  // maan: nachten overleven
  '☾': '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  // pijl naar links: terug
  '←': '<path d="M20 12H5M11 6l-6 6 6 6"/>',

  // Voor uitdagingen
  // sneeuwvlok: de lange winter
  '❄': '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2M4 10.8l3.2-.6-.9-3M20 13.2l-3.2.6.9 3M4 13.2l3.2.6-.9 3M20 10.8l-3.2-.6.9-3"/>',

  // Voor gebeurtenissen
  // vlam: bosbrand
  '♨': '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.2 3.6-8.3 1.6 1.4 2.2 3 2.3 4.6 1-1.5 1.4-3.3 1.2-5.6 3.5 2.4 5.9 5.6 5.9 9.3 0 3.6-2.6 6.2-6.5 6.2z"/><path d="M12 21c-1.6 0-2.7-1-2.7-2.6 0-1.5 1.2-2.6 2.7-4.2 1.5 1.6 2.7 2.7 2.7 4.2 0 1.6-1.1 2.6-2.7 2.6z"/>',
  // wolk met regen: storm en rook
  '☁': '<path d="M7 16a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 16z"/><path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2"/>',
  // geslepen steen: een rijke vondst
  '◆': '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M9.5 4L8 9l4 11 4-11-1.5-5"/>',
  // anker: een schip
  '⚓': '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 11h8"/><path d="M4.5 14c.5 4 3.6 7 7.5 7s7-3 7.5-7"/>',
  // schotel met golven: een signaal
  '☊': '<path d="M4 10a10 10 0 0 0 10 10z"/><path d="M9 15l3.5-3.5"/><path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5M15 7a2 2 0 0 1 2 2"/>',

  // vraagteken: geheime prestatie
  '?': '<path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9V15"/><circle cx="12" cy="18.6" r=".6" fill="currentColor"/>',
};

// Geeft een SVG-pictogram terug voor een bekend teken, of het teken zelf als we het niet kennen.
export function ico(ch: string, cls = ''): string {
  const p = PATHS[ch];
  if (!p) return `<span class="gl ${cls}">${ch}</span>`;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
