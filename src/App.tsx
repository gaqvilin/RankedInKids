import { Route, Routes } from 'react-router-dom';
import Account from './pages/Account';
import Calendar from './pages/Calendar';
import Home from './pages/Home';
import Player from './pages/Player';
import Referee from './pages/Referee';
import Tournament from './pages/Tournament';
import { SessionProvider } from './session';

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/spelare/:rid" element={<Player />} />
        <Route path="/tavling/:id" element={<Tournament />} />
        <Route path="/tavlingar" element={<Calendar />} />
        <Route path="/doma/:code" element={<Referee />} />
        <Route path="/konto" element={<Account />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </SessionProvider>
  );
}
