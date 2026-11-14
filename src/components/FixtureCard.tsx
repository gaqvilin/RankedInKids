import { Go } from './shell';
import type { Fixture } from '../lib/leagues';
import { fmtDay, fmtTime } from '../lib/format';
import { t } from '../lib/i18n';

export function FixtureCard({ f, highlightTeamId, from }: { f: Fixture; highlightTeamId?: number; from: string }) {
  const teams = [f.home, f.away];
  const time = fmtTime(f.date);
  return (
    <Go to={`/lagmatch/${f.teamMatchId}`} from={from} className={`match fixture ${teams.some((x) => x.id === highlightTeamId) ? 'match--mine' : ''}`}>
      <div className="match__meta">
        {f.date && <span className="match__time">{fmtDay(f.date)}{time ? ` ${time}` : ''}</span>}
        {f.round != null && <span className="pill">{t('Omg. {n}', { n: f.round })}</span>}
        {f.location && <span className="match__label">{f.location}</span>}
      </div>
      <div className="match__body">
        {teams.map((x) => (
          <div key={x.id} className={`match__side ${x.isWinner ? 'is-winner' : ''} ${x.id === highlightTeamId ? 'is-mine' : ''}`}>
            <span className="match__names">{x.name}</span>
            <span className="match__sets">{f.played && <span className={x.isWinner ? 'set set--won' : 'set'}>{x.result}</span>}</span>
          </div>
        ))}
      </div>
      {(f.canEnterResult || f.isMyTeamCaptain) && (
        <div className="match__actions">
          {f.isMyTeamCaptain && <span className="pill">{t('Du är lagkapten')}</span>}
          {f.canEnterResult && <span className="pill pill--warn">{t('Resultat kan rapporteras (lagkapten)')}</span>}
        </div>
      )}
    </Go>
  );
}
