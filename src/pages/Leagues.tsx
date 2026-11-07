import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { ADULT_LEAGUES } from '../lib/features';
import { fmtDay } from '../lib/format';
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
  return { position: row?.position ?? null, size: table.length, next };
}

export default function Leagues() {
  const players = useKnownPlayers();
  const savedTeams = getSavedTeams();
  const klubbligan = useAsync(() => currentKlubbligan(), [], 'klubbligan');
  const spl = useAsync(() => (ADULT_LEAGUES ? currentSplLeagues() : Promise.resolve([])), []);
  const playerKey = players.map((p) => p.id).join(',');
  const leagueKey = (klubbligan.data || []).map((l) => l.id).join(',');

  const mine = useAsync(async () => {
    if (!klubbligan.data || players.length === 0) return [];
    const found = await findMyTeams(
      klubbligan.data.map((l) => l.id),
      players.map((p) => ({ id: p.id, name: p.name })),
    );
    // One entry per team, listing every known player on it.
    const byTeam = new Map<number, (typeof found)[number] & { players: string[] }>();
    for (const f of found) {
      const t = byTeam.get(f.teamId);
      if (t) t.players.push(firstName(f.player.name));
      else byTeam.set(f.teamId, { ...f, players: [firstName(f.player.name)] });
    }
    return Promise.all([...byTeam.values()].map(async (t) => ({ ...t, status: await teamStatus(t.teamId).catch(() => null) })));
  }, [playerKey, leagueKey], playerKey ? `mine.${playerKey}` : undefined);

  const myLeagueIds = new Set((mine.data || []).map((t) => t.leagueId));
  const otherSavedTeams = savedTeams.filter((s) => !(mine.data || []).some((m) => m.teamId === s.id));

  return (
    <>
      <AppHeader title="Klubbligan" />
      <Page wide>
        <div className="page-title">
          <h1>Klubbligan</h1>
        </div>

        <Section title="Min Klubbliga">
          {players.length === 0 && (
            <Empty>
              <Go to="/" from="Klubbligan">
                Spara ditt barn
              </Go>{' '}
              eller logga in med barnets Rankedin-konto, så visas laget här.
            </Empty>
          )}
          {players.length > 0 && (!klubbligan.data || mine.loading) && !mine.data?.length && <Loading label="Letar efter era lag…" />}
          {mine.data && mine.data.length === 0 && players.length > 0 && klubbligan.data && !mine.loading && (
            <Empty>{players.map((p) => firstName(p.name)).join(' och ')} spelar inte i någon Klubbliga den här säsongen.</Empty>
          )}
          {mine.data && mine.data.length > 0 && (
            <div className="list">
              {mine.data.map((t) => {
                const league = klubbligan.data?.find((l) => l.id === t.leagueId);
                const next = t.status?.next;
                const opp = next ? (next.home.id === t.teamId ? next.away : next.home) : null;
                return (
                  <Go key={t.teamId} to={`/lag/${t.teamId}`} from="Klubbligan" className="item">
                    <span className="item__main">
                      <strong>{t.teamName}</strong>
                      <span className="muted small block">
                        {league ? shortKlubbliganName(league.name) : ''} · {t.division} · {t.players.join(', ')}
                      </span>
                    </span>
                    {t.status && (
                      <span className="item__side small">
                        {t.status.position != null && (
                          <span className="block">
                            Plats <strong>{t.status.position}</strong> av {t.status.size}
                          </span>
                        )}
                        {next && opp && (
                          <span className="block muted">
                            Nästa {fmtDay(next.date)} mot {opp.name}
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
              <p className="list-label">Andra sparade lag</p>
              <div className="list">
                {otherSavedTeams.map((t) => (
                  <Go key={t.id} to={`/lag/${t.id}`} from="Klubbligan" className="item">
                    <span className="item__main">
                      <strong>{t.name}</strong>
                      <span className="muted small block">{t.league}</span>
                    </span>
                  </Go>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="Alla serier den här säsongen">
          {klubbligan.error && <ErrorBox error={klubbligan.error} onRetry={() => klubbligan.reload()} />}
          {!klubbligan.data && klubbligan.loading && <Loading />}
          {klubbligan.data && klubbligan.data.length === 0 && <Empty>Hittade ingen pågående Klubbliga.</Empty>}
          {klubbligan.data && klubbligan.data.length > 0 && (
            <div className="list list--cols">
              {klubbligan.data.map((l) => (
                <Go key={l.id} to={`/liga/${l.id}`} from="Klubbligan" className="item">
                  <span className="item__main">
                    <strong>{shortKlubbliganName(l.name)}</strong>
                    {myLeagueIds.has(l.id) && <span className="tag">Era lag</span>}
                    {l.startDate && <span className="muted small block">från {fmtDay(parseSearchDate(l.startDate))}</span>}
                  </span>
                </Go>
              ))}
            </div>
          )}
        </Section>

        {spl.data && spl.data.length > 0 && (
          <Section title="SPL">
            <div className="list">
              {spl.data.map((l) => (
                <Go key={l.id} to={`/liga/${l.id}`} from="Klubbligan" className="item">
                  <span className="item__main">
                    <strong>{l.name}</strong>
                  </span>
                </Go>
              ))}
            </div>
          </Section>
        )}
      </Page>
    </>
  );
}

/** Search results give "17/10/2026 10:00". */
function parseSearchDate(v: string): string {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00` : v;
}
