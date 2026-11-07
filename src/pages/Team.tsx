import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { FixtureRow } from '../components/FixtureRow';
import { Go } from '../components/shell';
import { StandingsTable } from '../components/StandingsTable';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, relativeDays } from '../lib/format';
import { getLeagueHeader, getStandings, getTeam, getTeamFixtures } from '../lib/leagues';
import { rinUrl } from '../lib/rankedin';
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
        <AppHeader back="/serier" backLabel="Klubbligan" />
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

  return (
    <>
      <AppHeader back="/serier" backLabel="Klubbligan" title={t.name} />
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
          {row && (
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
            {standings.data && standings.data.length > 0 && (
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
