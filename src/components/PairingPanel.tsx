// Organiser: pair up players without partner, or split a pair, per class.
import { useEffect, useState } from 'react';
import { searchPlayers, type PlayerHit } from '../lib/rankedin';
import { getClassEntries, pairPlayers, unpairPlayers, type PairEntry } from '../lib/pairing';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { AccountSwitcher } from './AccountSwitcher';
import { Loading, Notice } from './ui';

export function PairingPanel({ tournamentId, classId, className, onChanged }: { tournamentId: number; classId: number; className: string; onChanged: () => void }) {
  const { version } = useSession();
  const entries = useAsync(() => getClassEntries(tournamentId, classId), [tournamentId, classId, version]);
  const [first, setFirst] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (entries.loading && !entries.data) return <Loading label="Hämtar anmälningar…" />;
  if (entries.error) {
    const code = (entries.error as { code?: string }).code;
    return code === 'not_admin' ? null : <Notice tone="warn">{entries.error.message}</Notice>;
  }
  const list = entries.data ?? [];
  const singles = list.filter((e) => e.player1 && !e.player2);
  const pairs = list.filter((e) => e.player1 && e.player2);
  const locked = list.some((e) => e.drawCreated);

  async function run(action: () => Promise<PairEntry[]>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
      setMsg({ tone: 'ok', text: ok });
      setFirst(null);
      entries.reload();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
      entries.reload();
    } finally {
      setBusy(false);
    }
  }

  const name = (id: number) => singles.find((s) => s.player1!.id === id)?.player1?.name ?? '';
  return (
    <div className="pairing">
      <AccountSwitcher label="Ändras som" />
      {locked && <Notice tone="warn">{className} är redan lottad – par kan inte ändras här längre.</Notice>}
      {msg && <Notice tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Notice>}

      {!locked && singles.length > 0 && (
        <>
          <p className="small">{first ? `Välj partner till ${name(first)}:` : 'Tryck på en spelare och sedan på den hen ska spela med.'}</p>
          <div className="chips chips--wrap">
            {singles.map((s) => {
              const id = s.player1!.id;
              return (
                <button
                  key={s.entryId}
                  className={`chip ${first === id ? 'chip--on' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    if (!first) return setFirst(id);
                    if (first === id) return setFirst(null);
                    const a = first;
                    if (window.confirm(`Para ihop ${name(a)} och ${s.player1!.name} i ${className}? Ändringen görs direkt i Rankedin.`)) {
                      void run(() => pairPlayers(tournamentId, classId, a, id), `${name(a)} och ${s.player1!.name} är nu ett par.`);
                    }
                  }}
                >
                  {s.player1!.name}
                </button>
              );
            })}
          </div>
          {first && (
            <>
              <OutsidePartner
                disabled={busy}
                exclude={list.flatMap((e) => [e.player1?.id, e.player2?.id]).filter((x): x is number => !!x)}
                onPick={(h) => {
                  const a = first;
                  if (
                    window.confirm(
                      `Lägga till ${h.name} som partner till ${name(a)} i ${className}? ${h.name} är inte anmäld i klassen än – Rankedin lägger in hen direkt. Kontrollera att hen har tävlingslicens.`,
                    )
                  ) {
                    void run(() => pairPlayers(tournamentId, classId, a, h.id), `${name(a)} och ${h.name} är nu ett par.`);
                  }
                }}
              />
              <button className="btn btn--ghost btn--small" onClick={() => setFirst(null)}>
                Avbryt
              </button>
            </>
          )}
        </>
      )}

      {pairs.length > 0 && (
        <details className="fold">
          <summary>Anmälda par ({pairs.length})</summary>
          <div className="list">
            {pairs.map((p) => (
              <div key={p.entryId} className="item">
                <span className="item__main">
                  {p.player1!.name} / {p.player2!.name}
                </span>
                {!locked && (
                  <span className="item__side">
                    <button
                      className="btn btn--ghost btn--small"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Dela på ${p.player1!.name} och ${p.player2!.name}? Båda ligger kvar i ${className} utan partner.`)) {
                          void run(() => unpairPlayers(tournamentId, classId, p.entryId), `${p.player1!.name} och ${p.player2!.name} är nu utan partner.`);
                        }
                      }}
                    >
                      Dela på
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
      {busy && <Loading label="Ändrar i Rankedin…" />}
    </div>
  );
}

/** Find a partner who is not entered in the class yet. */
function OutsidePartner({ onPick, exclude, disabled }: { onPick: (h: PlayerHit) => void; exclude: number[]; disabled: boolean }) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<PlayerHit[] | null>(null);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) return setHits(null);
    let cancelled = false;
    const t = setTimeout(() => {
      searchPlayers(q)
        .then((h) => !cancelled && setHits(h.filter((x) => !exclude.includes(x.id))))
        .catch(() => !cancelled && setHits([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  return (
    <div className="outside-partner">
      <label className="field">
        <span className="small">Partnern är inte anmäld? Sök på namn:</span>
        <input className="input" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="t.ex. Eric FalkBoman" autoComplete="off" />
      </label>
      {hits && hits.length === 0 && <p className="small muted">Ingen träff.</p>}
      {hits && hits.length > 0 && (
        <div className="list">
          {hits.map((h) => (
            <button key={h.id} className="item item--button" disabled={disabled} onClick={() => onPick(h)}>
              <span className="item__main">
                <strong>{h.name}</strong>
                <span className="muted small block">{h.rankedinId}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
