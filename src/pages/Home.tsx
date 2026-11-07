import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { searchPlayers, type PlayerHit } from '../lib/rankedin';
import { getSavedPlayers, removePlayer, type SavedPlayer } from '../lib/storage';

export default function Home() {
  const [saved, setSaved] = useState<SavedPlayer[]>(getSavedPlayers);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<PlayerHit[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const q = term.trim();
    if (q.length < 3) {
      setHits(null);
      return;
    }
    // A pasted profile link or R-number goes straight to the player.
    const rid = q.match(/R\d{9}/i)?.[0];
    if (rid) {
      navigate(`/spelare/${rid.toUpperCase()}`);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      searchPlayers(q)
        .then((h) => {
          setHits(h);
          setError(null);
        })
        .catch(setError)
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [term, navigate]);

  return (
    <>
      <AppHeader />
      <Page>
        <Section title="Mina spelare">
          {saved.length === 0 ? (
            <Empty>Sök fram ditt barn nedan och tryck på stjärnan för att spara.</Empty>
          ) : (
            <ul className="card-list">
              {saved.map((p) => (
                <li key={p.rankedinId} className="player-row">
                  <Link to={`/spelare/${p.rankedinId}`} className="player-row__link">
                    <span className="avatar" aria-hidden="true">
                      {p.name[0]}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <span className="muted small block">{p.rankedinId}</span>
                    </span>
                  </Link>
                  <button className="icon-btn" aria-label={`Ta bort ${p.name}`} onClick={() => setSaved(removePlayer(p.rankedinId))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Hitta spelare">
          <input
            className="input"
            type="search"
            placeholder="Namn, R-nummer eller profillänk"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoComplete="off"
          />
          {loading && <Loading label="Söker…" />}
          {error && <ErrorBox error={error} />}
          {hits && hits.length === 0 && <Empty>Ingen spelare hittades.</Empty>}
          {hits && hits.length > 0 && (
            <ul className="card-list">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link to={`/spelare/${h.rankedinId}`} className="player-row__link">
                    <span className="avatar" aria-hidden="true">
                      {h.name[0]}
                    </span>
                    <span>
                      <strong>{h.name}</strong>
                      <span className="muted small block">{h.rankedinId}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Döma en match">
          <form
            className="row gap"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/doma/${encodeURIComponent(code.trim())}`);
            }}
          >
            <input className="input" placeholder="Domarkod" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" />
            <button className="btn btn--primary" type="submit" disabled={!code.trim()}>
              Starta
            </button>
          </form>
        </Section>

        <Link to="/tavlingar" className="big-link">
          <span>
            <strong>Juniortävlingar</strong>
            <span className="muted small block">Step In, Level Up, SPT Future m.fl.</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      </Page>
    </>
  );
}
