// Alleen voor de tests: de paar Node-functies die ze gebruiken om broncode van het spel te lezen.
// (Zo hoeven we niet alle Node-types te installeren; het spel zelf draait in de browser.)
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
