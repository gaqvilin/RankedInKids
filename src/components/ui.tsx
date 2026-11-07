import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../session';

/** back: a path, or 'history' to go to the previous page (falls back to start). */
export function AppHeader({ title, back }: { title?: string; back?: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const backArrow = (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <header className="app-header">
      <div className="app-header__inner">
        {back === 'history' ? (
          <button
            className="icon-btn"
            aria-label="Tillbaka"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          >
            {backArrow}
          </button>
        ) : back ? (
          <Link to={back} className="icon-btn" aria-label="Tillbaka">
            {backArrow}
          </Link>
        ) : (
          <Link to="/" className="brand" aria-label="Padelkids start">
            <span className="brand__ball" aria-hidden="true" />
            Padelkids
          </Link>
        )}
        {title && <h1 className="app-header__title">{title}</h1>}
        <Link to="/konto" className="account-chip" aria-label="Konto">
          {user.loggedIn ? initials(user.name) : 'Logga in'}
        </Link>
      </div>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page">{children}</main>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label = 'Hämtar från Rankedin…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="notice notice--error" role="alert">
      <p>{error.message || 'Något gick fel.'}</p>
      {onRetry && (
        <button className="btn btn--small" onClick={onRetry}>
          Försök igen
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="ext-link">
      {children}
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button className="btn btn--ghost btn--small" onClick={onClick} disabled={loading} aria-label="Uppdatera">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className={loading ? 'spin' : ''}>
        <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Uppdatera
    </button>
  );
}
