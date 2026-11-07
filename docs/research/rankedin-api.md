# Rankedin – plattform och API

*Research 2026-11-07. Endpoints markerade ✅ är testade live från den här miljön.*

## Vad Rankedin är

Rankedin (Rankedin AS, Lysaker, Norge) är tävlingssystemet som Svenska Padelförbundet (SPF) använder.
Där finns spelarprofiler, tävlingslicenser, turneringar, lottning, resultat, ranking, klubbligor (Club League),
lagligor (Team League), Americano m.m. Allt som är sanktionerat i Sverige ligger där.

## Det finns två API:er

### 1. Officiellt "Public API" (smalt, kräver nyckel)

Dokumenterat på [rankedin.ladesk.com – 15. API](https://rankedin.ladesk.com/635787-Getting-started).

- Nyckel per **organisation** (klubb/förbund), genereras av org-admin under *Organization Manager → Settings → Public API*.
- Header `X-API-Key`. Får **inte** anropas från webbläsaren (CORS blockerat) – bara från egen backend.
- Innehåll: licenskontroll för egna medlemmar, namnuppslag (org/spelare/lag), Team League-data för egen org.
- Felformat: RFC 7807-liknande JSON med stabil `code` + `traceId`. 429 vid rate limit.

**Slutsats:** för smalt för vår app. Användbart bara om en klubb vill integrera licens-/avgiftskontroll.

### 2. Webbens eget API – `https://api.rankedin.com/v1` (brett, inofficiellt men publikt)

Det är detta rankedin.com själv använder. Swagger: <https://api.rankedin.com/swagger/v1/swagger.json>
(685 paths, OpenAPI 3). En lokal endpoint-lista finns i [`rankedin-endpoints.txt`](./rankedin-endpoints.txt).

- **Läsning kräver ingen inloggning** och CORS är öppet (andra open source-projekt anropar det direkt från webbläsaren).
- Skrivning (anmälan, resultat m.m.) kräver inloggad session: `POST /v1/Account/LogInAsync` → cookie `rin-auth`.
- PascalCase-JSON, ofta `language`-parameter (`sv`/`en`).
- Ingen dokumenterad rate limit. Observerat av annat projekt: ~25 samtidiga anrop OK, 30 → 429 med `Retry-After: 1`.
- **Risk:** inofficiellt kontrakt – kan ändras utan förvarning. Vi bör kapsla in det i ett eget klientlager med cache,
  och helst prata med Rankedin (support@rankedin.com) innan publik lansering.

Fördelning av endpoints per controller: Tournament 155, TeamLeague 92, ClubLeague 67, Admin 56, Organization 50,
Ranking 35, Player 23, Search 17, Rating 14, Match 10, Americano 7, Calendar 1 …

## Viktiga ID-begrepp

| Begrepp | Exempel | Kommentar |
|---|---|---|
| RankedinId (publikt spelar-ID) | `R000006081` | Syns i profil-URL. Behandla som text. |
| PlayerId (numeriskt) | `123456` | Krävs av event-/match-endpoints. Hämtas via `PlayerProfileInfoAsync`. |
| TournamentId | `75317` | Från URL `/tournament/75317/...` |
| TournamentClassId | `178304` | En klass, t.ex. "Pojkar 12" |
| RankingId | `1917` | **SPF Padel Ranking** (den officiella svenska) |
| CountryId Sverige | `152` | |
| Sport padel | `5` | |
| EventType | `4` = turnering, `3` = Team League | |

## Endpoints som är relevanta för en barn-/föräldraapp

### Hitta spelare
- ✅ `GET /Search/GetPlayersByNameSimpleAsync?name=&take=&skip=` – namnsök → numeriskt Id + RankedinId
- `GET /Player/PlayerProfileInfoAsync?rankedinId=R...&language=sv` – profil, hemmaklubb, vinst/förlust-statistik
- `GET /Player/GetPlayerMatchesAsync?playerId=&takeHistory=&skip=&take=&language=` – matcher (kommande + historik)
- `GET /Player/ParticipatedEventsAsync?PlayerId=&Language=&Skip=&Take=` – alla event spelaren deltagit i
- `GET /Player/GetLastEventsPlayedAsync?PlayerId=&Take=&Language=`
- `GET /Player/PlayerRankingsAsync?Id=&Language=&Skip=&Take=` – spelarens rankingplaceringar
- `GET /Rating/GetPlayerRatingAsync?id=`, `GET /Rating/GetPlayerRatingHistoryForChartAsync?RatingId=&PlayerId=` – skill-rating & historik
- `GET /Match/GetHeadToHeadAsync?Id=`

### Hitta tävlingar
- ✅ `GET /Calendar/GetEventsAsync?Country=152&Sport=5&CalendarAgeGroups=1&From=0&Take=20`
  – **`CalendarAgeGroups=1` = juniortävlingar.** Stöder även `Lat`, `Lng`, `RadiusKm` (≤500), `StartDate`, `EndDate`.
- ✅ `GET /Search/GetTournamentsAsync?term=Step%20In&language=sv&take=&skip=`

### En tävling
- ✅ `GET /Tournament/GetHeaderAsync?id=&language=sv` – namn, datum, stad, status, **sista anmälningsdag** (`CloseSignInDate`), antal spelare
- `GET /Tournament/GetInfoAsync`, `GET /Tournament/GetRegulationsAsync` – info och "Regler/Regulations"-texten (spelform, avgift, klasstorlek)
- ✅ `GET /Tournament/GetClassesAndDrawNamesAsync?tournamentId=` – klasser (P12, F12, P14 …) + lottningar
- `GET /Tournament/GetPlayersForClassAsync?tournamentId=&tournamentClassId=&language=` – anmälda par
- `GET /Tournament/GetMatchesSectionAsync?...` – matcher/schema/resultat
- `GET /Tournament/GetTimetableDatesAsync`, `GET /Tournament/GetTournamentTimetableInfoAsync`, `GET /Tournament/GetCourtsAsync` – tidsschema och banor
- `GET /Tournament/GetResultsAsync?tournamentId=&classId=&rankingId=&language=` – slutplaceringar och rankingpoäng
- `GET /Tournament/GetJoinButtonModelAsync`, `POST /Tournament/JoinDoubleAsync` … – anmälan (kräver inloggning)

### Ranking
- ✅ `GET /Ranking/LoadRankingInfoAsync?id=1917&language=sv` – SPF-rankingens kategorier. Junior-åldersgrupper:
  - Pojkar: `BU12`=65, `BU14`=66, `BU16`=67, `BU18`=68 (RankingType 3)
  - Flickor: `GU12`=71, `GU14`=72, `GU16`=73, `GU18`=74 (RankingType 4)
- `GET /Ranking/GetRankingsAsync?...` – rankinglista för vald kategori/vecka
- `GET /Search/SearchRankingPlayersAsync?SearchTerm=&RankingId=1917&...` – en spelares poäng/placering
- `GET /Ranking/GetParticipantPointsDetailsAsync` – vilka tävlingar poängen kommer från

### Live
- `https://live.rankedin.com/api/v1/court/{courtId}/scoreboard` – live-score per bana (används av streaming-overlays)

## Exempel på verkligt svar

```json
// GET /Tournament/GetHeaderAsync?id=75317&language=sv
{ "Id": 75317, "EventType": 4,
  "Name": "Step In Linköping PF 14 November - Pojkar & Flickor 12/14/16/18",
  "EventState": 1, "EventStatusText": "Shared_Events_SignInOpen",
  "StartDate": "2026-11-14T09:00:00", "CloseSignInDate": "2026-11-09T23:55:00",
  "UniquePlayersCount": 12, "City": "Linköping", "Sport": 5 }
```

## Referensprojekt (open source) som använder samma API
- [winrarr/rankedin-explorer](https://github.com/winrarr/rankedin-explorer) – React/Vite, ren read-only klient med cache, retry och 429-hantering. Bra förebild för klientlagret.
- [6564200/MixRanker](https://github.com/6564200/MixRanker) – Python, live-scoreboards.
- [dotsandcoms/4mpadel](https://github.com/dotsandcoms/4mpadel) – Sydafrikanskt förbund; synkar även *till* Rankedin via inloggad session.

## Skriva data (resultat, anmälan)

Tekniskt finns allt i API:t, men det kräver inloggad användare (`POST /Account/LogInAsync` med
`userName`/`password` → cookie `rin-auth`). Det finns ingen OAuth eller "logga in med Rankedin".

| Vad | Endpoint | Vem får (styrs av Rankedin) |
|---|---|---|
| Rapportera matchresultat | `POST /Match/SubmitResultAsync` (`participant1Games`, `participant2Games` …) | Spelare om arrangören tillåter det, annars admin/domare |
| Bekräfta motståndarens resultat | fält `awaitingResultConfirmation`, `POST /ClubLeague/ConfirmClubLeagueResultAsync` | Motståndaren |
| Domarkod per match | `ProfileMatchInfoModel.refereeCode` | Den som har koden |
| Lagliga | `TeamLeagueMatchRowModel.showPlayerEnterResultButton` | Lagkapten/spelare |
| Anmälan dubbel | `POST /Tournament/JoinDoubleAsync` (`tournamentClassId`, `tournamentId`, `partnerId`) | Inloggad spelare |
| Privat match | `PrivateMatchCreateRequest` | Inloggad spelare |

Begränsningar:
- Appen kan aldrig göra mer än användaren själv får göra på rankedin.com.
- Vi måste hantera användarnas Rankedin-lösenord – säkerhets-, GDPR- (barn!) och villkorsrisk.
- I stor skala är detta inte hållbart utan ett avtal med Rankedin (OAuth/partner-API).

## Rekommendation för arkitektur
1. **Egen tunn backend/proxy** (t.ex. serverless) mot `api.rankedin.com/v1` med cache (minuter för schema/resultat, timmar för ranking) – skyddar mot rate limits och API-ändringar.
2. **Read-only i v1.** Anmälan/licens länkar vi till Rankedin (deep link) tills vi vet att Rankedin accepterar skrivning från tredje part.
3. Normalisera PascalCase-svaren till egna domäntyper i ett enda klientlager.
