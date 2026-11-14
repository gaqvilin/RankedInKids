import { Go } from './shell';
import type { Side } from '../lib/rankedin';
import { Tip } from './ui';
import { fmtDayTime, fmtTime } from '../lib/format';

type Props = {
  sides: [Side, Side];
  sets: [number, number][];
  played: boolean;
  date: string | null;
  court: string | null;
  label?: string;
  highlightIds?: number[];
  showDay?: boolean;
  refereeCode?: string | null;
  canEnterResult?: boolean;
  awaitingConfirmation?: boolean;
  onEnterResult?: () => void;
  /** Organiser: move the match to another time/court. */
  onMove?: () => void;
  /** Link to the whole team match (team leagues). */
  teamMatchPath?: string;
  /** Label for "back" on pages opened from this card. */
  from?: string;
};

export function MatchCard(p: Props) {
  const mine = (s: Side) => !!p.highlightIds?.some((id) => s.ids.includes(id));
  const when = p.showDay ? fmtDayTime(p.date) : fmtTime(p.date);
  const isMine = p.sides.some(mine);
  // "Pågår nu": started within the last 90 minutes and no result yet.
  const start = p.date ? Date.parse(p.date) : NaN;
  const live = !p.played && Number.isFinite(start) && Date.now() >= start && Date.now() < start + 90 * 60_000;
  const won = isMine && p.played ? p.sides.some((s) => mine(s) && s.isWinner) : null;
  return (
    <article className={`match ${isMine ? 'match--mine' : ''} ${live ? 'match--live' : ''} ${p.played ? 'match--played' : ''}`}>
      <div className="match__meta">
        {when && <span className="match__time">{when}</span>}
        {p.court && <span className="pill">{p.court}</span>}
        {live && (
          <span className="pill pill--live">
            <span className="live-dot" aria-hidden="true" />
            Pågår nu
          </span>
        )}
        {won !== null && <span className={`pill ${won ? 'pill--win' : 'pill--loss'}`}>{won ? 'Vinst' : 'Förlust'}</span>}
        {p.label && <span className="match__label">{p.label}</span>}
      </div>
      <div className="match__body">
        {p.sides.map((s, i) => (
          <div key={i} className={`match__side ${s.isWinner ? 'is-winner' : ''} ${mine(s) ? 'is-mine' : ''}`}>
            <span className="match__names">{s.names.length ? s.names.join(' / ') : 'Ej uttagna'}</span>
            <span className="match__sets">
              {p.sets.map((set, j) => (
                <span key={j} className={set[i] > set[1 - i] ? 'set set--won' : 'set'}>
                  {set[i]}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      {(p.refereeCode || p.canEnterResult || p.awaitingConfirmation || p.teamMatchPath || p.onMove) && (
        <div className="match__actions">
          {p.teamMatchPath && (
            <Go className="btn btn--ghost btn--small" to={p.teamMatchPath} from={p.from ?? 'Tillbaka'}>
              Hela lagmatchen
            </Go>
          )}
          {p.awaitingConfirmation && <span className="pill pill--warn">
              <Tip tip="Resultatet är rapporterat men inte bekräftat av motståndaren än.">Väntar på bekräftelse</Tip>
            </span>}
          {p.refereeCode && !p.played && (
            <Go className="btn btn--small" to={`/doma/${encodeURIComponent(p.refereeCode)}`} from={p.from ?? 'Tillbaka'}>
              Döm live
            </Go>
          )}
          {p.onMove && !p.played && (
            <button className="btn btn--ghost btn--small" onClick={p.onMove}>
              Flytta
            </button>
          )}
          {p.canEnterResult && p.onEnterResult && (
            <button className="btn btn--small" onClick={p.onEnterResult}>
              {p.played ? 'Ändra resultat' : 'Rapportera resultat'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
