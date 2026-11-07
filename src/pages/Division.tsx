import { useParams, useSearchParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { FixtureCard } from '../components/FixtureCard';
import { StandingsTable } from '../components/StandingsTable';
import { AppHeader, Empty, ErrorBox, Loading, Page, RefreshButton, Section } from '../components/ui';
import { getLeague, getPoolFixtures, getStandings, type Fixture } from '../lib/leagues';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

function byRound(fixtures: Fixture[]): [string, Fixture[]][] {
  const groups = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const key = f.round != null ? `Omgång ${f.round}` : 'Övriga';
    groups.set(key, [...(groups.get(key) || []), f]);
  }
  return [...groups.entries()];
}

export default function Division() {
  const { poolId = '' } = useParams();
  const [params] = useSearchParams();
  const leagueId = Number(params.get('liga')) || 0;
  const highlight = Number(params.get('lag')) || undefined;
  const pid = Number(poolId);
  const league = useAsync(() => (leagueId ? getLeague(leagueId) : Promise.resolve(null)), [leagueId]);
  const standings = useAsync((fresh) => getStandings(pid, fresh), [pid]);
  const { version } = useSession();
  const fixtures = useAsync((fresh) => getPoolFixtures(pid, fresh), [pid, version]);

  const pool = league.data?.pools.find((p) => p.id === pid);
  const rounds = byRound(fixtures.data || []);
  const nextRound = rounds.find(([, fs]) => fs.some((f) => !f.played))?.[0];

  const title = pool?.division || 'Division';
  return (
    <>
      <AppHeader back={leagueId ? `/liga/${leagueId}` : '/serier'} backLabel={league.data?.name ?? 'Klubbligan'} title={title} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{title}</h1>
            {league.data && (
              <p className="muted">
                <Go to={`/liga/${league.data.id}`} from={title}>
                  {league.data.name}
                </Go>
                {pool?.region ? ` · ${pool.region}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="columns">
          <div>
            <Section title="Tabell" action={<RefreshButton onClick={() => standings.reload()} loading={standings.loading} />}>
              {standings.error && <ErrorBox error={standings.error} onRetry={() => standings.reload()} />}
              {!standings.data && standings.loading && <Loading />}
              {standings.data && standings.data.length === 0 && <Empty>Ingen tabell ännu.</Empty>}
              {standings.data && standings.data.length > 0 && (
                <StandingsTable rows={standings.data} highlightTeamId={highlight} leagueId={leagueId} from={title} />
              )}
            </Section>
          </div>
          <div>
            {fixtures.error && <ErrorBox error={fixtures.error} onRetry={() => fixtures.reload()} />}
            {!fixtures.data && fixtures.loading && <Loading />}
            {fixtures.data && fixtures.data.length === 0 && <Empty>Inga matcher lottade ännu.</Empty>}
            {rounds.map(([round, fs]) => (
              <Section key={round} title={round + (round === nextRound ? ' · nästa' : '')}>
                {fs.map((f) => (
                  <FixtureCard key={f.teamMatchId} f={f} highlightTeamId={highlight} from={title} />
                ))}
              </Section>
            ))}
          </div>
        </div>
      </Page>
    </>
  );
}
