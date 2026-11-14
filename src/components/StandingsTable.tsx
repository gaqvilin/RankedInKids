import { Go } from './shell';
import { Tip } from './ui';
import { t } from '../lib/i18n';
import type { StandingRow } from '../lib/leagues';

export function StandingsTable({ rows, highlightTeamId, leagueId, from }: { rows: StandingRow[]; highlightTeamId?: number; leagueId?: number; from: string }) {
  const hasPoints = rows.some((r) => r.points > 0);
  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('Lag')}</th>
            <th>
              <Tip tip={t('Spelade lagmatcher')}>{t('S')}</Tip>
            </th>
            <th>
              <Tip tip={t('Vunna–förlorade lagmatcher')}>{t('V–F')}</Tip>
            </th>
            <th>
              <Tip tip={t('Vunna–förlorade matcher (par mot par)')}>{t('Matcher')}</Tip>
            </th>
            {hasPoints && (
              <th>
                <Tip tip={t('Poäng i serien')}>{t('P')}</Tip>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId || r.name} className={r.teamId === highlightTeamId ? 'is-mine' : ''}>
              <td>{r.position}</td>
              <td>
                {r.teamId ? (
                  <Go to={`/lag/${r.teamId}${leagueId ? `?liga=${leagueId}` : ''}`} from={from}>
                    {r.name}
                  </Go>
                ) : (
                  r.name
                )}
              </td>
              <td>{r.played}</td>
              <td>
                {r.wins}–{r.losses}
              </td>
              <td>
                {r.matchesWon}–{r.matchesLost}
              </td>
              {hasPoints && (
                <td>
                  <strong>{r.points}</strong>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{t('Matcher = vunna och förlorade dubbelmatcher')}{hasPoints ? t('. P = tabellpoäng') : ''}.</p>
    </>
  );
}
