# Padelkids (RankedInKids)

En enklare mobilapp för barn som spelar padel och deras föräldrar, ovanpå Rankedin.

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
- Research: [Rankedin API](docs/research/rankedin-api.md), [Juniorpadel i Sverige](docs/research/juniorpadel-sverige.md).

## Utveckling
```bash
npm install
npm run dev     # kör även api/-funktionerna lokalt
npm test
npm run build
```
I en miljö med HTTP-proxy behöver Node `NODE_USE_ENV_PROXY=1` för att `fetch` ska gå via proxyn.
