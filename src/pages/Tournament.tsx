import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, isSameDay, relativeDays } from '../lib/format';
import { getClasses, getClassPairs, getTournament, getTournamentMatches, rinUrl, type Pair, type TournamentMatch } from '../lib/rankedin';
import { standings } from '../lib/standings';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export default function Tournament() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const [params, setParams] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;

  const header = useAsync(() => getTournament(tid), [tid]);
  const classes = useAsync(() => getClasses(tid), [tid]);
  const { version } = useSession();
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid, version]);
  const [onlyMine, setOnlyMine] = useState(!!playerId);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [onlyToReport, setOnlyToReport] = useState(false);

  const myClass = useMemo(() => {
    if (!playerId || !matches.data) return null;
    return matches.data.find((m) => m.sides.some((s) => s.ids.includes(playerId)))?.className ?? null;
  }, [matches.data, playerId]);
  const selectedClass = params.get('klass') || myClass || classes.data?.find((c) => c.published)?.name || classes.data?.[0]?.name || '';
  const showAll = selectedClass === ALL;
  const visibleClasses = (classes.data || []).filter((c) => showAll || c.name === selectedClass);
  const classKey = visibleClasses.map((c) => c.id).join(',');
  const pairs = useAsync(
    async () => new Map(await Promise.all(visibleClasses.map(async (c) => [c.name, await getClassPairs(tid, c.id)] as const))),
    [tid, classKey],
  );

  const selectClass = (name: string) => {
    setOnlyMine(false);
    const next = new URLSearchParams(params);
    next.set('klass', name);
    setParams(next, { replace: true });
  };

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
        <AppHeader back="/tavlingar" backLabel="Tävlingar" />
        <Page>
          <ErrorBox error={header.error} onRetry={() => header.reload()} />
        </Page>
      </>
    );
  }
  if (!header.data) {
    return (
      <>
        <AppHeader back="/tavlingar" backLabel="Tävlingar" />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const t = header.data;
  const all = matches.data || [];
  const mine = playerId ? all.filter((m) => m.sides.some((s) => s.ids.includes(playerId))) : [];
  const showMine = onlyMine && mine.length > 0;
  const reportable = all.filter((m) => m.canEnterResult && !m.played);
  const filtered = onlyToReport ? all.filter((m) => m.canEnterResult && !m.played) : all;
  const highlight = playerId ? [playerId] : [];
  const nextMine = mine.find((m) => !m.played);

  return (
    <>
      <AppHeader back="/tavlingar" backLabel="Tävlingar" />
      <Page wide>
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
          <div className="chips chips--wrap-wide" role="tablist" aria-label="Klasser">
            {mine.length > 0 && (
              <button className={`chip ${showMine ? 'chip--on' : ''}`} onClick={() => setOnlyMine(true)} role="tab" aria-selected={showMine}>
                Mina matcher
              </button>
            )}
            {classes.data.length > 1 && (
              <button
                role="tab"
                aria-selected={!showMine && showAll}
                className={`chip ${!showMine && showAll ? 'chip--on' : ''}`}
                onClick={() => selectClass(ALL)}
              >
                Alla klasser
              </button>
            )}
            {classes.data.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={!showMine && c.name === selectedClass}
                className={`chip ${!showMine && c.name === selectedClass ? 'chip--on' : ''}`}
                onClick={() => selectClass(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}
        {!matches.data && matches.loading && <Loading />}
        {(reportable.length > 0 || onlyToReport) && !showMine && (
          <label className="toolbar__check report-toggle">
            <input type="checkbox" checked={onlyToReport} onChange={(e) => setOnlyToReport(e.target.checked)} /> Bara matcher att rapportera (
            {reportable.length} kvar)
          </label>
        )}

        {showMine ? (
          <Section title="Mina matcher" action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
            {mine.map((m) => (
              <MatchCard
                key={m.id}
                sides={m.sides}
                sets={m.sets}
                played={m.played}
                date={m.date}
                court={m.court}
                label={m.className}
                highlightIds={highlight}
                canEnterResult={m.canEnterResult}
                awaitingConfirmation={m.awaitingConfirmation}
                onEnterResult={() => setReporting(m)}
              />
            ))}
          </Section>
        ) : (
          matches.data &&
          visibleClasses.map((c, i) => (
            <ClassBlock
              key={c.id}
              title={showAll ? c.name : null}
              matches={filtered.filter((m) => m.className === c.name)}
              pairs={pairs.data?.get(c.name)}
              pairsLoading={pairs.loading}
              highlight={highlight}
              finished={t.state === 4}
              onEnterResult={setReporting}
              action={i === 0 ? <RefreshButton onClick={() => matches.reload()} loading={matches.loading} /> : undefined}
            />
          ))
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

const ALL = 'alla';

function ClassBlock(props: {
  title: string | null;
  matches: TournamentMatch[];
  pairs: Pair[] | undefined;
  pairsLoading: boolean;
  highlight: number[];
  finished: boolean;
  onEnterResult: (m: TournamentMatch) => void;
  action?: ReactNode;
}) {
  const { matches, pairs, highlight } = props;
  const table = standings(matches);
  const isMine = (ids: number[]) => highlight.some((h) => ids.includes(h));
  const body = (
    <>
      <Section title="Matcher" action={props.action}>
        {matches.length === 0 && <Empty>Inga matcher publicerade ännu. Lottningen brukar komma några dagar innan.</Empty>}
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            sides={m.sides}
            sets={m.sets}
            played={m.played}
            date={m.date}
            court={m.court}
            highlightIds={highlight}
            canEnterResult={m.canEnterResult}
            awaitingConfirmation={m.awaitingConfirmation}
            onEnterResult={() => props.onEnterResult(m)}
          />
        ))}
      </Section>

      {table.length > 1 && (
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
                <tr key={r.key} className={isMine(r.ids) ? 'is-mine' : ''}>
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

      <Section title={`Anmälda par${pairs ? ` (${pairs.length})` : ''}`}>
        {props.pairsLoading && !pairs && <Loading />}
        {pairs && pairs.length === 0 && <Empty>Inga anmälda.</Empty>}
        {pairs && pairs.length > 0 && (
          <ul className="pairs">
            {pairs.map((pair, i) => (
              <li key={i} className={isMine(pair.players.map((p) => p.id)) ? 'is-mine' : ''}>
                {pair.players.map((p) => p.name).join(' / ')}
                {pair.missingPartner && <span className="pill pill--warn">Söker partner</span>}
                {!props.finished && pair.players.some((p) => !p.hasLicense) && <span className="pill pill--warn">Licens saknas</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
  return props.title ? (
    <div className="class-block">
      <h2 className="class-block__title">{props.title}</h2>
      {body}
    </div>
  ) : (
    body
  );
}
