// Organiser: move one match to another time and court, the way Rankedin's court planner does.
// Only free cells can be picked, players already playing at that time are flagged, and the move is read back.
import { useState } from 'react';
import { getPlanner, moveMatch } from '../lib/draws';
import { fmtTime } from '../lib/format';
import type { TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { Sheet } from './Sheet';
import { ErrorBox, Loading } from './ui';

export function MoveSheet({
  tournamentId,
  match,
  all,
  onClose,
  onDone,
}: {
  tournamentId: number;
  match: TournamentMatch;
  all: TournamentMatch[];
  onClose: () => void;
  onDone: () => void;
}) {
  const planner = useAsync(() => getPlanner(tournamentId), [tournamentId]);
  const [time, setTime] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = match.sides.map((s) => s.names.map((n) => n.split(' ')[0]).join(' / ')).join(' – ');
  const ids = match.sides.flatMap((s) => s.ids);
  // Who in this match already plays at a given time (another match).
  const clash = (t: string) =>
    all
      .filter((m) => m.id !== match.id && fmtTime(m.date) === t && m.sides.some((s) => s.ids.some((id) => ids.includes(id))))
      .flatMap((m) => m.sides.filter((s) => s.ids.some((id) => ids.includes(id))).map((s) => s.names.map((n) => n.split(' ')[0]).join(' / ')));

  const p = planner.data;
  const free = (t: string) => (p ? p.courts.filter((c) => !p.busy.some((b) => b.courtId === c.id && b.time === t && b.challengeId !== match.id)) : []);
  const court = p?.courts.find((c) => c.id === courtId);
  const clashes = time ? clash(time) : [];

  async function move() {
    if (!time || !courtId) return;
    setBusy(true);
    setError(null);
    try {
      await moveMatch(tournamentId, match.id, courtId, time);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label="Flytta match" onClose={onClose}>
      <h2>Flytta match</h2>
      <p>
        <strong>{names}</strong>
        <br />
        <span className="muted">
          Nu: {fmtTime(match.date) || 'ingen tid'}
          {match.court ? ` · ${match.court}` : ''} · {match.className}
        </span>
      </p>
      {planner.error && <ErrorBox error={planner.error} onRetry={() => planner.reload()} />}
      {!p && planner.loading && <Loading label="Hämtar banplaneringen…" />}
      {p && (
        <>
          <h3 className="h3">Ny tid</h3>
          <div className="chips chips--wrap">
            {p.slots.map((t) => {
              const n = free(t).length;
              return (
                <button
                  key={t}
                  className={`chip ${time === t ? 'chip--on' : ''}`}
                  disabled={n === 0}
                  onClick={() => {
                    setTime(t);
                    setCourtId(null);
                  }}
                >
                  {t}
                  {n === 0 ? ' (fullt)' : ''}
                </button>
              );
            })}
          </div>
          {time && clashes.length > 0 && <p className="field-error">{clashes.join(', ')} spelar redan kl {time}. Välj en annan tid.</p>}
          {time && clashes.length === 0 && (
            <>
              <h3 className="h3">Bana kl {time}</h3>
              <div className="chips chips--wrap">
                {free(time).map((c) => (
                  <button key={c.id} className={`chip ${courtId === c.id ? 'chip--on' : ''}`} onClick={() => setCourtId(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn--primary btn--block" disabled={!time || !court || clashes.length > 0 || busy} onClick={move}>
            {busy ? 'Flyttar…' : time && court ? `Flytta till ${time} · ${court.name}` : 'Välj tid och bana'}
          </button>
          <p className="muted small">Flytten görs direkt i Rankedin och syns för alla. Säg till spelarna om den nya tiden.</p>
        </>
      )}
      <button className="btn btn--ghost btn--block" onClick={onClose}>
        Avbryt
      </button>
    </Sheet>
  );
}
