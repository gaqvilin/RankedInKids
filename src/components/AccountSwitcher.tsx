import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../session';

/**
 * Shows which Rankedin account an action will be done as, and lets the user
 * switch when several accounts are logged in (e.g. parent and child).
 */
export function AccountSwitcher({ label = 'Görs som' }: { label?: string }) {
  const { user, switchAccount } = useSession();
  const [busy, setBusy] = useState(false);
  if (!user.loggedIn) return null;

  if (user.accounts.length < 2) {
    return (
      <p className="account-line">
        {label} <strong>{user.name}</strong> ·{' '}
        <Link to="/konto">Lägg till konto</Link>
      </p>
    );
  }

  return (
    <label className="account-line">
      <span>{label}</span>
      <select
        className="input input--inline"
        value={user.playerId}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            await switchAccount(Number(e.target.value));
          } finally {
            setBusy(false);
          }
        }}
      >
        {user.accounts.map((a) => (
          <option key={a.playerId} value={a.playerId}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
