import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FixtureCard } from '../components/FixtureCard';
import { StandingsTable } from '../components/StandingsTable';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, relativeDays } from '../lib/format';
import { getStandings, getTeam, getTeamFixtures } from '../lib/leagues';
import { rinUrl } from '../lib/rankedin';
import { getSavedTeams, toggleTeam } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export default function Team() {
  const { teamId = '' } = useParams();
  const tid = Number(teamId);
  const team = useAsync(() => getTeam(tid), [tid]);
  const { version } = useSession();
  const fixtures = useAsync((fresh) => getTeamFixtures(tid, fresh), [tid, version]);
  const poolId = team.data?.poolId;
  const standings = useAsync(() => (poolId ? getStandings(poolId) : Promise.resolve([])), [poolId]);
  const [saved, setSaved] = useState(() => getSavedTeams().some((t) => t.id === tid));

  if (team.error) {
    return (
      <>
        <AppHeader back="history" title="Lag" />
        <Page>
          <ErrorBox error={team.error} onRetry={() => team.reload()} />
        </Page>
      </>
    );
  }
  if (!team.data) {
    return (
      <>
        <AppHeader back="history" title="Lag" />
        <Page>
          <Loading />
        </Page>
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

  return (
    <>
      <AppHeader back="history" title="Lag" />
      <Page>
        <div className="profile">
          <div className="profile__avatar" aria-hidden="true">
            {t.clubImageUrl ? <img src={t.clubImageUrl} alt="" /> : t.name[0]}
          </div>
          <div className="profile__info">
            <h1>{t.name}</h1>
            <p className="muted small">
              <Link to={`/liga/${t.leagueId}`}>{t.leagueName}</Link>
              {t.division ? ` · ${t.division}` : ''}
            </p>
            {row && (
              <p className="small">
                Plats <strong>{row.position}</strong> · {row.points} p · {row.wins}–{row.losses}
              </p>
            )}
          </div>
          <button
            className={`star ${saved ? 'star--on' : ''}`}
            aria-pressed={saved}
            aria-label={saved ? 'Ta bort från mina lag' : 'Spara som mitt lag'}
            onClick={() => {
              toggleTeam({ id: t.id, name: t.name, league: t.leagueName });
              setSaved(!saved);
            }}
          >
            ★
          </button>
        </div>

        {next && opponent && (
          <Notice tone="ok">
            <strong>Nästa match:</strong> {fmtDay(next.date)} {fmtTime(next.date)} ({relativeDays(next.date)}) mot <strong>{opponent.name}</strong>
            {next.location ? ` · ${next.location}` : ''}
          </Notice>
        )}
        {unlicensed.length > 0 && (
          <Notice tone="warn">
            Licens saknas för: {unlicensed.map((p) => p.name).join(', ')}.
          </Notice>
        )}

        <Section title="Kommande" action={<RefreshButton onClick={() => fixtures.reload()} loading={fixtures.loading} />}>
          {fixtures.error && <ErrorBox error={fixtures.error} onRetry={() => fixtures.reload()} />}
          {!fixtures.data && fixtures.loading && <Loading />}
          {fixtures.data && upcoming.length === 0 && <Empty>Inga fler matcher.</Empty>}
          {upcoming.map((f) => (
            <FixtureCard key={f.teamMatchId} f={f} highlightTeamId={t.id} />
          ))}
        </Section>

        {played.length > 0 && (
          <Section title="Spelade">
            {played.map((f) => (
              <FixtureCard key={f.teamMatchId} f={f} highlightTeamId={t.id} />
            ))}
          </Section>
        )}

        {standings.data && standings.data.length > 0 && (
          <Section
            title="Tabell"
            action={
              <Link className="btn btn--ghost btn--small" to={`/division/${t.poolId}?liga=${t.leagueId}&lag=${t.id}`}>
                Hela divisionen
              </Link>
            }
          >
            <StandingsTable rows={standings.data} highlightTeamId={t.id} leagueId={t.leagueId} />
          </Section>
        )}

        <Section title={`Spelare (${t.players.length})`}>
          <ul className="pairs">
            {t.players.map((p) => (
              <li key={p.id}>
                <Link to={`/spelare/${p.rankedinId}`}>{p.name}</Link>
                {p.isCaptain && <span className="pill">Kapten</span>}
                {!p.hasLicense && <span className="pill pill--warn">Licens saknas</span>}
              </li>
            ))}
          </ul>
        </Section>

        <p className="center">
          <ExternalLink href={rinUrl(`/sv/team/homepage/${t.id}`)}>Laget på Rankedin</ExternalLink>
        </p>
      </Page>
    </>
  );
}
