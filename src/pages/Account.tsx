import { t } from '../lib/i18n';
import { InstallButton } from '../components/InstallButton';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader, Notice, Page, Section } from '../components/ui';
import { useSession } from '../session';

export default function Account() {
  const { user, login, logout, logoutAll, switchAccount } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const accounts = user.accounts;
  const showForm = accounts.length === 0 || adding;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      setPassword('');
      setEmail('');
      setAdding(false);
      setAdded(t('Kontot är tillagt och aktivt.'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader title={t('Konton')} />
      <Page>
        <div className="page-title">
          <h1>{t('Konton')}</h1>
        </div>
        {accounts.length > 0 && (
          <Section title={t('Inloggade Rankedin-konton')}>
            <ul className="card-list">
              {accounts.map((a) => {
                const active = user.loggedIn && user.playerId === a.playerId;
                return (
                  <li key={a.playerId} className="player-row">
                    <Link to={`/spelare/${a.rankedinId}`} className="player-row__link">
                      <span className="avatar" aria-hidden="true">
                        {a.name[0]}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        {active && <span className="pill">{t('Aktivt')}</span>}
                        <span className="muted small block">{a.rankedinId}</span>
                      </span>
                    </Link>
                    <span className="row gap account-actions">
                      {!active && (
                        <button className="btn btn--small" onClick={() => switchAccount(a.playerId)}>
                          {t('Använd')}
                        </button>
                      )}
                      <button className="btn btn--ghost btn--small" onClick={() => logout(a.playerId)} aria-label={t('Logga ut {name}', { name: a.name })}>
                        {t('Logga ut')}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {added && <Notice tone="ok">{added}</Notice>}
            <p className="muted small">
              {t('Det aktiva kontot används när du rapporterar resultat eller sätter uppställning. Du kan byta direkt i de vyerna också.')}
            </p>
            {!adding && (
              <div className="row gap">
                <button className="btn btn--primary" onClick={() => setAdding(true)}>
                  {t('+ Lägg till konto')}
                </button>
                {accounts.length > 1 && (
                  <button className="btn btn--ghost" onClick={() => logoutAll()}>
                    {t('Logga ut alla')}
                  </button>
                )}
              </div>
            )}
          </Section>
        )}

        <p className="center">
          <InstallButton />
        </p>

        {accounts.length > 0 && (
          <Section title={t('Verktyg')}>
            <div className="list">
              <Link to="/admin" className="item">
                <span className="item__main">
                  <strong>Admin</strong>
                  <span className="muted small block">{t('Klubbar och event du administrerar i Rankedin')}</span>
                </span>
              </Link>
              <Link to="/hjalp" className="item">
                <span className="item__main">
                  <strong>{t('Hjälp')}</strong>
                  <span className="muted small block">{t('Hur PadelAdmin fungerar')}</span>
                </span>
              </Link>
              <Link to="/nyheter" className="item">
                <span className="item__main">
                  <strong>{t('Nyheter')}</strong>
                  <span className="muted small block">{t('Vad som är nytt i PadelAdmin')}</span>
                </span>
              </Link>
            </div>
          </Section>
        )}

        {showForm && (
          <Section title={accounts.length ? t('Lägg till ett Rankedin-konto') : t('Logga in med Rankedin')}>
            <p className="muted">
              {accounts.length
                ? t('T.ex. ditt barns konto. Båda kontona är inloggade samtidigt.')
                : t('Behövs bara för att rapportera resultat och sätta uppställning. Du kan lägga till flera konton, t.ex. ditt eget och ditt barns.')}
            </p>
            <form className="stack" onSubmit={onSubmit}>
              <label className="field">
                <span>{t('E-post')}</span>
                <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="field">
                <span>{t('Lösenord')}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && <p className="field-error">{t(error)}</p>}
              <button className="btn btn--primary btn--block" disabled={busy}>
                {busy ? t('Loggar in…') : t('Logga in')}
              </button>
              {accounts.length > 0 && (
                <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdding(false)}>
                  {t('Avbryt')}
                </button>
              )}
            </form>
            <Notice tone="info">
              {t('Lösenordet skickas vidare till Rankedin och sparas inte. Appen behåller bara inloggningen (som en cookie) på den här enheten.')}
            </Notice>
          </Section>
        )}
      </Page>
    </>
  );
}
