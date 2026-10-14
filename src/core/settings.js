// Spelersinstellingen (geluid, randscrollen, ...) die in de browser worden bewaard.
export let SET = { vol: 0.8, edge: true, hp: false, shake: true };
try {
  Object.assign(SET, JSON.parse(localStorage.getItem('tijdperken-set') || '{}'));
} catch (e) {}
export function saveSet() {
  try {
    localStorage.setItem('tijdperken-set', JSON.stringify(SET));
  } catch (e) {}
}
