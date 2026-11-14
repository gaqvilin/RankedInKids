// Organiser: pair up players without partner, or split a pair, per class.
import { useEffect, useState } from 'react';
import { getProfile, searchPlayers, type PlayerHit } from '../lib/rankedin';
import { t } from '../lib/i18n';
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

  if (entries.loading && !entries.data) return <Loading label={t('Hämtar anmälningar…')} />;
  if (entries.error) {
    const code = (entries.error as { code?: string }).code;
    return code === 'not_admin' ? null : <Notice tone="warn">{t(entries.error.message)}</Notice>;
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
      setMsg({ tone: 'error', text: t((e as Error).message) });
      entries.reload();
    } finally {
      setBusy(false);
    }
  }

  const name = (id: number) => singles.find((s) => s.player1!.id === id)?.player1?.name ?? '';
  return (
    <div className="pairing">
      <AccountSwitcher label={t('Ändras som')} />
      {locked && <Notice tone="warn">{t('{name} är redan lottad – par kan inte ändras här längre.', { name: className })}</Notice>}
      {msg && <Notice tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Notice>}

      {!locked && singles.length > 0 && (
        <>
          <p className="small">{first ? t('Välj partner till {name}:', { name: name(first) }) : t('Tryck på en spelare och sedan på den hen ska spela med.')}</p>
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
                    if (window.confirm(t('Para ihop {a} och {b} i {className}? Ändringen görs direkt i Rankedin.', { a: name(a), b: s.player1!.name, className }))) {
                      void run(() => pairPlayers(tournamentId, classId, a, id), t('{a} och {b} är nu ett par.', { a: name(a), b: s.player1!.name }));
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
                      t('Lägga till {b} som partner till {a} i {className}? {b} är inte anmäld i klassen än – Rankedin lägger in hen direkt. Kontrollera att hen har tävlingslicens.', {
                        a: name(a),
                        b: h.name,
                        className,
                      }),
                    )
                  ) {
                    void run(() => pairPlayers(tournamentId, classId, a, h.id), t('{a} och {b} är nu ett par.', { a: name(a), b: h.name }));
                  }
                }}
              />
              <button className="btn btn--ghost btn--small" onClick={() => setFirst(null)}>
                {t('Avbryt')}
              </button>
            </>
          )}
        </>
      )}

      {pairs.length > 0 && (
        <details className="fold">
          <summary>{t('Anmälda par ({n})', { n: pairs.length })}</summary>
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
                        if (window.confirm(t('Dela på {a} och {b}? Båda ligger kvar i {className} utan partner.', { a: p.player1!.name, b: p.player2!.name, className }))) {
                          void run(() => unpairPlayers(tournamentId, classId, p.entryId), t('{a} och {b} är nu utan partner.', { a: p.player1!.name, b: p.player2!.name }));
                        }
                      }}
                    >
                      {t('Dela på')}
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
      {busy && <Loading label={t('Ändrar i Rankedin…')} />}
    </div>
  );
}

/** Find a partner who is not entered in the class yet. */
export function OutsidePartner({
  onPick,
  exclude,
  disabled,
  label = t('Partnern är inte anmäld? Sök på namn:'),
}: {
  onPick: (h: PlayerHit) => void;
  exclude: number[];
  disabled: boolean;
  label?: string;
}) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<PlayerHit[] | null>(null);
  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) return setHits(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPlayers(q)
        .then((h) => !cancelled && setHits(h.filter((x) => !exclude.includes(x.id)).slice(0, 6)))
        .catch(() => !cancelled && setHits([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  return (
    <div className="outside-partner">
      <label className="field">
        <span className="small">{label}</span>
        <input className="input" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('t.ex. Eric FalkBoman')} autoComplete="off" />
      </label>
      {hits && hits.length === 0 && <p className="small muted">{t('Ingen träff.')}</p>}
      {hits && hits.length > 0 && (
        <div className="list">
          {hits.map((h) => (
            <button key={h.id} className="item item--button" disabled={disabled} onClick={() => onPick(h)}>
              <span className="item__main">
                <strong>{h.name}</strong>
                <HitDetails rankedinId={h.rankedinId} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Club and age, to tell namesakes apart. */
function HitDetails({ rankedinId }: { rankedinId: string }) {
  const p = useAsync(() => getProfile(rankedinId), [rankedinId], `profile.${rankedinId}`);
  const d = [p.data?.club, p.data?.age ? t('{n} år', { n: p.data.age }) : null].filter(Boolean).join(' · ');
  return <span className="muted small block">{d || rankedinId}</span>;
}
