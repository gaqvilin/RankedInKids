import { t } from '../lib/i18n';
import { useState } from 'react';
import { PlayerHitRow } from '../components/PlayerHitRow';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { useKnownPlayers } from '../lib/known';
import { clearRecentPlayers, getRecentPlayers } from '../lib/storage';
import { usePlayerSearch } from '../lib/usePlayerSearch';

export default function Search() {
  const { term, setTerm, hits, error, loading } = usePlayerSearch(t('Sök'), '/sok');
  const known = useKnownPlayers();
  const [recent, setRecent] = useState(getRecentPlayers);
  const mineIds = new Set(known.map((k) => k.rankedinId));
  const badge = (rid: string) => (mineIds.has(rid) ? t('Min spelare') : undefined);

  return (
    <>
      <AppHeader title={t('Sök')} />
      <Page>
        <div className="page-title">
          <h1>{t('Sök spelare')}</h1>
        </div>
        <input
          className="input input--search"
          type="search"
          placeholder={t('Namn, R-nummer eller Rankedin-länk')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoComplete="off"
          autoFocus
          aria-label={t('Sök spelare')}
        />
        <p className="muted small">{t('Alla spelare i Rankedin – motståndare, lagkamrater, partner. Skriv minst 3 bokstäver.')}</p>

        {loading && <Loading label={t('Söker…')} />}
        {error && <ErrorBox error={error} />}
        {hits && hits.length === 0 && !loading && <Empty>{t('Ingen spelare hittades. Prova bara efternamnet.')}</Empty>}
        {hits && hits.length > 0 && (
          <Section title={t('Träffar ({n})', { n: `${hits.length}${hits.length === 12 ? '+' : ''}` })}>
            <div className="list">
              {hits.map((h) => (
                <PlayerHitRow key={h.id} h={h} from={t('Sök')} badge={badge(h.rankedinId)} />
              ))}
            </div>
            {hits.length === 12 && <p className="muted small">{t('Visar de 12 första. Skriv mer av namnet för att hitta rätt.')}</p>}
          </Section>
        )}

        {!hits && recent.length > 0 && (
          <Section
            title={t('Senast visade')}
            action={
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  clearRecentPlayers();
                  setRecent([]);
                }}
              >
                {t('Rensa')}
              </button>
            }
          >
            <div className="list">
              {recent.map((p) => (
                <PlayerHitRow key={p.rankedinId} h={p} from={t('Sök')} badge={badge(p.rankedinId)} />
              ))}
            </div>
          </Section>
        )}
      </Page>
    </>
  );
}
