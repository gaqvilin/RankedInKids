import { Go } from './shell';
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
            <th title="Spelade">S</th>
            <th title="Vunna-förlorade">V–F</th>
            <th title="Matcher vunna-förlorade">Matcher</th>
            {hasPoints && <th title="Poäng">P</th>}
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
