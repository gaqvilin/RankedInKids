import { t } from '../lib/i18n';
import { useState } from 'react';
import { sendFeedback } from '../lib/feedback';
import { Sheet } from './Sheet';

/** As short as possible: one text field, optional contact, send. */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
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
      await sendFeedback({ kind: 'other', message, contact, website });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label={t('Ge feedback')} onClose={onClose}>
      <h2>{t('Ge feedback')}</h2>
      {sent ? (
        <>
          <p>{t('Tack! Vi läser allt.')}</p>
          <button className="btn btn--primary" onClick={onClose}>
            {t('Stäng')}
          </button>
        </>
      ) : (
        <>
          <textarea
            className="input textarea"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            placeholder={t('Vad krånglar, vad saknas, vad kan bli bättre?')}
            aria-label={t('Feedback')}
            autoFocus
          />
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            placeholder={t('E-post eller telefon (valfritt)')}
            aria-label={t('Kontakt')}
          />
          <input className="visually-hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
          {error && <p className="notice notice--error small">{t(error)}</p>}
          <div className="row gap">
            <button className="btn btn--primary" disabled={busy || message.trim().length < 3} onClick={send}>
              {busy ? t('Skickar…') : t('Skicka')}
            </button>
            <button className="btn btn--ghost" onClick={onClose}>
              {t('Avbryt')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
