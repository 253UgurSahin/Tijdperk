# Tijdperken

Een real-time strategiespel in de browser: leid je stam van de **steentijd** naar het **dronetijdperk**, in zes tijdperken.

**Spelen:** <https://253ugursahin.github.io/Tijdperk/>

- 3D-wereld in WebGL ([three.js](https://threejs.org)), met dag/nacht, seizoenen, regen en schaduwen
- RTS-interface: grondstoffen met dorpelingen per taak, selectiepaneel, knoppenraster en minikaart
- Bouwen, verzamelen, gebied uitbreiden, onderzoek, een leger trainen en kampen veroveren
- Het spel wijst zelf de volgende stap aan; geen uitleg nodig
- Gemaakt voor de pc, ook speelbaar op telefoon en tablet (staand en liggend)
- Voortgang wordt in de browser bewaard (localStorage)

## Besturing

| Actie | Muis / toets | Aanraken |
|---|---|---|
| Selecteren | Klik · Shift + slepen voor een groep | Tik |
| Opdracht (lopen, aanvallen, verzamelen) | Rechtsklik | Selecteer, tik dan op de plek of het doel |
| Kaart verschuiven | Slepen, WASD of pijltjes, muis naar de rand | Slepen met één vinger |
| Zoomen | Scrollwiel | Knijpen met twee vingers |
| Pauze / sneller / langzamer | Spatie · `]` · `[` | Knoppen bovenin |
| Bouwcategorie | Z · X · C · B, daarna 1–9 | Tabbladen onderin |
| Gebied uitbreiden | E | Menu → Kaart |
| Hele leger · dorpelingen zonder werk | Q · I | |
| Bovenaanzicht aan/uit | V | Menu → Instellingen |

## Zelf ontwikkelen

Nodig: [Node.js](https://nodejs.org) 20.19 of nieuwer.

```bash
npm install       # eenmalig
npm run dev       # ontwikkelserver met automatisch herladen
npm run build     # typecheck + productiebuild in dist/
npm run preview   # de build lokaal bekijken
```

Elke push naar `main` wordt door GitHub Actions gecontroleerd (TypeScript) en gebouwd, en daarna op GitHub Pages gezet
(*Settings → Pages → Source: GitHub Actions*). Pull requests worden alleen gecontroleerd.

### Opbouw

De code is TypeScript (strict) met [Vite](https://vite.dev) als bouwgereedschap.

| Map | Inhoud |
|---|---|
| `src/data/` | Spelgegevens: grondstoffen, tijdperken, gebouwen, eenheden, onderzoek |
| `src/sim/` | De simulatie: wereld, dorpelingen, gevechten, tijd, opslaan. Gebruikt geen DOM of three.js |
| `src/render/` | De 3D-wereld met three.js: camera, modellen, terrein, effecten, belichting |
| `src/ui/` | De interface: balken, panelen, selectie, menu's, de volgende-stap-coach |
| `src/input/` | Muis, aanraken, toetsenbord, selecteren en opdrachten geven |
| `src/audio/` | Geluidseffecten (Web Audio) |
| `src/core/` | Gedeelde hulpfuncties, instellingen en de koppeling tussen simulatie en interface |
| `src/game/` | Start, spellus, nieuw spel, opslaan en laden |
| `src/types.ts` | Gedeelde types voor spelgegevens en eenheden |

De simulatie praat niet rechtstreeks met de interface: meldingen en geluid gaan via `core/bus.ts`.
