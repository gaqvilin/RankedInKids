import { seriesKind } from '../lib/rules';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { ADULT_LEAGUES } from '../lib/features';
import { fmtDay } from '../lib/format';
import { t } from '../lib/i18n';
import { useKnownPlayers } from '../lib/known';
import { currentKlubbligan, currentSplLeagues, findMyTeams, getStandings, getTeam, getTeamFixtures, shortKlubbliganName } from '../lib/leagues';
import { getSavedTeams } from '../lib/storage';
import { useAsync } from '../lib/useAsync';

const firstName = (n: string) => n.split(' ')[0];

/** One of "my" teams with its current position and next match. */
async function teamStatus(teamId: number) {
  const [team, fixtures] = await Promise.all([getTeam(teamId), getTeamFixtures(teamId)]);
  const table = await getStandings(team.poolId);
  const row = table.find((r) => r.teamId === teamId);
  const next = fixtures.find((f) => !f.played) ?? null;
  const day = next?.date?.slice(0, 10);
  const opponents = day
    ? [...new Set(fixtures.filter((f) => !f.played && f.date?.slice(0, 10) === day).map((f) => (f.home.id === teamId ? f.away.name : f.home.name)))]
    : [];
  return { position: row?.position ?? null, size: table.length, next, opponents };
}

export default function Leagues() {
  const players = useKnownPlayers();
  const savedTeams = getSavedTeams();
  const klubbligan = useAsync(() => currentKlubbligan(), [], 'klubbligan');
  const spl = useAsync(() => (ADULT_LEAGUES ? currentSplLeagues() : Promise.resolve([])), [], 'spl');
  const playerKey = players.map((p) => p.id).join(',');
  const allLeagues = [...(klubbligan.data || []), ...(spl.data || [])];
  const leagueKey = allLeagues.map((l) => l.id).join(',');

  // Both searches must have settled (data or error) before "no league" can be said.
  const searchesDone = (!!klubbligan.data || !!klubbligan.error) && (!!spl.data || !!spl.error);
  const mine = useAsync(async () => {
    if (!searchesDone || players.length === 0) return null;
    const found = await findMyTeams(
      [...(klubbligan.data ?? []), ...(spl.data ?? [])].map((l) => l.id),
      players.map((p) => ({ id: p.id, name: p.name })),
    );
    // One entry per team, listing every known player on it.
    const byTeam = new Map<number, (typeof found)[number] & { players: string[] }>();
    for (const f of found) {
      const tm = byTeam.get(f.teamId);
      if (tm) tm.players.push(firstName(f.player.name));
      else byTeam.set(f.teamId, { ...f, players: [firstName(f.player.name)] });
    }
    return Promise.all([...byTeam.values()].map(async (tm) => ({ ...tm, status: await teamStatus(tm.teamId).catch(() => null) })));
  }, [playerKey, leagueKey, searchesDone], playerKey ? `mine.${playerKey}` : undefined);

  const myLeagueIds = new Set((mine.data || []).map((tm) => tm.leagueId));
  const otherSavedTeams = savedTeams.filter((s) => !(mine.data || []).some((m) => m.teamId === s.id));

  return (
    <>
      <AppHeader title={t('Serier')} />
      <Page wide>
        <div className="page-title">
          <h1>{t('Serier')}</h1>
        </div>

        <Section title={t('Mina lag')}>
          {players.length === 0 && (
            <Empty>
              <Go to="/" from={t('Serier')}>
                {t('Spara ditt barn')}
              </Go>{' '}
              {t('eller logga in med barnets Rankedin-konto, så visas laget här.')}
            </Empty>
          )}
          {players.length > 0 && (!searchesDone || mine.loading || mine.data === null) && !mine.data?.length && !mine.error && <Loading label={t('Letar efter era lag…')} />}
          {(mine.error || (searchesDone && klubbligan.error && spl.error)) && <ErrorBox error={mine.error ?? klubbligan.error!} onRetry={() => { klubbligan.reload(); spl.reload(); mine.reload(); }} />}
          {mine.data && mine.data.length === 0 && players.length > 0 && searchesDone && !klubbligan.error && !spl.error && !mine.loading && (
            <Empty>{t('{names} spelar inte i någon serie den här säsongen.', { names: players.map((p) => firstName(p.name)).join(t(' och ')) })}</Empty>
          )}
          {mine.data && mine.data.length > 0 && (
            <div className="list">
              {mine.data.map((tm) => {
                const league = allLeagues.find((l) => l.id === tm.leagueId);
                const next = tm.status?.next;
                const opp = next ? (next.home.id === tm.teamId ? next.away : next.home) : null;
                return (
                  <Go key={tm.teamId} to={`/lag/${tm.teamId}`} from={t('Serier')} className="item">
                    <span className="item__main">
                      <strong>{tm.teamName}</strong>
                      <span className="muted small block">
                        {league ? (/klubbligan/i.test(league.name) ? `Klubbligan ${shortKlubbliganName(league.name)}` : league.name.replace(/^SPL Swedish Padel League\s*/i, 'SPL ')) : ''} · {tm.division} · {tm.players.join(', ')}
                      </span>
                    </span>
                    {tm.status && (
                      <span className="item__side small">
                        {tm.status.position != null && !(league && seriesKind(league.name) === 'klubbligan-young') && (
                          <span className="block">
                            {t('Plats')} <strong>{tm.status.position}</strong> {t('av {n}', { n: tm.status.size })}
                          </span>
                        )}
                        {next && opp && (
                          <span className="block muted">
                            {t('Nästa {day} mot {opponent}', { day: fmtDay(next.date), opponent: tm.status.opponents?.length ? tm.status.opponents.join(t(' och ')) : opp.name })}
                          </span>
                        )}
                      </span>
                    )}
                  </Go>
                );
              })}
            </div>
          )}
          {otherSavedTeams.length > 0 && (
            <>
              <p className="list-label">{t('Andra sparade lag')}</p>
              <div className="list">
                {otherSavedTeams.map((tm) => (
                  <Go key={tm.id} to={`/lag/${tm.id}`} from={t('Serier')} className="item">
                    <span className="item__main">
                      <strong>{tm.name}</strong>
                      <span className="muted small block">{tm.league}</span>
                    </span>
                  </Go>
                ))}
              </div>
            </>
          )}
        </Section>

        {(() => {
          const lists = (
            <>
            <Section title={t('Klubbligan den här säsongen')}>
              {klubbligan.error && <ErrorBox error={klubbligan.error} onRetry={() => klubbligan.reload()} />}
              {!klubbligan.data && klubbligan.loading && <Loading />}
              {klubbligan.data && klubbligan.data.length === 0 && <Empty>{t('Hittade ingen pågående Klubbliga.')}</Empty>}
              {klubbligan.data && klubbligan.data.length > 0 && (
                <div className="list list--cols">
                  {klubbligan.data.map((l) => (
                    <Go key={l.id} to={`/liga/${l.id}`} from={t('Serier')} className="item">
                      <span className="item__main">
                        <strong>{shortKlubbliganName(l.name)}</strong>
                        {myLeagueIds.has(l.id) && <span className="tag">{t('Era lag')}</span>}
                        
                      </span>
                    </Go>
                  ))}
                </div>
              )}
            </Section>

            {spl.data && spl.data.length > 0 && (
              <Section title="SPL – Swedish Padel League">
                <div className="list list--cols">
                  {spl.data.map((l) => (
                    <Go key={l.id} to={`/liga/${l.id}`} from={t('Serier')} className="item">
                      <span className="item__main">
                        <strong>{l.name.replace(/^SPL Swedish Padel League\s*/i, '')}</strong>
                        {myLeagueIds.has(l.id) && <span className="tag">{t('Era lag')}</span>}
                      </span>
                    </Go>
                  ))}
                </div>
              </Section>
            )}
            </>
          );
          // With teams of your own, the full list of series is one tap away.
          return (mine.data?.length ?? 0) > 0 ? (
            <details className="fold">
              <summary>{t('Alla serier den här säsongen')}</summary>
              {lists}
            </details>
          ) : (
            lists
          );
        })()}
      </Page>
    </>
  );
}
