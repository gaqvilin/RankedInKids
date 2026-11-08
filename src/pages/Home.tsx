import { PlayerHitRow } from '../components/PlayerHitRow';
import { usePlayerSearch } from '../lib/usePlayerSearch';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Notice, Page, Section } from '../components/ui';
import { fmtDay, relativeDays } from '../lib/format';
import { loadOverview } from '../lib/overview';
import { useMine } from '../lib/mine';
import { getUpcomingMatches } from '../lib/rankedin';
import { useKnownPlayers } from '../lib/known';
import { getSavedPlayers, removePlayer, type SavedPlayer } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { LeagueTeamCard } from './Player';

/** The most important things for one saved child, without clicking further. */
function PlayerSummary({ p, onRemove }: { p: SavedPlayer; onRemove?: () => void }) {
  const { version } = useSession();
  const first = p.name.split(' ')[0];
  const matches = useAsync(() => getUpcomingMatches(p.id), [p.id, version], `matches.${p.id}`);
  const overview = useAsync(() => loadOverview(p.id), [p.id], `overview.${p.id}`);
  const o = overview.data;
  const next = matches.data?.[0];
  const missing = o?.entries.filter((e) => e.missingPartner) ?? [];
  const activeTeams = o?.leagueTeams.filter((t) => t.active) ?? [];

  return (
    <section className="summary">
      <div className="summary__head">
        <h2>
          <Go to={`/spelare/${p.rankedinId}`} from="Översikt">
            {p.name}
          </Go>
        </h2>
        {onRemove ? (
          <button className="link-btn small muted" onClick={onRemove}>
            Ta bort
          </button>
        ) : (
          <span className="small muted">Inloggad</span>
        )}
      </div>

      {missing.map((e) => (
        <Notice key={e.event.id} tone="error">
          <strong>Partner saknas</strong> i {e.className}, {e.event.name}. Anmälan stänger {fmtDay(e.closeSignInDate)} ({relativeDays(e.closeSignInDate)}).
        </Notice>
      ))}

      {next && (
        <>
          <p className="list-label">Nästa lottade match</p>
          <MatchCard
            sides={next.sides}
            sets={next.sets}
            played={next.sets.length > 0}
            date={next.date}
            court={next.court}
            showDay
            label={next.eventName}
            highlightIds={[p.id]}
            refereeCode={next.refereeCode}
            teamMatchPath={next.teamMatchId ? `/lagmatch/${next.teamMatchId}?spelare=${p.id}` : undefined}
            from="Översikt"
          />
        </>
      )}
      {!o && <Loading />}
      {activeTeams.length > 0 && (
        <div className="list">
          {activeTeams.map((t) => (
            <LeagueTeamCard key={t.leagueId} t={t} from="Översikt" />
          ))}
        </div>
      )}
      {o && !next && activeTeams.length === 0 && o.entries.length === 0 && <p className="muted small">Inget på gång just nu.</p>}
      <p className="small">
        <Go to={`/spelare/${p.rankedinId}`} from="Översikt">
          Allt om {first} →
        </Go>
      </p>
    </section>
  );
}

export default function Home() {
  const [saved, setSaved] = useState<SavedPlayer[]>(getSavedPlayers);
  const known = useKnownPlayers();
  const mine = useMine();
  const shown = [...saved, ...known.filter((k) => !saved.some((s) => s.rankedinId === k.rankedinId))];
  const { term, setTerm, hits, error, loading } = usePlayerSearch('Översikt', '/');
  const [code, setCode] = useState('');
  const navigate = useNavigate();


  return (
    <>
      <AppHeader title="Översikt" />
      <Page wide>
        <div className="page-title">
          <h1>Översikt</h1>
        </div>

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
                      <span className="muted small">{relativeDays(`${u.date}T12:00:00`)}</span>
                    </span>
                    <span className="item__main">
                      <strong>{u.title}</strong>
                      <span className={`small block ${/partner saknas/.test(u.detail) ? 'text-warn' : 'muted'}`}>
                        {u.detail}
                        {shown.length > 1 ? ` · ${u.who.join(', ')}` : ''}
                      </span>
                    </span>
                  </Go>
                ))}
              </div>
            )}
          </Section>
        )}

        <div className="summaries">
          {shown.map((p) => {
            const isSaved = saved.some((s) => s.rankedinId === p.rankedinId);
            return <PlayerSummary key={p.rankedinId} p={p} onRemove={isSaved ? () => setSaved(removePlayer(p.rankedinId)) : undefined} />;
          })}
        </div>

        <Section title={shown.length ? 'Lägg till spelare' : 'Hitta ditt barn'}>
          {shown.length === 0 && <p className="muted">Sök på namn och spara spelaren, så samlas allt viktigt här.</p>}
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

        <Section title="Döma en match">
          <form
            className="row gap"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/doma/${encodeURIComponent(code.trim())}`, { state: { from: { label: 'Översikt', to: '/' } } });
            }}
          >
            <input className="input" placeholder="Domarkod" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" />
            <button className="btn" type="submit" disabled={!code.trim()}>
              Starta
            </button>
          </form>
        </Section>
      </Page>
    </>
  );
}
