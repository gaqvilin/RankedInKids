# PadelAdmin (RankedInKids)

En enklare app för padelspelare, föräldrar och lagledare ovanpå Rankedins data. Först för barn och ungdom (Step In, Klubbligan), därefter vuxna (SPL).

## Designprinciper

PadelAdmin är en **enklare, nedskalad Rankedin**. Varje sida ska klara sig på det man behöver just nu:

- Visa nästa steg och det som kräver handling först. Allt annat ligger ett tryck bort (ihopfällt eller på nästa sida).
- En rad per sak. Samma sak visas på ett sätt och heter samma sak överallt (t.ex. *speldag*).
- Ingen dubblering mellan sektioner på samma sida.
- Hellre en kort text med en länk ("Lös det") än en förklaring.

## Vad den gör (v1)
- **Spelare:** sök barnet, spara som "min spelare", se kommande matcher (tid, bana, motståndare) och anmälda tävlingar.
- **Varningar:** "Partner saknas" med nedräkning till sista anmälningsdag.
- **Tävling:** klasser, anmälda par (vem söker partner), matcher med resultat, uträknad gruppspelstabell, auto-uppdatering på matchdagen.
- **Döm live:** poäng för poäng med matchens domarkod (Rankedins live-API, ingen inloggning). Fungerar i Premium-tävlingar (t.ex. Step In).
- **Laguppställning (lagkaptener):** välj par per match ur truppen, med rankingpoäng, licenskontroll och kontroll av dubbletter. Sparas med `TeamLeague/UpdateTeamLeagueLineupsAsync`.
- **Lagserier (SPL, Klubbligan):** serie → division (tabell, omgångar) → lag → lagmatch.
- **Rapportera slutresultat:** logga in med Rankedin-kontot och skicka set-resultat (samma flöde som "Enter result" på rankedin.com). Fungerar bara där Rankedin ger användaren den rätten.
- **Juniortävlingar:** kalender filtrerad på junior, nivå och "nära mig".

## Arkitektur
- Vite + React + TypeScript (SPA), hostas på Vercel.
- `api/` är Vercel Functions:
  - `rin.ts` – läsproxy mot `api.rankedin.com/v1` (vitlistade läs-endpoints, kort edge-cache).
  - `login.ts` / `session.ts` – loggar in mot Rankedin och sparar Rankedins session i en HttpOnly-cookie på vår domän. Lösenord sparas aldrig.
  - `submit-result.ts` – `Match/GetChallengeResultAsync` + `Match/SubmitResultAsync`.
  - `lineup.ts` – sparar laguppställning; hämtar först aktuell uppställning med kaptenens session och behåller motståndarens spelare.
- Live-domare anropar `live.rankedin.com/api/v1/Referee` direkt från webbläsaren (öppen CORS).
- Research: [Rankedin API](docs/research/rankedin-api.md), [Juniorpadel i Sverige](docs/research/juniorpadel-sverige.md), [SPL](docs/research/spl.md).

## Utveckling
```bash
npm install
npm run dev     # kör även api/-funktionerna lokalt
npm test
npm run build
```
I en miljö med HTTP-proxy behöver Node `NODE_USE_ENV_PROXY=1` för att `fetch` ska gå via proxyn.

## Release notes
Användarnas "Nyheter" finns i `src/lib/releases.ts`. Lägg till en ny post överst vid varje release (kort, på svenska, för användare). Ny version visar en röd punkt vid länken tills användaren har öppnat sidan.

## Data utöver Rankedin
Sådant Rankedin inte har (t.ex. tillgänglighet per speldag) lagras via `api/_lib/store.ts`:
- **Neon Postgres** (projekt `padel-admin`, tabell `docs(key, value jsonb, updated_at)`) när `DATABASE_URL` finns. Appen ansluter med rollen `padeladmin_app` (read_write, ingen admin).
- Annars Vercel Blob (`BLOB_READ_WRITE_TOKEN`), annars minne (lokalt/tester).
- `GET /api/health` visar vilken lagring som används och om den svarar.

Behörighet: varje skrivning verifierar inloggningen mot Rankedin (`api/_lib/identity.ts`). Spelare svarar för sig själva, lagledare (Rankedins "initiator") för hela laget.
