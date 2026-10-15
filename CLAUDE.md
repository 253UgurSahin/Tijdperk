# Tijdperken — werkafspraken

## Leesbaarheid (vaste regel)
- Code moet leesbaar zijn voor een gewoon persoon, niet alleen voor programmeurs.
- Schrijf geen samengeperste one-liners: houd de opmaak van Prettier aan (`npm run format`).
- Zet hier en daar een **korte, simpele uitleg** in het Nederlands: bovenaan elk bestand één regel
  over wat het doet, en bij lastige stukken één zin over het *waarom*. Niet bij elke regel.
- Kies duidelijke namen voor nieuwe functies en variabelen.
- Ook uitleg in commits, README en berichten aan de gebruiker: kort en in gewone taal.

## Project
- `npm run dev` · `npm test` · `npm run lint` · `npm run format` · `npm run typecheck` · `npm run build`
- De code is TypeScript (`strict`). `npm run build` controleert eerst de types (`tsc`) en bouwt dan.
- Gedeelde types (gebouwen, dorpelingen, soldaten, de spelstand) staan in `src/types.ts`.
  Geen `any` en geen `@ts-ignore`; liever een duidelijk type of een korte uitleg waarom iets zeker bestaat (`!`).
- Speldata in `src/data/` is puur (geen spelstand of DOM), zodat het te testen is. Het type van elke lijst
  (zegeningen, gebeurtenissen, volken, ...) staat bij die lijst in hetzelfde bestand.
- Gedeelde toestand die meerdere modules aanpassen staat in `src/core/store.ts` (met het type `Store`).
- Controleer wijzigingen in de browser; in dev-modus staan hulpjes op `window.__tp`.
- GitHub Actions draait bij elke push lint, tests, typecheck en build; `main` gaat daarna naar GitHub Pages.

## Artifact bijhouden (vaste regel)
- Na elke afgeronde wijziging: `npm run build:artifact` en `dist-artifact/tijdperken.html` publiceren op
  https://claude.ai/artifact/FKtjpDYdSNZfo86mL9hgeT (dezelfde link blijven gebruiken).
