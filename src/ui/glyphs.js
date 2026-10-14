// Kleine lijnpictogrammen (SVG) voor de HUD, zodat ze er op elk apparaat hetzelfde uitzien.
// Unicode-tekens zoals ⚔ of ⌂ zien er per lettertype anders uit; hier tekenen we ze zelf.

// Elk pictogram is getekend op een raster van 24 bij 24, met ronde lijnen in de tekstkleur.
const PATHS = {
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
};

// Geeft een SVG-pictogram terug voor een bekend teken, of het teken zelf als we het niet kennen.
export function ico(ch, cls = '') {
  const p = PATHS[ch];
  if (!p) return `<span class="gl ${cls}">${ch}</span>`;
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
