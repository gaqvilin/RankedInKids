import { Route, Routes } from 'react-router-dom';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Calendar from './pages/Calendar';
import Club from './pages/Club';
import Division from './pages/Division';
import Feedback from './pages/Feedback';
import Help from './pages/Help';
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

export default function App() {
  return (
    <SessionProvider>
      <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spelare/:rid" element={<Player />} />
        <Route path="/tavling/:id" element={<Tournament />} />
        <Route path="/tavlingar" element={<Calendar />} />
        <Route path="/lagmatch/:id" element={<TeamMatch />} />
        <Route path="/serier" element={<Leagues />} />
        <Route path="/klubb/:id" element={<Club />} />
        <Route path="/liga/:id" element={<League />} />
        <Route path="/division/:poolId" element={<Division />} />
        <Route path="/lag/:teamId" element={<Team />} />
        <Route path="/lag/:teamId/omgang/:date" element={<Round />} />
        <Route path="/doma/:code" element={<Referee />} />
        <Route path="/konto" element={<Account />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/nyheter" element={<Releases />} />
        <Route path="/hjalp" element={<Help />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </AppShell>
    </SessionProvider>
  );
}
