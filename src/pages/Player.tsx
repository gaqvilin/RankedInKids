import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, hoursUntil, relativeDays } from '../lib/format';
import {
  getClasses,
  getClassPairs,
  getPlayerEvents,
  getProfile,
  getTournament,
  getUpcomingMatches,
  rinUrl,
  type PlayerEvent,
  type UpcomingMatch,
} from '../lib/rankedin';
import { isSaved, removePlayer, savePlayer } from '../lib/storage';
import { useAsync } from '../lib/useAsync';

type Entry = {
  event: PlayerEvent;
  closeSignInDate: string | null;
  signInOpen: boolean;
  className: string | null;
  partner: string | null;
  missingPartner: boolean;
};

/** For upcoming tournaments: which class the player is in, and whether a partner is missing. */
async function loadEntries(playerId: number, events: PlayerEvent[]): Promise<Entry[]> {
  const upcoming = events.filter((e) => e.kind === 'tournament' && e.state !== 4);
  return Promise.all(
    upcoming.map(async (event) => {
      const entry: Entry = { event, closeSignInDate: null, signInOpen: false, className: null, partner: null, missingPartner: false };
      try {
        const [header, classes] = await Promise.all([getTournament(event.id), getClasses(event.id)]);
        entry.closeSignInDate = header.closeSignInDate;
        entry.signInOpen = header.signInOpen;
        for (const c of classes) {
          const pairs = await getClassPairs(event.id, c.id);
          const pair = pairs.find((p) => p.players.some((x) => x.id === playerId));
          if (pair) {
            entry.className = c.name;
            entry.missingPartner = pair.missingPartner;
            entry.partner = pair.players.find((x) => x.id !== playerId)?.name ?? null;
            break;
          }
        }
      } catch {
        /* keep partial info */
      }
      return entry;
    }),
  );
}

export default function Player() {
  const { rid = '' } = useParams();
  const profile = useAsync(() => getProfile(rid), [rid]);
  const playerId = profile.data?.id;
  const matches = useAsync((fresh) => (playerId ? getUpcomingMatches(playerId, fresh) : Promise.resolve([])), [playerId]);
  const events = useAsync(() => (playerId ? getPlayerEvents(playerId) : Promise.resolve([])), [playerId]);
  const entries = useAsync(
    () => (playerId && events.data ? loadEntries(playerId, events.data) : Promise.resolve([])),
    [playerId, events.data],
  );
  const [saved, setSaved] = useState(() => isSaved(rid));
  const [reporting, setReporting] = useState<UpcomingMatch | null>(null);

  if (profile.error) {
    return (
      <>
        <AppHeader back="history" />
        <Page>
          <ErrorBox error={profile.error} onRetry={() => profile.reload()} />
        </Page>
      </>
    );
  }
  if (!profile.data) {
    return (
      <>
        <AppHeader back="history" />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const p = profile.data;
  const toggleSave = () => {
    if (saved) removePlayer(p.rankedinId);
    else savePlayer({ rankedinId: p.rankedinId, name: p.name, id: p.id });
    setSaved(!saved);
  };

  const finished = (events.data || []).filter((e) => e.state === 4 || e.kind !== 'tournament');

  return (
    <>
      <AppHeader back="history" />
      <Page>
        <div className="profile">
          <div className="profile__avatar" aria-hidden="true">
            {p.imageUrl ? <img src={p.imageUrl} alt="" /> : p.firstName[0]}
          </div>
          <div className="profile__info">
            <h1>{p.name}</h1>
            <p className="muted">
              {[p.club, p.age && `${p.age} år`].filter(Boolean).join(' · ')}
            </p>
            <div className="form-row" aria-label="Senaste matcherna">
              {p.form.map((f, i) => (
                <span key={i} className={`form-dot form-dot--${f === 'W' ? 'w' : 'l'}`} title={f === 'W' ? 'Vinst' : 'Förlust'}>
                  {f === 'W' ? 'V' : 'F'}
                </span>
              ))}
              <span className="muted small">Dubbel i år: {p.doublesThisYear}</span>
            </div>
          </div>
          <button className={`star ${saved ? 'star--on' : ''}`} onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Ta bort från mina spelare' : 'Spara som min spelare'}>
            ★
          </button>
        </div>

        {(entries.data || [])
          .filter((e) => e.missingPartner)
          .map((e) => {
            const h = hoursUntil(e.closeSignInDate);
            return (
              <Notice key={e.event.id} tone={h != null && h < 72 ? 'error' : 'warn'}>
                <strong>Partner saknas</strong> i {e.className} – {e.event.name}.{' '}
                {e.closeSignInDate && (
                  <>
                    Anmälan stänger {fmtDay(e.closeSignInDate)} ({relativeDays(e.closeSignInDate)}). Utan partner kommer {p.firstName} inte med i lottningen.{' '}
                  </>
                )}
                <ExternalLink href={rinUrl(e.event.link)}>Lägg till partner i Rankedin</ExternalLink>
              </Notice>
            );
          })}

        <Section title="Kommande matcher" action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
          {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}
          {!matches.data && matches.loading && <Loading />}
          {matches.data && matches.data.length === 0 && <Empty>Inga lottade matcher just nu.</Empty>}
          {matches.data?.map((m) => (
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
            />
          ))}
        </Section>

        <Section title="Anmäld till">
          {(events.loading || entries.loading) && !entries.data && <Loading />}
          {entries.data && entries.data.length === 0 && <Empty>Inga kommande tävlingar.</Empty>}
          <ul className="card-list">
            {entries.data?.map((e) => (
              <li key={e.event.id}>
                <Link
                  to={`/tavling/${e.event.id}?spelare=${p.id}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`}
                  className="event-row"
                >
                  <span className="event-row__date">
                    <strong>{fmtDay(e.event.startDate)}</strong>
                    <span className="muted small">{relativeDays(e.event.startDate)}</span>
                  </span>
                  <span className="event-row__main">
                    <strong>{e.event.name}</strong>
                    <span className="small block">
                      {e.className ?? 'Klass okänd'}
                      {e.partner ? ` · med ${e.partner}` : ''}
                      {e.missingPartner && <span className="pill pill--warn">Partner saknas</span>}
                    </span>
                    {e.signInOpen && e.closeSignInDate && (
                      <span className="muted small block">Anmälan stänger {fmtDay(e.closeSignInDate)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tidigare och ligor">
          {finished.length === 0 && !events.loading && <Empty>Inget ännu.</Empty>}
          <ul className="card-list">
            {finished.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                {e.kind === 'tournament' ? (
                  <Link to={`/tavling/${e.id}?spelare=${p.id}`} className="event-row">
                    <span className="event-row__date">
                      <strong>{fmtDay(e.startDate)}</strong>
                    </span>
                    <span className="event-row__main">
                      <strong>{e.name}</strong>
                    </span>
                  </Link>
                ) : (
                  <a href={rinUrl(e.link)} target="_blank" rel="noreferrer" className="event-row">
                    <span className="event-row__date">
                      <strong>{fmtDay(e.startDate)}</strong>
                    </span>
                    <span className="event-row__main">
                      <strong>{e.name}</strong>
                      <span className="muted small block">{e.kind === 'teamleague' ? 'Lagliga' : 'Liga'} · öppnas i Rankedin</span>
                    </span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <p className="center">
          <ExternalLink href={rinUrl(`/sv/player/${p.rankedinId}`)}>Profil på Rankedin</ExternalLink>
        </p>
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
