import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page } from '../components/ui';
import { CITIES, findCity } from '../lib/cities';
import { fmtDay, unlessInName, soon } from '../lib/format';
import { getClasses, getJuniorCalendar, getProfile, type CalendarLevel } from '../lib/rankedin';
import { AGE_CLASSES, ageClassFor, eventMatchesAge, type AgeClass } from '../lib/ages';
import { useKnownPlayers } from '../lib/known';
import { useAsync } from '../lib/useAsync';

type Place = { label: string; lat: number; lng: number } | null;

const LEVELS: ('Alla' | CalendarLevel)[] = ['Alla', 'Step In', 'Level Up', 'SPT Future', 'USM', 'Övrigt'];
const RADII = [25, 50, 100, 200];
const PLACE_KEY = 'padeladmin.calendar.place';

function loadPlace(): Place {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}
function storePlace(p: Place) {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export default function Calendar() {
  const [place, setPlaceState] = useState<Place>(loadPlace);
  const [cityInput, setCityInput] = useState(place?.label ?? '');
  const [radius, setRadius] = useState(100);
  const [level, setLevel] = useState<'Alla' | CalendarLevel>('Alla');
  const [onlySanctioned, setOnlySanctioned] = useState(false);
  const [age, setAge] = useState<AgeClass | null>(null);
  // "För Aron (12)": the class each of my players can play, from the age in their profile.
  const known = useKnownPlayers();
  const knownKey = known.map((k) => k.rankedinId).join(',');
  const myClasses = useAsync(
    async () =>
      (
        await Promise.all(
          known.map(async (k) => {
            const p = await getProfile(k.rankedinId).catch(() => null);
            const c = ageClassFor(p?.age ? Number.parseInt(p.age, 10) : null);
            return c ? { first: k.name.split(' ')[0], age: c } : null;
          }),
        )
      ).filter((x): x is { first: string; age: AgeClass } => !!x),
    [knownKey],
    knownKey ? `myclasses.${knownKey}` : undefined,
  );
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  const setPlace = (p: Place) => {
    setPlaceState(p);
    storePlace(p);
  };
  const events = useAsync(() => getJuniorCalendar(place ? { lat: place.lat, lng: place.lng, radiusKm: radius } : {}), [place?.lat, place?.lng, radius], `calendar.${place?.lat ?? 'se'}.${place?.lng ?? ''}.${radius}`);

  const byLevel = useMemo(
    () => (events.data || []).filter((e) => (level === 'Alla' || e.level === level) && (!onlySanctioned || e.sanctioned)),
    [events.data, level, onlySanctioned],
  );
  // With an age chosen, look at each tournament's real classes (cached per tournament).
  const idsKey = age ? byLevel.map((e) => e.id).join(',') : '';
  const classNames = useAsync(
    async () =>
      idsKey
        ? new Map(await Promise.all(byLevel.map(async (e) => [e.id, (await getClasses(e.id).catch(() => [])).map((c) => c.name)] as const)))
        : new Map<number, string[]>(),
    [idsKey],
  );
  const list = useMemo(
    () => (age ? byLevel.filter((e) => eventMatchesAge(e.name, classNames.data?.get(e.id), age)) : byLevel),
    [byLevel, age, classNames.data],
  );

  function applyCity(value: string) {
    setCityInput(value);
    const c = findCity(value);
    if (c && c.name.toLowerCase() === value.trim().toLowerCase()) {
      setPlace({ label: c.name, lat: c.lat, lng: c.lng });
      setGeoMsg(null);
    }
  }

  function submitCity(e: React.FormEvent) {
    e.preventDefault();
    if (!cityInput.trim()) {
      setPlace(null);
      return;
    }
    const c = findCity(cityInput);
    if (c) {
      setCityInput(c.name);
      setPlace({ label: c.name, lat: c.lat, lng: c.lng });
      setGeoMsg(null);
    } else {
      setGeoMsg(`Hittar inte "${cityInput}". Välj en ort i listan.`);
    }
  }

  function useMyPosition() {
    setGeoMsg(null);
    if (!navigator.geolocation) {
      setGeoMsg('Din webbläsare kan inte dela position. Skriv en ort i stället.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ label: 'Min position', lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCityInput('Min position');
      },
      () => setGeoMsg('Kunde inte hämta din position (kolla platsbehörighet). Skriv en ort i stället.'),
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

        <div className="toolbar">
          <form className="toolbar__group" onSubmit={submitCity}>
            <label className="toolbar__label" htmlFor="city">
              Nära
            </label>
            <input
              id="city"
              className="input input--inline toolbar__city"
              list="cities"
              placeholder="Ort, t.ex. Varberg"
              value={cityInput}
              onChange={(e) => applyCity(e.target.value)}
              autoComplete="off"
            />
            <datalist id="cities">
              {CITIES.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
            <select className="input input--inline" value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Avstånd" disabled={!place}>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
            <span className="chips chips--wrap chips--inline" role="group" aria-label="Område">
              <button
                type="button"
                className={`chip ${!place ? 'chip--on' : ''}`}
                aria-pressed={!place}
                onClick={() => {
                  setPlace(null);
                  setCityInput('');
                }}
              >
                Hela Sverige
              </button>
              <button type="button" className={`chip chip--icon ${place?.label === 'Min position' ? 'chip--on' : ''}`} aria-pressed={place?.label === 'Min position'} onClick={useMyPosition}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                Min position
              </button>
            </span>
          </form>
          <div className="toolbar__group" role="group" aria-label="Ålder">
            <button className={`chip ${age == null ? 'chip--on' : ''}`} onClick={() => setAge(null)}>
              Alla åldrar
            </button>
            {(myClasses.data ?? []).map((m) => (
              <button key={m.first} className={`chip ${age === m.age ? 'chip--on' : ''}`} onClick={() => setAge(m.age)}>
                För {m.first} ({m.age})
              </button>
            ))}
            {AGE_CLASSES.filter((a) => !(myClasses.data ?? []).some((m) => m.age === a)).map((a) => (
              <button key={a} className={`chip ${age === a ? 'chip--on' : ''}`} onClick={() => setAge(a)}>
                {a} år
              </button>
            ))}
          </div>
          <div className="toolbar__group">
            {LEVELS.map((l) => (
              <button key={l} className={`chip ${level === l ? 'chip--on' : ''}`} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
            <label className="toolbar__check">
              <input type="checkbox" checked={onlySanctioned} onChange={(e) => setOnlySanctioned(e.target.checked)} /> Bara sanktionerade
            </label>
          </div>
        </div>
        {geoMsg && <p className="field-error">{geoMsg}</p>}

        <p className="muted small">
          {events.data ? `${list.length} kommande tävlingar` : ''}
          {age ? ` med ${age}-årsklass` : ''}
          {place ? ` inom ${radius} km från ${place.label}` : ' i hela Sverige'}
        </p>

        {events.loading && !events.data && <Loading />}
        {events.error && <ErrorBox error={events.error} onRetry={() => events.reload()} />}
        {age && classNames.loading && !classNames.data && <Loading label="Kollar klasserna…" />}
        {events.data && list.length === 0 && !(age && classNames.loading) && <Empty>Inga tävlingar matchar. Prova ett större avstånd eller en annan nivå.</Empty>}

        {list.length > 0 && (
          <table className="table table--rows">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Tävling</th>
                <th>Nivå</th>
                <th>Ort</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">
                    <strong>{fmtDay(e.startDate)}</strong>
                    <span className="muted small block">{soon(e.startDate)}</span>
                  </td>
                  <td>
                    <Go to={`/tavling/${e.id}`} from="Tävlingar" className="row-link">
                      {e.name}
                    </Go>
                    <span className="muted small block only-narrow">
                      {[unlessInName(e.name, e.town), e.level !== 'Övrigt' ? unlessInName(e.name, e.level) : null].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="only-wide">
                    {e.level}
                    {e.sanctioned && <span className="muted small block">Sanktionerad</span>}
                  </td>
                  <td className="only-wide">{e.town ?? <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <RefereeBox />
      </Page>
    </>
  );
}

/** Live scoring with a referee code (shown on upcoming matches in a tournament). */
function RefereeBox() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  return (
    <details className="fold">
      <summary>Har du en domarkod?</summary>
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) navigate(`/doma/${encodeURIComponent(code.trim())}`, { state: { from: { label: 'Tävlingar', to: '/tavlingar' } } });
        }}
      >
        <input className="input" placeholder="Domarkod" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" />
        <button className="btn" type="submit" disabled={!code.trim()}>
          Döm live
        </button>
      </form>
    </details>
  );
}
