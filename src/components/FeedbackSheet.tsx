import { useState } from 'react';
import { sendFeedback, type FeedbackKind } from '../lib/feedback';
import { useSession } from '../session';

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: 'idea', label: 'Idé' },
  { id: 'bug', label: 'Något är fel' },
  { id: 'other', label: 'Övrigt' },
];

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { user } = useSession();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState(''); // honeypot, hidden
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await sendFeedback({ kind, message, contact, website });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Lämna feedback" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden="true" />
        <h2>Lämna feedback</h2>
        {sent ? (
          <>
            <p className="notice notice--ok">Tack! Vi har tagit emot din feedback.</p>
            <div className="row gap">
              <button className="btn btn--primary" onClick={onClose}>
                Stäng
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">Vad saknas, vad krånglar, vad borde bli bättre? Allt hjälper.</p>
            <div className="chips chips--wrap" role="radiogroup" aria-label="Typ">
              {KINDS.map((k) => (
                <button key={k.id} role="radio" aria-checked={kind === k.id} className={`chip ${kind === k.id ? 'chip--on' : ''}`} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Meddelande</span>
              <textarea className="input textarea" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} autoFocus />
            </label>
            <label className="field">
              <span>E-post eller telefon (om du vill ha svar)</span>
              <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} />
            </label>
            <input className="visually-hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
            <p className="muted small">
              {user.loggedIn ? `Skickas som ${user.name}. ` : ''}Sidan du är på och appens version skickas med.
            </p>
            {error && <p className="notice notice--error small">{error}</p>}
            <div className="row gap">
              <button className="btn btn--primary" disabled={busy || message.trim().length < 3} onClick={send}>
                {busy ? 'Skickar…' : 'Skicka'}
              </button>
              <button className="btn btn--ghost" onClick={onClose}>
                Avbryt
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
