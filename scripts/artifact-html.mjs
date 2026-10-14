// Maakt van de één-bestand-build een pagina voor de Claude-artifact:
// de artifact zet zelf het <html>/<head>/<body>-skelet eromheen, dus die tags halen we weg.
import fs from 'node:fs';

const file = 'dist-artifact/index.html';
let html = fs.readFileSync(file, 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body[^>]*>/gi, '')
  .replace(/<meta charset="utf-8"\s*\/?>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .trim();
fs.writeFileSync('dist-artifact/tijdperken.html', html + '\n');
console.log('dist-artifact/tijdperken.html', Math.round(html.length / 1024) + ' kB');
