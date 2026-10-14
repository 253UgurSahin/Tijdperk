// Spelersinstellingen (geluid, randscrollen, ...) die in de browser worden bewaard.
// quality: 'auto' | 'low' | 'mid' | 'high' · dragSelect: linkermuis slepen = selectiekader
// hudWide: op een ultrabreed scherm de HUD over de volle breedte in plaats van in het midden
export let SET = {
  vol: 0.8,
  edge: true,
  hp: false,
  shake: true,
  quality: 'auto',
  dragSelect: true,
  hudWide: false,
};
try {
  Object.assign(SET, JSON.parse(localStorage.getItem('tijdperken-set') || '{}'));
} catch (e) {}
export function saveSet() {
  try {
    localStorage.setItem('tijdperken-set', JSON.stringify(SET));
  } catch (e) {}
}

/** Instellingen die direct de pagina-indeling raken. */
export function applyLayoutSettings() {
  document.body.classList.toggle('hudwide', !!SET.hudWide);
}
applyLayoutSettings();
