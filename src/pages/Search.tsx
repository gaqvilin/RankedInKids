import { useState } from 'react';
import { PlayerHitRow } from '../components/PlayerHitRow';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { useKnownPlayers } from '../lib/known';
import { clearRecentPlayers, getRecentPlayers } from '../lib/storage';
import { usePlayerSearch } from '../lib/usePlayerSearch';

export default function Search() {
  const { term, setTerm, hits, error, loading } = usePlayerSearch('Sök', '/sok');
  const known = useKnownPlayers();
  const [recent, setRecent] = useState(getRecentPlayers);
  const mineIds = new Set(known.map((k) => k.rankedinId));
  const badge = (rid: string) => (mineIds.has(rid) ? 'Min spelare' : undefined);

  return (
    <>
      <AppHeader title="Sök" />
      <Page>
        <div className="page-title">
          <h1>Sök spelare</h1>
        </div>
        <input
          className="input input--search"
          type="search"
          placeholder="Namn, R-nummer eller Rankedin-länk"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoComplete="off"
          autoFocus
          aria-label="Sök spelare"
        />
        <p className="muted small">Alla spelare i Rankedin – motståndare, lagkamrater, partner. Skriv minst 3 bokstäver.</p>

        {loading && <Loading label="Söker…" />}
        {error && <ErrorBox error={error} />}
        {hits && hits.length === 0 && !loading && <Empty>Ingen spelare hittades. Prova bara efternamnet.</Empty>}
        {hits && hits.length > 0 && (
          <Section title={`Träffar (${hits.length}${hits.length === 12 ? '+' : ''})`}>
            <div className="list">
              {hits.map((h) => (
                <PlayerHitRow key={h.id} h={h} from="Sök" badge={badge(h.rankedinId)} />
              ))}
            </div>
            {hits.length === 12 && <p className="muted small">Visar de 12 första. Skriv mer av namnet för att hitta rätt.</p>}
          </Section>
        )}

        {!hits && recent.length > 0 && (
          <Section
            title="Senast visade"
            action={
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  clearRecentPlayers();
                  setRecent([]);
                }}
              >
                Rensa
              </button>
            }
          >
            <div className="list">
              {recent.map((p) => (
                <PlayerHitRow key={p.rankedinId} h={p} from="Sök" badge={badge(p.rankedinId)} />
              ))}
            </div>
          </Section>
        )}
      </Page>
    </>
  );
}
