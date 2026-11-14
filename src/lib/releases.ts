// Release notes shown on /nyheter. Newest first. Write for parents and
// players, not developers: what changed and what it means for them.

export type Release = { version: string; date: string; title: string; items: string[] };

export const RELEASES: Release[] = [
  {
    version: '0.12',
    date: '2026-11-08',
    title: 'Tävlingsledning för arrangörer',
    items: [
      'Appen finns på engelska: välj Svenska eller English under Meny. Första gången följer appen telefonens språk.',
      'Spelarsidan visar spelarens profilbild från Rankedin (eller initialen om bild saknas).',
      'Slutresultat: när slutspelet rapporteras visas placeringarna 1–8 i en egen ruta ovanför Slutspel.',
      'Anmäl till en tävling direkt i PadelAdmin: tryck Anmäl på tävlingen, välj klass och partner (eller "söker partner") och bekräfta. Betalning och avanmälan görs i Rankedin.',
      'Tävlingslistan visar ort även när Rankedin saknar adress – orten hämtas då från tävlingens namn (t.ex. "… SKURUP").',
      '"Pågår nu" syns även på tavlan, och bara på matcher som kan ha börjat: om spelarna eller banan fortfarande är upptagna i en tidigare match utan resultat står det "Väntar på förra matchen".',
      'Slutspelet syns i matchlistan och på tavlan direkt, med tid och bana, även innan paren är klara ("1:a grupp B").',
      'Nytt utseende: blå accentfärg, mjukare kort och diskret rörelse. Matcher visar "Pågår nu" i grönt, dina egna visar Vinst eller Förlust, och tävlingen har en rad överst med hur många matcher som är klara.',
      'Grupptabellen visar vad placeringen leder till: ettan är markerad (spelar final), och ett tryck på platssiffran säger vad platsen spelar om.',
      'Fungerar utan nät: appen öppnas och visar det som senast hämtades. Resultat du rapporterar utan nät sparas i telefonen och skickas till Rankedin när nätet är tillbaka – har någon annan hunnit rapportera något annat får du välja vilket som gäller.',
      'På datorn kan sidomenyn döljas (knappen bredvid loggan) så att sidan, t.ex. tavlan, använder hela skärmen. Samma knapp uppe till vänster tar tillbaka menyn.',
      'Arrangörer kan flytta en match till en annan tid och bana: Tävlingsledning → Schema → Flytta på matchen. Bara lediga banor visas, och spelare som redan spelar den tiden varnas för.',
      'Fel resultat? Tävlingsledning → Resultat → Rapporterade: tryck Ändra resultat på matchen, rätta eller tryck Ta bort resultatet – matchen blir ospelad i Rankedin igen.',
      'Matcherna kan visas som en tavla: en kolumn per klockslag med banorna under och hur många som är spelade. Växla mellan Lista och Tavla vid rubriken Matcher – valet sparas.',
      'Förklaringar i tabellerna: håll över eller tryck på S, V, F, +/- och P (och A1, B1 i slutspelet, "Väntar på bekräftelse" och "Licens saknas") för att se vad de betyder. En rad under Grupper säger hur gruppen avgör slutspelet.',
      'Resultat: välj 1 set, 2 set eller bäst av 3 – valet sparas till nästa match. Rankedin kräver en vinnare, så vid 1–1 skrivs supertiebreaket som ett tredje set.',
      'Grupperna ser ut som ett gruppspel i fotboll: tabell (S V F +/- P) och gruppens matcher med tid, bana och resultat. Slutspelet visas under som en rad per match (Final, Om plats 3–4 …) med parens gruppplats (A1, B1) och tid och bana, ifyllt med paren som leder grupperna just nu.',
      'Utskrifterna är kortare: klassen står utan nivån när tävlingens namn redan säger den ("Pojkar 12"), och gruppen bara när klassen har flera. Marginaler runt utskriften i alla webbläsare.',
      'Rättat: utskriftssidan (schema, deltagarlista, banlistor och QR) kunde sluta reagera i mobilen efter en utskrift.',
      'Alla klasser på tävlingssidan visar nu alla matcher i en lista efter tid, med klassen på varje match. Tidigare låg en klass långt ner under en annan.',
      'PadelAdmin-loggan på alla utskrifter (schema, deltagarlista, banlistor, QR-affisch och lappar).',
      'Tävlingar kan filtreras på ålder (12, 14, 16, 18) – och med ett tryck på "För Aron (12)" ser du bara tävlingar med en klass som passar ditt barn.',
      'Utskrifter för tävlingsdagen: dagens schema, deltagarlista för avcheckning, en sida per bana och QR-kod (Tävlingsledning → Skriv ut).',
      'Fyra knappar längst ner: Översikt, Tävlingar, Serier och Meny. Sök ligger som förstoringsglas uppe till höger. Fliken lyser även på sidor under den, t.ex. ett lag.',
      'Ny knapp Meny längst ner: konton, admin, hjälp, nyheter, feedback och hemskärm på ett ställe. Sidfoten och kontoknappen uppe till höger är borta.',
      'Översikt är kortare: först det som behöver göras, sedan På gång och en enkel lista med dina spelare.',
      'Enklare feedback: bara en ruta att skriva i. Rutorna öppnas nu alltid snyggt ovanpå sidan.',
      'Mobilen zoomar inte längre in när man trycker i ett fält eller dubbeltrycker.',
      'Knappen Lägg till på hemskärmen (under Konton och längst ner på Översikt) installerar PadelAdmin som en app.',
      'Säkerhet: skydd mot att sidan bäddas in på andra sajter, begränsat antal inloggningsförsök och uppdaterade bibliotek utan kända brister.',
      'Mindre information överallt: tävlingens detaljer är ihopfällda, lagsidan har en enda lista med speldagar, serielistan och reglerna ligger ett tryck bort, och varningar är kortare.',
      'Spelare som är anmälda utan partner kan själva lägga till en partner – även från en annan klubb – med sitt eget konto, direkt på tävlingssidan.',
      'Rättat: sökning på namn med mellanslag (t.ex. för- och efternamn) fungerade inte.',
      'Ny logga: en padelracket i en enkel form. Syns i menyn, som app-ikon på hemskärmen och i webbläsarfliken.',
      'Ny sida Tävlingsledning för klubben som arrangerar en tävling (knapp på tävlingen och under Admin).',
      'Före lottning: alla som söker partner per klass med klubb och ålder, färdigt meddelande att kopiera, licenser som saknas och antal par per klass.',
      'Para ihop och dela på par direkt i PadelAdmin (för arrangörens konto, fram till lottningen) – ingen inloggning på rankedin.com behövs.',
      'Lottning i PadelAdmin: lägg till banor och tider, stäng anmälan, lotta (en eller flera grupper), schemalägg och publicera – steg för steg, och allt går att ångra innan publicering.',
      'Under dagen: varje bana med pågående och nästa match, och varning när en bana ligger efter.',
      'Resultat: lista över matcher som borde vara klara men saknar resultat, med snabb inmatning.',
      'QR-kod att dela ut: skriv ut lappar (8 per A4) eller en affisch. Den som skannar ser sina matcher, tider, banor och resultat direkt i mobilen.',
      'Har ni en TV finns också en skärmvy som uppdateras själv.',
      'Logiskare flöden: spelarsidans schema visar en rad per speldag (som Översikt), "Senast" sammanfattar hela speldagen, och "Nästa" står inte längre två gånger.',
      'Varningen "Partner saknas" leder till tävlingen där du ser vilka fler som söker partner.',
      'Ett och samma ord överallt: speldag. Passerade speldagar visar bara resultaten.',
      'Lagmatchen visar datum, serie och länk till hela speldagen.',
      'Översikt är renare: sökningen ligger under Sök och domarkoden under Tävlingar.',
    ],
  },
  {
    version: '0.11',
    date: '2026-11-08',
    title: 'Klubbligans regler, mer tävlingsinfo och säkrare inloggning',
    items: [
      'Klubbligan 10–13/10–14 år visar ingen tabell eller placering – precis som SPF:s regler säger. Lagsidan förklarar hur serien spelas.',
      'Uppställning i Klubbligan varnar om samma par spelar två matcher eller om laget har färre än 4 spelare.',
      'Arrangör i Klubbligan: kallelse och spelschema (match 1–2, 3–4, 5–6 för de yngsta), att skicka senast 10 dagar före.',
      'Tävlingar visar anläggning med karta, arrangör, avgift och arrangörens information. Serier visar sina regler.',
      'Säkrare: inloggningen kan inte längre styras från andra sajter, och ett konto används aldrig i en flik som visar ett annat.',
      'Du loggas inte längre ut om Rankedin har en kort störning.',
      'Snabbare och stabilare när du följer flera spelare – appen skickar färre samtidiga frågor till Rankedin.',
      'Tävlingssidan visar vilka fler i klassen som söker partner när ditt barn saknar en.',
      '"Nästa" visar alla motståndare på speldagen, inte bara den första.',
      'Speldagar har en liten etikett, Spelad eller Kommande, och spelade visar resultatet mot varje lag.',
      'Ge feedback: knapp längst ner och på hjälpsidan. Allt du skriver sparas och läses.',
      'Ny flik Sök: hitta vilken spelare som helst – motståndare, lagkamrat eller partner – med klubb och ålder i träffarna, och se dina senast visade spelare.',
      'Rättat: när du byter spelare eller lag syns inte längre den förra sidans information en kort stund.',
    ],
  },
  {
    version: '0.10',
    date: '2026-11-08',
    title: 'Hjälpsida, fylligare meny och rättningar',
    items: [
      'Ny hjälpsida som förklarar tanken med PadelAdmin och hur allt fungerar, med vanliga frågor. Länk längst ner.',
      'Menyn visar dina lag med nästa speldag, din klubb och vad som är på gång (tävlingar och speldagar) med direktlänkar.',
      'Speldagen visar anläggningen för hela sammandraget, och spelare som inte är uttagna visas som "Ej uttagna".',
      '"Resultat saknas" visas inte längre inför en speldag som inte har varit.',
      'Rättat: den gamla adressen padelkids.vercel.app skickar nu vidare även från startsidan.',
    ],
  },
  {
    version: '0.9',
    date: '2026-11-08',
    title: 'SPL och lagledare',
    items: [
      'SPL är med: fliken heter nu Serier och visar både Klubbligan och SPL, och "Mina lag" hittar era lag i båda.',
      'Speldagar: en sida per sammandrag med checklista, lagmatcher, uppställning, resultat och vilka som kan spela.',
      'Tillgänglighet: spelare svarar "Kan / Kanske / Kan inte", lagledare ser alla svar och kan svara åt andra.',
      'Uppställning i SPL visar seriens regler, varnar för fel rankingordning eller för få spelare och visar sista tid.',
      'Arrangör: spelschema per bana och färdig kallelse enligt SPF:s mall att kopiera eller mejla.',
      'Spelarsidan visar nästa speldag, om du är uttagen och i vilken match, och rankingpoäng per division.',
    ],
  },
  {
    version: '0.8',
    date: '2026-11-08',
    title: 'Snabbare',
    items: [
      'Sidor visar det du såg senast direkt och uppdaterar i bakgrunden.',
      'Publik information (profiler, lag, serier, klubbar) cachas och laddar mycket snabbare.',
      'En tunn linje överst visar när något hämtas.',
      'Lagmatcher förklarar när resultat inte går att rapportera eller ändra.',
    ],
  },
  {
    version: '0.7',
    date: '2026-11-07',
    title: 'Min Klubbliga och tydligare meny',
    items: [
      'Klubbligan visar "Min Klubbliga" överst: era lag med placering och nästa match, och markerar serierna ni spelar i.',
      'Konton du är inloggad med räknas som dina spelare automatiskt, du behöver inte spara dem.',
      'Menyn: det du tittar på överst, Admin och Konton längst ner. Nyheter finns i botten.',
    ],
  },
  {
    version: '0.6',
    date: '2026-11-07',
    title: 'Schema, klubbsida och admin',
    items: [
      'Schema för varje spelare: tävlingar och lagmatcher i datumordning, även innan matcherna är lottade.',
      'Klubbsida med kontakt, lag den här säsongen, medlemmar och kommande tävlingar.',
      'Admin-flik för dig som är admin i Rankedin, och filtret "Bara matcher att rapportera" på tävlingar.',
      'Tävlingar: bara kommande, filtrera på nivå, sanktionerade och ort (skriv en stad).',
      'Enklare mobilvy: en rad per lagmatch och ihopfällda listor.',
      'Ny adress: padeladmin-app.vercel.app (den gamla skickar vidare).',
    ],
  },
  {
    version: '0.5',
    date: '2026-11-07',
    title: 'Nytt utseende och namn',
    items: [
      'Appen heter nu PadelAdmin.',
      'Meny på datorn och flikar i mobilen, och tillbaka-knappen visar vart den leder.',
      'Översikten visar det viktigaste för dina sparade spelare direkt.',
      'Lag visar säsongens datum, tabellplacering, senaste och nästa match.',
      'Enklare färger.',
      'Rättat: "Licens saknas" visades felaktigt i Klubbligan, som inte kräver licens.',
    ],
  },
  {
    version: '0.4',
    date: '2026-11-07',
    title: 'Flera konton och alla klasser',
    items: [
      'Logga in med flera Rankedin-konton samtidigt, t.ex. ditt eget och ditt barns, och byt med ett tryck.',
      '"Alla klasser" på tävlingssidan.',
      'Rättat: lagmatcher i Klubbligan visade 0–0 i stället för resultatet.',
    ],
  },
  {
    version: '0.3',
    date: '2026-11-07',
    title: 'Serier och laguppställning',
    items: [
      'Lagserier: Klubbligan (och SPL) med divisioner, tabeller, omgångar och lag.',
      'Lagledare kan sätta laguppställning.',
    ],
  },
  {
    version: '0.2',
    date: '2026-11-07',
    title: 'Lagmatcher',
    items: ['Lagmatcher i Klubbligan med alla dubbelmatcher och ställning.', 'Klistra in en Rankedin-länk för att öppna rätt sida direkt.'],
  },
  {
    version: '0.1',
    date: '2026-11-07',
    title: 'Första versionen',
    items: [
      'Hitta och spara ditt barn, se kommande matcher och tävlingar.',
      'Varning när partner saknas inför sista anmälningsdag.',
      'Tävlingar med klasser, anmälda par, matcher och tabell.',
      'Döm matcher live med domarkod.',
      'Rapportera resultat med ditt Rankedin-konto.',
    ],
  },
];

export const CURRENT_VERSION = RELEASES[0].version;
const SEEN_KEY = 'padeladmin.seenVersion';

export function hasUnseenRelease(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== CURRENT_VERSION;
  } catch {
    return false;
  }
}

export function markReleasesSeen() {
  try {
    localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
  } catch {
    /* storage unavailable */
  }
}
