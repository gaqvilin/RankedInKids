import { Logo } from './Logo';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { From } from './shell';

/**
 * Page top bar. The back link shows where it goes: the page we came from
 * (carried by <Go>), otherwise the given fallback.
 * back: a fallback path, or 'history' to go to the previous page.
 */
export function AppHeader({ title, back, backLabel }: { title?: string; back?: string; backLabel?: string }) {
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: From } | null)?.from;

  useEffect(() => {
    document.title = title ? `${title} · PadelAdmin` : 'PadelAdmin';
  }, [title]);

  const arrow = (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  let backEl: ReactNode = (
    <Link to="/" className="brand brand--mobile" aria-label="PadelAdmin start">
      <Logo size={20} />
    </Link>
  );
  if (from) {
    backEl = (
      <Link to={from.to} className="back-link">
        {arrow}
        <span>{from.label}</span>
      </Link>
    );
  } else if (back === 'history') {
    backEl = (
      <button className="back-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        {arrow}
        <span>{backLabel ?? 'Tillbaka'}</span>
      </button>
    );
  } else if (back) {
    backEl = (
      <Link to={back} className="back-link">
        {arrow}
        <span>{backLabel ?? 'Tillbaka'}</span>
      </Link>
    );
  }

  return (
    <header className={`app-header ${!from && !back ? 'app-header--root' : ''}`}>
      <div className="app-header__inner">
        {backEl}
        {loc.pathname !== '/sok' && (
          <Link to="/sok" className="header-search" aria-label="Sök spelare">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <main className={`page ${wide ? 'page--wide' : ''}`}>{children}</main>;
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
