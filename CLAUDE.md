# CLAUDE.md – PadelAdmin

Instruktioner för Claude Code (och människor) som arbetar i det här repot. Läs README.md för vad appen gör.

## Produkten
PadelAdmin är en **enklare, nedskalad Rankedin** för juniorpadel (Step In, Klubbligan) och lagserier (SPL), för föräldrar,
spelare, lagledare och arrangörer. All tävlingsdata ligger i Rankedin; vi läser och skriver via Rankedins interna API.

**Designprinciper (viktigast av allt):**
- Visa bara det man behöver just nu. Nästa steg och det som kräver handling först; allt annat ett tryck bort (ihopfällt eller nästa sida).
- En rad per sak. Inga dubbletter mellan sektioner. Upprepa inte det namnet redan säger (ort, nivå).
- Samma sak heter samma sak överallt: *speldag* (inte sammandrag/omgång), *lagmatch*, *tävling*, *klass*.
- Korta texter med en länk ("Lös det") hellre än förklaringar. Datum utan "om N dagar" (bara idag/imorgon/igår).
- Lugnt och ljust utseende: mjuka kort (radie och skugga från tokens), en accentfärg (`--accent`: primära knappar, aktivt val, "Pågår"), annars färg bara där den betyder något (vinst, varning, fel). Inga färger utöver tokens i `src/styles.css`.
- Rörelse är diskret och kort (sidor tonar in, nya resultat tonar in, skelett vid laddning) och stängs av med `prefers-reduced-motion`.

## Språk
- All text i appen är på **svenska**. Kod, kommentarer och commit-meddelanden på engelska.
- Användarnyheter: lägg en kort punkt i `src/lib/releases.ts` (översta posten) för varje ändring användare märker.

## Kommandon
```bash
npm install
npm run dev        # Vite + api/-funktionerna lokalt (vite.config.ts serverar api/)
npm test           # vitest
npm run typecheck  # tsc -b
npm run build
```
Bakom en HTTP-proxy: kör med `NODE_USE_ENV_PROXY=1`. Utan `DATABASE_URL` används en minneslagring lokalt – inget behöver sättas upp för att köra appen.

Innan push: `npm run typecheck && npm test` ska vara gröna. Kontrollera gärna oanvänd kod med `npx tsc --noEmit --noUnusedLocals`.

## Arkitektur i korthet
- `src/` – React-SPA (Vite, React 19, react-router 7). Sidor i `src/pages`, delade komponenter i `src/components`, logik i `src/lib`.
- `api/` – Vercel Functions (Web `Request`/`Response`, `export async function GET/POST`). Hjälpkod i `api/_lib`.
- Rankedin-läsningar går via `api/rin.ts` (vitlistade sökvägar i `READ_PREFIXES`, `api/_lib/rankedin.ts`).
  På klienten: `rin()` i `src/lib/api.ts` – anonymt och edge-cachat som standard, `{ auth: true }` bara när svaret beror på vem som är inloggad.
- Rankedins svar är PascalCase och inkonsekventa – mappa till egna små typer i `src/lib/*.ts`, läs fält skiftlägesokänsligt (`prop()` i `api/_lib/pairing.ts`).
- Data vi själva sparar (tillgänglighet, feedback, rate limits) ligger i Neon Postgres via `api/_lib/store.ts` (tabell `docs`).

## Säkerhet – regler som inte får brytas
- Lösenord sparas aldrig. Rankedins session ligger bara i HttpOnly-cookies (`rk_rin_<playerId>`).
- Varje skrivande endpoint börjar med `isSameOriginJson(request)` och en rate limit (`api/_lib/ratelimit.ts`).
- Klienten skickar `x-rk-account` (`accountHeaders()`), så servern agerar som kontot sidan visar – aldrig ett annat.
- Lägg bara till Rankedin-läsvägar i `READ_PREFIXES` när de behövs; sökvägen valideras efter URL-normalisering (`readUrl`).
- Behörighet avgörs av Rankedin. Bygg aldrig egna "är admin"-genvägar som ger mer än Rankedin ger.
- Inga hemligheter i koden. Miljövariabler: se `.env.example`.

## Skriva mot Rankedin (resultat, uppställning, ihopparning, lottning)
- Härma exakt vad Rankedins egen webb gör. Kartläggningar finns i `docs/research/` (t.ex. `rankedin-draw-flow.md`).
- Ett steg i taget, bekräftat av användaren, och läs tillbaka från Rankedin efter varje steg.
- Skriv tester mot en fejkad Rankedin (se `test/pairing.test.ts`, `test/draws.test.ts`) innan något körs skarpt.
- Gör aldrig något som inte kan ångras utan tydlig bekräftelse (t.ex. publicering, omlottning).

## Arbetsflöde (grenar och releaser)
- `main` är produktion: allt som hamnar där byggs och läggs ut på https://padeladmin-app.vercel.app av Vercel automatiskt.
- Jobba aldrig direkt på `main`. Skapa en gren per ändring, t.ex. `feature/kort-namn` eller `fix/kort-namn`, och öppna en pull request mot `main`.
- Varje PR får en egen förhandsversion av Vercel (länk i PR:en) och kontrolleras av GitHub Actions (`.github/workflows/ci.yml`:
  typkontroll, oanvänd kod, tester, bygge). Slå ihop när kontrollen är grön och förhandsversionen ser rätt ut.
- Håll PR:er små och slå ihop ofta, så krockar ni inte med varandra. Hämta senaste `main` (`git pull`) innan ni börjar något nytt.
- Förhandsversioner använder samma Rankedin som produktion. Skrivningar (resultat, lottning) i en förhandsversion är alltså skarpa.

## Konventioner
- Formattering: enkla citattecken, ~150 tecken per rad (som befintlig kod). Kör inte prettier med standardinställningar på hela filer.
- `useAsync(fn, deps, storeKey?)` för datahämtning; `storeKey` cachar på enheten (stale-while-revalidate).
- Navigering: använd `<Go to=… from="Etikett">` så att tillbaka-knappen visar var man kom ifrån.
- Nya sidor: lägg route i `src/App.tsx`, och länka dit från ett ställe där användaren naturligt behöver den.
