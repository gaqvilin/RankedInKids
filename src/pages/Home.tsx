import { PlayerHitRow } from '../components/PlayerHitRow';
import { usePlayerSearch } from '../lib/usePlayerSearch';
import { useState } from 'react';
import { MatchCard } from '../components/MatchCard';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Notice, Page, Section } from '../components/ui';
import { fmtDay, hoursUntil, relativeDays, soon } from '../lib/format';
import { loadOverview } from '../lib/overview';
import { useMine } from '../lib/mine';
import { getUpcomingMatches } from '../lib/rankedin';
import { useKnownPlayers } from '../lib/known';
import { getSavedPlayers, type SavedPlayer } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

/** Only what needs attention for one player: a missing partner, or a drawn match coming up within a week. */
function PlayerAlerts({ p, showName }: { p: SavedPlayer; showName: boolean }) {
  const { version } = useSession();
  const matches = useAsync(() => getUpcomingMatches(p.id), [p.id, version], `matches.${p.id}`);
  const overview = useAsync(() => loadOverview(p.id), [p.id], `overview.${p.id}`);
  const missing = overview.data?.entries.filter((e) => e.missingPartner) ?? [];
  const next = matches.data?.find((m) => m.date && hoursUntil(m.date) != null && hoursUntil(m.date)! < 24 * 7);
  if (!missing.length && !next) return null;
  const first = p.name.split(' ')[0];
  return (
    <>
      {missing.map((e) => (
        <Notice key={e.event.id} tone="error">
          <strong>{showName ? `${first}: partner saknas` : 'Partner saknas'}</strong> till {e.event.name.split(/\s[\/–-]\s/)[0]} – anmälan stänger{' '}
          {relativeDays(e.closeSignInDate)}.{' '}
          <Go to={`/tavling/${e.event.id}?spelare=${p.id}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`} from="Översikt">
            Lös det
          </Go>
        </Notice>
      ))}
      {next && (
        <MatchCard
          sides={next.sides}
          sets={next.sets}
          played={next.sets.length > 0}
          date={next.date}
          court={next.court}
          showDay
          label={showName ? `${first} · ${next.eventName}` : next.eventName}
          highlightIds={[p.id]}
          refereeCode={next.refereeCode}
          teamMatchPath={next.teamMatchId ? `/lagmatch/${next.teamMatchId}?spelare=${p.id}` : undefined}
          from="Översikt"
        />
      )}
    </>
  );
}

export default function Home() {
  const [saved] = useState<SavedPlayer[]>(getSavedPlayers);
  const known = useKnownPlayers();
  const mine = useMine();
  const shown = [...saved, ...known.filter((k) => !saved.some((s) => s.rankedinId === k.rankedinId))];
  const { term, setTerm, hits, error, loading } = usePlayerSearch('Översikt', '/');
  // Name who it's for only when items belong to different players.
  const multiWho = new Set((mine.data?.upcoming ?? []).flatMap((u) => u.who)).size > 1;


  return (
    <>
      <AppHeader title="Översikt" />
      <Page wide>
        <div className="page-title">
          <h1>Översikt</h1>
        </div>

        {shown.length > 0 && (
          <div className="stack alerts">
            {shown.map((p) => (
              <PlayerAlerts key={p.rankedinId} p={p} showName={shown.length > 1} />
            ))}
          </div>
        )}

        {shown.length > 0 && (
          <Section title="På gång">
            {!mine.data && <Loading />}
            {mine.data && mine.data.upcoming.length === 0 && <Empty>Inget inbokat just nu.</Empty>}
            {mine.data && mine.data.upcoming.length > 0 && (
              <div className="list">
                {mine.data.upcoming.map((u) => (
                  <Go key={u.to} to={u.to} from="Översikt" className="item">
                    <span className="item__date">
                      {fmtDay(`${u.date}T12:00:00`)}
                      <span className="muted small">{soon(`${u.date}T12:00:00`)}</span>
                    </span>
                    <span className="item__main">
                      <strong>{u.title}</strong>
                      <span className={`small block ${/partner saknas/.test(u.detail) ? 'text-warn' : 'muted'}`}>
                        {u.detail}
                        {multiWho ? ` · ${u.who.join(', ')}` : ''}
                      </span>
                    </span>
                  </Go>
                ))}
              </div>
            )}
          </Section>
        )}

        {shown.length > 0 && (
          <Section
            title="Mina spelare"
            action={
              <Go className="btn btn--ghost btn--small" to="/sok" from="Översikt">
                + Lägg till
              </Go>
            }
          >
            <div className="list">
              {shown.map((p) => (
                <Go key={p.rankedinId} to={`/spelare/${p.rankedinId}`} from="Översikt" className="item">
                  <span className="item__main">
                    <strong>{p.name}</strong>
                  </span>
                </Go>
              ))}
            </div>
          </Section>
        )}

        {shown.length === 0 ? (
        <Section title="Hitta ditt barn">
          {true && <p className="muted">Sök på namn och spara spelaren, så samlas allt viktigt här.</p>}
          <input
            className="input"
            type="search"
            placeholder="Namn, R-nummer eller Rankedin-länk"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoComplete="off"
          />
          {loading && <Loading label="Söker…" />}
          {error && <ErrorBox error={error} />}
          {hits && hits.length === 0 && <Empty>Ingen spelare hittades.</Empty>}
          {hits && hits.length > 0 && (
            <div className="list">
              {hits.map((h) => (
                <PlayerHitRow key={h.id} h={h} from="Översikt" />
              ))}
            </div>
          )}
        </Section>
        ) : null}

      </Page>
    </>
  );
}
