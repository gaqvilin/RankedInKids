import { Go } from './shell';
import type { Fixture } from '../lib/leagues';
import { fmtDay, fmtTime } from '../lib/format';

export function FixtureCard({ f, highlightTeamId, from }: { f: Fixture; highlightTeamId?: number; from: string }) {
  const teams = [f.home, f.away];
  const time = fmtTime(f.date);
  return (
    <Go to={`/lagmatch/${f.teamMatchId}`} from={from} className={`match fixture ${teams.some((t) => t.id === highlightTeamId) ? 'match--mine' : ''}`}>
      <div className="match__meta">
        {f.date && <span className="match__time">{fmtDay(f.date)}{time ? ` ${time}` : ''}</span>}
        {f.round != null && <span className="pill">Omg. {f.round}</span>}
        {f.location && <span className="match__label">{f.location}</span>}
      </div>
      <div className="match__body">
        {teams.map((t) => (
          <div key={t.id} className={`match__side ${t.isWinner ? 'is-winner' : ''} ${t.id === highlightTeamId ? 'is-mine' : ''}`}>
            <span className="match__names">{t.name}</span>
            <span className="match__sets">{f.played && <span className={t.isWinner ? 'set set--won' : 'set'}>{t.result}</span>}</span>
          </div>
        ))}
      </div>
      {(f.canEnterResult || f.isMyTeamCaptain) && (
        <div className="match__actions">
          {f.isMyTeamCaptain && <span className="pill">Du är lagkapten</span>}
          {f.canEnterResult && <span className="pill pill--warn">Resultat kan rapporteras (lagkapten)</span>}
        </div>
      )}
    </Go>
  );
}
