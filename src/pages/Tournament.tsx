import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, isSameDay, relativeDays } from '../lib/format';
import { getClasses, getClassPairs, getTournament, getTournamentMatches, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { standings } from '../lib/standings';
import { useAsync } from '../lib/useAsync';

export default function Tournament() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const [params, setParams] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;

  const header = useAsync(() => getTournament(tid), [tid]);
  const classes = useAsync(() => getClasses(tid), [tid]);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid]);
  const [onlyMine, setOnlyMine] = useState(!!playerId);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);

  const myClass = useMemo(() => {
    if (!playerId || !matches.data) return null;
    return matches.data.find((m) => m.sides.some((s) => s.ids.includes(playerId)))?.className ?? null;
  }, [matches.data, playerId]);
  const selectedClass = params.get('klass') || myClass || classes.data?.find((c) => c.published)?.name || classes.data?.[0]?.name || '';
  const classId = classes.data?.find((c) => c.name === selectedClass)?.id;
  const pairs = useAsync(() => (classId ? getClassPairs(tid, classId) : Promise.resolve([])), [tid, classId]);

  // Match day: refresh automatically every minute.
  const matchDay = isSameDay(header.data?.startDate) || isSameDay(header.data?.endDate);
  useEffect(() => {
    if (!matchDay) return;
    const t = setInterval(() => matches.reload(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDay]);

  if (header.error) {
    return (
      <>
        <AppHeader back="history" />
        <Page>
          <ErrorBox error={header.error} onRetry={() => header.reload()} />
        </Page>
      </>
    );
  }
  if (!header.data) {
    return (
      <>
        <AppHeader back="history" />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const t = header.data;
  const all = matches.data || [];
  const mine = playerId ? all.filter((m) => m.sides.some((s) => s.ids.includes(playerId))) : [];
  const inClass = all.filter((m) => m.className === selectedClass);
  const showMine = onlyMine && mine.length > 0;
  const shown = showMine ? mine : inClass;
  const table = standings(inClass);
  const highlight = playerId ? [playerId] : [];
  const nextMine = mine.find((m) => !m.played);

  return (
    <>
      <AppHeader back="history" />
      <Page>
        <div className="event-head">
          <p className="muted small">
            {fmtDay(t.startDate)} · {t.city} · {relativeDays(t.startDate)}
          </p>
          <h1>{t.name}</h1>
          {t.signInOpen && t.closeSignInDate && (
            <p className="small">
              Anmälan öppen till <strong>{fmtDay(t.closeSignInDate)} {fmtTime(t.closeSignInDate)}</strong>
            </p>
          )}
          <ExternalLink href={rinUrl(t.url)}>Öppna i Rankedin</ExternalLink>
        </div>

        {nextMine && (
          <Notice tone="ok">
            <strong>Nästa match:</strong> {fmtTime(nextMine.date) || 'tid ej satt'}
            {nextMine.court ? ` på ${nextMine.court}` : ''} mot{' '}
            {nextMine.sides.find((s) => !s.ids.includes(playerId!))?.names.join(' / ')}
          </Notice>
        )}

        {classes.data && classes.data.length > 0 && (
          <div className="chips" role="tablist" aria-label="Klasser">
            {mine.length > 0 && (
              <button className={`chip ${showMine ? 'chip--on' : ''}`} onClick={() => setOnlyMine(true)} role="tab" aria-selected={showMine}>
                Mina matcher
              </button>
            )}
            {classes.data.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={!showMine && c.name === selectedClass}
                className={`chip ${!showMine && c.name === selectedClass ? 'chip--on' : ''}`}
                onClick={() => {
                  setOnlyMine(false);
                  const next = new URLSearchParams(params);
                  next.set('klass', c.name);
                  setParams(next, { replace: true });
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <Section title={showMine ? 'Mina matcher' : 'Matcher'} action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
          {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}
          {!matches.data && matches.loading && <Loading />}
          {matches.data && shown.length === 0 && <Empty>Inga matcher publicerade ännu. Lottningen brukar komma några dagar innan.</Empty>}
          {shown.map((m) => (
            <MatchCard
              key={m.id}
              sides={m.sides}
              sets={m.sets}
              played={m.played}
              date={m.date}
              court={m.court}
              label={showMine ? m.className : undefined}
              highlightIds={highlight}
              canEnterResult={m.canEnterResult}
              awaitingConfirmation={m.awaitingConfirmation}
              onEnterResult={() => setReporting(m)}
            />
          ))}
        </Section>

        {!showMine && table.length > 1 && (
          <Section title="Tabell">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Par</th>
                  <th title="Matcher">M</th>
                  <th title="Vunna">V</th>
                  <th title="Set">Set</th>
                  <th title="Game">Game</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={r.key} className={highlight.some((h) => r.ids.includes(h)) ? 'is-mine' : ''}>
                    <td>{i + 1}</td>
                    <td>{r.names.join(' / ')}</td>
                    <td>{r.played}</td>
                    <td>{r.won}</td>
                    <td>
                      {r.setsFor}–{r.setsAgainst}
                    </td>
                    <td>
                      {r.gamesFor}–{r.gamesAgainst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">Uträknad från resultaten. Arrangörens tabell i Rankedin gäller.</p>
          </Section>
        )}

        {!showMine && (
          <Section title={`Anmälda par${pairs.data ? ` (${pairs.data.length})` : ''}`}>
            {pairs.loading && !pairs.data && <Loading />}
            {pairs.data && pairs.data.length === 0 && <Empty>Inga anmälda.</Empty>}
            <ul className="pairs">
              {pairs.data?.map((pair, i) => (
                <li key={i} className={highlight.some((h) => pair.players.some((p) => p.id === h)) ? 'is-mine' : ''}>
                  {pair.players.map((p) => p.name).join(' / ')}
                  {pair.missingPartner && <span className="pill pill--warn">Söker partner</span>}
                  {t.state !== 4 && pair.players.some((p) => !p.hasLicense) && <span className="pill pill--warn">Licens saknas</span>}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </Page>

      {reporting && (
        <ResultSheet
          challengeId={reporting.id}
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
