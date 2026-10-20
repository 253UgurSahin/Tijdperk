# Veranderingen

Alle wijzigingen uit de "wereldwijde hit"-ronde (analyse → bugfixes → techniek → gameplay → polish), in gewone
taal. Per bug: wat er misging, hoe het is opgelost en hoe dat is gecontroleerd. Nieuwste bovenaan.

## Daarna

- **Opgeraakte delfstoffen:** nieuwe gebouwen Steengroeve (steen, steentijd) en Mijnschacht (koper, tin en
  ijzer, IJzertijd) maken langzaam grondstoffen uit het niets; de markt verhandelt nu ook tin, zand en lithium;
  de coach wijst deze uitwegen aan als een grondstof op is en er geen land meer te koop is.
- **Beter ontwerp van figuren en akkers:** rondere hoofden, schouders, hals, kraag en neus; dorpelingen met een
  tasje, geharnaste soldaten met schouderstukken; paarden met hoeven, oren, ogen en zadel; akkers met voren,
  losse planten met aar, een hek rondom, waterbak en vogelverschrikker (van ver nog steeds simpele rijen).
- **Verbeteren:** knop Alles verbeteren altijd zichtbaar, met de totale kosten en het tekort.

## Ronde "Hit-niveau" (oktober 2026)

### Kritiek

- **Laden kon het lopende spel vernielen.** Een kapotte of nieuwere opslag werd pas halverwege het laden
  afgekeurd; het spel, de kaart en de gebouwenlijst waren dan al vervangen, en een minuut later schreef het
  automatisch opslaan die halve stand weg. _Fix:_ `deserialize` controleert nu eerst alles (versie, kaartgrootte,
  lijsten, base64, sleutels van gebouwen, eenheden en onderzoek) en raakt het spel pas daarna aan; gaat het toch
  mis, dan zet `loadSlot` het spel van daarvoor terug. Een opslag die niet te laden is, krijgt een eigen sleutel
  (`…-kapot`) en de volgende plek wordt geprobeerd. _Controle:_ browsertest met afgekapte JSON, kapotte base64 en
  onbekende sleutels (`save_test.py`): het lopende spel blijft staan, onbekende dingen worden overgeslagen.
- **"Snel spel" overschreef zonder waarschuwing je enige bewaarde spel.** _Fix:_ Snel spel, Nog een keer en
  Opnieuw zetten het spel van nu eerst op een vrije eigen plek (`parkLiveGame`); zijn alle plekken vol, dan
  vraagt Snel spel om een tweede klik. _Controle:_ handmatig in de browser; melding "staat bewaard op Plek N".

### Hoog

- **Eén fout bevroor het spel voorgoed.** `requestAnimationFrame` stond aan het eind van de lus zonder
  try/catch. _Fix:_ het volgende beeldje wordt eerst aangevraagd, de rest staat in try/catch; fouten gaan naar de
  console met één melding aan de speler, bij 30 fouten in 5 s gaat het spel op pauze (`core/errors.ts`). Ook
  `error`- en `unhandledrejection`-gebeurtenissen worden gevangen. _Controle:_ test gooit een fout; beeldjes en
  speltijd lopen door, `store.errors` telt.
- **Twee tabbladen overschreven elkaars opslag.** _Fix:_ elk tabblad heeft een nummer; wie het laatst opslaat is de
  baas, het andere tabblad stopt met automatisch opslaan en zegt dat (`storage`-event).
- **Tikken om te bouwen gebruikte een oude vingerpositie** (telefoon) en na schuiven met WASD stond de spookafbeelding
  niet onder de muis. _Fix:_ `trackPointer` bij indrukken, bewegen én loslaten; `refreshMouseTile` elk beeldje als
  de camera beweegt.
- **"Zeker? Klik nogmaals" was met een dubbelklik te omzeilen** (profiel wissen, oorlog verklaren, afbreken, nieuw
  spel). _Fix:_ één gedeelde beveiliging (`ui/confirm.ts`): de tweede klik telt pas na 0,4 s en hooguit 5 s.
- **Geluid startte mogelijk nooit op iOS.** Eén `pointerdown`-luisteraar met `once`; op iOS telt pas het loslaten.
  _Fix:_ blijvende luisteraars op pointerdown/pointerup/touchend/keydown tot de context echt loopt; ook de
  iOS-stand `interrupted` wordt hervat.
- **Centrales gingen om de beurt samen aan en uit.** Alle centrales beslisten met dezelfde oude voorraad stroom.
  _Fix:_ `adjustPowerSup` werkt de voorraad meteen bij; na het laden begint elke centrale op een ander punt van zijn
  stooktijd.
- **Gekapte bomen groeiden na laden nooit terug; een aanval verdween bij opslaan/laden en telde dan als
  "doorstaan"; meteoriet en training gingen verloren.** _Fix:_ `regrow`, `spawnQ`, `meteor`, `starMeteor`,
  `training`, `trainT` en lopende aanvallers (`raiders`) worden opgeslagen en gecontroleerd geladen.
- **Kampbewakers zonder doel zochten elke tik** (`isDead(null)` is waar). _Fix:_ alleen opnieuw zoeken als er een doel
  was dat wegviel of na de wachttijd.
- **Elke gekapte boom bouwde alle bomen en al het gras in beeld opnieuw** (hapering om de paar seconden). _Fix:_
  `hideNode` verbergt alleen die ene instantie; alleen de minikaart en schaduwkaart daar worden bijgewerkt.
- **'s Ochtends werden alle dorpelingen in één beeldje opnieuw gebouwd.** _Fix:_ een dorpeling die binnen is blijft
  bestaan en wordt alleen onzichtbaar.
- **Omlijning viel weg bij de wissel tussen bewegend figuur en vast beeldje.** _Fix:_ schillen hangen aan alle
  onderdelen (ook onzichtbare); het grove gebouwmodel wordt overgeslagen en is ook niet aanwijsbaar.
- **Lampen in/uit de scène dwongen nieuwe shaders af bij de eerste schemering.** _Fix:_ de nachtshaders worden bij
  het eerste beeldje vooraf gecompileerd; marge rond de "ver"-grens zodat de lampen niet heen en weer gaan.
- **Automatische kwaliteit sprong heen en weer** (hoog → middel → hoog om de 10 s). _Fix:_ de stand die te zwaar
  was wordt 90 s gemeden; één traag beeldje na een tabwissel telt niet mee.

### Laag

- Weggestuurde dorpelingen en soldaten bleven "spook"-doelwit (dubbel geteld bij verlies) → `dead = true`.
- Spatschade van aanvallers raakte helpers van een bondgenoot nooit → het doel wordt altijd geraakt.
- Het treffer-effect op gebouwen en dorpelingen werkte maar één keer (`flash` liep niet af) → loopt nu af.
- "Aanval over X uur" rekende fout tussen 0 en 6 uur → opnieuw geschreven vanaf het begin van de dag (6 uur).
- Handelaar liet je betalen zonder te controleren of je genoeg had; een eis die je niet kon betalen sloot stil af →
  `has()`-controle, een onbetaalbare eis telt als weigering.
- `destroyBuilding` haalde het gebouw uit `bById` vóór `unhide`, dus wie erin schuilde bleef op de tegel staan →
  volgorde omgedraaid.
- Snelle dagen (spelregel) werkten niet door in rivaalaanvallen, geschenken en meteorieten → `dayLength()`.
- Zonder dorpelingen en zonder eten zat het spel vast → na 30 s sluit een zwerver zich aan.
- Aanvallers in de wachtrij verschenen ook na het aanzetten van de vredige modus → wachtrij leeg.
- UI-toestand (plaatsmodus, bevelen, pings, tempo's, grote kaart) bleef staan bij een nieuw spel → `resetUiState`.
- Het eindscherm van een vorig spel kon in een nieuw spel verschijnen → timer controleert of het nog hetzelfde spel is.
- Het tempo (2×, 4×) ging verloren na het menu → `lastSpeed`.
- Instellingen/uitleg gingen na een verloren spel niet dicht met Esc → alleen het eindscherm zelf is vergrendeld.
- Opslagkaartjes zetten tekst uit localStorage onge-escaped in HTML → alleen gewone tekst, hooguit 60 tekens.
- Als de lijst met kaartjes niet paste, bleef de opslag wel staan met een oud kaartje → beide of geen van beide.
- Na verlies bleef de automatische opslag staan (verder spelen van vlak vóór de nederlaag) → meteen gewist.
- Slepen bleef hangen na alt-tab; een vergeten vinger maakte van elke tik een knijpgebaar; Shift liet een toets
  "ingedrukt" achter; sneltoetsen gingen af in textarea/select → allemaal opgelost in `input/input.ts`.
- Geluid hervatte op een verborgen tabblad met "stil op de achtergrond" aan → niet meer.
- Kanonskogels stootten per beeldje rook uit (144 Hz = 2,4× zoveel, ook tijdens pauze) → op tijd gebaseerd.
- Tempo- en draaiberekening van figuren gingen uit van 60 Hz → op de echte beeldtijd gebaseerd.
- Instance-buffers van bomen werden niet vrijgegeven; elk figuur had een eigen cirkelmateriaal → `dispose()` en
  één gedeeld materiaal.
- `resize` + ResizeObserver gaven twee keer nieuwe render targets; een andere pixeldichtheid werd niet opgemerkt →
  één resize per verandering, `matchMedia` voor de pixeldichtheid.
- Opslaan ook bij `pagehide` (iOS sluit soms zonder `visibilitychange`).

### Techniek

- Dode code weg (`pulseRes`, `store.lastGroup`, ongebruikte parameter); `weightedPick` één keer in `util/random`.
- De weergave schrijft niets meer in de spelstand (treffer-flits van rivaalgebouwen loopt af in de logica).
- Geen `querySelector` of nieuwe `Set` per beeldje in de spellus.

### Gameplay en gevoel

- Hit-stop en een schok bij een verslagen kampioen en een veroverd kamp.
- Balans: torens tellen met hun echte (verbeterde) sterkte mee voor de grootte van aanvallen; het stamhuis wordt
  per tijdperk minder hard sterker (schade ×0,5 i.p.v. ×0,8 per tijdperk); de buit van het eerste kamp is lager
  (160/130/100) en groeit per kamp-niveau harder (×0,8 i.p.v. ×0,6).

### Polish

- Achtergrondmuziek, ter plekke gemaakt (geen bestanden): overdag licht, 's nachts rustig, donkerder bij een
  aanval. Eigen schakelaar en volume.
- Instellingen **Lichtflitsen** en **Kleurenblindvriendelijk** (vijanden oranje).
- **Deel je score** op het eindscherm (deelmenu of klembord, met zaadcode); omschrijving en sociale voorvertoning
  in de pagina.
- Gevonden onderweg: de knop "Nieuwe wereld" op het eindscherm werkte niet meer sinds de dubbelklik-beveiliging.

## Eerder in deze reeks

- Schuine paden sluiten op elkaar aan (één doorlopende strook in plaats van een dambord).
- Veel meer detail op gebouwen (metselwerk en korrel in de shader, plinten, luiken, kozijnen, nokbalken,
  stoepstenen, spullen op het erf), figuren (ogen, laarzen, riem, handen) en bomen (wortels, takken, bessen), met
  een grove versie van elk gebouw voor ver uitgezoomd.
- Lichtere renderer: omlijning zonder extra beeldpassen, gloed op een kwart van de pixels, niets tekenen achter de
  mist, lampen alleen 's nachts, schaduwkaart zonder flikkeren.
- Snel spel (±25 minuten), oefennacht, "Nog een keer", opslaan bij elke ochtend.
- Torens met geschut draaien mee naar de vijand.
- Rustige, icoon-gebaseerde telefoon-interface.
