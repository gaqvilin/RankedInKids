import { Link } from 'react-router-dom';
import type { StandingRow } from '../lib/leagues';

export function StandingsTable({ rows, highlightTeamId, leagueId }: { rows: StandingRow[]; highlightTeamId?: number; leagueId?: number }) {
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
            <th title="Poäng">P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId || r.name} className={r.teamId === highlightTeamId ? 'is-mine' : ''}>
              <td>{r.position}</td>
              <td>
                {r.teamId ? <Link to={`/lag/${r.teamId}${leagueId ? `?liga=${leagueId}` : ''}`}>{r.name}</Link> : r.name}
              </td>
              <td>{r.played}</td>
              <td>
                {r.wins}–{r.losses}
              </td>
              <td>
                {r.matchesWon}–{r.matchesLost}
              </td>
              <td>
                <strong>{r.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Matcher = vunna och förlorade dubbelmatcher. P = tabellpoäng.</p>
    </>
  );
}
