# Vervolgstappen

Wat het spel nog groter kan maken, op volgorde van wat het meest oplevert per uur werk. Elke stap staat los van
de andere.

## Nu (meeste winst, weinig risico)

1. **Lokalisatie-laag.** Alle UI-teksten en speldata via één `t('sleutel')` met Nederlands en Engels als
   bestanden (`src/i18n/nl.ts`, `en.ts`). Aanpak: eerst de UI-strings (menu's, knoppen, coach, ±400), dan de
   speldata (gebouwen, eenheden, gebeurtenissen, ±1.400 regels) per bestand. Engels als basis opent de markt;
   Poki en CrazyGames vragen erom. Geschat: 2–3 dagen.
2. **Lettertypen zelf hosten** (nu Google Fonts): nodig voor offline, voor portals zonder externe verzoeken en
   voor een snellere eerste tekening. Een uur.
3. **Progressief laden voor portals** (Poki/CrazyGames): een kleine eerste bundel met titelscherm en steentijd,
   de modellen en data van latere tijdperken per tijdperk nalaten. Plus het portal-SDK (laad-/speelsignalen,
   advertentiepauzes op natuurlijke momenten: nieuw tijdperk, eindscherm). Een dag.
4. **Echte speeldata verzamelen**: anonieme tellers (hoe ver komt een eerste spel, waar stopt het, welk tijdperk
   na 25 minuten) om de groei en het voedseltempo te balanceren. Het vermoeden uit de code-analyse: groei loopt
   hard op, voedsel remt te weinig. Voorstel om te testen: dorpeling eet 4 i.p.v. 3 per minuut vanaf de Bronstijd.

## Daarna (meer spel)

5. **Dagelijkse wereld als hoofdingang** op het titelscherm, met het resultaat van vandaag en de beste score,
   zonder streak-straf (uit de marktanalyse). Halve dag.
6. **Kroniek van je beschaving**: een deelbare samenvatting (tijdlijn, hoogte- en dieptepunten, kaartje) aan het
   eind van een spel. Goed voor terugkomen én delen. Een dag.
7. **Schaarste laat in het spel**: meteorieten vullen nu alles aan en fabrieken pauzeren vanzelf, waardoor
   grondstoffen beheren in de laatste tijdperken automatisch gaat. Eén schaarse grondstof per tijdperk (bv.
   lithium alleen uit handel of één ader) geeft keuzes terug. Halve dag, plus balanceren.
8. **Rivalen met een economie**: hun inkomen hangt nu alleen af van tijdperk en gebieden; hun gebouwen slopen
   schaadt ze niet. Een eenvoudige economie (gebouwen produceren echt) maakt plunderen en diplomatie zinvoller.
   Twee dagen.
9. **Geleidelijk onthullen van menu's**: Leger, Diplomatie en Verbeteren pas tonen als ze ertoe doen (eerste
   kazerne, eerste rivaalcontact, eerste onderzoek). Minder overweldigend in de eerste 10 minuten. Een dag.

## Later (groter)

10. **Figuren delen hun vormen** (dezelfde samengevoegde geometrie per soort, met teller) en **gras/regen in een
    shader**: minder geheugen en CPU op telefoons met honderden figuren. Twee dagen.
11. **Replays/kijken**: de spelstand is al deterministisch per zaadcode; met een invoerlog is een replay haalbaar.
    Goed voor delen en voor het vinden van bugs. Drie dagen.
12. **Cloud-opslag en profiel over apparaten** (bijv. via een portal-account): nu alleen localStorage.
13. **Meer volken en wonderen** per tijdperk; de data-structuur is er al, het is vooral ontwerp en modellen.
