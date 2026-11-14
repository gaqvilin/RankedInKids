// Shows when there is no connection, and results waiting to be sent to Rankedin (with conflicts to resolve).
import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import { discard, flush, overwrite, useOutbox } from '../lib/outbox';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const fmt = (sets: [number, number][] | null | undefined) => (sets === null ? t('inget resultat') : sets && sets.length ? sets.map(([a, b]) => `${a}–${b}`).join(' ') : t('ospelad'));

export function OfflineBar() {
  const online = useOnline();
  const queue = useOutbox();
  const [busy, setBusy] = useState(false);
  const waiting = queue.filter((q) => q.state === 'waiting');
  const problems = queue.filter((q) => q.state !== 'waiting');
  if (online && queue.length === 0) return null;
  return (
    <div className={`offline-bar ${online ? '' : 'is-offline'}`} role="status">
      {!online && <p>{t('Ingen anslutning – du ser det som senast hämtades. Resultat sparas i telefonen och skickas när nätet är tillbaka.')}</p>}
      {waiting.length > 0 && (
        <p>
          {waiting.length === 1 ? t('1 resultat väntar på att skickas till Rankedin') : t('{n} resultat väntar på att skickas till Rankedin', { n: waiting.length })}
          {waiting.some((w) => w.message) ? ` – ${t(waiting.find((w) => w.message)!.message!)}` : '.'}{' '}
          {online && (
            <button
              className="link-btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void flush().finally(() => setBusy(false));
              }}
            >
              {busy ? t('Skickar…') : t('Skicka nu')}
            </button>
          )}
        </p>
      )}
      {problems.map((q) => (
        <div key={q.challengeId} className="offline-bar__problem">
          <p>
            <strong>{q.title}</strong>:{' '}
            {q.state === 'conflict'
              ? t('Rankedin har redan {current}, du skrev {mine}.', { current: fmt(q.current), mine: fmt(q.sets) })
              : t('kunde inte skickas ({reason}).', { reason: q.message ? t(q.message) : t('okänt fel') })}
          </p>
          <div className="row gap">
            {q.state === 'conflict' && (
              <button className="btn btn--small" onClick={() => overwrite(q.challengeId)}>
                {t('Skicka mitt ({score})', { score: fmt(q.sets) })}
              </button>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => discard(q.challengeId)}>
              {q.state === 'conflict' ? t('Behåll Rankedins') : t('Släng')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
