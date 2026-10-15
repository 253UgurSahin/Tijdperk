# Tijdperken

Een real-time strategiespel in de browser: leid je stam van de **steentijd** naar het **sterrentijdperk**, in negen tijdperken.

- Negen tijdperken, elk met eigen gebouwen, wapens en vijanden:
  Steentijd · Bronstijd · IJzertijd · Middeleeuwen · Gouden Eeuw (windmolens, kruitmolens, grachtenpanden,
  musketiers) · Industriële tijd · Moderne tijd · Dronetijdperk · Sterrentijdperk (sterrenmetaal uit meteorieten,
  fusie, mechs en de sterrenpoort waarmee je wint)
- Elke wereld wordt opnieuw gegenereerd (256×256 tegels): zee en kust, rivieren en meren, bossen, heuvels, bergketens met sneeuw, woestijnen en zoutvlaktes. Ertsen liggen waar ze logisch horen
- Meteorieten: af en toe slaat er een in (met waarschuwing). Rond de krater liggen daarna nieuwe ertsen, vooral wat bij jou schaars is
- Een nieuw tijdperk maakt oude gebouwen en eenheden onbouwbaar (de hut wijkt voor het leemhuis, het kampvuur voor de fakkelpaal, ...)
- Zegeningen: na de eerste minuut en bij elk nieuw tijdperk kies je één van drie kaarten met een voordeel voor de
  rest van het spel (sommige met een nadeel erbij). Dezelfde wereld geeft dezelfde kaarten; je zegeningen staan
  bovenaan het paneel Verbeteren
- Gebeurtenissen: ruim 40, de meeste horen bij een tijdperk (wolven, een ingestorte mijn, de pest, tulpenmanie,
  een staking, hackers, een signaal uit de ruimte, ...). Elke keuze heeft een voor- en een nadeel. Sommige geven
  een tijdelijke bonus (onder de kaartjes zie je wat hij doet en hoe lang nog; tik erop voor uitleg) of krijgen
  dagen later een vervolg dat afhangt van wat je koos. Kies je niet op tijd, dan gebeurt de laatste keuze vanzelf
- Nieuwe wereld: kies je volk, moeilijkheid (Vredig, Normaal, Zwaar of Meedogenloos), kaart (Continent,
  Eilanden of Bergland) en hoe je wint: de sterrenpoort bouwen, 30 nachten overleven, een kort spel tot de
  Gouden Eeuw, alle rivalen verslaan of vier wereldwonderen hebben. Elke wereld heeft een zaadcode zoals `TP-7K2Q`: dezelfde code met dezelfde kaart geeft dezelfde
  wereld, dus je kunt hem delen. Je ziet de code in het pauzemenu. Prestaties voor winnen tellen alleen met de
  sterrenpoort; win je eerst op een andere manier, dan kun je daarvoor gewoon doorspelen
- Uitdagingen: tien opdrachten van 20 tot 45 minuten met eigen spelregels, zoals Lange winter, Belegering (10
  nachten overleven tegen grotere aanvallen), Alleen torens (geen leger), Eilandvolk en Sprint naar de sterren
  (begin in het Dronetijdperk). Haal je het doel, dan krijg je brons, zilver of goud, op tijd of op hoe weinig je
  verloor. Op de doelenkaart zie je het doel, hoe ver je bent en de klok. Je beste medaille blijft bewaard
- Wereld van de dag: elke dag een nieuwe wereld met een doel en twee spelregels, voor iedereen hetzelfde. Je beste
  score van die dag blijft bewaard
- Volken: kies bij een nieuwe wereld met welk volk je begint. Elk volk heeft eigen voordelen; de Noormannen trainen
  zelfs een eigen soldaat (de Berserker). Friezen, Noormannen en Hanze zijn vrij; Bergvolk, Sterrenkijkers en
  Nomaden speel je vrij met prestaties
- Wereldwonderen: elk tijdperk heeft één wonder (Hunebed, Piramide, Colosseum, Dom van Utrecht, Oost-Indisch
  Huis, Eiffeltoren, Deltawerken, Ruimtestation en Ruimtelift), elk maar één keer per wereld en met een sterke
  bonus. Met 3 bouwers duurt een wonder 2 tot 3 minuten; meer bouwers helpen, maar steeds minder. Een rivaal met
  het karakter Bouwer bouwt ze ook (vanaf dag 10) en doet er anderhalf keer zo lang over. Op de doelenkaart zie
  je al als hij ervoor spaart, en daarna de race; sloop zijn bouwplaats of wees sneller. Is hij eerder klaar,
  dan is het wonder bezet tot je het verwoest of hem verslaat: dan wordt het van jou. Met vier wonderen tegelijk
  kun je winnen (kies Wonderen bij een nieuwe wereld); elk wonder telt 500 punten
- Diplomatie: elke rivaal heeft een relatie van −100 tot +100 (Vijandig, Koel, Neutraal, Vriendelijk of
  Bondgenoot). Een Handelaar begint op +20, een Bouwer op 0 en een Krijger op −30 (op Zwaar 15 lager, op
  Meedogenloos 30 lager). De relatie schuift elke dag 4 punten terug naar dat beginpunt; een verdrag of verbond
  houdt haar hoger. In het paneel Leger opent **Diplomatie ›** (in de kop Rivalen) een venster (het spel staat dan
  stil) met per rivaal: een geschenk, een handelsverdrag (vanaf +20, elke minuut je overschot voor wat je
  tekortkomt; je laatste voorraad houd je zelf), schatting eisen (alleen als je veel sterker bent), een
  bondgenootschap (vanaf +60) en oorlog verklaren of vrede voorstellen. Bij elke actie staan vooraf de kans, de
  kosten en wat er gebeurt. Vrienden vallen zelden aan, bondgenoten nooit; die sturen soms soldaten als je wordt
  aangevallen. Val je iemand aan zonder oorlogsverklaring, dan vraagt het spel eerst om een tweede klik: daarna is
  het oorlog en vertrouwen de anderen je minder (sla je terug na hun aanval, dan niet). Een kamp of kampioen
  verslaan maakt ze juist blij. Rivalen sturen ook zelf berichten: een ruil, een vraag om hulp, een eis (betaal je,
  dan laten ze je een paar dagen met rust) of een voorstel
- Prestaties en profiel: ruim 40 prestaties (elk tijdperk, winnen op Zwaar of hoger, winnen met elk volk,
  kampen veroveren, aanvallen doorstaan, en een paar geheime). Je haalt ze in het spel met een eigen geluid en
  kaartje; op het titelscherm zie je onder **Prestaties** wat je hebt, je beste scores en je laatste spellen. Het
  profiel blijft bewaard, ook als je een nieuwe wereld begint
- Eindscore: bij winst of verlies rekent het spel je score uit (tijdperken verder, kampen, vijanden, min de dagen,
  keer de moeilijkheid) en krijg je een medaille van brons, zilver of goud. Zet je de vredige modus aan, dan telt
  de score van dat spel half
- 3D-wereld in WebGL ([three.js](https://threejs.org) r149), met dag/nacht, seizoenen, regen en schaduwen
- RTS-interface: grondstoffen met dorpelingen per taak, selectiepaneel, knoppenraster en minikaart
- Bouwen, verzamelen, gebied uitbreiden, onderzoek, een leger trainen en kampen veroveren
- Het spel wijst zelf de volgende stap aan; geen uitleg nodig
- Voortgang wordt in de browser bewaard (localStorage)

## Zelf ontwikkelen

De code is **TypeScript** (strict) en wordt gebouwd met [Vite](https://vite.dev). Nodig: Node.js 20.19 of nieuwer.

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
npm run typecheck  # alleen de types controleren
npm run build      # types controleren en productiebuild in dist/
npm run preview    # bekijk de build lokaal
npm test           # unittests (Vitest)
npm run lint       # ESLint + opmaakcontrole
npm run format     # code netjes opmaken (Prettier)
```

Bij elke push naar `main` draait de CI (lint, tests, build) en wordt `dist/` naar GitHub Pages gepubliceerd
(_Settings → Pages → Source: GitHub Actions_).

## Projectstructuur

```
index.html            alleen de HUD-markup; laadt src/main.ts
src/
  main.ts             opstarten en de spellus (frame)
  types.ts            gedeelde types: gebouwen, dorpelingen, soldaten, de spelstand
  config.ts           kaartgrootte en vaste getallen
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

## Beeld en besturing

- **Selecteren:** sleep met de linkermuis een kader (Shift: erbij). Dubbelklik of Ctrl-klik selecteert alles van
  dat soort in beeld. Rechts slepen, WASD of de schermrand verschuift de kaart. In de instellingen kun je slepen
  weer op "kaart verschuiven" zetten.
- **Instellingen** (Menu → Instellingen), in vier tabbladen:
  - _Spel:_ tutorial aan/uit, uitleg bij de muis, levensbalken, automatisch opslaan, vredige modus
  - _Beeld:_ kwaliteit (ook "Eigen": resolutie, schaduwen, gloed en omlijning los), bovenaanzicht,
    schermschudden, animaties, grootte van de interface (S–XL), teller met beeldjes per seconde
  - _Geluid:_ aan/uit, volume, meldingen, klikgeluiden, stil op de achtergrond
  - _Besturing:_ slepen = selecteren, randscrollen, camerasnelheid, zoomen omkeren
- **2D en 3D:** kies op de minikaart (of met V) tussen het bovenaanzicht (2D) en het 3D-aanzicht. In 3D kun je
  het beeld helemaal rond draaien: met de middelste muisknop, met `,` en `.`, met de draaiknoppen op de minikaart
  of met twee vingers. Het kompas op de minikaart wijst naar het noorden; klik erop om de draaiing terug te zetten.
- **Beeldkwaliteit:** Automatisch (standaard), Laag, Middel of Hoog. Automatisch verlaagt zelf de resolutie en
  zware effecten als het spel hapert, zodat het vloeiend blijft.
- **Grote schermen:** op ultrabrede schermen (21:9 en breder, ook 5K2K) blijft de HUD in een centraal gebied
  (instelbaar: volle breedte); op 1440p, 4K en 5K2K wordt hij groter. Elke kwaliteitsstand heeft een
  maximum aantal pixels voor de 3D-wereld, zodat ook 5120×2160 vloeiend blijft.

## Op telefoon en tablet

Het spel past zich aan elk scherm aan, staand en liggend. Tik om te selecteren of te bouwen, sleep om de kaart
te verschuiven, knijp om te zoomen en draai met twee vingers om het 3D-beeld te draaien. Onderin staan knoppen
voor **Dorp**, **Leger**, **Verbeteren**, **Doel** en **Kaart**. Tik op de "volgende stap" bovenin voor meer uitleg.

## Besturing

| Actie                                   | Muis / toets                                |
| --------------------------------------- | ------------------------------------------- |
| Selecteren                              | Klik · Shift + slepen voor een groep        |
| Opdracht (lopen, aanvallen, verzamelen) | Rechtsklik                                  |
| Kaart verschuiven                       | Slepen, WASD of pijltjes, muis naar de rand |
| Zoomen                                  | Scrollwiel                                  |
| Pauze / sneller / langzamer             | Spatie · `]` · `[`                          |
| Bouwcategorie                           | Z · X · C · B, daarna 1–9                   |
| Gebied uitbreiden                       | E                                           |
| Hele leger · dorpelingen zonder werk    | Q · I                                       |
| Bovenaanzicht (2D) of 3D                | V, of de knop op de minikaart               |
| 3D-beeld draaien                        | Middelste muisknop slepen · `,` en `.`      |

## Claude-artifact

`npm run build:artifact` bundelt het hele spel (inclusief three.js) in één bestand:
`dist-artifact/tijdperken.html`. Dat bestand wordt na elke mijlpaal gepubliceerd op de artifact-link.
