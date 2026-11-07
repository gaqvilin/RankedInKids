import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, Notice, Page, Section } from '../components/ui';
import { useSession } from '../session';

export default function Account() {
  const { user, login, logout } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      setPassword('');
      navigate(-1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppHeader back="history" title="Konto" />
      <Page>
        {user.loggedIn ? (
          <Section title="Inloggad">
            <p>
              Du är inloggad i Rankedin som <strong>{user.name}</strong>.
            </p>
            <button className="btn" onClick={() => logout()}>
              Logga ut
            </button>
          </Section>
        ) : (
          <Section title="Logga in med Rankedin">
            <p className="muted">
              Behövs bara för att rapportera slutresultat. Att se matcher och döma live med domarkod fungerar utan inloggning.
            </p>
            <form className="stack" onSubmit={onSubmit}>
              <label className="field">
                <span>E-post</span>
                <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="field">
                <span>Lösenord</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && <p className="field-error">{error}</p>}
              <button className="btn btn--primary btn--block" disabled={busy}>
                {busy ? 'Loggar in…' : 'Logga in'}
              </button>
            </form>
            <Notice tone="info">
              Lösenordet skickas vidare till Rankedin och sparas inte. Appen behåller bara inloggningen (som en cookie) på den här enheten.
            </Notice>
          </Section>
        )}
      </Page>
    </>
  );
}
