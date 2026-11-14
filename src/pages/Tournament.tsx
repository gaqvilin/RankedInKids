import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { DrawGroups } from '../components/DrawGroups';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { OutsidePartner } from '../components/PairingPanel';
import { addMyPartner } from '../lib/pairing';
import { Go } from '../components/shell';
import { isTournamentAdmin } from '../lib/clubs';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDay, fmtTime, isSameDay, unlessInName, soon } from '../lib/format';
import {
  getClasses,
  getClassPairs,
  getTournament,
  getTournamentDetails,
  getTournamentMatches,
  rinUrl,
  type Pair,
  type TournamentMatch,
} from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export default function Tournament() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const [params, setParams] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;

  const header = useAsync(() => getTournament(tid), [tid]);
  const classes = useAsync(() => getClasses(tid), [tid]);
  const details = useAsync(() => getTournamentDetails(tid).catch(() => null), [tid], `tdetails.${tid}`);
  const { version, user } = useSession();
  const isOrganiser = useAsync(() => (user.loggedIn ? isTournamentAdmin(tid) : Promise.resolve(false)), [user.loggedIn, version, tid]);
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
    async (fresh) => new Map(await Promise.all(visibleClasses.map(async (c) => [c.name, await getClassPairs(tid, c.id, fresh)] as const))),
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
            {[fmtDay(t.startDate), unlessInName(t.name, t.city), soon(t.startDate)].filter(Boolean).join(' · ')}
          </p>
          <h1>{t.name}</h1>
          {t.signInOpen && t.closeSignInDate && (
            <p className="small">
              Anmälan öppen till{' '}
              <strong>
                {fmtDay(t.closeSignInDate)} {fmtTime(t.closeSignInDate)}
              </strong>
            </p>
          )}
          {isOrganiser.data && (
            <Go className="btn btn--primary btn--small" to={`/tavling/${tid}/ledning`} from={t.name}>
              Tävlingsledning
            </Go>
          )}
          <details className="fold fold--quiet">
            <summary>Om tävlingen</summary>
            {details.data && (
              <p className="small">
                {details.data.venue && <strong>{details.data.venue}</strong>}
                {details.data.address && <span className="muted"> · {details.data.address}</span>}
                {details.data.mapUrl && (
                  <>
                    {' '}
                    · <ExternalLink href={details.data.mapUrl}>Karta</ExternalLink>
                  </>
                )}
                <span className="block muted">
                  {[
                    details.data.sanctioned ? 'Sanktionerad (ger rankingpoäng)' : 'Osanktionerad',
                    details.data.fees.length ? `Avgift ${[...new Set(details.data.fees.map((f) => `${f.price} kr`))].join(' / ')}` : null,
                    details.data.organiser ? `Arrangör ${details.data.organiser.name}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </p>
            )}
            {details.data && details.data.regulations.length > 0 && (
              <div className="regulations">
                {details.data.regulations.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
            <p className="small row gap wrap">
              <ExternalLink href={rinUrl(t.url)}>Öppna i Rankedin</ExternalLink>
              {!isOrganiser.data && (
                <Go className="muted" to={`/tavling/${tid}/ledning`} from={t.name}>
                  För arrangören
                </Go>
              )}
            </p>
          </details>
        </div>

        {nextMine && (
          <Notice tone="ok">
            <strong>Nästa match:</strong> {fmtTime(nextMine.date) || 'tid ej satt'}
            {nextMine.court ? ` på ${nextMine.court}` : ''} mot {nextMine.sides.find((s) => !s.ids.includes(playerId!))?.names.join(' / ')}
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
          <>
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
          {(() => {
            const cls = classes.data?.find((c) => c.name === myClass);
            const clsMatches = all.filter((m) => m.className === myClass);
            return cls ? (
              <DrawGroups
                classId={cls.id}
                matches={clsMatches}
                highlight={highlight}
                refreshKey={`${clsMatches.length}-${clsMatches.filter((m) => m.played).length}`}
              />
            ) : null;
          })()}
          </>
        ) : (
          matches.data && (
            <>
              {showAll && all.length > 0 && (
                // All classes: one list in time order, so no class is hidden below another class's matches and table.
                <Section title="Matcher" action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
                  {byTime(filtered).map((m) => (
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
              )}
              {visibleClasses.map((c, i) => (
                <ClassBlock
                  key={c.id}
                  title={showAll ? c.name : null}
                  matches={filtered.filter((m) => m.className === c.name)}
                  pairs={pairs.data?.get(c.name)}
                  pairsLoading={pairs.loading}
                  highlight={highlight}
                  finished={t.state === 4}
                  tournamentId={tid}
                  classId={c.id}
                  signInOpen={t.signInOpen}
                  onPairsChanged={() => pairs.reload()}
                  onEnterResult={setReporting}
                  hideMatches={showAll}
                  action={i === 0 ? <RefreshButton onClick={() => matches.reload()} loading={matches.loading} /> : undefined}
                />
              ))}
            </>
          )
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
const byTime = (ms: TournamentMatch[]) =>
  [...ms].sort((a, b) => (a.date ? Date.parse(a.date) : Infinity) - (b.date ? Date.parse(b.date) : Infinity));

function ClassBlock(props: {
  title: string | null;
  matches: TournamentMatch[];
  pairs: Pair[] | undefined;
  pairsLoading: boolean;
  highlight: number[];
  finished: boolean;
  tournamentId: number;
  classId: number;
  signInOpen: boolean;
  onPairsChanged: () => void;
  onEnterResult: (m: TournamentMatch) => void;
  /** Matches are listed above for all classes together. */
  hideMatches?: boolean;
  action?: ReactNode;
}) {
  const { matches, pairs, highlight } = props;
  const isMine = (ids: number[]) => highlight.some((h) => ids.includes(h));
  const drawn = matches.length > 0;
  const pairsSection = (
    <Section title={`Anmälda par${pairs ? ` (${pairs.length})` : ''}`}>
      {props.pairsLoading && !pairs && <Loading />}
      {pairs && pairs.length === 0 && <Empty>Inga anmälda.</Empty>}
      {pairs &&
        (() => {
          // Help a player without a partner: who else in this class is looking?
          const mineLooking = pairs.find((p) => p.missingPartner && isMine(p.players.map((x) => x.id)));
          const others = pairs.filter((p) => p.missingPartner && p !== mineLooking).flatMap((p) => p.players.map((x) => x.name));
          if (!mineLooking) return null;
          return (
            <>
              <p className="notice notice--warn small">
                <strong>{mineLooking.players[0]?.name.split(' ')[0]} söker partner.</strong>{' '}
                {others.length ? `Även ${others.join(', ')} söker.` : 'Ingen annan i klassen söker just nu.'}
              </p>
              {props.signInOpen && mineLooking.players[0] && (
                <AddPartnerBox
                  tournamentId={props.tournamentId}
                  classId={props.classId}
                  seeker={mineLooking.players[0]}
                  onDone={props.onPairsChanged}
                />
              )}
            </>
          );
        })()}
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
  );
  const body = (
    <>
      {!drawn && pairsSection}
      {!drawn && <p className="muted small">Lottningen är inte publicerad än – matcher och tider dyker upp här när den är klar.</p>}
      {drawn && !props.hideMatches && (
        <Section title="Matcher" action={props.action}>
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
      )}

      {drawn && (
        <DrawGroups
          classId={props.classId}
          matches={matches}
          highlight={highlight}
          refreshKey={`${matches.length}-${matches.filter((m) => m.played).length}`}
        />
      )}

      {drawn && pairsSection}
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

/**
 * The player (logged in on this device) adds a partner themselves – Rankedin's
 * "Lägg till partner" for someone entered alone. No organiser needed.
 */
function AddPartnerBox({
  tournamentId,
  classId,
  seeker,
  onDone,
}: {
  tournamentId: number;
  classId: number;
  seeker: { id: number; name: string; rankedinId: string | null };
  onDone: () => void;
}) {
  const { user } = useSession();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const onDevice = user.accounts.some((a) => a.rankedinId === seeker.rankedinId);
  const active = user.loggedIn && user.rankedinId === seeker.rankedinId;
  const first = seeker.name.split(' ')[0];
  const [open, setOpen] = useState(false);
  if (!onDevice) return null;
  if (!open && !msg)
    return (
      <button className="btn btn--primary btn--small" onClick={() => setOpen(true)}>
        Lägg till partner åt {first}
      </button>
    );
  return (
    <div className="add-partner">
      <strong>Lägg till partner åt {first}</strong>
      {!active ? (
        <>
          <p className="small">Det görs med {first}s eget Rankedin-konto. Byt till det kontot:</p>
          <AccountSwitcher label="Aktivt konto" />
        </>
      ) : (
        <>
          <p className="small muted">Sök fram partnern. Det funkar även om hen spelar i en annan klubb och inte är anmäld än.</p>
          <OutsidePartner
            disabled={busy}
            exclude={[seeker.id]}
            onPick={async (h) => {
              if (!window.confirm(`Lägga till ${h.name} som partner till ${seeker.name}? Ändringen görs direkt i Rankedin.`)) return;
              setBusy(true);
              setMsg(null);
              try {
                await addMyPartner(tournamentId, classId, h.id);
                setMsg({
                  tone: 'ok',
                  text: `${h.name} är tillagd som partner. Rankedin kan be ${h.name.split(' ')[0]} bekräfta – kolla listan nedan.`,
                });
                onDone();
              } catch (e) {
                setMsg({ tone: 'error', text: (e as Error).message });
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      {msg && <p className={`notice notice--${msg.tone === 'ok' ? 'ok' : 'error'} small`}>{msg.text}</p>}
    </div>
  );
}
