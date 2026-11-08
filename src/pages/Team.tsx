import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { StandingsTable } from '../components/StandingsTable';
import { seriesKind, seriesRules, showsStandings } from '../lib/rules';
import { AppHeader, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
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
  const next = upcoming[0];
  const opponent = next ? (next.home.id === t.id ? next.away : next.home) : null;
  const row = standings.data?.find((r) => r.teamId === t.id);
  const unlicensed = t.players.filter((p) => !p.hasLicense);
  const me = t.name;
  // Team matches on the same day form one round ("sammandrag").
  type RoundResult = { opponent: string; own: number; opp: number };
  const byDay = new Map<string, { date: string; opponents: string[]; played: boolean; results: RoundResult[] }>();
  for (const f of all) {
    const d = f.date?.slice(0, 10);
    if (!d) continue;
    const r = byDay.get(d) ?? { date: d, opponents: [], played: true, results: [] };
    const [own, opp] = f.home.id === t.id ? [f.home, f.away] : [f.away, f.home];
    r.opponents.push(opp.name);
    if (f.played) r.results.push({ opponent: opp.name, own: Number(own.result) || 0, opp: Number(opp.result) || 0 });
    r.played = r.played && f.played;
    byDay.set(d, r);
  }
  const roundsAll = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  // Every speldag of the season: played ones show their results, so no separate match lists are needed.
  const rounds = roundsAll;
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
              <span className="stats__label">Nästa speldag</span>
              <span>
                {fmtDay(next.date)} {fmtTime(next.date)} ({relativeDays(next.date)}) mot{' '}
                <strong>{byDay.get(next.date?.slice(0, 10) ?? '')?.opponents.filter((o, i, a) => a.indexOf(o) === i).join(' och ') || opponent.name}</strong>
                {next.location ? `, ${next.location}` : ''}
              </span>
            </div>
          )}
        </div>

        {unlicensed.length > 0 && <Notice tone="warn">Licens saknas för: {unlicensed.map((p) => p.name).join(', ')}.</Notice>}

        <div className="columns">
          <div>
            {fixtures.error && <ErrorBox error={fixtures.error} onRetry={() => fixtures.reload()} />}
            {!fixtures.data && fixtures.loading && <Loading />}
            {rounds.length > 0 && (
              <Section title="Speldagar" action={<RefreshButton onClick={() => fixtures.reload()} loading={fixtures.loading} />}>
                <div className="list">
                  {rounds.map((r) => {
                    return (
                      <Go key={r.date} to={`/lag/${t.id}/omgang/${r.date}`} from={me} className="item round-item">
                        <span className={`status ${r.played ? 'status--played' : ''}`}>{r.played ? 'Spelad' : 'Kommande'}</span>
                        <span className="item__date">
                          {fmtDay(`${r.date}T12:00:00`)}
                          <span className="muted small">{relativeDays(`${r.date}T12:00:00`)}</span>
                        </span>
                        <span className="item__main">
                          {r.played ? (
                            <span className="block round-results">
                              {r.results.map((x) => (
                                <span key={x.opponent} className="block">
                                  <strong className={x.own > x.opp ? 'text-win' : undefined}>
                                    {x.own > x.opp ? 'Vann' : x.own < x.opp ? 'Förlorade' : 'Oavgjort'} {x.own}–{x.opp}
                                  </strong>{' '}
                                  <span className="muted">mot {x.opponent}</span>
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="block">mot {r.opponents.join(' och ')}</span>
                          )}
                        </span>
                        <span className="item__side small muted">{r.played ? 'Resultat och matcher ›' : 'Uppställning, tillgänglighet ›'}</span>
                      </Go>
                    );
                  })}
                </div>
              </Section>
            )}

          </div>
          <div>
            {!hasTable && <p className="muted small">Ingen tabell förs i den här åldersklassen.</p>}
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
              <summary>Om serien</summary>
              <ul className="small">
                {league.data && <li>Säsong {fmtRange(league.data.startDate, league.data.endDate)}</li>}
                {points && (
                  <li>
                    Rankingpoäng: {String(points.win).replace('.', ',')} per vinst, {String(points.loss).replace('.', ',')} per förlust
                  </li>
                )}
                {rules && [rules.summary, ...rules.notes].map((n) => <li key={n}>{n}</li>)}
              </ul>
            </details>
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
