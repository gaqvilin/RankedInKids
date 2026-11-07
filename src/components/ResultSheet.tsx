import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitResult } from '../lib/api';
import { summarizeSets, type SetScore } from '../../api/_lib/result';
import type { Side } from '../lib/rankedin';
import { useSession } from '../session';

type Props = {
  challengeId: number;
  sides: [Side, Side];
  initial?: SetScore[];
  onClose: () => void;
  onDone: () => void;
};

const PRESETS: { label: string; sets: number }[] = [
  { label: '1 set / supertiebreak', sets: 1 },
  { label: 'Bäst av 3', sets: 3 },
];

export function ResultSheet({ challengeId, sides, initial, onClose, onDone }: Props) {
  const { user } = useSession();
  const [sets, setSets] = useState<(string | number)[][]>(
    initial && initial.length ? initial.map((s) => [s[0], s[1]]) : [['', '']],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = sets
    .filter((s) => s[0] !== '' || s[1] !== '')
    .map((s) => [Number(s[0]), Number(s[1])] as SetScore);
  let summary: { p1: number; p2: number } | null = null;
  let validation: string | null = null;
  try {
    summary = summarizeSets(parsed);
  } catch (e) {
    validation = (e as Error).message;
  }

  const update = (i: number, j: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2);
    setSets((prev) => prev.map((s, k) => (k === i ? s.map((x, m) => (m === j ? clean : x)) : s)));
  };

  async function send() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      await submitResult(challengeId, parsed);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Rapportera resultat" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden="true" />
        <h2>Rapportera resultat</h2>
        {!user.loggedIn ? (
          <>
            <p className="muted">För att skicka resultat till Rankedin behöver du logga in med ditt Rankedin-konto.</p>
            <Link className="btn btn--primary btn--block" to="/konto">
              Logga in
            </Link>
          </>
        ) : (
          <>
            <div className="presets">
              {PRESETS.map((p) => (
                <button
                  key={p.sets}
                  className={`chip ${sets.length === p.sets ? 'chip--on' : ''}`}
                  onClick={() => setSets(Array.from({ length: p.sets }, (_, i) => sets[i] ?? ['', '']))}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <table className="score-table">
              <thead>
                <tr>
                  <th />
                  {sets.map((_, i) => (
                    <th key={i}>Set {i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sides.map((side, j) => (
                  <tr key={j}>
                    <th scope="row">{side.names.join(' / ') || `Lag ${j + 1}`}</th>
                    {sets.map((s, i) => (
                      <td key={i}>
                        <input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label={`Set ${i + 1}, ${side.names.join(' och ')}`}
                          value={s[j]}
                          onChange={(e) => update(i, j, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row gap">
              {sets.length < 5 && (
                <button className="btn btn--ghost btn--small" onClick={() => setSets([...sets, ['', '']])}>
                  + Set
                </button>
              )}
              {sets.length > 1 && (
                <button className="btn btn--ghost btn--small" onClick={() => setSets(sets.slice(0, -1))}>
                  − Set
                </button>
              )}
            </div>
            <p className="muted small">Supertiebreak skrivs som ett eget set, t.ex. 10–8.</p>
            {parsed.length > 0 && validation && <p className="field-error">{validation}</p>}
            {summary && (
              <p className="result-summary">
                Vinnare: <strong>{(summary.p1 > summary.p2 ? sides[0] : sides[1]).names.join(' / ')}</strong> ({summary.p1}–{summary.p2} i set)
              </p>
            )}
            {error && <p className="field-error">{error}</p>}
            <button className="btn btn--primary btn--block" disabled={!summary || busy} onClick={send}>
              {busy ? 'Skickar…' : 'Skicka till Rankedin'}
            </button>
          </>
        )}
        <button className="btn btn--ghost btn--block" onClick={onClose}>
          Avbryt
        </button>
      </div>
    </div>
  );
}
