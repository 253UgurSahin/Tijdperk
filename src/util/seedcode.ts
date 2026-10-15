// Zaadcodes: een korte code zoals "TP-7K2Q" voor het getal (de seed) waaruit een wereld groeit.
// Zelfde code = zelfde getal = zelfde wereld, zodat je een wereld kunt delen met een vriend.

// 32 tekens zonder I, L, O en U: die lijken te veel op 1, 0 en V (zoals bij Crockford-codes).
// Wie ze toch typt, krijgt het teken waar ze op lijken (zie seedFromCode).
const LETTERS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'TP-';

/** Zoveel tekens heeft een nieuwe code (na "TP-"). */
export const CODE_LEN = 4;
/** Nieuwe werelden krijgen een seed onder dit getal, zodat de code vier tekens blijft. */
export const SEED_MAX = 32 ** CODE_LEN;
// Oude opslag heeft seeds tot een miljard: die passen in zes tekens
const MAX_LEN = 6;

/** De code bij een seed, zoals "TP-7K2Q". Altijd minstens vier tekens (aangevuld met nullen). */
export function codeFromSeed(seed: number): string {
  let n = Math.max(0, Math.floor(seed) || 0);
  let text = '';
  do {
    text = LETTERS[n % 32] + text;
    n = Math.floor(n / 32);
  } while (n > 0);
  return PREFIX + text.padStart(CODE_LEN, '0');
}

/**
 * De seed bij een getypte code, of null als het geen geldige code is.
 * Vergeeft kleine foutjes: kleine letters, spaties, zonder "TP-", O/I/L in plaats van 0/1 en U voor V.
 */
export function seedFromCode(text: string | null | undefined): number | null {
  let s = String(text || '')
    .toUpperCase()
    .trim();
  if (/^TP[\s-]+/.test(s)) {
    // "TP-" of "TP " staat er duidelijk voor: altijd weghalen. Zo wordt "TP-7K2" (een teken te weinig)
    // geweigerd, in plaats van stilletjes als de code "TP7K2" van een andere wereld gelezen.
    s = s.replace(/^TP[\s-]+/, '');
  } else if (/^TP/.test(s) && s.length - 2 >= CODE_LEN) {
    // "TP7K2Q" zonder streepje: "TP" weghalen als er daarna nog een hele code staat
    s = s.slice(2);
  }
  s = s
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V');
  // Een code heeft vier tot zes tekens (meer dan vier alleen bij werelden uit oude opslag)
  if (s.length < CODE_LEN || s.length > MAX_LEN) return null;
  let n = 0;
  for (const ch of s) {
    const v = LETTERS.indexOf(ch);
    if (v < 0) return null;
    n = n * 32 + v;
  }
  return n;
}

/** Een getypte code netjes geschreven ("tp 7k2q" wordt "TP-7K2Q"), of null als hij niet klopt. */
export function cleanCode(text: string | null | undefined): string | null {
  const seed = seedFromCode(text);
  return seed === null ? null : codeFromSeed(seed);
}

/** Een willekeurige seed voor een nieuwe wereld (nooit 0, en altijd met een code van vier tekens). */
export const randomSeed = (rand = Math.random): number => 1 + Math.floor(rand() * (SEED_MAX - 1));
