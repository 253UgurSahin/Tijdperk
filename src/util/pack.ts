// Grote rijen getallen (wegen en grondstoffen op de kaart) klein maken voor de opslag in de browser.
// Op de meeste tegels staat een 0, dus een reeks nullen schrijven we kort op als "0 en hoeveel".

/** Bytes naar tekst (base64), want de browseropslag bewaart alleen tekst. */
export function toBase64(bytes: Uint8Array): string {
  let text = '';
  // In stukjes, anders wordt de lijst met argumenten te lang voor de browser.
  // (apply werkt ook met een Uint8Array, een rij getallen, maar de types kennen alleen gewone lijsten.)
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(text);
}

/** Tekst (base64) terug naar bytes. */
export function fromBase64(text: string): Uint8Array {
  const raw = atob(text),
    bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Reeksen nullen inkorten. Elke 0 wordt gevolgd door hoeveel nullen er achter elkaar staan (1 tot 255);
 * andere getallen blijven gewoon staan. Een kaart van 256 × 256 tegels wordt zo zo'n tien keer kleiner.
 */
export function packZeros(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length * 2 + 2);
  let n = 0;
  for (let i = 0; i < bytes.length;) {
    if (bytes[i] !== 0) {
      out[n++] = bytes[i++];
      continue;
    }
    let run = 0;
    while (i < bytes.length && bytes[i] === 0 && run < 255) {
      run++;
      i++;
    }
    out[n++] = 0;
    out[n++] = run;
  }
  return out.slice(0, n);
}

/** Terug naar de volle rij van `length` bytes (zie packZeros). */
export function unpackZeros(packed: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let n = 0;
  for (let i = 0; i < packed.length && n < length; i++) {
    if (packed[i] !== 0) out[n++] = packed[i];
    else n += packed[++i] || 0; // de nullen staan er al: een nieuwe rij begint op 0
  }
  return out;
}
