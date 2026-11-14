import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { DrawGroups } from '../components/DrawGroups';
import { matchStatus, type MatchStatus } from '../lib/matchStatus';
import { JoinSheet } from '../components/JoinSheet';
import { isWatched, toggleWatch } from '../lib/watch';
import { missingResults } from '../lib/organizer';
import { Sheet } from '../components/Sheet';
import { MatchBoard, MatchViewToggle, useMatchView, type MatchView } from '../components/MatchBoard';
import { AccountSwitcher } from '../components/AccountSwitcher';
import { OutsidePartner } from '../components/PairingPanel';
import { addMyPartner } from '../lib/pairing';
import { Go } from '../components/shell';
import { isTournamentAdmin } from '../lib/clubs';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section, Tip } from '../components/ui';
import { fmtDay, fmtTime, isSameDay, unlessInName, soon } from '../lib/format';
import { t } from '../lib/i18n';
import {
  getClasses,
  getClassPairs,
  getClassPlayoff,
  playoffAsMatches,
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

  // Remembered on the device (storeKey) so the page works offline on match day.
  const header = useAsync(() => getTournament(tid), [tid], `t.${tid}`);
  const classes = useAsync(() => getClasses(tid), [tid], `tclasses.${tid}`);
  const details = useAsync(() => getTournamentDetails(tid).catch(() => null), [tid], `tdetails.${tid}`);
  const { version, user } = useSession();
  const isOrganiser = useAsync(() => (user.loggedIn ? isTournamentAdmin(tid) : Promise.resolve(false)), [user.loggedIn, version, tid]);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid, version], `tmatches.${tid}`);
  // Results queued offline went through: show them.
  useEffect(() => {
    const on = () => matches.reload();
    window.addEventListener('padeladmin:results-sent', on);
    return () => window.removeEventListener('padeladmin:results-sent', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);
  const [onlyMine, setOnlyMine] = useState(!!playerId);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [onlyToReport, setOnlyToReport] = useState(false);
  const [view, setView] = useMatchView();
  const [joining, setJoining] = useState(false);
  const [watching, setWatching] = useState(() => isWatched(tid));

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

  const allClassKey = (classes.data || []).map((c) => c.id).join(',');
  const playedSoFar = (matches.data || []).filter((m) => m.played).length;
  const playoffs = useAsync(
    async (fresh) =>
      (await Promise.all((classes.data || []).map(async (c) => playoffAsMatches(c.name, await getClassPlayoff(c.id, fresh).catch(() => []))))).flat(),
    [tid, allClassKey, playedSoFar],
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
    const timer = setInterval(() => matches.reload(), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDay]);

  if (header.error) {
    return (
      <>
        <AppHeader back="/tavlingar" backLabel={t('Tävlingar')} />
        <Page>
          <ErrorBox error={header.error} onRetry={() => header.reload()} />
        </Page>
      </>
    );
  }
  if (!header.data) {
    return (
      <>
        <AppHeader back="/tavlingar" backLabel={t('Tävlingar')} />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const tour = header.data;
  // Playoff matches Rankedin has scheduled but does not list yet (a pair is still "1:a grupp B"): show them with time and court.
  const listed = matches.data || [];
  const listedIds = new Set(listed.map((m) => m.id));
  const rounds = new Map((playoffs.data ?? []).map((m) => [m.id, m.playoff]));
  // Listed matches that belong to the playoff keep the playoff mark.
  const all = [...listed.map((m) => (rounds.has(m.id) ? { ...m, playoff: rounds.get(m.id) } : m)), ...(playoffs.data ?? []).filter((m) => !listedIds.has(m.id))];
  const status = matchStatus(all);
  const mine = playerId ? all.filter((m) => m.sides.some((s) => s.ids.includes(playerId))) : [];
  const showMine = onlyMine && mine.length > 0;
  const reportable = all.filter((m) => m.canEnterResult && !m.played);
  // "Bara matcher att rapportera" keeps the coming playoff matches too, so the day can be planned.
  const filtered = onlyToReport ? all.filter((m) => (m.canEnterResult || m.upcoming) && !m.played) : all;
  const highlight = playerId ? [playerId] : [];
  const playedCount = all.filter((m) => m.played).length;
  const nextMine = mine.find((m) => !m.played);
  const missing = missingResults(all).length;

  return (
    <>
      <AppHeader back="/tavlingar" backLabel={t('Tävlingar')} />
      <Page wide>
        <div className="event-head">
          <p className="muted small">
            {[fmtDay(tour.startDate), unlessInName(tour.name, tour.city), soon(tour.startDate)].filter(Boolean).join(' · ')}
          </p>
          <h1>{tour.name}</h1>
          {all.length > 0 && (playedCount > 0 || isSameDay(tour.startDate) || isSameDay(tour.endDate)) && (
            <div className="progress">
              <p className="progress__text">
                {playedCount === all.length ? (
                  <strong>{t('Klar')}</strong>
                ) : (
                  <>
                    <span className="live-dot" aria-hidden="true" />
                    <strong>{t('Pågår')}</strong>
                  </>
                )}{' '}
                · {t('{n} av {total} matcher klara', { n: playedCount, total: all.length })}
                {matches.at && playedCount < all.length && <span className="muted"> · {t('uppdaterad {time}', { time: fmtTime(new Date(matches.at).toISOString()) || t('nyss') })}</span>}
              </p>
              <div className="progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={playedCount}>
                <div className="progress__fill" style={{ width: `${Math.round((playedCount / all.length) * 100)}%` }} />
              </div>
            </div>
          )}
          {tour.signInOpen && tour.closeSignInDate && (
            <p className="small">
              {t('Anmälan öppen till')}{' '}
              <strong>
                {fmtDay(tour.closeSignInDate)} {fmtTime(tour.closeSignInDate)}
              </strong>
            </p>
          )}
          {tour.signInOpen && (
            <button className="btn btn--primary btn--small" onClick={() => setJoining(true)}>
              {t('Anmäl')}
            </button>
          )}{' '}
          {playedCount > 0 && (
            <button className="btn btn--small" onClick={() => document.querySelector('.results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {t('Resultat')}
            </button>
          )}{' '}
          {tour.state !== 4 && playedCount === 0 && (
            <button
              className="btn btn--small"
              aria-pressed={watching}
              onClick={() => setWatching(toggleWatch({ id: tid, name: tour.name, startDate: tour.startDate }))}
            >
              {watching ? t('Bevakas') : t('Bevaka')}
            </button>
          )}{' '}
          {isOrganiser.data && (
            <Go className="btn btn--primary btn--small" to={`/tavling/${tid}/ledning`} from={tour.name}>
              {t('Tävlingsledning')}
            </Go>
          )}
          <details className="fold fold--quiet">
            <summary>{t('Om tävlingen')}</summary>
            {details.data && (
              <p className="small">
                {details.data.venue && <strong>{details.data.venue}</strong>}
                {details.data.address && <span className="muted"> · {details.data.address}</span>}
                {details.data.mapUrl && (
                  <>
                    {' '}
                    · <ExternalLink href={details.data.mapUrl}>{t('Karta')}</ExternalLink>
                  </>
                )}
                <span className="block muted">
                  {[
                    details.data.sanctioned ? t('Sanktionerad (ger rankingpoäng)') : t('Osanktionerad'),
                    details.data.fees.length ? t('Avgift {fees}', { fees: [...new Set(details.data.fees.map((f) => `${f.price} kr`))].join(' / ') }) : null,
                    details.data.organiser ? t('Arrangör {name}', { name: details.data.organiser.name }) : null,
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
              <ExternalLink href={rinUrl(tour.url)}>{t('Öppna i Rankedin')}</ExternalLink>
              {!isOrganiser.data && (
                <Go className="muted" to={`/tavling/${tid}/ledning`} from={tour.name}>
                  {t('För arrangören')}
                </Go>
              )}
            </p>
          </details>
        </div>

        {nextMine && (
          <Notice tone="ok">
            <strong>{t('Nästa match:')}</strong> {fmtTime(nextMine.date) || t('tid ej satt')}
            {nextMine.court ? ` ${t('på {court}', { court: nextMine.court })}` : ''}{' '}
            {t('mot {names}', { names: nextMine.sides.find((s) => !s.ids.includes(playerId!))?.names.join(' / ') ?? '' })}
          </Notice>
        )}

        {classes.data && classes.data.length > 0 && (
          <div className="chips chips--wrap-wide" role="tablist" aria-label={t('Klasser')}>
            {mine.length > 0 && (
              <button className={`chip ${showMine ? 'chip--on' : ''}`} onClick={() => setOnlyMine(true)} role="tab" aria-selected={showMine}>
                {t('Mina matcher')}
              </button>
            )}
            {classes.data.length > 1 && (
              <button
                role="tab"
                aria-selected={!showMine && showAll}
                className={`chip ${!showMine && showAll ? 'chip--on' : ''}`}
                onClick={() => selectClass(ALL)}
              >
                {t('Alla klasser')}
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
            <input type="checkbox" checked={onlyToReport} onChange={(e) => setOnlyToReport(e.target.checked)} />{' '}
            {t('Bara matcher att rapportera ({n} kvar)', { n: reportable.length })}
          </label>
        )}

        {showMine ? (
          <>
          <Section title={t('Mina matcher')} action={<RefreshButton onClick={() => matches.reload()} loading={matches.loading} />}>
            {mine.map((m) => (
              <MatchCard
                key={m.id}
                challengeId={m.id}
                sides={m.sides}
                sets={m.sets}
                played={m.played}
                date={m.date}
                court={m.court}
                label={m.className}
                playoff={m.playoff}
                        status={status.get(m.id) ?? null}
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
                <Section
                  title={t('Matcher')}
                  action={
                    <span className="row gap">
                      <MatchViewToggle view={view} onChange={setView} />
                      <RefreshButton onClick={() => matches.reload()} loading={matches.loading} />
                    </span>
                  }
                >
                  {view === 'tavla' ? (
                    <MatchBoard
                      matches={filtered}
                      highlight={highlight}
                      showClass
                      onEnterResult={setReporting}
                      status={status}
                    />
                  ) : (
                    byTime(filtered).map((m) => (
                      <MatchCard
                        key={m.id}
                        challengeId={m.id}
                        sides={m.sides}
                        sets={m.sets}
                        played={m.played}
                        date={m.date}
                        court={m.court}
                        label={m.className}
                        playoff={m.playoff}
                        status={status.get(m.id) ?? null}
                        highlightIds={highlight}
                        canEnterResult={m.canEnterResult}
                        awaitingConfirmation={m.awaitingConfirmation}
                        onEnterResult={() => setReporting(m)}
                      />
                    ))
                  )}
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
                  finished={tour.state === 4}
                  tournamentId={tid}
                  classId={c.id}
                  signInOpen={tour.signInOpen}
                  onPairsChanged={() => pairs.reload()}
                  onEnterResult={setReporting}
                  hideMatches={showAll}
                  view={view}
                  onViewChange={setView}
                  status={status}
                  action={i === 0 ? <RefreshButton onClick={() => matches.reload()} loading={matches.loading} /> : undefined}
                />
              ))}
            </>
          )
        )}
      </Page>

      {isOrganiser.data && missing > 0 && (
        <Go className="fab" to={`/tavling/${tid}/ledning?vy=resultat`} from={tour.name}>
          {missing === 1 ? t('1 resultat saknas') : t('{n} resultat saknas', { n: missing })}
        </Go>
      )}

      {joining &&
        (user.loggedIn ? (
          <JoinSheet
            tournamentId={tid}
            tournamentName={tour.name}
            rankedinUrl={rinUrl(tour.url)}
            fees={details.data?.fees ?? []}
            onClose={() => setJoining(false)}
            onDone={() => pairs.reload()}
          />
        ) : (
          <Sheet label={t('Anmäl')} onClose={() => setJoining(false)}>
            <h2>{t('Anmäl till tävlingen')}</h2>
            <p>{t('Anmälan görs med spelarens eget Rankedin-konto. Logga in med det först.')}</p>
            <Go className="btn btn--primary btn--block" to="/konto" from={tour.name}>
              {t('Logga in')}
            </Go>
            <button className="btn btn--ghost btn--block" onClick={() => setJoining(false)}>
              {t('Avbryt')}
            </button>
          </Sheet>
        ))}

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
  view: MatchView;
  onViewChange: (v: MatchView) => void;
  status: Map<number, MatchStatus>;
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
    <Section title={pairs ? t('Anmälda par ({n})', { n: pairs.length }) : t('Anmälda par')}>
      {props.pairsLoading && !pairs && <Loading />}
      {pairs && pairs.length === 0 && <Empty>{t('Inga anmälda.')}</Empty>}
      {pairs &&
        (() => {
          // Help a player without a partner: who else in this class is looking?
          const mineLooking = pairs.find((p) => p.missingPartner && isMine(p.players.map((x) => x.id)));
          const others = pairs.filter((p) => p.missingPartner && p !== mineLooking).flatMap((p) => p.players.map((x) => x.name));
          if (!mineLooking) return null;
          return (
            <>
              <p className="notice notice--warn small">
                <strong>{t('{name} söker partner.', { name: mineLooking.players[0]?.name.split(' ')[0] ?? '' })}</strong>{' '}
                {others.length ? t('Även {names} söker.', { names: others.join(', ') }) : t('Ingen annan i klassen söker just nu.')}
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
              {pair.missingPartner && <span className="pill pill--warn">{t('Söker partner')}</span>}
              {!props.finished && pair.players.some((p) => !p.hasLicense) && <span className="pill pill--warn">
                  <Tip tip={t('Spelaren har ingen giltig tävlingslicens i Rankedin för i år.')}>{t('Licens saknas')}</Tip>
                </span>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
  const body = (
    <>
      {!drawn && pairsSection}
      {!drawn && <p className="muted small">{t('Lottningen är inte publicerad än – matcher och tider dyker upp här när den är klar.')}</p>}
      {drawn && !props.hideMatches && (
        <Section
          title={t('Matcher')}
          action={
            <span className="row gap">
              <MatchViewToggle view={props.view} onChange={props.onViewChange} />
              {props.action}
            </span>
          }
        >
          {props.view === 'tavla' ? (
            <MatchBoard matches={matches} highlight={highlight} showClass={false} onEnterResult={props.onEnterResult} status={props.status} />
          ) : (
            matches.map((m) => (
              <MatchCard
                key={m.id}
                challengeId={m.id}
                sides={m.sides}
                sets={m.sets}
                played={m.played}
                date={m.date}
                court={m.court}
                playoff={m.playoff}
                status={props.status.get(m.id) ?? null}
                highlightIds={highlight}
                canEnterResult={m.canEnterResult}
                awaitingConfirmation={m.awaitingConfirmation}
                onEnterResult={() => props.onEnterResult(m)}
              />
            ))
          )}
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
        {t('Lägg till partner åt {name}', { name: first })}
      </button>
    );
  return (
    <div className="add-partner">
      <strong>{t('Lägg till partner åt {name}', { name: first })}</strong>
      {!active ? (
        <>
          <p className="small">{t('Det görs med {name}s eget Rankedin-konto. Byt till det kontot:', { name: first })}</p>
          <AccountSwitcher label={t('Aktivt konto')} />
        </>
      ) : (
        <>
          <p className="small muted">{t('Sök fram partnern. Det funkar även om hen spelar i en annan klubb och inte är anmäld än.')}</p>
          <OutsidePartner
            disabled={busy}
            exclude={[seeker.id]}
            onPick={async (h) => {
              if (!window.confirm(t('Lägga till {partner} som partner till {name}? Ändringen görs direkt i Rankedin.', { partner: h.name, name: seeker.name }))) return;
              setBusy(true);
              setMsg(null);
              try {
                await addMyPartner(tournamentId, classId, h.id);
                setMsg({
                  tone: 'ok',
                  text: t('{partner} är tillagd som partner. Rankedin kan be {first} bekräfta – kolla listan nedan.', { partner: h.name, first: h.name.split(' ')[0] }),
                });
                onDone();
              } catch (e) {
                setMsg({ tone: 'error', text: t((e as Error).message) });
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
