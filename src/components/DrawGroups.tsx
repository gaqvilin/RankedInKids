// The class's groups like Rankedin's "Draws": official table first, then the grid of who meets whom.
import { fmtTime } from '../lib/format';
import { getClassDraws, type DrawGroup, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { Section } from './ui';

export function DrawGroups({ classId, matches, highlight, refreshKey }: { classId: number; matches: TournamentMatch[]; highlight: number[]; refreshKey: string }) {
  const draws = useAsync((fresh) => getClassDraws(classId, fresh), [classId, refreshKey], `draws.${classId}`);
  if (!draws.data?.length) return null;
  return (
    <Section title={draws.data.length > 1 ? 'Grupper' : 'Grupp'}>
      <div className="draw-groups">
        {draws.data.map((g) => (
          <Group key={g.name} g={g} matches={matches} highlight={highlight} />
        ))}
      </div>
    </Section>
  );
}

function Group({ g, matches, highlight }: { g: DrawGroup; matches: TournamentMatch[]; highlight: number[] }) {
  const mine = (ids: number[]) => highlight.some((h) => ids.includes(h));
  const short = (names: string[]) => names.map((n) => n.split(' ')[0]).join(' / ');
  // Result from the row pair's point of view, e.g. "6–3".
  const result = (rowIds: number[], cell: { matchId: number; challengeId: number }) => {
    const m = matches.find((x) => x.id === cell.matchId || x.id === cell.challengeId);
    if (!m || !m.played || !m.sets.length) return null;
    const rowFirst = m.sides[0].ids.some((id) => rowIds.includes(id));
    const sets = m.sets.map(([a, b]) => (rowFirst ? `${a}–${b}` : `${b}–${a}`)).join(' ');
    const won = rowFirst ? m.sides[0].isWinner : m.sides[1].isWinner;
    return { sets, won };
  };
  const anyPlayed = g.standings.some((s) => s.played > 0);
  return (
    <div className="draw-group">
      <h3 className="h3">{g.name}</h3>
      <div className="table-scroll">
      <table className="table draw-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Par</th>
            <th title="Spelade">S</th>
            <th title="Vunna–förlorade">V–F</th>
            <th title="Game">Game</th>
            <th title="Poäng">P</th>
          </tr>
        </thead>
        <tbody>
          {(anyPlayed ? g.standings : g.pairs.map((p, i) => ({ position: i + 1, names: p.names, ids: p.ids, played: 0, wins: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0 }))).map((s) => (
            <tr key={s.ids.join('-')} className={mine(s.ids) ? 'is-mine' : ''}>
              <td>{anyPlayed ? s.position : '–'}</td>
              <td title={s.names.join(' / ')}>
                <span className="only-wide">{s.names.join(' / ')}</span>
                <span className="only-narrow">{short(s.names)}</span>
              </td>
              <td>{s.played}</td>
              <td>
                {s.wins}–{s.losses}
              </td>
              <td>
                {s.gamesWon}–{s.gamesLost}
              </td>
              <td>
                <strong>{s.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <details className="fold fold--quiet">
        <summary>Vem möter vem</summary>
        <div className="table-scroll">
          <table className="table draw-grid">
            <thead>
              <tr>
                <th />
                {g.pairs.map((p) => (
                  <th key={p.index} title={p.names.join(' / ')}>
                    {p.index}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.pairs.map((row, r) => (
                <tr key={row.index} className={mine(row.ids) ? 'is-mine' : ''}>
                  <th className="draw-grid__name">
                    {row.index}. {short(row.names)}
                  </th>
                  {g.pairs.map((col, c) => {
                    if (r === c) return <td key={col.index} className="draw-grid__self" />;
                    // Pool rows/columns are offset by the header row and column.
                    const cell = g.cells.get(`${r + 1}-${c + 1}`);
                    if (!cell) return <td key={col.index} />;
                    const res = result(row.ids, cell);
                    return (
                      <td key={col.index} className={res ? (res.won ? 'draw-grid__won' : 'draw-grid__lost') : 'muted'}>
                        {res ? (
                          res.sets
                        ) : (
                          <>
                            {fmtTime(cell.date)}
                            {cell.court && <span className="draw-grid__court">{cell.court}</span>}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
