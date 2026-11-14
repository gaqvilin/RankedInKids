// The day's matches as a board: one column per start time, a card per match (sorted by court).
import { useState } from 'react';
import { fmtTime } from '../lib/format';
import { t } from '../lib/i18n';
import type { TournamentMatch } from '../lib/rankedin';
import type { MatchStatus } from '../lib/matchStatus';
import { MatchCard } from './MatchCard';

export type MatchView = 'lista' | 'tavla';
const KEY = 'padeladmin.matchView';

/** List or board, remembered on this device. */
export function useMatchView(): [MatchView, (v: MatchView) => void] {
  const [view, setView] = useState<MatchView>(() => {
    try {
      return localStorage.getItem(KEY) === 'tavla' ? 'tavla' : 'lista';
    } catch {
      return 'lista';
    }
  });
  const set = (v: MatchView) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* private mode */
    }
  };
  return [view, set];
}

export function MatchViewToggle({ view, onChange }: { view: MatchView; onChange: (v: MatchView) => void }) {
  return (
    <span className="seg" role="group" aria-label={t('Visa matcher som')}>
      {(['lista', 'tavla'] as const).map((v) => (
        <button key={v} className={`seg__btn ${view === v ? 'is-on' : ''}`} aria-pressed={view === v} onClick={() => onChange(v)}>
          {v === 'lista' ? t('Lista') : t('Tavla')}
        </button>
      ))}
    </span>
  );
}

/** Matches grouped by start time ("10:00"), times in order; matches without a time last. */
export function boardColumns(matches: TournamentMatch[]): { time: string; matches: TournamentMatch[] }[] {
  const cols = new Map<string, TournamentMatch[]>();
  const sorted = [...matches].sort(
    (a, b) => (a.date ? Date.parse(a.date) : Infinity) - (b.date ? Date.parse(b.date) : Infinity) || (a.court || '').localeCompare(b.court || '', 'sv'),
  );
  for (const m of sorted) {
    const time = fmtTime(m.date) || 'Ingen tid';
    cols.set(time, [...(cols.get(time) || []), m]);
  }
  return [...cols].map(([time, ms]) => ({ time, matches: ms }));
}

export function MatchBoard({
  matches,
  highlight,
  showClass,
  onEnterResult,
  onMove,
  status,
}: {
  matches: TournamentMatch[];
  highlight: number[];
  showClass: boolean;
  onEnterResult: (m: TournamentMatch) => void;
  onMove?: (m: TournamentMatch) => void;
  /** Live/waiting per match id, from matchStatus() over all the day's matches. */
  status?: Map<number, MatchStatus>;
}) {
  return (
    <div className="board">
      {boardColumns(matches).map((col) => {
        const played = col.matches.filter((m) => m.played).length;
        const time = col.time === 'Ingen tid' ? t('Ingen tid') : col.time;
        return (
          <section key={col.time} className="board__col" aria-label={time}>
            <header className="board__head">
              <strong>{time}</strong>
              <span className="muted small">
                {played === col.matches.length ? t('Klart') : t('{n} av {total} spelade', { n: played, total: col.matches.length })}
              </span>
            </header>
            {col.matches.map((m) => (
              <MatchCard
                key={m.id}
                challengeId={m.id}
                sides={m.sides}
                sets={m.sets}
                played={m.played}
                date={m.date}
                hideTime
                status={status ? (status.get(m.id) ?? null) : undefined}
                court={m.court}
                label={showClass ? m.className : undefined}
                playoff={m.playoff}
                highlightIds={highlight}
                canEnterResult={m.canEnterResult}
                awaitingConfirmation={m.awaitingConfirmation}
                onEnterResult={() => onEnterResult(m)}
                onMove={onMove ? () => onMove(m) : undefined}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
