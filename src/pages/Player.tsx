import { t } from '../lib/i18n';
import { rememberRecentPlayer } from '../lib/storage';
import { seriesKind, showsStandings } from '../lib/rules';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { Go } from '../components/shell';
import { AppHeader, Avatar, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, hoursUntil, relativeDays } from '../lib/format';
import { buildAgenda, loadOverview, type LeagueTeamSummary } from '../lib/overview';
import { Agenda } from '../components/Agenda';
import { PlayerRound } from '../components/PlayerRound';
import { getProfile, getUpcomingMatches, rinUrl, type UpcomingMatch } from '../lib/rankedin';
import { isSaved, removePlayer, savePlayer } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export function fmtRange(start: string | null, end: string | null): string {
  if (!start) return '';
  return end ? `${fmtDay(start)} – ${fmtDay(end)}` : fmtDay(start);
}

/** hideNext: the page shows the next speldag right below (Player page). */
export function LeagueTeamCard({ t: team, from, hideNext = false }: { t: LeagueTeamSummary; from: string; hideNext?: boolean }) {
  const opponent = team.next ? (team.next.home.id === team.teamId ? team.next.away : team.next.home) : null;
  // A speldag often has two team matches: name every opponent that day.
  const nextDay = team.next?.date?.slice(0, 10);
  const nextOpponents = nextDay
    ? [...new Set(team.upcoming.filter((f) => f.date?.slice(0, 10) === nextDay).map((f) => (f.home.id === team.teamId ? f.away.name : f.home.name)))]
    : [];
  const last = team.last;
  const lastOwn = last ? (last.home.id === team.teamId ? last.home : last.away) : null;
  const lastOpp = last ? (last.home.id === team.teamId ? last.away : last.home) : null;
  // The last speldag as a whole: "Senast lör 7 nov: vann 5–1 mot GLTK, förlorade 1–5 mot Halmstad".
  const lastDay = team.lastDay?.length ? team.lastDay : last ? [last] : [];
  const tally = lastDay.reduce(
    (acc, f) => {
      const [own, opp] = f.home.id === team.teamId ? [f.home, f.away] : [f.away, f.home];
      const d = (Number(own.result) || 0) - (Number(opp.result) || 0);
      return d > 0 ? { ...acc, w: acc.w + 1 } : d < 0 ? { ...acc, l: acc.l + 1 } : acc;
    },
    { w: 0, l: 0 },
  );
  const lastSummary = lastDay.length
    ? t('Senast {day}: {summary}', {
        day: fmtDay(lastDay[0].date),
        summary:
          [
            tally.w ? (tally.w > 1 ? t('{n} vinster', { n: tally.w }) : t('1 vinst')) : null,
            tally.l ? (tally.l > 1 ? t('{n} förluster', { n: tally.l }) : t('1 förlust')) : null,
          ]
            .filter(Boolean)
            .join(', ') || t('oavgjort'),
      })
    : lastOwn && lastOpp
      ? t('Senast {own}–{opp} mot {name}', { own: lastOwn.result ?? '', opp: lastOpp.result ?? '', name: lastOpp.name })
      : null;
  return (
    <Go to={`/lag/${team.teamId}`} from={from} className="item">
      <span className="item__main">
        <strong>{team.teamName}</strong>
        <span className="muted small block">{team.leagueName.replace(/\s*\b(HT|VT)\s*\d{2}\b.*$/i, '').replace(/^SPL Swedish Padel League\s*/i, 'SPL ')}</span>
        {!team.active && <span className="muted small block">{fmtRange(team.startDate, team.endDate)}</span>}
      </span>
      {team.active && (
        <span className="item__side small">
          {team.position != null && showsStandings(seriesKind(team.leagueName)) && (
            <span className="block">
              {t('Plats')} <strong>{team.position}</strong>
              {team.teamsInDivision ? ` ${t('av')} ${team.teamsInDivision}` : ''}
            </span>
          )}
          {lastSummary && <span className="block muted">{lastSummary}</span>}
          {!hideNext && opponent && team.next && (
            <span className="block muted">
              {t('Nästa {day} mot {opponents}', { day: fmtDay(team.next.date), opponents: nextOpponents.length ? nextOpponents.join(` ${t('och')} `) : opponent.name })}
            </span>
          )}
        </span>
      )}
    </Go>
  );
}

export default function Player() {
  const { rid = '' } = useParams();
  const { version } = useSession();
  const profile = useAsync(() => getProfile(rid), [rid], `profile.${rid}`);
  const playerId = profile.data?.id;
  useEffect(() => {
    const p = profile.data;
    if (p && p.rankedinId === rid) rememberRecentPlayer({ id: p.id, rankedinId: p.rankedinId, name: p.name });
  }, [profile.data, rid]);
  const matches = useAsync((fresh) => (playerId ? getUpcomingMatches(playerId, fresh, true) : Promise.resolve([])), [playerId, version]);
  const overview = useAsync(() => (playerId ? loadOverview(playerId) : Promise.resolve(null)), [playerId], playerId ? `overview.${playerId}` : undefined);
  const [saved, setSaved] = useState(() => isSaved(rid));
  useEffect(() => setSaved(isSaved(rid)), [rid]);
  const [reporting, setReporting] = useState<UpcomingMatch | null>(null);

  if (profile.error || !profile.data) {
    return (
      <>
        <AppHeader back="/" backLabel={t('Översikt')} />
        <Page>{profile.error ? <ErrorBox error={profile.error} onRetry={() => profile.reload()} /> : <Loading />}</Page>
      </>
    );
  }

  const p = profile.data;
  const o = overview.data;
  const toggleSave = () => {
    if (saved) removePlayer(p.rankedinId);
    else savePlayer({ rankedinId: p.rankedinId, name: p.name, id: p.id });
    setSaved(!saved);
  };
  const activeTeams = o?.leagueTeams.filter((t) => t.active) ?? [];
  const agenda = o ? buildAgenda(o.entries, o.leagueTeams) : [];
  const pastTeams = o?.leagueTeams.filter((t) => !t.active) ?? [];

  return (
    <>
      <AppHeader back="/" backLabel={t('Översikt')} title={p.name} />
      <Page wide>
        <div className="page-title">
          <div className="page-title__who">
            <Avatar name={p.name} imageUrl={p.imageUrl} large />
            <div>
            <h1>{p.name}</h1>
            <p className="muted">
              {p.club &&
                (p.clubId ? (
                  <Go to={`/klubb/${p.clubId}`} from={p.firstName} className="nowrap">
                    {p.club}
                  </Go>
                ) : (
                  p.club
                ))}
              {[p.age && t('{n} år', { n: p.age }), p.doublesThisYear && t('dubbel i år {n}', { n: p.doublesThisYear })]
                .filter(Boolean)
                .map((part, i) => (
                  <span key={i}>
                    {i > 0 || p.club ? ' · ' : ''}
                    <span className="nowrap">{part}</span>
                  </span>
                ))}
            </p>
            </div>
          </div>
          <button className={`btn btn--small ${saved ? '' : 'btn--primary'}`} onClick={toggleSave} aria-pressed={saved}>
            {saved ? t('Sparad') : t('Spara som min spelare')}
          </button>
        </div>

        {o?.entries
          .filter((e) => e.missingPartner)
          .map((e) => {
            const h = hoursUntil(e.closeSignInDate);
            return (
              <Notice key={e.event.id} tone={h != null && h < 72 ? 'error' : 'warn'}>
                <strong>{t('Partner saknas')}</strong>{' '}
                {e.closeSignInDate
                  ? t('till {event} – anmälan stänger {when}.', { event: e.event.name.split(/\s[\/–-]\s/)[0], when: `${relativeDays(e.closeSignInDate)} ${fmtTime(e.closeSignInDate)}` })
                  : t('till {event}.', { event: e.event.name.split(/\s[\/–-]\s/)[0] })}{' '}
                <Go to={`/tavling/${e.event.id}?spelare=${p.id}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`} from={p.firstName}>
                  {t('Lös det')}
                </Go>
              </Notice>
            );
          })}

        <div className="columns">
          <div>
            {matches.data && matches.data.length > 0 && (
              <Section title={t('Lottade matcher')} action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
                {matches.data.map((m) => (
                  <MatchCard
                    key={m.challengeId}
                    sides={m.sides}
                    sets={m.sets}
                    played={m.sets.length > 0}
                    date={m.date}
                    court={m.court}
                    showDay
                    label={m.teamNames ? `${m.eventName} · ${m.teamNames.join(' – ')}` : m.eventName}
                    highlightIds={[p.id]}
                    refereeCode={m.refereeCode}
                    canEnterResult={m.canEnterResult}
                    awaitingConfirmation={m.awaitingConfirmation}
                    onEnterResult={() => setReporting(m)}
                    teamMatchPath={m.teamMatchId ? `/lagmatch/${m.teamMatchId}?spelare=${p.id}` : undefined}
                    from={p.firstName}
                  />
                ))}
              </Section>
            )}
            {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}

            <Section title={t('Schema')}>
              {!o && overview.loading && <Loading />}
              {o && agenda.length === 0 && <Empty>{t('Inget inbokat just nu.')}</Empty>}
              {agenda.length > 0 && <Agenda items={agenda} playerId={p.id} from={p.firstName} />}
            </Section>
          </div>

          <div>
            <Section title={t('Lag')}>
              {!o && overview.loading && <Loading />}
              {o && o.leagueTeams.length === 0 && <Empty>{t('Inget lag i någon serie.')}</Empty>}
              {activeTeams.length > 0 && (
                <div className="list">
                  {activeTeams.map((lt) => (
                    <div key={lt.leagueId}>
                      <LeagueTeamCard t={lt} from={p.firstName} hideNext />
                      <PlayerRound team={lt} playerId={p.id} rankedinId={p.rankedinId} from={p.firstName} />
                    </div>
                  ))}
                </div>
              )}
              {pastTeams.length > 0 && (
                <details className="fold">
                  <summary>{t('Tidigare säsonger ({n})', { n: pastTeams.length })}</summary>
                  <div className="list">
                    {pastTeams.map((lt) => (
                      <LeagueTeamCard key={lt.leagueId} t={lt} from={p.firstName} />
                    ))}
                  </div>
                </details>
              )}
            </Section>

            {o && o.pastTournaments.length > 0 && (
              <details className="fold">
                <summary>{t('Tidigare tävlingar ({n})', { n: o.pastTournaments.length })}</summary>
                <div className="list">
                  {o.pastTournaments.map((e) => (
                    <Go key={e.id} from={p.firstName} to={`/tavling/${e.id}?spelare=${p.id}`} className="item">
                      <span className="item__date">{fmtDay(e.startDate)}</span>
                      <span className="item__main">{e.name}</span>
                    </Go>
                  ))}
                </div>
              </details>
            )}

            <p className="small">
              <ExternalLink href={rinUrl(`/sv/player/${p.rankedinId}`)}>{t('Profil på Rankedin')}</ExternalLink>
            </p>
          </div>
        </div>
      </Page>

      {reporting && (
        <ResultSheet
          challengeId={reporting.challengeId}
          sides={reporting.sides}
          initial={reporting.sets}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            matches.reload();
          }}
        />
      )}
    </>
  );
}
