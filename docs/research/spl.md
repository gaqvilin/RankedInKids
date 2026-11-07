# SPL – Swedish Padel League: hur det fungerar och vad PadelAdmin bör göra

*Research 2026-11-08. Källor: SPF:s [SPL-bestämmelser 2024/25](https://svenskpadel.se/wp-content/uploads/2024/07/SPL-Bestammelser-2024-25_1_19jun24.pdf),
[Manual genomförande sammandrag](https://svenskpadel.se/tavling/manual-genomforande-sammandrag/), seriens regeltext i Rankedin
(SPL Herrar 2026-27, `TeamLeague/GetRegulationsAsync?id=946`) och Rankedins API för lagserier.
Bestämmelserna för 2026/27 är "uppdateras inom kort" enligt SPF – reglerna nedan om uppställning kommer från 2024/25.*

## Upplägg 2026/27
- Herrar spelar lördagar, damer söndagar. Div 1 och lägre: **5 sammandrag** (3–4 okt, 7–8 nov, 12–13 dec, 16–17 jan, 13–14 feb), extrahelg 13–14 mars, kval 3–4 april. Klubblags-SM 29 april–2 maj.
- Ett sammandrag = 1–2 **lagmatcher** samma dag hos en arrangerande förening. En lagmatch = **3 dubbelmatcher**.
- Poäng: 1 poäng per vunnen dubbelmatch + 1 bonuspoäng för vunnen lagmatch. Tabell: poäng → vunna matcher → inbördes → set → game.
- Rankingpoäng per vunnen match: Div 1 = 2, Div 2 = 1, Div 3 = 0,5, Div 4 = 0,4 (förlust ger deltagarpoäng).
- Flytt av enskild lagmatch godkänns inte; WO = 0–6 0–6 utan spelare.
- Licens krävs; spelare utan aktiv licens går inte att välja i uppställningen i Rankedin.

## Roller och vad de gör
| Roll | Före | På plats | Efter |
|---|---|---|---|
| **Lagledare/kapten** | Trupp i Rankedin (min 6 spelare div 1, 4 i div 2–4), betala serieavgift (2 000 kr i Rankedin senast 16/8), samla spelare till sammandraget. *Nytt 26/27: coachcertifiering krävs.* | **Lägga in uppställning i Rankedin senast 15 min före första matchen** (div 2+: match 3 senast 5 min efter match 1–2). Vinnande lag **rapporterar resultat löpande**. | – |
| **Arrangerande förening** | Boka banor, bollar, mat, spelschema, **skicka kallelse senast måndag** samma vecka. | Ta betalt (550 kr/lagmatch), sekretariat med Rankedin, se till att lagledarna lagt in lag i tid. | Säkerställa att alla resultat är inlagda. |
| **Spelare** | Licens, medlemskap, vara tillgänglig. | Veta när, var, med vem och i vilken match. | Se resultat, tabell, rankingpoäng. |

### Uppställningsregler (2024/25)
- **Div 1:** 6 olika spelare per lagmatch. Högst rankade paret från varje lag möts i match 1, osv.
- **Div 2–4:** minst 4 olika spelare. Högst rankade paret möts i match 1 och 2; **fri uppställning i match 3** (nya konstellationer, får ha högre poäng än match 1).
- Utlåning inom föreningen: max 1 lånad spelare per lagmatch, som spelar max 1 match.

## Vad Rankedin redan gör (och vi återanvänder)
- Trupp, lagledare (`initiator`), uppställning (`UpdateTeamLeagueLineupsAsync`), resultat (`SubmitResultAsync`), tabell, omgångar.
- Datum/plats-inbjudningar mellan lag (`CreateDateAndLocationInvitationAsync` m.fl.) – används knappt i SPL eftersom datum är fasta.
- Lagledarvy (`GetTeamManagerAsync`): trupp, admins, betalning (`GetTeamBillingDetailsAsync`).

## Smärtpunkter → förslag (prio)
1. **Uppställning med SPL-regler** – validera 6 olika spelare (div 1) / min 4 (div 2+), visa parens rankingpoäng och varna om ordningen bryter mot "högst rankade paret i match 1", fri match 3 i div 2+. Nedräkning till deadline (15 min före första matchen).
2. **Sammandragsdagen för lagledaren** – en vy per omgång: datum, arrangör/plats, båda lagmatcherna, status för *vår* och *motståndarens* uppställning, licensstatus i truppen, vilka resultat som saknas och vem som ska rapportera (vinnande lag).
3. **Snabb resultatrapportering under dagen** – från lagmatchen, en match i taget, gärna live med domarkod.
4. **Tillgänglighet** – "Kan du spela 12/12?" till truppen; lagledaren ser svar och tar ut laget. Finns inte i Rankedin. Kräver egen lagring (t.ex. Supabase/Vercel KV).
5. **Arrangörsverktyg** – kallelsemall (SPF:s exempel ifyllt med datum, lag, plats, schema) och spelschema per bana (SPF:s exempel för 4/6 banor).
6. **Spelarvy SPL** – mitt lag, nästa sammandrag, om jag är uttagen och i vilken match, mina rankingpoäng per division.

Inte för oss (görs i Rankedin/SPF): anmälan av lag, serieavgift, spelarövergångar, dispenser.
