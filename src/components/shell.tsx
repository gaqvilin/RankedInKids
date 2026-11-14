import { Logo } from './Logo';
import { FeedbackSheet } from './FeedbackSheet';
import { AccountSwitcher } from './AccountSwitcher';
import { InstallButton } from './InstallButton';
import { Sheet } from './Sheet';
import { OfflineBar } from './OfflineBar';
import { LangSwitch } from './ui';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, type LinkProps } from 'react-router-dom';
import { onLoadingChange } from '../lib/api';
import { CURRENT_VERSION, hasUnseenRelease } from '../lib/releases';
import { useKnownPlayers } from '../lib/known';
import { useMine } from '../lib/mine';
import { getSavedTeams } from '../lib/storage';
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
  { to: '/serier', label: 'Serier', icon: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14' },
  { to: '/sok', label: 'Sök', icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4' },
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
  const [feedback, setFeedback] = useState(false);
  return (
    <span className={className}>
      <button type="button" className="link-button" onClick={() => setFeedback(true)}>
        Ge feedback
      </button>
      {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
      <span className="muted"> · </span>
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
const MAIN_NAV = NAV.slice(0, 4);
const ACCOUNT_NAV = NAV[4];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FULL_KEY = 'padeladmin.fullscreen';

/** Desktop: hide the sidebar to use the whole screen (e.g. the board on match day). Remembered on this device. */
function useFullWidth(): [boolean, (v: boolean) => void] {
  const [full, setFull] = useState(() => {
    try {
      return localStorage.getItem(FULL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setFull(v);
    try {
      localStorage.setItem(FULL_KEY, v ? '1' : '0');
    } catch {
      /* private mode */
    }
  };
  return [full, set];
}

const PanelIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M9 4v16" stroke="currentColor" strokeWidth="2" />
  </svg>
);

function Sidebar({ onHide }: { onHide: () => void }) {
  const { user } = useSession();
  const players = useKnownPlayers();
  const mine = useMine();
  const myTeams = mine.data?.teams ?? getSavedTeams().map((t) => ({ ...t, nextDate: null as string | null }));
  return (
    <aside className="sidebar" aria-label="Huvudmeny">
      <div className="sidebar__top">
        <Link to="/" className="brand" aria-label="PadelAdmin start">
          <Logo />
          <span className="brand__sub">Data från Rankedin</span>
        </Link>
        <button className="icon-btn" onClick={onHide} title="Dölj menyn" aria-label="Dölj menyn och använd hela skärmen">
          <PanelIcon />
        </button>
      </div>
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
            <NavLink key={t.id} to={`/lag/${t.id}`} className={({ isActive }) => `sidebar__link sidebar__link--sub ${isActive ? 'is-active' : ''}`}>
              {t.name}
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
        <LangSwitch />
        <ReleasesLink className="sidebar__releases small" />
      </div>
    </aside>
  );
}

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';

/** Which tab a page belongs to, so the tab stays lit on pages below it (a team, a tournament…). */
function section(path: string): string | null {
  if (/^\/(tavling|doma)/.test(path)) return '/tavlingar';
  if (/^\/(serier|liga|division|lag|lagmatch)/.test(path)) return '/serier';
  if (/^\/(spelare|klubb)/.test(path)) return '/';
  return null;
}

/** Four main places plus "Meny" for everything else (account, admin, help, news, feedback, install). */
function TabBar() {
  const [open, setOpen] = useState(false);
  const unseen = useUnseenRelease();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <>
      <nav className="tabbar" aria-label="Huvudmeny">
        {MAIN_NAV.filter((n) => n.to !== '/sok').map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tabbar__link ${isActive || section(loc.pathname) === n.to ? 'is-active' : ''}`}>
            <Icon d={n.icon} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`tabbar__link ${open ? 'is-active' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span className="tabbar__icon">
            <Icon d={MENU_ICON} />
            {unseen && <span className="new-dot new-dot--icon" aria-label="nytt" />}
          </span>
          <span>Meny</span>
        </button>
      </nav>
      {open && <MenuSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function MenuSheet({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const unseen = useUnseenRelease();
  const [feedback, setFeedback] = useState(false);
  if (feedback) return <FeedbackSheet onClose={onClose} />;
  return (
    <Sheet label="Meny" onClose={onClose}>
      <div className="menu">
        {user.loggedIn ? (
          <div className="menu__account">
            <span className="muted small">Inloggad som</span>
            <AccountSwitcher label="" />
          </div>
        ) : null}
        <nav className="list">
          <Link to="/sok" className="item">
            <strong>Sök spelare</strong>
          </Link>
          <Link to="/konto" className="item">
            <strong>{user.loggedIn ? 'Konton' : 'Logga in med Rankedin'}</strong>
          </Link>
          {user.loggedIn && (
            <Link to="/admin" className="item">
              <strong>Admin</strong>
            </Link>
          )}
          <Link to="/hjalp" className="item">
            <strong>Hjälp</strong>
          </Link>
          <Link to="/nyheter" className="item">
            <strong>Nyheter</strong>
            {unseen && <span className="new-dot" aria-label="nytt" />}
          </Link>
          <button type="button" className="item item--button" onClick={() => setFeedback(true)}>
            <strong>Ge feedback</strong>
          </button>
        </nav>
        <p className="center">
          <LangSwitch />
        </p>
        <p className="center">
          <InstallButton />
        </p>
        <p className="muted small center">PadelAdmin {CURRENT_VERSION} · data från Rankedin</p>
      </div>
    </Sheet>
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
  const [full, setFull] = useFullWidth();
  return (
    <div className={`shell ${full ? 'shell--full' : ''}`}>
      <LoadingBar />
      {full ? (
        <button className="icon-btn show-sidebar" onClick={() => setFull(false)} title="Visa menyn" aria-label="Visa menyn">
          <PanelIcon />
        </button>
      ) : (
        <Sidebar onHide={() => setFull(true)} />
      )}
      <div className="shell__main">
        <OfflineBar />
        {children}
      </div>
      <TabBar />
    </div>
  );
}
