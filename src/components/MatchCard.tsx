import { Go } from './shell';
import type { Side } from '../lib/rankedin';
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
  /** Link to the whole team match (team leagues). */
  teamMatchPath?: string;
  /** Label for "back" on pages opened from this card. */
  from?: string;
};

export function MatchCard(p: Props) {
  const mine = (s: Side) => !!p.highlightIds?.some((id) => s.ids.includes(id));
  const when = p.showDay ? fmtDayTime(p.date) : fmtTime(p.date);
  return (
    <article className={`match ${p.sides.some(mine) ? 'match--mine' : ''}`}>
      <div className="match__meta">
        {when && <span className="match__time">{when}</span>}
        {p.court && <span className="pill">{p.court}</span>}
        {p.label && <span className="match__label">{p.label}</span>}
      </div>
      <div className="match__body">
        {p.sides.map((s, i) => (
          <div key={i} className={`match__side ${s.isWinner ? 'is-winner' : ''} ${mine(s) ? 'is-mine' : ''}`}>
            <span className="match__names">{s.names.length ? s.names.join(' / ') : 'Ej klart'}</span>
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
      {(p.refereeCode || p.canEnterResult || p.awaitingConfirmation || p.teamMatchPath) && (
        <div className="match__actions">
          {p.teamMatchPath && (
            <Go className="btn btn--ghost btn--small" to={p.teamMatchPath} from={p.from ?? 'Tillbaka'}>
              Hela lagmatchen
            </Go>
          )}
          {p.awaitingConfirmation && <span className="pill pill--warn">Väntar på bekräftelse</span>}
          {p.refereeCode && !p.played && (
            <Go className="btn btn--small" to={`/doma/${encodeURIComponent(p.refereeCode)}`} from={p.from ?? 'Tillbaka'}>
              Döm live
            </Go>
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
