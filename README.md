# PadelAdmin (RankedInKids)

En enklare app för padelspelare, föräldrar och lagledare ovanpå Rankedins data. Först för barn och ungdom (Step In, Klubbligan), därefter vuxna (SPL).

## Designprinciper

PadelAdmin är en **enklare, nedskalad Rankedin**. Varje sida ska klara sig på det man behöver just nu:

- Visa nästa steg och det som kräver handling först. Allt annat ligger ett tryck bort (ihopfällt eller på nästa sida).
- En rad per sak. Samma sak visas på ett sätt och heter samma sak överallt (t.ex. *speldag*).
- Ingen dubblering mellan sektioner på samma sida.
- Hellre en kort text med en länk ("Lös det") än en förklaring.

## Vad den gör
- **Översikt:** det som är på gång för dina spelare (tävlingar och speldagar), varningar som "partner saknas".
- **Spelare och sök:** sök vilken spelare som helst, spara "mina spelare", schema, lag, tidigare tävlingar.
- **Tävlingar:** juniorkalender (nivå, ort/närhet), klasser, anmälda par, matcher, resultat, uträknad tabell, lägg till partner.
- **Serier (Klubbligan, SPL):** mina lag, speldagar med resultat, lagmatcher, tabell, uppställning för lagledare med seriens regler,
  tillgänglighet ("Vilka kan spela?"), kallelse och spelschema för arrangerande klubb.
- **Rapportera resultat och döm live** där Rankedin ger kontot rätt.
- **Tävlingsledning (arrangör):** para ihop spelare, banor och tider, stäng anmälan, lotta, schemalägg, publicera, banöversikt
  under dagen, saknade resultat, QR-lappar.
- **Flera konton** (förälder + barn), feedback, hjälp, nyheter, installera som app (PWA).

## Arkitektur
- Vite + React + TypeScript (SPA), hostas på Vercel (projekt `padeladmin`, region `arn1`, https://padeladmin-app.vercel.app).
- `api/` är Vercel Functions:
  - `rin.ts` – läsproxy mot `api.rankedin.com/v1` (vitlistade sökvägar, edge-cache för anonyma läsningar).
  - `login.ts`, `session.ts` – inloggning mot Rankedin, flera konton per enhet (HttpOnly-cookies). Lösenord sparas aldrig.
  - `submit-result.ts`, `lineup.ts` – resultat och laguppställning.
  - `join-partner.ts` – spelaren lägger till partner själv (Rankedins "Lägg till partner").
  - `pairing.ts`, `draws.ts` – arrangörens ihopparning och lottning/schema/publicering (se `docs/research/rankedin-draw-flow.md`).
  - `availability.ts`, `feedback.ts` – egen data i Neon. `health.ts` – status.
  - `_lib/` – Rankedin-hjälpare, identitet, lagring (`store.ts`), rate limits, ren logik som testas.
- Live-domare anropar `live.rankedin.com/api/v1/Referee` direkt från webbläsaren.
- Säkerhet: same-origin-krav och rate limits på alla skrivningar, CSP och övriga säkerhetshuvuden i `vercel.json`.
- Research: [Rankedin API](docs/research/rankedin-api.md), [lottningsflödet](docs/research/rankedin-draw-flow.md),
  [Juniorpadel i Sverige](docs/research/juniorpadel-sverige.md), [SPL](docs/research/spl.md).

Se också [CLAUDE.md](CLAUDE.md) för principer och regler när man ändrar koden.

## Utveckling
```bash
npm install
npm run dev     # kör även api/-funktionerna lokalt
npm test
npm run build
```
Inga miljövariabler behövs lokalt (minneslagring). Se `.env.example` för det som finns.
I en miljö med HTTP-proxy behöver Node `NODE_USE_ENV_PROXY=1` för att `fetch` ska gå via proxyn.

## Release notes
Användarnas "Nyheter" finns i `src/lib/releases.ts`. Lägg till en ny post överst vid varje release (kort, på svenska, för användare). Ny version visar en röd punkt vid länken tills användaren har öppnat sidan.

## Data utöver Rankedin
Sådant Rankedin inte har (t.ex. tillgänglighet per speldag) lagras via `api/_lib/store.ts`:
- **Neon Postgres** (projekt `padel-admin`, tabell `docs(key, value jsonb, updated_at)`) när `DATABASE_URL` finns. Appen ansluter med rollen `padeladmin_app` (read_write, ingen admin).
- Annars Vercel Blob (`BLOB_READ_WRITE_TOKEN`), annars minne (lokalt/tester).
- `GET /api/health` visar vilken lagring som används och om den svarar.

Behörighet: varje skrivning verifierar inloggningen mot Rankedin (`api/_lib/identity.ts`). Spelare svarar för sig själva, lagledare (Rankedins "initiator") för hela laget.
