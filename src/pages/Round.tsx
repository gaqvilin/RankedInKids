import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AvailabilityPanel } from '../components/AvailabilityPanel';
import { LineupSheet } from '../components/LineupSheet';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, soon } from '../lib/format';
import { locale, t } from '../lib/i18n';
import { buildInvitation, buildSchedule, scheduleAsText } from '../lib/host';
import { getPoolFixtures, getTeam, getTeamFixtures, type Fixture } from '../lib/leagues';
import { getTeamMatch, getTeamMatchInfo, type TeamMatch, type TournamentMatch } from '../lib/rankedin';
import { divisionLevel, isSplLeague, lineupDeadline, rankingPoints } from '../lib/spl';
import { seriesKind, seriesRules, type SeriesRules } from '../lib/rules';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

type DayMatch = { fixture: Fixture; tm: TeamMatch; startsAt: string | null };

export default function Round() {
  const { teamId = '', date = '' } = useParams();
  const tid = Number(teamId);
  const { version } = useSession();
  const team = useAsync(() => getTeam(tid), [tid], `team.${tid}`);
  const day = useAsync(
    async (fresh): Promise<DayMatch[]> => {
      const fixtures = (await getTeamFixtures(tid, fresh, true)).filter((f) => dayOf(f.date) === date);
      return Promise.all(
        fixtures.map(async (fixture) => {
          const [tm, info] = await Promise.all([getTeamMatch(fixture.teamMatchId, fresh), getTeamMatchInfo(fixture.teamMatchId).catch(() => null)]);
          return { fixture, tm, startsAt: info?.date ?? fixture.date };
        }),
      );
    },
    [tid, date, version],
  );
  const poolId = team.data?.poolId;
  const poolDay = useAsync(() => (poolId ? getPoolFixtures(poolId).then((fs) => fs.filter((f) => dayOf(f.date) === date)) : Promise.resolve([])), [poolId, date]);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [lineupFor, setLineupFor] = useState<DayMatch | null>(null);

  const td = team.data;
  const spl = td ? isSplLeague(td.leagueName) : false;
  const level = spl ? divisionLevel(td?.division) : null;
  const kind = seriesKind(td?.leagueName);
  const rules = seriesRules(kind, td?.division);
  const points = rankingPoints(level);
  const matches = day.data ?? [];
  const firstStart = matches.map((m) => m.startsAt).filter(Boolean).sort()[0] ?? null;
  const deadline = lineupDeadline(firstStart);
  const title = t('Speldag {day}', { day: fmtDay(`${date}T12:00:00`) });

  if (team.error) {
    return (
      <>
        <AppHeader back={`/lag/${tid}`} backLabel={t('Laget')} />
        <Page>
          <ErrorBox error={team.error} onRetry={() => team.reload()} />
        </Page>
      </>
    );
  }
  if (!td) {
    return (
      <>
        <AppHeader back={`/lag/${tid}`} backLabel={t('Laget')} />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const sideOf = (m: DayMatch) => (m.tm.teams[0].id === tid ? 0 : 1);
  const lineupSet = (m: DayMatch, side: 0 | 1) => m.tm.slots.length > 0 && m.tm.slots.every((s) => (side === 0 ? s.first : s.second).filter((id) => id > 0).length >= 2);
  const unlicensed = td.players.filter((p) => !p.hasLicense);
  const today = new Date().toLocaleDateString('sv-SE');
  const isPastOrToday = date <= today;
  const isPast = date < today;
  const resultsMissing = isPastOrToday ? matches.reduce((n, m) => n + m.tm.matches.filter((x) => !x.played).length, 0) : 0;
  // In SPL the whole division plays at one venue per day; Rankedin puts the
  // venue on one of the day's fixtures.
  const venue = (poolDay.data ?? []).map((f) => f.location).find(Boolean) ?? matches.map((m) => m.fixture.location).find(Boolean) ?? null;
  const norm = (x: string | null | undefined) => (x ?? '').toLowerCase().replace(/[^a-zåäö0-9]/g, '');
  const hosting = !!venue && !!td.club && (norm(venue).includes(norm(td.club)) || norm(td.club).includes(norm(venue)));

  return (
    <>
      <AppHeader back={`/lag/${tid}`} backLabel={td.name} title={title} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{title}</h1>
            <p className="muted">
              {td.name} · {td.division}
              {venue ? ` · ${venue}` : ''}
              {soon(`${date}T12:00:00`) ? ` · ${soon(`${date}T12:00:00`)}` : ''}
            </p>
          </div>
          <RefreshButton onClick={() => day.reload()} loading={day.loading} />
        </div>

        {day.error && <ErrorBox error={day.error} onRetry={() => day.reload()} />}
        {!day.data && day.loading && <Loading />}
        {day.data && matches.length === 0 && <Empty>{t('Laget har ingen lagmatch den här dagen.')}</Empty>}

        {matches.length > 0 && (
          <div className="checklist">
            <h2 className="h3">{isPast ? t('Resultat') : t('Checklista')}</h2>
            <ul>
              {!isPast && matches.map((m) => {
                const s = sideOf(m);
                const opp = m.tm.teams[1 - s].name;
                return (
                  <li key={m.fixture.teamMatchId} className={lineupSet(m, s as 0 | 1) ? 'ok' : 'todo'}>
                    {t('Uppställning mot {opponent}:', { opponent: opp })} {lineupSet(m, s as 0 | 1) ? t('inlagd') : m.tm.slots.length ? t('inte inlagd') : t('matcherna inte öppnade i Rankedin än')}
                    {lineupSet(m, (1 - s) as 0 | 1) ? <span className="muted"> · {t('motståndaren har lagt in')}</span> : null}
                  </li>
                );
              })}
              {!isPast && deadline && (
                <li className="info">
                  {t('Uppställning senast')} <strong>{fmtTime(deadline.toISOString())}</strong> ({t('15 min före första matchen')}{level != null && level >= 2 ? t('; match 3 senast 5 min efter match 1–2') : ''}).
                </li>
              )}
              {!isPast && <li className={unlicensed.length ? 'todo' : 'ok'}>
                {unlicensed.length ? t('Licens saknas: {names}', { names: unlicensed.map((p) => p.name).join(', ') }) : t('Alla i truppen har licens')}
              </li>}
              {isPastOrToday ? (
                <li className={resultsMissing ? 'todo' : 'ok'}>
                  {resultsMissing
                    ? `${resultsMissing === 1 ? t('1 resultat saknas') : t('{n} resultat saknas', { n: resultsMissing })} – ${kind === 'spl' ? t('vinnande lag rapporterar löpande') : t('rapporteras efter lagmatcherna')}`
                    : t('Alla resultat inlagda')}
                </li>
              ) : (
                <li className="info">
                  {kind === 'spl' ? t('Resultat rapporteras löpande under speldagen av vinnande lag.') : t('Resultaten rapporteras i Rankedin efter lagmatcherna. Spelarna dömer själva.')}
                </li>
              )}
              {points && (
                <li className="info">
                  {t('Rankingpoäng i {division}: {win} per vinst, {loss} per förlust.', { division: td.division ?? '', win: points.win.toLocaleString(locale()), loss: points.loss.toLocaleString(locale()) })}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="columns">
          <div>
            {matches.map((m) => {
              const s = sideOf(m);
              const opp = m.tm.teams[1 - s];
              return (
                <Section
                  key={m.fixture.teamMatchId}
                  title={`${m.fixture.home.id === tid ? t('Hemma mot {opponent}', { opponent: opp.name }) : t('Borta mot {opponent}', { opponent: opp.name })}${fmtTime(m.startsAt) ? ` · ${fmtTime(m.startsAt)}` : ''}`}
                  action={
                    <Go className="btn btn--ghost btn--small" to={`/lagmatch/${m.fixture.teamMatchId}`} from={t('Speldagen')}>
                      {t('Lagmatchen')}
                    </Go>
                  }
                >
                  <p className="small">
                    {t('Ställning')}{' '}
                    <strong>
                      {m.tm.score[s]}–{m.tm.score[1 - s]}
                    </strong>
                    {m.tm.canLineup[s] && m.tm.slots.length > 0 && (
                      <button className="btn btn--small" style={{ marginLeft: 10 }} onClick={() => setLineupFor(m)}>
                        {lineupSet(m, s as 0 | 1) ? t('Ändra uppställning') : t('Sätt uppställning')}
                      </button>
                    )}
                  </p>
                  {m.tm.matches.length === 0 && <Empty>{t('Matcherna är inte öppnade i Rankedin än.')}</Empty>}
                  {m.tm.matches.map((x, i) => (
                    <MatchCard
                      key={x.id}
                      label={t('Match {n}', { n: i + 1 })}
                      sides={x.sides}
                      sets={x.sets}
                      played={x.played}
                      date={null}
                      court={null}
                      highlightIds={td.players.map((p) => p.id)}
                      canEnterResult={x.canEnterResult}
                      awaitingConfirmation={x.awaitingConfirmation}
                      onEnterResult={() => setReporting(x)}
                    />
                  ))}
                </Section>
              );
            })}
          </div>
          <div>
            {!isPast && (
              <Section title={t('Vilka kan spela?')}>
                <AvailabilityPanel teamId={tid} date={date} players={td.players} from={t('Speldagen')} />
              </Section>
            )}
            {rules && !isPast && (hosting || (poolDay.data?.length ?? 0) > 0) && (
              <details className="fold" open={hosting}>
                <summary>{hosting ? t('Ni arrangerar: kallelse och spelschema') : t('Arrangör: kallelse och spelschema')}</summary>
                <HostTools
                  hostClub={venue ?? td.club ?? td.name}
                  division={td.division ?? ''}
                  date={date}
                  series={spl ? 'spl' : 'klubbligan'}
                  rules={rules}
                  venue={venue}
                  fixtures={poolDay.data ?? []}
                />
              </details>
            )}
          </div>
        </div>
      </Page>

      {reporting && (
        <ResultSheet
          challengeId={reporting.id}
          sides={reporting.sides}
          initial={reporting.sets}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            day.reload();
          }}
        />
      )}
      {lineupFor && (
        <LineupSheet
          teamMatch={lineupFor.tm}
          side={sideOf(lineupFor) === 0 ? 'first' : 'second'}
          leagueName={td.leagueName}
          division={td.division}
          firstMatchStart={lineupFor.startsAt}
          onClose={() => setLineupFor(null)}
          onSaved={() => {
            setLineupFor(null);
            day.reload();
          }}
        />
      )}
    </>
  );
}

function HostTools({
  hostClub,
  division,
  date,
  series,
  rules,
  fixtures,
  venue,
}: {
  hostClub: string;
  division: string;
  date: string;
  series: 'spl' | 'klubbligan';
  rules: SeriesRules;
  fixtures: Fixture[];
  venue: string | null;
}) {
  const [courts, setCourts] = useState(4);
  const [start, setStart] = useState('10:00');
  const [slot, setSlot] = useState(series === 'spl' ? 75 : 60);
  const waves = rules.waves;
  const freeThirdMatch = series === 'spl' && waves.length > 1;
  const [contact, setContact] = useState('');
  const [copied, setCopied] = useState(false);
  const teamMatches = fixtures.map((f) => ({ id: f.teamMatchId, home: f.home.name, away: f.away.name }));
  const schedule = useMemo(() => buildSchedule(teamMatches, { courts, start, slotMinutes: slot, waves }), [JSON.stringify(teamMatches), courts, start, slot, JSON.stringify(waves)]);
  const invitation = buildInvitation({
    series,
    hostClub,
    division,
    dateLabel: new Date(`${date}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    venue: venue ?? '',
    contact,
    startTime: start,
    teamMatches,
    schedule: scheduleAsText(schedule, slot),
    freeThirdMatch,
    feePerTeamMatch: series === 'spl' ? 550 : null,
  });

  if (teamMatches.length === 0) return <Empty>{t('Hittar inga lagmatcher på anläggningen den här dagen.')}</Empty>;

  return (
    <div className="stack">
      <div className="toolbar__group">
        <label className="toolbar__label">
          {t('Banor')}{' '}
          <select className="input input--inline" value={courts} onChange={(e) => setCourts(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="toolbar__label">
          {t('Start')} <input className="input input--inline" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="toolbar__label">
          {t('Min/match')}{' '}
          <select className="input input--inline" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
            {[60, 75, 90].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>{t('Tid')}</th>
            {Array.from({ length: courts }, (_, i) => (
              <th key={i}>{t('Bana {n}', { n: i + 1 })}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((s) => (
            <tr key={s.start}>
              <td>{s.start}</td>
              {s.courts.map((g, i) => (
                <td key={i} className="small">
                  {g ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <label className="field">
        <span>{t('Kontaktperson (namn, telefon, e-post)')}</span>
        <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
      </label>
      <label className="field">
        <span>{t('Kallelse – skickas {deadline}', { deadline: rules.invitationDeadline })}</span>
        <textarea className="input textarea" readOnly value={invitation} rows={14} />
      </label>
      <div className="row gap">
        <button
          className="btn btn--primary btn--small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(invitation);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? t('Kopierad') : t('Kopiera kallelse')}
        </button>
        <a className="btn btn--small" href={`mailto:?subject=${encodeURIComponent(t('Kallelse sammandrag {division}', { division }))}&body=${encodeURIComponent(invitation)}`}>
          {t('Öppna i e-post')}
        </a>
      </div>
    </div>
  );
}
