import { useState, type ReactNode } from 'react';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { Link } from 'react-router-dom';
import { AppHeader, Page } from '../components/ui';

const SECTIONS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'tanken',
    title: 'Vad är PadelAdmin?',
    body: (
      <>
        <p>
          PadelAdmin är ett enklare sätt att följa och sköta padel för barn, föräldrar, spelare och lagledare. All tävlingsdata finns i Rankedin
          (Svenska Padelförbundets tävlingssystem) – PadelAdmin hämtar den därifrån och visar det viktigaste först, i stället för att du ska klicka
          runt.
        </p>
        <p>
          Det du gör här (rapporterar resultat, sätter uppställning) sparas direkt i Rankedin, precis som om du gjort det på rankedin.com. Det
          enda PadelAdmin sparar själv är sådant Rankedin saknar, som vilka spelare som kan spela en speldag.
        </p>
        <p className="muted small">PadelAdmin är fristående och inte en officiell Rankedin-produkt.</p>
      </>
    ),
  },
  {
    id: 'kom-igang',
    title: 'Kom igång',
    body: (
      <ol>
        <li>
          <strong>Hitta ditt barn</strong> under <Link to="/sok">Sök</Link> – sök på namn eller klistra in en Rankedin-länk – och tryck{' '}
          <em>Spara som min spelare</em>.
        </li>
        <li>
          <strong>Logga in</strong> under <em>Meny → Konton</em> med ditt Rankedin-konto om du vill rapportera resultat, sätta uppställning
          eller svara på tillgänglighet. Du kan lägga till flera konton, t.ex. ditt eget och ditt barns.
        </li>
        <li>
          <strong>Lägg appen på hemskärmen</strong> med knappen <em>Lägg till på hemskärmen</em> i Menyn – eller i Safari: Dela → Lägg till
          på hemskärmen, i Chrome: menyn → Installera app.
        </li>
      </ol>
    ),
  },
  {
    id: 'oversikt',
    title: 'Översikt och spelare',
    body: (
      <>
        <p>
          <strong>Översikt</strong> visar för varje spelare du följer: varningar (t.ex. <em>partner saknas</em> inför sista anmälningsdag), nästa
          lottade match och det som är på gång – tävlingar och lagens speldagar i datumordning.
        </p>
        <p>
          Under <Link to="/sok">Sök</Link> hittar du vilken spelare som helst i Rankedin, t.ex. en motståndare eller en möjlig partner.{' '}
          <strong>Spelarsidan</strong> har allt om en spelare: schema, lag med tabellplacering och nästa match, om spelaren är uttagen till nästa
          speldag, tidigare tävlingar och klubb. Konton du är inloggad med räknas automatiskt som dina spelare.
        </p>
      </>
    ),
  },
  {
    id: 'tavlingar',
    title: 'Tävlingar',
    body: (
      <>
        <p>
          Under <Link to="/tavlingar">Tävlingar</Link> finns kommande juniortävlingar. Filtrera på nivå (Step In, Level Up, SPT Future, USM),
          sanktionerade och avstånd från en ort eller din position.
        </p>
        <p>
          På en tävling ser du klasser, anmälda par (och vilka som söker partner), matcher med tid och bana när de är lottade, resultat och en
          uträknad tabell. Välj <em>Alla klasser</em> för att se allt på en gång. Under tävlingsdagen uppdateras sidan automatiskt.
        </p>
      </>
    ),
  },
  {
    id: 'serier',
    title: 'Serier: Klubbligan och SPL',
    body: (
      <>
        <p>
          Under <Link to="/serier">Serier</Link> visas först <em>Mina lag</em> – lagen dina spelare spelar i, med placering och nästa match – och
          sedan alla Klubbligor och SPL-serier den här säsongen.
        </p>
        <p>
          <strong>Lagsidan</strong> visar säsongens datum, tabell, speldagar, kommande och spelade lagmatcher och truppen.{' '}
          <strong>Lagmatchen</strong> visar ställningen mellan lagen och alla dubbelmatcher.
        </p>
      </>
    ),
  },
  {
    id: 'speldag',
    title: 'Speldagar och tillgänglighet',
    body: (
      <>
        <p>
          En <strong>speldag</strong> (sammandrag) är dagen då laget spelar sina lagmatcher. Speldagssidan samlar allt: en checklista (uppställning
          inlagd för oss och motståndaren, licenser, saknade resultat, sista tid), lagmatcherna med uppställning och resultat, och{' '}
          <strong>Vilka kan spela?</strong>
        </p>
        <p>
          Spelare svarar <em>Kan / Kanske / Kan inte</em> för sig själva. Lagledare ser alla svar, vem som inte svarat och kan svara åt andra. Svaren
          syns bara för inloggade som finns i laget.
        </p>
      </>
    ),
  },
  {
    id: 'lagledare',
    title: 'För lagledare',
    body: (
      <>
        <p>
          Är du lagledare i Rankedin syns <strong>Sätt uppställning</strong> på lagmatchen och speldagen när Rankedin har öppnat matcherna (ofta
          närmare speldagen). Välj par per match ur truppen; rankingpoäng visas och ordningen sorteras efter dem.
        </p>
        <p>I SPL visar appen seriens regler och varnar (men stoppar inte) om något ser fel ut:</p>
        <ul>
          <li>Div 1: 6 olika spelare, högst rankade paret i match 1, näst högst i match 2 osv.</li>
          <li>Div 2–4: minst 4 spelare, rankingordning i match 1–2, fri uppställning i match 3.</li>
          <li>Uppställningen ska vara inlagd 15 minuter före första matchen (match 3 i div 2–4: 5 min efter match 1–2).</li>
        </ul>
        <p>I Klubbligan varnar appen om samma par spelar flera matcher eller om laget har färre än 4 spelare. I 10–13 år förs ingen tabell.</p>
        <p className="muted small">Reglerna bygger på SPF:s bestämmelser (SPL 2024/25, Klubbligan 2026) tills nya publiceras.</p>
      </>
    ),
  },
  {
    id: 'arrangor',
    title: 'För arrangerande klubb',
    body: (
      <p>
        På speldagssidan finns <strong>Arrangör: kallelse och spelschema</strong>. Välj antal banor, starttid och matchlängd så görs ett spelschema
        där inget lag spelar två lagmatcher samtidigt. Kallelsen fylls i enligt SPF:s mall och kan kopieras eller öppnas i e-post. Skicka den
        senast måndag samma vecka i SPL och senast 10 dagar före i Klubbligan.
      </p>
    ),
  },
  {
    id: 'tavlingsledning',
    title: 'För dig som arrangerar en tävling',
    body: (
      <>
        <p>
          Öppna tävlingen här och tryck <strong>Tävlingsledning</strong> (syns när ditt konto administrerar tävlingen, annars via{' '}
          <em>För arrangören</em>). Allt nedan görs direkt i Rankedin – du behöver inte logga in på rankedin.com.
        </p>
        <ul>
          <li>
            <strong>Före lottning</strong>: vilka som söker partner i varje klass, para ihop eller dela på par, licenser som saknas och antal
            par per klass.
          </li>
          <li>
            <strong>Lottning</strong>: lägg till banor och tider, stäng anmälan, lotta varje klass (en grupp där alla möter alla, eller flera
            grupper), schemalägg och publicera. Allt går att ta bort och göra om tills du publicerar.
          </li>
          <li>
            <strong>Banor</strong>: pågående och nästa match per bana, och vilka banor som ligger efter.
          </li>
          <li>
            <strong>Resultat</strong>: matcher som saknar resultat, med snabb inmatning.
          </li>
          <li>
            <strong>QR-kod</strong>: lappar att dela ut eller en affisch, så att alla ser matcher och resultat i mobilen. Har ni en TV finns en skärmvy.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'resultat',
    title: 'Resultat och live-dömning',
    body: (
      <>
        <p>
          <strong>Rapportera resultat</strong> syns på en match när Rankedin tillåter ditt inloggade konto att rapportera (arrangören bestämmer, i
          lagserier lagledarna). Skriv game per set; en supertiebreak skrivs som ett eget set, t.ex. 10–8.
        </p>
        <p>
          Ett redan inlagt resultat i en lagserie kan bara seriens administratör ändra – samma regel som i Rankedin. Appen förklarar det på
          lagmatchen.
        </p>
        <p>
          <strong>Döm live</strong> räknar poäng för poäng med matchens domarkod (finns på kommande matcher, eller skriv in den längst ner under Tävlingar), och resultatet hamnar i Rankedin när
          matchen avslutas. Fungerar i tävlingar där arrangören har live-dömning (Premium).
        </p>
      </>
    ),
  },
  {
    id: 'konton',
    title: 'Konton och integritet',
    body: (
      <ul>
        <li>Du loggar in med ditt vanliga Rankedin-konto. Lösenordet skickas vidare till Rankedin och sparas aldrig.</li>
        <li>Inloggningen sparas som en säker cookie på din enhet. Du kan vara inloggad med flera konton och byta aktivt konto.</li>
        <li>Det aktiva kontot används när du rapporterar eller sätter uppställning – i de rutorna står vilket konto som används, och du kan byta där.</li>
        <li>PadelAdmin sparar bara tillgänglighetssvar (vem som svarat vad och när). Allt annat ligger i Rankedin.</li>
        <li>Sparade spelare och lag ligger bara i din webbläsare.</li>
        <li>Vi räknar anonymt hur appen används – sidvisningar och hur många konton som är inloggade per dag – utan cookies, namn eller spelarnummer.</li>
      </ul>
    ),
  },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: 'Varför ser jag inga matcher för nästa speldag?', a: 'Rankedin skapar de enskilda matcherna först när arrangören öppnar omgången. Tills dess visas speldagen och motståndarna, men inte uppställning eller resultat.' },
  { q: 'Varför kan jag inte rapportera ett resultat?', a: 'Knappen visas bara när Rankedin tillåter ditt aktiva konto. Kontrollera att du är inloggad med rätt konto (byt i Menyn). Inlagda resultat i lagserier kan bara ändras av seriens administratör.' },
  { q: 'Varför syns inte mitt barn i rankinglistan?', a: 'Barn till och med 12 år får rankingpoäng men visas inte i SPF:s rankinglistor.' },
  { q: 'Sidan visar gammal information.', a: 'Appen visar det du såg senast direkt och hämtar nytt i bakgrunden – en tunn linje överst visar när den laddar. Tryck Uppdatera för att hämta direkt.' },
  { q: 'Mina sparade spelare försvann.', a: 'De sparas i webbläsaren. Byter du enhet, webbläsare eller adress behöver du spara dem igen – eller logga in, så räknas dina konton som dina spelare automatiskt.' },
];

export default function Help() {
  const [feedback, setFeedback] = useState(false);
  return (
    <>
      <AppHeader back="/" backLabel="Översikt" title="Hjälp" />
      <Page>
        <div className="page-title">
          <div>
            <h1>Hjälp</h1>
            <p className="muted">Hur PadelAdmin fungerar och vad tanken är.</p>
          </div>
        </div>
        <nav className="toc" aria-label="Innehåll">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
          <a href="#fragor">Vanliga frågor</a>
        </nav>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="help-section">
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}
        <section id="fragor" className="help-section">
          <h2>Vanliga frågor</h2>
          {FAQ.map((f) => (
            <details key={f.q} className="fold">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
        <section className="help-section">
          <h2>Saknar du något?</h2>
          <p>Berätta vad som krånglar eller vad du vill ha – vi läser allt.</p>
          <button className="btn btn--primary" onClick={() => setFeedback(true)}>
            Ge feedback
          </button>
          {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
        </section>
        <p className="muted small">
          Se vad som är nytt under <Link to="/nyheter">Nyheter</Link>.
        </p>
      </Page>
    </>
  );
}
