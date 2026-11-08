import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FixtureRow } from '../components/FixtureRow';
import { Go } from '../components/shell';
import { StandingsTable } from '../components/StandingsTable';
import { seriesKind, seriesRules, showsStandings } from '../lib/rules';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, relativeDays } from '../lib/format';
import { getLeagueHeader, getStandings, getTeam, getTeamFixtures } from '../lib/leagues';
import { rinUrl } from '../lib/rankedin';
import { divisionLevel, isSplLeague, rankingPoints } from '../lib/spl';
import { getSavedTeams, toggleTeam } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { fmtRange } from './Player';

export default function Team() {
  const { teamId = '' } = useParams();
  const tid = Number(teamId);
  const { version } = useSession();
  const team = useAsync(() => getTeam(tid), [tid], `team.${tid}`);
  const fixtures = useAsync((fresh) => getTeamFixtures(tid, fresh, true), [tid, version]);
  const poolId = team.data?.poolId;
  const leagueId = team.data?.leagueId;
  const standings = useAsync(() => (poolId ? getStandings(poolId) : Promise.resolve([])), [poolId]);
  const league = useAsync(() => (leagueId ? getLeagueHeader(leagueId) : Promise.resolve(null)), [leagueId]);
  const [saved, setSaved] = useState(() => getSavedTeams().some((t) => t.id === tid));

  if (team.error || !team.data) {
    return (
      <>
        <AppHeader back="/serier" backLabel="Serier" />
        <Page>{team.error ? <ErrorBox error={team.error} onRetry={() => team.reload()} /> : <Loading />}</Page>
      </>
    );
  }

  const t = team.data;
  const all = fixtures.data || [];
  const upcoming = all.filter((f) => !f.played);
  const played = all.filter((f) => f.played).reverse();
  const next = upcoming[0];
  const opponent = next ? (next.home.id === t.id ? next.away : next.home) : null;
  const row = standings.data?.find((r) => r.teamId === t.id);
  const unlicensed = t.players.filter((p) => !p.hasLicense);
  const me = t.name;
  // Team matches on the same day form one round ("sammandrag").
  const byDay = new Map<string, { date: string; opponents: string[]; played: boolean }>();
  for (const f of all) {
    const d = f.date?.slice(0, 10);
    if (!d) continue;
    const r = byDay.get(d) ?? { date: d, opponents: [], played: true };
    r.opponents.push(f.home.id === t.id ? f.away.name : f.home.name);
    r.played = r.played && f.played;
    byDay.set(d, r);
  }
  const roundsAll = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const nextRound = roundsAll.find((r) => !r.played)?.date;
  const lastPlayed = [...roundsAll].reverse().find((r) => r.played);
  // Upcoming rounds plus the latest played one (for late results).
  const rounds = roundsAll.filter((r) => !r.played || r === lastPlayed);
  const splLevel = isSplLeague(t.leagueName) ? divisionLevel(t.division) : null;
  const kind = seriesKind(t.leagueName);
  const hasTable = showsStandings(kind);
  const rules = seriesRules(kind, t.division);
  const points = rankingPoints(splLevel);

  return (
    <>
      <AppHeader back="/serier" backLabel="Serier" title={t.name} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{t.name}</h1>
            <p className="muted">
              <Go to={`/liga/${t.leagueId}`} from={me}>
                {t.leagueName}
              </Go>
              {t.division ? ` · ${t.division}` : ''}
            </p>
            {league.data && <p className="muted small">Säsong {fmtRange(league.data.startDate, league.data.endDate)}</p>}
            {points && (
              <p className="muted small">
                Rankingpoäng: {String(points.win).replace('.', ',')} per vinst, {String(points.loss).replace('.', ',')} per förlust
              </p>
            )}
          </div>
          <button
            className={`btn btn--small ${saved ? '' : 'btn--primary'}`}
            aria-pressed={saved}
            onClick={() => {
              toggleTeam({ id: t.id, name: t.name, league: t.leagueName });
              setSaved(!saved);
            }}
          >
            {saved ? 'Sparat' : 'Spara lag'}
          </button>
        </div>

        <div className="stats">
          {row && hasTable && (
            <>
              <div>
                <span className="stats__value">{row.position}</span>
                <span className="stats__label">plats av {standings.data?.length}</span>
              </div>
              {(standings.data ?? []).some((r) => r.points > 0) && (
                <div>
                  <span className="stats__value">{row.points}</span>
                  <span className="stats__label">poäng</span>
                </div>
              )}
              <div>
                <span className="stats__value">
                  {row.wins}–{row.losses}
                </span>
                <span className="stats__label">vunna–förlorade</span>
              </div>
            </>
          )}
          {next && opponent && (
            <div className="stats__wide">
              <span className="stats__label">Nästa match</span>
              <span>
                {fmtDay(next.date)} {fmtTime(next.date)} ({relativeDays(next.date)}) mot <strong>{opponent.name}</strong>
                {next.location ? `, ${next.location}` : ''}
              </span>
            </div>
          )}
        </div>

        {unlicensed.length > 0 && <Notice tone="warn">Licens saknas för: {unlicensed.map((p) => p.name).join(', ')}.</Notice>}

        <div className="columns">
          <div>
            {rounds.length > 0 && (
              <Section title="Speldagar">
                <div className="list">
                  {rounds.map((r) => (
                    <Go key={r.date} to={`/lag/${t.id}/omgang/${r.date}`} from={me} className="item">
                      <span className="item__date">
                        {fmtDay(`${r.date}T12:00:00`)}
                        <span className="muted small">{relativeDays(`${r.date}T12:00:00`)}</span>
                      </span>
                      <span className="item__main">
                        <strong>{r.played ? 'Spelat' : r.date === nextRound ? 'Nästa sammandrag' : 'Sammandrag'}</strong>
                        <span className="muted small block">mot {r.opponents.join(' och ')}</span>
                      </span>
                      <span className="item__side small muted">Uppställning, tillgänglighet, resultat ›</span>
                    </Go>
                  ))}
                </div>
              </Section>
            )}

            <Section title="Kommande" action={<RefreshButton onClick={() => fixtures.reload()} loading={fixtures.loading} />}>
              {fixtures.error && <ErrorBox error={fixtures.error} onRetry={() => fixtures.reload()} />}
              {!fixtures.data && fixtures.loading && <Loading />}
              {fixtures.data && upcoming.length === 0 && <Empty>Inga fler matcher den här säsongen.</Empty>}
              {upcoming.length > 0 && (
                <div className="list">
                  {upcoming.map((f) => (
                    <FixtureRow key={f.teamMatchId} f={f} teamId={t.id} from={me} />
                  ))}
                </div>
              )}
            </Section>
            {played.length > 0 && (
              <Section title="Spelade">
                <div className="list">
                  {played.map((f) => (
                    <FixtureRow key={f.teamMatchId} f={f} teamId={t.id} from={me} />
                  ))}
                </div>
              </Section>
            )}
          </div>
          <div>
            {!hasTable && rules && (
              <Section title="Så spelas serien">
                <p className="notice notice--info small">I Klubbligan 10–13 år förs ingen tabell och det delas inte ut lagpoäng – det är spelglädjen som räknas.</p>
                <ul className="small">
                  {[rules.summary, ...rules.notes].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Section>
            )}
            {hasTable && rules && kind !== 'spl' && (
              <p className="muted small">{rules.notes.join(' ')}</p>
            )}
            {hasTable && standings.data && standings.data.length > 0 && (
              <Section
                title="Tabell"
                action={
                  <Go className="btn btn--ghost btn--small" to={`/division/${t.poolId}?liga=${t.leagueId}&lag=${t.id}`} from={me}>
                    Hela divisionen
                  </Go>
                }
              >
                <StandingsTable rows={standings.data} highlightTeamId={t.id} leagueId={t.leagueId} from={me} />
              </Section>
            )}
            <details className="fold">
              <summary>Spelare ({t.players.length})</summary>
              <div className="list">
                {t.players.map((p) => (
                  <Go key={p.id} to={`/spelare/${p.rankedinId}`} from={me} className="item">
                    <span className="item__main">
                      {p.name}
                      {p.isCaptain && <span className="tag">Lagledare</span>}
                      {!p.hasLicense && <span className="tag tag--warn">Licens saknas</span>}
                    </span>
                  </Go>
                ))}
              </div>
            </details>
            <p className="small">
              <ExternalLink href={rinUrl(`/sv/team/homepage/${t.id}`)}>Laget på Rankedin</ExternalLink>
            </p>
          </div>
        </div>
      </Page>
    </>
  );
}
