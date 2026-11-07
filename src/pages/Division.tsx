import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { FixtureCard } from '../components/FixtureCard';
import { StandingsTable } from '../components/StandingsTable';
import { AppHeader, Empty, ErrorBox, Loading, Page, RefreshButton, Section } from '../components/ui';
import { getLeague, getPoolFixtures, getStandings, type Fixture } from '../lib/leagues';
import { useAsync } from '../lib/useAsync';

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
  const fixtures = useAsync((fresh) => getPoolFixtures(pid, fresh), [pid]);
  const [tab, setTab] = useState<'tabell' | 'matcher'>('tabell');

  const pool = league.data?.pools.find((p) => p.id === pid);
  const rounds = byRound(fixtures.data || []);
  const nextRound = rounds.find(([, fs]) => fs.some((f) => !f.played))?.[0];

  return (
    <>
      <AppHeader back="history" title={pool?.division || 'Division'} />
      <Page>
        {league.data && (
          <p className="muted small">
            <Link to={`/liga/${league.data.id}`}>{league.data.name}</Link>
            {pool?.region ? ` · ${pool.region}` : ''}
          </p>
        )}
        <div className="chips" role="tablist">
          <button role="tab" aria-selected={tab === 'tabell'} className={`chip ${tab === 'tabell' ? 'chip--on' : ''}`} onClick={() => setTab('tabell')}>
            Tabell
          </button>
          <button role="tab" aria-selected={tab === 'matcher'} className={`chip ${tab === 'matcher' ? 'chip--on' : ''}`} onClick={() => setTab('matcher')}>
            Omgångar
          </button>
        </div>

        {tab === 'tabell' && (
          <Section title="Tabell" action={<RefreshButton onClick={() => standings.reload()} loading={standings.loading} />}>
            {standings.error && <ErrorBox error={standings.error} onRetry={() => standings.reload()} />}
            {!standings.data && standings.loading && <Loading />}
            {standings.data && standings.data.length === 0 && <Empty>Ingen tabell ännu.</Empty>}
            {standings.data && standings.data.length > 0 && (
              <StandingsTable rows={standings.data} highlightTeamId={highlight} leagueId={leagueId} />
            )}
          </Section>
        )}

        {tab === 'matcher' && (
          <>
            {fixtures.error && <ErrorBox error={fixtures.error} onRetry={() => fixtures.reload()} />}
            {!fixtures.data && fixtures.loading && <Loading />}
            {fixtures.data && fixtures.data.length === 0 && <Empty>Inga matcher lottade ännu.</Empty>}
            {rounds.map(([round, fs]) => (
              <Section key={round} title={round + (round === nextRound ? ' · nästa' : '')}>
                {fs.map((f) => (
                  <FixtureCard key={f.teamMatchId} f={f} highlightTeamId={highlight} />
                ))}
              </Section>
            ))}
          </>
        )}
      </Page>
    </>
  );
}
