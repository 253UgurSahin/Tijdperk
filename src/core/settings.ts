// Spelersinstellingen (geluid, beeld, besturing, hulp) die in de browser worden bewaard.
// Elke instelling heeft hier een standaardwaarde; "Standaard herstellen" zet ze allemaal terug.
export const DEFAULTS = {
  // geluid
  sound: true, // alle geluid aan of uit
  vol: 0.8, // hoofdvolume
  alerts: true, // alarm bij aanvallen en meldingen
  uiSounds: true, // klikjes van knoppen
  muteHidden: true, // stil als je naar een ander tabblad gaat
  // beeld
  quality: 'auto', // 'auto' | 'low' | 'mid' | 'high' | 'custom'
  gfx: { scale: 1, shadows: true, bloom: true, outline: true, particles: true },
  shake: true,
  motion: true, // animaties: bewegende knoppen, camerazwaai, meetellende getallen (uit = rustiger)
  fps: false, // beeldjes per seconde tonen
  // besturing
  edge: true, // kaart schuift als de muis de rand raakt
  camSpeed: 1, // hoe snel de camera schuift
  invertZoom: false,
  dragSelect: true, // linkermuis slepen = selectiekader
  // interface en hulp
  coach: true, // tutorial: "volgende stap" en oplichtende knoppen
  tips: true, // uitleg als je over iets heen gaat met de muis
  hp: false, // levensbalken altijd tonen
  uiScale: 1, // grootte van de interface
  hudWide: false, // ultrabreed scherm: HUD over de volle breedte
  autosave: true,
};

/** Alle instellingen, met hun soort (zie DEFAULTS). */
export type Settings = typeof DEFAULTS;

export const SET: Settings = structuredClone(DEFAULTS);
try {
  const saved = JSON.parse(localStorage.getItem('tijdperken-set') || '{}');
  Object.assign(SET, saved, { gfx: { ...DEFAULTS.gfx, ...(saved.gfx || {}) } });
  // Oude losse instelling voor geluid aan/uit meenemen
  if (localStorage.getItem('tijdperken-snd') === 'off' && saved.sound === undefined) SET.sound = false;
} catch (e) {}

export function saveSet() {
  try {
    localStorage.setItem('tijdperken-set', JSON.stringify(SET));
  } catch (e) {}
}

/** Alles terug naar de standaardwaarden. */
export function resetSet() {
  // Alles weghalen, ook oude sleutels uit de opslag die niet (meer) in DEFAULTS staan
  for (const k of Object.keys(SET)) delete (SET as Record<string, unknown>)[k];
  Object.assign(SET, structuredClone(DEFAULTS));
  saveSet();
  applyLayoutSettings();
}

/** Instellingen die direct de pagina raken: indeling, grootte, animaties en hulp. */
export function applyLayoutSettings() {
  const body = document.body.classList;
  body.toggle('hudwide', !!SET.hudWide);
  body.toggle('nocoach', !SET.coach);
  body.toggle('calm', !SET.motion);
  document.documentElement.style.setProperty('--ui-scale', String(SET.uiScale));
  const fps = document.getElementById('fps');
  if (fps) fps.hidden = !SET.fps;
}
applyLayoutSettings();
