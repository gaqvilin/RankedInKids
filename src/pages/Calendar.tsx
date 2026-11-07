import { useState } from 'react';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { fmtDay, relativeDays } from '../lib/format';
import { getJuniorCalendar } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

type Geo = { lat: number; lng: number } | null;

const LEVELS = ['Alla', 'Step In', 'Level Up', 'SPT Future', 'USM'];

export default function Calendar() {
  const [geo, setGeo] = useState<Geo>(null);
  const [radius, setRadius] = useState(100);
  const [level, setLevel] = useState('Alla');
  const [geoError, setGeoError] = useState<string | null>(null);
  const events = useAsync(() => getJuniorCalendar(geo ? { ...geo, radiusKm: radius } : {}), [geo, radius]);

  const list = (events.data || []).filter((e) => level === 'Alla' || e.name.toLowerCase().includes(level.toLowerCase()));

  function useMyPosition() {
    setGeoError(null);
    navigator.geolocation?.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Kunde inte hämta din position.'),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }

  return (
    <>
      <AppHeader title="Tävlingar" />
      <Page wide>
        <div className="page-title">
          <h1>Juniortävlingar</h1>
        </div>
        <div className="chips">
          {LEVELS.map((l) => (
            <button key={l} className={`chip ${level === l ? 'chip--on' : ''}`} onClick={() => setLevel(l)}>
              {l}
            </button>
          ))}
        </div>
        <div className="row gap">
          {geo ? (
            <>
              <select className="input input--auto" value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Avstånd">
                {[25, 50, 100, 200, 500].map((r) => (
                  <option key={r} value={r}>
                    Inom {r} km
                  </option>
                ))}
              </select>
              <button className="btn btn--ghost btn--small" onClick={() => setGeo(null)}>
                Hela Sverige
              </button>
            </>
          ) : (
            <button className="btn btn--small" onClick={useMyPosition}>
              Nära mig
            </button>
          )}
        </div>
        {geoError && <p className="field-error">{geoError}</p>}

        <Section title="Kommande">
          {events.loading && !events.data && <Loading />}
          {events.error && <ErrorBox error={events.error} onRetry={() => events.reload()} />}
          {events.data && list.length === 0 && <Empty>Inga tävlingar hittades.</Empty>}
          <ul className="card-list">
            {list.map((e) => (
              <li key={e.id}>
                <Go to={`/tavling/${e.id}`} from="Tävlingar" className="event-row">
                  <span className="event-row__date">
                    <strong>{fmtDay(e.startDate)}</strong>
                    <span className="muted small">{relativeDays(e.startDate)}</span>
                  </span>
                  <span className="event-row__main">
                    <strong>{e.name}</strong>
                    <span className="muted small block">
                      {e.address}
                      {e.sanctioned ? ' · Sanktionerad' : ''}
                    </span>
                  </span>
                </Go>
              </li>
            ))}
          </ul>
        </Section>
      </Page>
    </>
  );
}
