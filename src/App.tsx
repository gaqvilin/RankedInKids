import { Route, Routes } from 'react-router-dom';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Calendar from './pages/Calendar';
import Club from './pages/Club';
import Division from './pages/Division';
import Feedback from './pages/Feedback';
import Group from './pages/Group';
import Help from './pages/Help';
import Organizer from './pages/Organizer';
import Screen from './pages/Screen';
import QrPrint from './pages/QrPrint';
import PrintSheets from './pages/PrintSheets';
import Search from './pages/Search';
import Home from './pages/Home';
import League from './pages/League';
import Player from './pages/Player';
import Referee from './pages/Referee';
import Releases from './pages/Releases';
import Round from './pages/Round';
import Team from './pages/Team';
import TeamMatch from './pages/TeamMatch';
import Tournament from './pages/Tournament';
import { AppShell } from './components/shell';
import Leagues from './pages/Leagues';
import { SessionProvider } from './session';
import { useLang } from './lib/i18n';

export default function App() {
  // The key remounts every page when the language changes, so all texts are read again.
  const lang = useLang();
  return (
    <SessionProvider>
      <AppShell key={lang}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spelare/:rid" element={<Player />} />
        <Route path="/tavling/:id" element={<Tournament />} />
        <Route path="/tavling/:id/ledning" element={<Organizer />} />
        <Route path="/tavling/:id/skarm" element={<Screen />} />
        <Route path="/tavling/:id/qr" element={<QrPrint />} />
        <Route path="/tavling/:id/skriv-ut" element={<PrintSheets />} />
        <Route path="/tavlingar" element={<Calendar />} />
        <Route path="/lagmatch/:id" element={<TeamMatch />} />
        <Route path="/serier" element={<Leagues />} />
        <Route path="/klubb/:id" element={<Club />} />
        <Route path="/grupp/:shareId" element={<Group />} />
        <Route path="/liga/:id" element={<League />} />
        <Route path="/division/:poolId" element={<Division />} />
        <Route path="/lag/:teamId" element={<Team />} />
        <Route path="/lag/:teamId/omgang/:date" element={<Round />} />
        <Route path="/doma/:code" element={<Referee />} />
        <Route path="/konto" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/nyheter" element={<Releases />} />
        <Route path="/hjalp" element={<Help />} />
        <Route path="/sok" element={<Search />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </AppShell>
    </SessionProvider>
  );
}
