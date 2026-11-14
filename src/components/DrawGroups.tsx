// The class's groups like a football group stage: table, the group's matches, then the playoff filled from the tables.
import { fmtTime } from '../lib/format';
import { getClassDraws, getClassPlayoff, resolvePlayoffSide, type DrawGroup, type PlayoffMatch, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { Section } from './ui';

type Props = { classId: number; matches: TournamentMatch[]; highlight: number[]; refreshKey: string };

const short = (names: string[]) => names.map((n) => n.split(' ')[0]).join(' / ');

export function DrawGroups({ classId, matches, highlight, refreshKey }: Props) {
  const draws = useAsync((fresh) => getClassDraws(classId, fresh), [classId, refreshKey], `draws.v2.${classId}`);
  const playoff = useAsync((fresh) => getClassPlayoff(classId, fresh), [classId, refreshKey], `playoff.v1.${classId}`);
  if (!Array.isArray(draws.data) || !draws.data.length) return null;
  const groups = draws.data;
  const mine = (ids: number[]) => highlight.some((h) => ids.includes(h));
  return (
    <>
      <Section title={groups.length > 1 ? 'Grupper' : 'Grupp'}>
        <div className="draw-groups">
          {groups.map((g) => (
            <Group key={g.name} g={g} matches={matches} mine={mine} />
          ))}
        </div>
      </Section>
      {Array.isArray(playoff.data) && playoff.data.length > 0 && <Playoff list={playoff.data} groups={groups} matches={matches} mine={mine} />}
    </>
  );
}

function Group({ g, matches, mine }: { g: DrawGroup; matches: TournamentMatch[]; mine: (ids: number[]) => boolean }) {
  const anyPlayed = g.standings.some((s) => s.played > 0);
  const rows = anyPlayed
    ? g.standings
    : g.pairs.map((p) => ({ position: 0, names: p.names, ids: p.ids, played: 0, wins: 0, losses: 0, points: 0, gamesWon: 0, gamesLost: 0 }));

  // Each match sits twice in Rankedin's grid (row vs column and back); take the upper half.
  // Pool rows/columns are offset by one for the header row and column.
  const fixtures = g.pairs
    .flatMap((a, r) => g.pairs.slice(r + 1).map((b, k) => ({ a, b, cell: g.cells?.[`${r + 1}-${r + k + 2}`] })))
    .filter((f) => !!f.cell)
    .sort((x, y) => (x.cell!.date || '').localeCompare(y.cell!.date || ''));

  return (
    <div className="draw-group">
      <h3 className="h3">{g.name}</h3>
      <div className="table-scroll">
        <table className="table draw-table">
          <thead>
            <tr>
              <th />
              <th>Par</th>
              <th title="Spelade">S</th>
              <th title="Vunna">V</th>
              <th title="Förlorade">F</th>
              <th title="Game-skillnad">+/-</th>
              <th title="Poäng">P</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const diff = s.gamesWon - s.gamesLost;
              return (
                <tr key={s.ids.join('-')} className={mine(s.ids) ? 'is-mine' : ''}>
                  <td className="muted">{s.position || ''}</td>
                  <td title={s.names.join(' / ')}>
                    <span className="only-wide">{s.names.join(' / ')}</span>
                    <span className="only-narrow">{short(s.names)}</span>
                  </td>
                  <td>{s.played}</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td>{diff > 0 ? `+${diff}` : diff}</td>
                  <td>
                    <strong>{s.points}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {fixtures.length > 0 && (
        <details className="fold fold--quiet">
          <summary>Matcher ({fixtures.length})</summary>
          <ul className="fixtures">
            {fixtures.map(({ a, b, cell }) => {
              const m = matches.find((x) => x.id === cell!.matchId || x.id === cell!.challengeId);
              // Keep Rankedin's side order when we have the match, so the score reads left to right.
              const flip = !!m && m.sides[0].ids.some((id) => b.ids.includes(id));
              const [left, right] = flip ? [b, a] : [a, b];
              return (
                <Fixture
                  key={cell!.matchId}
                  left={{ names: left.names, ids: left.ids, won: !!m?.sides[0].isWinner }}
                  right={{ names: right.names, ids: right.ids, won: !!m?.sides[1].isWinner }}
                  match={m}
                  date={cell!.date}
                  court={cell!.court}
                  mine={mine}
                />
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

type FixtureSide = { names: string[]; ids: number[]; won: boolean; label?: string | null; provisional?: boolean };

function Fixture({ left, right, match, date, court, mine, title }: {
  left: FixtureSide;
  right: FixtureSide;
  match: TournamentMatch | undefined;
  date: string | null;
  court: string | null;
  mine: (ids: number[]) => boolean;
  title?: string;
}) {
  const played = !!match?.played && match.sets.length > 0;
  const meta = [title, fmtTime(match?.date ?? date), match?.court ?? court].filter(Boolean).join(' · ');
  const name = (s: FixtureSide) =>
    s.names.length ? (
      <>
        <span className={s.provisional ? 'muted' : ''}>{short(s.names)}</span>
        {s.label && <span className="fixture__label">{s.provisional ? `${s.label} just nu` : s.label}</span>}
      </>
    ) : (
      <span className="muted">{s.label || 'Ej klart'}</span>
    );
  return (
    <li className={`fixture ${mine([...left.ids, ...right.ids]) ? 'is-mine' : ''}`}>
      {meta && <div className="fixture__meta">{meta}</div>}
      <div className="fixture__row">
        <div className={`fixture__side fixture__side--left ${played && left.won ? 'is-won' : ''}`}>{name(left)}</div>
        <div className="fixture__score">{played ? match!.sets.map(([x, y]) => `${x}–${y}`).join(' ') : '–'}</div>
        <div className={`fixture__side ${played && right.won ? 'is-won' : ''}`}>{name(right)}</div>
      </div>
    </li>
  );
}

function Playoff({ list, groups, matches, mine }: { list: PlayoffMatch[]; groups: DrawGroup[]; matches: TournamentMatch[]; mine: (ids: number[]) => boolean }) {
  const roundName = (m: PlayoffMatch) => {
    if (m.places) return m.places[0] === 1 ? 'Final' : `Om plats ${m.places[0]}–${m.places[1]}`;
    const left = m.maxRound - m.round;
    return left === 0 ? 'Final' : left === 1 ? 'Semifinal' : left === 2 ? 'Kvartsfinal' : `Omgång ${m.round}`;
  };
  const sorted = [...list].sort((a, b) => a.round - b.round || a.order - b.order);
  return (
    <Section title="Slutspel">
      <ul className="fixtures">
        {sorted.map((p) => {
          const m = matches.find((x) => x.id === p.matchId || x.id === p.challengeId);
          const [l, r] = p.sides.map((s) => resolvePlayoffSide(s, groups));
          return (
            <Fixture
              key={p.matchId}
              title={roundName(p)}
              left={{ ...l, won: !!m?.sides[0].isWinner }}
              right={{ ...r, won: !!m?.sides[1].isWinner }}
              match={m}
              date={p.date}
              court={p.court}
              mine={mine}
            />
          );
        })}
      </ul>
    </Section>
  );
}
