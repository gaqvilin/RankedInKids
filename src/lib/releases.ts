// Release notes shown on /nyheter. Newest first. Write for parents and
// players, not developers: what changed and what it means for them.

export type Release = { version: string; date: string; title: string; items: string[] };

export const RELEASES: Release[] = [
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
      'Speldagar märks tydligt som Spelad, Nästa speldag eller Kommande, och spelade visar resultatet mot varje lag.',
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
