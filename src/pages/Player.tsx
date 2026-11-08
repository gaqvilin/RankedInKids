import { rememberRecentPlayer } from '../lib/storage';
import { seriesKind, showsStandings } from '../lib/rules';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
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
export function LeagueTeamCard({ t, from, hideNext = false }: { t: LeagueTeamSummary; from: string; hideNext?: boolean }) {
  const opponent = t.next ? (t.next.home.id === t.teamId ? t.next.away : t.next.home) : null;
  // A speldag often has two team matches: name every opponent that day.
  const nextDay = t.next?.date?.slice(0, 10);
  const nextOpponents = nextDay
    ? [...new Set(t.upcoming.filter((f) => f.date?.slice(0, 10) === nextDay).map((f) => (f.home.id === t.teamId ? f.away.name : f.home.name)))]
    : [];
  const last = t.last;
  const lastOwn = last ? (last.home.id === t.teamId ? last.home : last.away) : null;
  const lastOpp = last ? (last.home.id === t.teamId ? last.away : last.home) : null;
  // The last speldag as a whole: "Senast lör 7 nov: vann 5–1 mot GLTK, förlorade 1–5 mot Halmstad".
  const lastDay = t.lastDay?.length ? t.lastDay : last ? [last] : [];
  const tally = lastDay.reduce(
    (acc, f) => {
      const [own, opp] = f.home.id === t.teamId ? [f.home, f.away] : [f.away, f.home];
      const d = (Number(own.result) || 0) - (Number(opp.result) || 0);
      return d > 0 ? { ...acc, w: acc.w + 1 } : d < 0 ? { ...acc, l: acc.l + 1 } : acc;
    },
    { w: 0, l: 0 },
  );
  const lastSummary = lastDay.length
    ? `Senast ${fmtDay(lastDay[0].date)}: ${[tally.w ? `${tally.w} vinst${tally.w > 1 ? 'er' : ''}` : null, tally.l ? `${tally.l} förlust${tally.l > 1 ? 'er' : ''}` : null].filter(Boolean).join(', ') || 'oavgjort'}`
    : lastOwn && lastOpp
      ? `Senast ${lastOwn.result}–${lastOpp.result} mot ${lastOpp.name}`
      : null;
  return (
    <Go to={`/lag/${t.teamId}`} from={from} className="item">
      <span className="item__main">
        <strong>{t.teamName}</strong>
        <span className="muted small block">{t.leagueName.replace(/\s*\b(HT|VT)\s*\d{2}\b.*$/i, '').replace(/^SPL Swedish Padel League\s*/i, 'SPL ')}</span>
        {!t.active && <span className="muted small block">{fmtRange(t.startDate, t.endDate)}</span>}
      </span>
      {t.active && (
        <span className="item__side small">
          {t.position != null && showsStandings(seriesKind(t.leagueName)) && (
            <span className="block">
              Plats <strong>{t.position}</strong>
              {t.teamsInDivision ? ` av ${t.teamsInDivision}` : ''}
            </span>
          )}
          {lastSummary && <span className="block muted">{lastSummary}</span>}
          {!hideNext && opponent && t.next && (
            <span className="block muted">
              Nästa {fmtDay(t.next.date)} mot {nextOpponents.length ? nextOpponents.join(' och ') : opponent.name}
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
        <AppHeader back="/" backLabel="Översikt" />
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
      <AppHeader back="/" backLabel="Översikt" title={p.name} />
      <Page wide>
        <div className="page-title">
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
              {[p.age && `${p.age} år`, p.doublesThisYear && `dubbel i år ${p.doublesThisYear}`]
                .filter(Boolean)
                .map((part, i) => (
                  <span key={i} className="nowrap">
                    {i > 0 || p.club ? ' · ' : ''}
                    {part}
                  </span>
                ))}
            </p>
          </div>
          <button className={`btn btn--small ${saved ? '' : 'btn--primary'}`} onClick={toggleSave} aria-pressed={saved}>
            {saved ? 'Sparad' : 'Spara som min spelare'}
          </button>
        </div>

        {o?.entries
          .filter((e) => e.missingPartner)
          .map((e) => {
            const h = hoursUntil(e.closeSignInDate);
            return (
              <Notice key={e.event.id} tone={h != null && h < 72 ? 'error' : 'warn'}>
                <strong>Partner saknas</strong> till {e.event.name.split(/\s[\/–-]\s/)[0]}
                {e.closeSignInDate ? ` – anmälan stänger ${relativeDays(e.closeSignInDate)} ${fmtTime(e.closeSignInDate)}` : ''}.{' '}
                <Go to={`/tavling/${e.event.id}?spelare=${p.id}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`} from={p.firstName}>
                  Lös det
                </Go>
              </Notice>
            );
          })}

        <div className="columns">
          <div>
            {matches.data && matches.data.length > 0 && (
              <Section title="Lottade matcher" action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
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

            <Section title="Schema">
              {!o && overview.loading && <Loading />}
              {o && agenda.length === 0 && <Empty>Inget inbokat just nu.</Empty>}
              {agenda.length > 0 && <Agenda items={agenda} playerId={p.id} from={p.firstName} />}
            </Section>
          </div>

          <div>
            <Section title="Lag">
              {!o && overview.loading && <Loading />}
              {o && o.leagueTeams.length === 0 && <Empty>Inget lag i någon serie.</Empty>}
              {activeTeams.length > 0 && (
                <div className="list">
                  {activeTeams.map((t) => (
                    <div key={t.leagueId}>
                      <LeagueTeamCard t={t} from={p.firstName} hideNext />
                      <PlayerRound team={t} playerId={p.id} rankedinId={p.rankedinId} from={p.firstName} />
                    </div>
                  ))}
                </div>
              )}
              {pastTeams.length > 0 && (
                <details className="fold">
                  <summary>Tidigare säsonger ({pastTeams.length})</summary>
                  <div className="list">
                    {pastTeams.map((t) => (
                      <LeagueTeamCard key={t.leagueId} t={t} from={p.firstName} />
                    ))}
                  </div>
                </details>
              )}
            </Section>

            {o && o.pastTournaments.length > 0 && (
              <details className="fold">
                <summary>Tidigare tävlingar ({o.pastTournaments.length})</summary>
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
              <ExternalLink href={rinUrl(`/sv/player/${p.rankedinId}`)}>Profil på Rankedin</ExternalLink>
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
