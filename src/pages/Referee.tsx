import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader, ErrorBox, Loading, Notice, Page } from '../components/ui';
import { RefereeSession, toScoreView, type LivePlayer, type RefereeState } from '../lib/live';
import { useSession } from '../session';

const names = (ps: LivePlayer[] | null | undefined) =>
  (ps || []).filter((p) => p.id).map((p) => `${p.firstName} ${p.lastName}`.trim());

export default function Referee() {
  const { code = '' } = useParams();
  const { user, ready } = useSession();
  const session = useRef<RefereeSession | null>(null);
  const [state, setState] = useState<RefereeState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const load = useCallback(() => {
    const s = new RefereeSession(code, user.loggedIn ? user.playerId : 0);
    session.current = s;
    setError(null);
    s.init().then(setState).catch(setError);
  }, [code, user]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Keep the phone screen on while refereeing.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  async function act(fn: (s: RefereeSession) => Promise<RefereeState>) {
    if (!session.current || busy) return;
    setBusy(true);
    try {
      setState(await fn(session.current));
      setError(null);
      navigator.vibrate?.(15);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
    return (
      <>
        <AppHeader back="history" title="Döma" />
        <Page>
          <ErrorBox error={error} onRetry={load} />
          <p className="muted small">Domarkoden finns på matchen i Rankedin (eller under ”Kommande matcher” här i appen).</p>
        </Page>
      </>
    );
  }
  if (!state) {
    return (
      <>
        <AppHeader back="history" title="Döma" />
        <Page>
          <Loading label="Ansluter till matchen…" />
        </Page>
      </>
    );
  }

  const view = toScoreView(state.score);
  const sides = [names(state.firstParticipant), names(state.secondParticipant)];
  const ended = !!state.termination?.isMatchEnded;
  const endSuggested = !!state.termination?.isEndMatchSuggested && !ended;
  const notStarted = view.sets.length === 0 && view.points[0] === '0' && view.points[1] === '0' && !view.inTiebreak;
  const needsServe = notStarted && state.serve?.isFirstParticipantServing == null;
  const settings = state.settings;
  const askSettings = notStarted && settings && (settings.askForSuperTieBreak || settings.askForMatchGamesCount);
  const serving = state.serve?.isFirstParticipantServing;

  return (
    <>
      <AppHeader back="history" title="Döma" />
      <Page>
        <p className="muted small center">{state.matchDetails?.eventName}</p>

        {error && <ErrorBox error={error} onRetry={load} />}

        {askSettings && settings && (
          <div className="card">
            <h2 className="h3">Matchformat</h2>
            {settings.askForMatchGamesCount && (
              <label className="field">
                <span>Game per set</span>
                <select
                  className="input"
                  value={settings.matchGamesCount}
                  onChange={(e) => act((s) => s.updateSettings({ ...settings, matchGamesCount: Number(e.target.value) }))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {settings.askForSuperTieBreak && (
              <label className="field field--row">
                <input
                  type="checkbox"
                  checked={settings.useSuperTieBreak}
                  onChange={(e) => act((s) => s.updateSettings({ ...settings, useSuperTieBreak: e.target.checked }))}
                />
                <span>Supertiebreak som avgörande set</span>
              </label>
            )}
          </div>
        )}

        {needsServe ? (
          <div className="card">
            <h2 className="h3">Vem servar först?</h2>
            <div className="serve-grid">
              {[true, false].map((first) => (
                <button key={String(first)} className="btn btn--block" disabled={busy} onClick={() => act((s) => s.serve(first, false))}>
                  {sides[first ? 0 : 1].join(' / ')}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="scoreboard" aria-live="polite">
            {[0, 1].map((i) => (
              <div key={i} className={`scoreboard__row ${serving === (i === 0) ? 'is-serving' : ''}`}>
                <div className="scoreboard__names">
                  {sides[i].map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
                <div className="scoreboard__sets">
                  {view.sets.map((s, j) => (
                    <span key={j} className={s[i] > s[1 - i] ? 'won' : ''}>
                      {s[i]}
                    </span>
                  ))}
                </div>
                <div className="scoreboard__points">{view.points[i]}</div>
              </div>
            ))}
            {view.inTiebreak && <p className="scoreboard__tag">Tiebreak</p>}
          </div>
        )}

        {ended ? (
          <Notice tone="ok">
            <strong>Matchen är avslutad</strong> och resultatet ligger i Rankedin.
          </Notice>
        ) : (
          !needsServe && (
            <>
              <div className="point-buttons">
                {[0, 1].map((i) => (
                  <button key={i} className={`point-btn point-btn--${i}`} disabled={busy || endSuggested} onClick={() => act((s) => s.point(i === 0))}>
                    <span className="point-btn__plus">+1</span>
                    <span className="point-btn__name">{sides[i].map((n) => n.split(' ')[0]).join(' & ')}</span>
                  </button>
                ))}
              </div>
              <div className="row gap center">
                <button className="btn" disabled={busy || notStarted} onClick={() => act((s) => s.undo())}>
                  Ångra
                </button>
                {!confirmEnd ? (
                  <button className={`btn ${endSuggested ? 'btn--primary' : 'btn--ghost'}`} disabled={busy} onClick={() => setConfirmEnd(true)}>
                    Avsluta match
                  </button>
                ) : (
                  <button
                    className="btn btn--danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmEnd(false);
                      act((s) => s.end());
                    }}
                  >
                    Ja, avsluta och spara
                  </button>
                )}
              </div>
              {endSuggested && <Notice tone="info">Matchen ser klar ut. Tryck ”Avsluta match” för att spara resultatet, eller ”Ångra”.</Notice>}
            </>
          )
        )}
      </Page>
    </>
  );
}
