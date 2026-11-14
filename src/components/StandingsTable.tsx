import { Go } from './shell';
import { Tip } from './ui';
import type { StandingRow } from '../lib/leagues';

export function StandingsTable({ rows, highlightTeamId, leagueId, from }: { rows: StandingRow[]; highlightTeamId?: number; leagueId?: number; from: string }) {
  const hasPoints = rows.some((r) => r.points > 0);
  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Lag</th>
            <th>
              <Tip tip="Spelade lagmatcher">S</Tip>
            </th>
            <th>
              <Tip tip="Vunna–förlorade lagmatcher">V–F</Tip>
            </th>
            <th>
              <Tip tip="Vunna–förlorade matcher (par mot par)">Matcher</Tip>
            </th>
            {hasPoints && (
              <th>
                <Tip tip="Poäng i serien">P</Tip>
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
      <p className="muted small">Matcher = vunna och förlorade dubbelmatcher{hasPoints ? '. P = tabellpoäng' : ''}.</p>
    </>
  );
}
