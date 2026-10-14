# Tijdperken

Een real-time strategiespel in de browser: leid je stam van de **steentijd** naar het **dronetijdperk**, in zes tijdperken.

- Elke wereld wordt opnieuw gegenereerd (256×256 tegels): zee en kust, rivieren en meren, bossen, heuvels, bergketens met sneeuw, woestijnen en zoutvlaktes. Ertsen liggen waar ze logisch horen
- 3D-wereld in WebGL ([three.js](https://threejs.org) r149), met dag/nacht, seizoenen, regen en schaduwen
- RTS-interface: grondstoffen met dorpelingen per taak, selectiepaneel, knoppenraster en minikaart
- Bouwen, verzamelen, gebied uitbreiden, onderzoek, een leger trainen en kampen veroveren
- Het spel wijst zelf de volgende stap aan; geen uitleg nodig
- Voortgang wordt in de browser bewaard (localStorage)

## Spelen

```bash
npm install
npm run dev       # ontwikkelserver op http://localhost:5173
npm run build     # productiebuild in dist/
npm run preview   # bekijk de build lokaal
npm test          # unittests (Vitest)
npm run lint      # ESLint + opmaakcontrole
npm run format    # code netjes opmaken (Prettier)
```

Bij elke push naar `main` draait de CI (lint, tests, build) en wordt `dist/` naar GitHub Pages gepubliceerd
(*Settings → Pages → Source: GitHub Actions*).

## Projectstructuur

```
index.html            alleen de HUD-markup; laadt src/main.js
src/
  main.js             opstarten en de spellus (frame)
  config.js           kaartgrootte en vaste getallen
  core/               gedeelde mutabele toestand (store) en instellingen
  data/               pure speldata: grondstoffen, gebouwen, eenheden, tijdperken, techniek
  world/              kaartgeneratie, terreinlagen en padvinding
  game/               spelregels: toestand, dorpelingen, leger, gebeurtenissen, opslaan
  render/             three.js-wereld: camera, modellen, terrein, effecten, minikaart
  input/              muis, toetsenbord, selectie en opdrachten
  audio/              geluidseffecten (Web Audio)
  ui/                 HUD-panelen, menu's, coach en tooltips
  styles/             CSS per HUD-onderdeel
tests/                Vitest-tests voor data, wereldgeneratie en hulpfuncties
```

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

## Claude-artifact

`npm run build:artifact` bundelt het hele spel (inclusief three.js) in één bestand:
`dist-artifact/tijdperken.html`. Dat bestand wordt na elke mijlpaal gepubliceerd op de artifact-link.
