// Release notes shown on /nyheter. Newest first. Write for parents and
// players, not developers: what changed and what it means for them.

export type Release = { version: string; date: string; title: string; items: string[] };

export const RELEASES: Release[] = [
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
