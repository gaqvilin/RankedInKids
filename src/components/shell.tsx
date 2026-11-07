import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, type LinkProps } from 'react-router-dom';
import { onLoadingChange } from '../lib/api';
import { CURRENT_VERSION, hasUnseenRelease } from '../lib/releases';
import { useKnownPlayers } from '../lib/known';
import { useMine } from '../lib/mine';
import { getSavedTeams } from '../lib/storage';

const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
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

type NavItem = { to: string; label: string; icon: string; end?: boolean };

const NAV: NavItem[] = [
  { to: '/', label: 'Översikt', end: true, icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/tavlingar', label: 'Tävlingar', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4' },
  { to: '/serier', label: 'Serier', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/konto', label: 'Konton', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];
const ADMIN_NAV: NavItem = { to: '/admin', label: 'Admin', icon: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z' };

/** True until the user has opened the release notes for the current version. */
function useUnseenRelease() {
  const [unseen, setUnseen] = useState(hasUnseenRelease);
  useEffect(() => {
    const onSeen = () => setUnseen(false);
    window.addEventListener('releases-seen', onSeen);
    return () => window.removeEventListener('releases-seen', onSeen);
  }, []);
  return unseen;
}

function ReleasesLink({ className }: { className: string }) {
  const unseen = useUnseenRelease();
  return (
    <span className={className}>
      <Link to="/hjalp">Hjälp</Link>
      <span className="muted"> · </span>
      <Link to="/nyheter">
        Nyheter{unseen && <span className="new-dot" aria-label="nytt" />}
      </Link>
      <span className="muted"> · version {CURRENT_VERSION}</span>
    </span>
  );
}

/** What you look at: always first. Tools and settings live at the bottom. */
const MAIN_NAV = NAV.slice(0, 3);
const ACCOUNT_NAV = NAV[3];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sidebar() {
  const { user } = useSession();
  const players = useKnownPlayers();
  const mine = useMine();
  const myTeams = mine.data?.teams ?? getSavedTeams().map((t) => ({ ...t, nextDate: null as string | null }));
  return (
    <aside className="sidebar" aria-label="Huvudmeny">
      <Link to="/" className="brand">
        PadelAdmin
        <span className="brand__sub">Data från Rankedin</span>
      </Link>
      <nav className="sidebar__nav">
        {MAIN_NAV.map((n) => (
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
      {myTeams.length > 0 && (
        <div className="sidebar__group">
          <p className="sidebar__heading">Mina lag</p>
          {myTeams.map((t) => (
            <NavLink key={t.id} to={`/lag/${t.id}`} className={({ isActive }) => `sidebar__link sidebar__link--sub sidebar__link--two ${isActive ? 'is-active' : ''}`}>
              <span>{t.name}</span>
              {t.nextDate && <span className="sidebar__meta">Nästa {shortDay(t.nextDate)}</span>}
            </NavLink>
          ))}
        </div>
      )}
      {(mine.data?.clubs.length ?? 0) > 0 && (
        <div className="sidebar__group">
          <p className="sidebar__heading">{mine.data!.clubs.length > 1 ? 'Klubbar' : 'Klubb'}</p>
          {mine.data!.clubs.map((c) => (
            <NavLink key={c.id} to={`/klubb/${c.id}`} className={({ isActive }) => `sidebar__link sidebar__link--sub ${isActive ? 'is-active' : ''}`}>
              {c.name}
            </NavLink>
          ))}
        </div>
      )}
      {(mine.data?.upcoming.length ?? 0) > 0 && (
        <div className="sidebar__group">
          <p className="sidebar__heading">På gång</p>
          {mine.data!.upcoming.map((u) => (
            <NavLink key={u.to} to={u.to} className={({ isActive }) => `sidebar__link sidebar__link--sub sidebar__link--two ${isActive ? 'is-active' : ''}`}>
              <span className="sidebar__meta">{shortDay(u.date)}</span>
              <span className="sidebar__clip">{u.label}</span>
            </NavLink>
          ))}
        </div>
      )}
      <div className="sidebar__foot">
        <nav className="sidebar__nav" aria-label="Verktyg">
          {user.loggedIn && (
            <NavLink to={ADMIN_NAV.to} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
              <Icon d={ADMIN_NAV.icon} />
              {ADMIN_NAV.label}
            </NavLink>
          )}
          <NavLink to={ACCOUNT_NAV.to} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
            <Icon d={ACCOUNT_NAV.icon} />
            <span>
              {user.loggedIn ? user.name : 'Logga in'}
              {user.loggedIn && user.accounts.length > 1 && <span className="muted small"> +{user.accounts.length - 1}</span>}
            </span>
          </NavLink>
        </nav>
        <ReleasesLink className="sidebar__releases small" />
      </div>
    </aside>
  );
}

function TabBar() {
  const nav = [...MAIN_NAV, ACCOUNT_NAV];
  return (
    <nav className="tabbar" aria-label="Huvudmeny">
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tabbar__link ${isActive ? 'is-active' : ''}`}>
          <Icon d={n.icon} />
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** Thin bar at the top while anything is loading from Rankedin. */
function LoadingBar() {
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      onLoadingChange((n) => {
        setBusy(n > 0);
      }),
    [],
  );
  return <div className={`loading-bar ${busy ? 'is-busy' : ''}`} role="progressbar" aria-hidden={!busy} aria-label="Hämtar från Rankedin" />;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <LoadingBar />
      <Sidebar />
      <div className="shell__main">
        {children}
        <footer className="app-footer">
          <ReleasesLink className="small" />
        </footer>
      </div>
      <TabBar />
    </div>
  );
}
