// Organiser: pair up players without partner, or split a pair, per class.
import { useState } from 'react';
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
            <button className="btn btn--ghost btn--small" onClick={() => setFirst(null)}>
              Avbryt
            </button>
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
