# Tijdperken

Een real-time strategiespel in de browser: leid je stam van de **steentijd** naar het **dronetijdperk**, in zes tijdperken.

- 3D-wereld in WebGL ([three.js](https://threejs.org) r149), met dag/nacht, seizoenen, regen en schaduwen
- RTS-interface: grondstoffen met dorpelingen per taak, selectiepaneel, knoppenraster en minikaart
- Bouwen, verzamelen, gebied uitbreiden, onderzoek, een leger trainen en kampen veroveren
- Het spel wijst zelf de volgende stap aan; geen uitleg nodig
- Voortgang wordt in de browser bewaard (localStorage)

## Spelen

Open `index.html` in een moderne browser (Chrome, Edge, Firefox of Safari). Er is geen build-stap.
Een internetverbinding is nodig voor three.js (jsDelivr) en de lettertypes (Google Fonts).

Met GitHub Pages kun je het spel ook online zetten: *Settings → Pages → Deploy from branch → `main` / root*.

## Besturing

| Actie | Muis / toets |
|---|---|
| Selecteren | Klik · Shift + slepen voor een groep |
| Opdracht (lopen, aanvallen, verzamelen) | Rechtsklik |
| Kaart verschuiven | Slepen, WASD of pijltjes, muis naar de rand |
| Zoomen | Scrollwiel |
| Pauze / sneller / langzamer | Spatie · `]` · `[` |
| Bouwcategorie | Z · X · C · B, daarna 1–9 |
| Gebied uitbreiden | E |
| Hele leger · dorpelingen zonder werk | Q · I |
| Bovenaanzicht aan/uit | V |
