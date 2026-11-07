import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, type LinkProps } from 'react-router-dom';
import { getSavedPlayers, getSavedTeams } from '../lib/storage';
import { useSession } from '../session';

/** Where "back" goes, carried in router state by <Go>. */
export type From = { label: string; to: string };

/**
 * A link that remembers where it came from, so the next page can show
 * "‹ Aron Aqvilin" instead of an anonymous back arrow.
 */
export function Go({ from, ...props }: LinkProps & { from: string }) {
  const loc = useLocation();
  return <Link {...props} state={{ from: { label: from, to: loc.pathname + loc.search } satisfies From }} />;
}

const NAV = [
  { to: '/', label: 'Översikt', end: true, icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/tavlingar', label: 'Tävlingar', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4' },
  { to: '/serier', label: 'Klubbligan', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/konto', label: 'Konton', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sidebar() {
  const { user } = useSession();
  const players = getSavedPlayers();
  const teams = getSavedTeams();
  return (
    <aside className="sidebar" aria-label="Huvudmeny">
      <Link to="/" className="brand">
        PadelAdmin
        <span className="brand__sub">Data från Rankedin</span>
      </Link>
      <nav className="sidebar__nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
            <Icon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      {players.length > 0 && (
        <div className="sidebar__group">
          <p className="sidebar__heading">Mina spelare</p>
          {players.map((p) => (
            <NavLink key={p.rankedinId} to={`/spelare/${p.rankedinId}`} className={({ isActive }) => `sidebar__link sidebar__link--sub ${isActive ? 'is-active' : ''}`}>
              {p.name}
            </NavLink>
          ))}
        </div>
      )}
      {teams.length > 0 && (
        <div className="sidebar__group">
          <p className="sidebar__heading">Mina lag</p>
          {teams.map((t) => (
            <NavLink key={t.id} to={`/lag/${t.id}`} className={({ isActive }) => `sidebar__link sidebar__link--sub ${isActive ? 'is-active' : ''}`}>
              {t.name}
            </NavLink>
          ))}
        </div>
      )}
      <div className="sidebar__foot">
        {user.loggedIn ? (
          <Link to="/konto" className="sidebar__account">
            <span className="muted small block">Inloggad som</span>
            {user.name}
            {user.accounts.length > 1 && <span className="muted small"> +{user.accounts.length - 1}</span>}
          </Link>
        ) : (
          <Link to="/konto" className="sidebar__account">
            Logga in med Rankedin
          </Link>
        )}
      </div>
    </aside>
  );
}

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Huvudmeny">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}>
          <Icon d={n.icon} />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">{children}</div>
      <TabBar />
    </div>
  );
}
