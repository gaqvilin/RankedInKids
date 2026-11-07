import type { Fixture } from '../lib/leagues';
import { fmtDay } from '../lib/format';
import { Go } from './shell';

/**
 * One team match on one line, from a team's point of view:
 * "lör 28 nov  mot KINGS PC (borta)   5–1 ✓".
 */
export function FixtureRow({ f, teamId, from }: { f: Fixture; teamId: number; from: string }) {
  const home = f.home.id === teamId;
  const own = home ? f.home : f.away;
  const opp = home ? f.away : f.home;
  const result = f.played ? `${own.result}–${opp.result}` : '';
  const outcome = !f.played ? '' : own.isWinner ? 'V' : opp.isWinner ? 'F' : 'O';
  return (
    <Go to={`/lagmatch/${f.teamMatchId}`} from={from} className="item fixture-row">
      <span className="item__date">{fmtDay(f.date)}</span>
      <span className="item__main">
        mot <strong>{opp.name}</strong>
        <span className="muted small"> {home ? 'hemma' : 'borta'}</span>
        {f.isMyTeamCaptain && f.canEnterResult && <span className="tag tag--warn">Rapportera</span>}
      </span>
      {f.played && (
        <span className={`fixture-row__result fixture-row__result--${outcome}`} aria-label={`Resultat ${result}`}>
          {result}
        </span>
      )}
    </Go>
  );
}
