import { useState } from 'react';
import { Go } from './shell';
import { ErrorBox, Loading, Tip } from './ui';
import { getAvailability, setAvailability, STATUS_LABEL, type AvailabilityStatus } from '../lib/availability';
import type { TeamPlayer } from '../lib/leagues';
import { fmtDay } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

const ORDER: AvailabilityStatus[] = ['yes', 'maybe', 'no'];

/** "Kan du spela?" for one team and one round day. */
export function AvailabilityPanel({ teamId, date, players, from }: { teamId: number; date: string; players: TeamPlayer[]; from: string }) {
  const { user, version } = useSession();
  const av = useAsync(() => (user.loggedIn ? getAvailability(teamId, date) : Promise.resolve(null)), [teamId, date, user.loggedIn, version]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user.loggedIn) {
    return (
      <p className="muted">
        <Go to="/konto" from={from}>
          Logga in
        </Go>{' '}
        med ett Rankedin-konto i laget för att svara och se vilka som kan spela {fmtDay(date).replace(/\.$/, '')}.
      </p>
    );
  }
  if (av.error) return <ErrorBox error={av.error} onRetry={() => av.reload()} />;
  if (!av.data) return <Loading />;

  const a = av.data;
  const byPlayer = new Map(a.entries.map((e) => [e.playerId, e]));
  const counts = ORDER.map((s) => [s, a.entries.filter((e) => e.status === s).length] as const);
  const unanswered = players.filter((p) => !byPlayer.has(p.id)).length;

  async function answer(playerId: number, status: AvailabilityStatus) {
    setBusy(playerId);
    setError(null);
    try {
      await setAvailability(teamId, date, playerId, status);
      av.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="small">
        {counts.map(([s, n]) => (
          <span key={s} className={`avail-count avail-count--${s}`}>
            {STATUS_LABEL[s]}: <strong>{n}</strong>
          </span>
        ))}
        <span className="avail-count">Inte svarat: {unanswered}</span>
      </p>
      {error && <p className="field-error">{error}</p>}
      <div className="list">
        {players.map((p) => {
          const e = byPlayer.get(p.id);
          const isMe = a.me.includes(p.rankedinId);
          const canEdit = isMe || a.isCaptain;
          return (
            <div key={p.id} className={`item avail-row ${isMe ? 'is-mine' : ''}`}>
              <span className="item__main">
                {p.name}
                {isMe && <span className="tag">Du</span>}
                {!p.hasLicense && <span className="tag tag--warn">
                    <Tip tip="Spelaren har ingen giltig tävlingslicens i Rankedin för i år.">Licens saknas</Tip>
                  </span>}
                {e && e.updatedBy !== p.name && <span className="muted small block">satt av {e.updatedBy}</span>}
              </span>
              {canEdit ? (
                <span className="seg" role="group" aria-label={`Kan ${p.name} spela?`}>
                  {ORDER.map((s) => (
                    <button
                      key={s}
                      className={`seg__btn seg__btn--${s} ${e?.status === s ? 'is-on' : ''}`}
                      disabled={busy === p.id}
                      aria-pressed={e?.status === s}
                      onClick={() => answer(p.id, s)}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </span>
              ) : (
                <span className={`avail-status avail-status--${e?.status ?? 'none'}`}>{e ? STATUS_LABEL[e.status] : '–'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
