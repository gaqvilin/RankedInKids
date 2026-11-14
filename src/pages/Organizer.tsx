// Tävlingsledning: everything the organising club needs on the day, on one page.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { MatchCard } from '../components/MatchCard';
import { DrawPanel } from '../components/DrawPanel';
import { PairingPanel } from '../components/PairingPanel';
import { PlayerHitRow } from '../components/PlayerHitRow';
import { isTournamentAdmin } from '../lib/clubs';
import { ResultSheet } from '../components/ResultSheet';
import { MatchBoard } from '../components/MatchBoard';
import { matchStatus } from '../lib/matchStatus';
import { MoveSheet } from '../components/MoveSheet';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDayTime, fmtTime, isSameDay } from '../lib/format';
import { t } from '../lib/i18n';
import { courtBoard, missingResults, partnerSeekers, unlicensed, type CourtState } from '../lib/organizer';
import { getClasses, getClassPairs, getTournament, getTournamentMatches, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

type Tab = 'partner' | 'lottning' | 'banor' | 'schema' | 'resultat' | 'dela';
const TABS: { id: Tab; label: string }[] = [
  { id: 'partner', label: 'Före lottning' },
  { id: 'lottning', label: 'Lottning' },
  { id: 'banor', label: 'Banor' },
  { id: 'schema', label: 'Schema' },
  { id: 'resultat', label: 'Resultat' },
  { id: 'dela', label: 'Skriv ut' },
];

export default function Organizer() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const { version, user } = useSession();
  const isOrganiser = useAsync(
    () => (user.loggedIn ? isTournamentAdmin(tid) : Promise.resolve(false)),
    [user.loggedIn, version, tid],
  );
  const [params, setParams] = useSearchParams();
  const header = useAsync(() => getTournament(tid), [tid], `t.${tid}`);
  const classes = useAsync(() => getClasses(tid), [tid], `tclasses.${tid}`);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid, version], `tmatches.${tid}`);
  // Results queued offline went through: show them.
  useEffect(() => {
    const on = () => matches.reload();
    window.addEventListener('padeladmin:results-sent', on);
    return () => window.removeEventListener('padeladmin:results-sent', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);
  const classKey = (classes.data ?? []).map((c) => c.id).join(',');
  const pairs = useAsync(
    async (fresh) => new Map(await Promise.all((classes.data ?? []).map(async (c) => [c.name, await getClassPairs(tid, c.id, fresh)] as const))),
    [tid, classKey],
  );
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [moving, setMoving] = useState<TournamentMatch | null>(null);
  const [now, setNow] = useState(() => new Date());

  const tour = header.data;
  const all = matches.data ?? [];
  const drawn = all.length > 0;
  const matchDay = !!tour && (isSameDay(tour.startDate) || isSameDay(tour.endDate));
  const tab = (params.get('vy') as Tab) || (matchDay && drawn ? 'banor' : 'partner');
  const setTab = (v: Tab) => {
    const next = new URLSearchParams(params);
    next.set('vy', v);
    setParams(next, { replace: true });
  };

  // On the day: fresh data every 30 s, clock every 15 s.
  useEffect(() => {
    if (!matchDay) return;
    const a = setInterval(() => matches.reload(), 30_000);
    const b = setInterval(() => setNow(new Date()), 15_000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDay]);

  const board = useMemo(() => courtBoard(all, now), [all, now]);
  const missing = useMemo(() => missingResults(all, now), [all, now]);
  // Played matches, latest first, so a wrong result is easy to find and fix.
  const status = useMemo(() => matchStatus(all, now.getTime()), [all, now]);
  const reported = useMemo(() => all.filter((m) => m.played).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [all]);
  const seekers = useMemo(() => (pairs.data ? partnerSeekers(pairs.data) : null), [pairs.data]);
  const noLicence = useMemo(() => (pairs.data ? unlicensed(pairs.data) : []), [pairs.data]);

  if (header.error) {
    return (
      <>
        <AppHeader back={`/tavling/${tid}`} backLabel={t('Tävlingen')} />
        <Page>
          <ErrorBox error={header.error} onRetry={() => header.reload()} />
        </Page>
      </>
    );
  }
  if (!tour) {
    return (
      <>
        <AppHeader back={`/tavling/${tid}`} backLabel={t('Tävlingen')} />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const played = all.filter((m) => m.played).length;
  return (
    <>
      <AppHeader back={`/tavling/${tid}`} backLabel={t('Tävlingen')} title={t('Tävlingsledning')} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{t('Tävlingsledning')}</h1>
            <p className="muted">
              {tour.name} · {fmtDayTime(tour.startDate)}
            </p>
            {drawn && (
              <p className="muted small">
                {t('{n} av {total} matcher klara', { n: played, total: all.length })}
                {missing.length ? ` · ${missing.length === 1 ? t('1 resultat saknas') : t('{n} resultat saknas', { n: missing.length })}` : ''}
              </p>
            )}
          </div>
          <RefreshButton onClick={() => matches.reload()} loading={matches.loading} />
        </div>

        <div className="chips chips--wrap" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} className={`chip ${tab === x.id ? 'chip--on' : ''}`} onClick={() => setTab(x.id)}>
              {t(x.label)}
              {x.id === 'resultat' && missing.length > 0 && <span className="count-badge">{missing.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'partner' && isOrganiser.data && (classes.data?.length ?? 0) > 0 && (
          <Section title={t('Para ihop och dela på par')}>
            <p className="small muted">{t('Ändringarna görs direkt i Rankedin, precis som i arrangörsvyn där. Fungerar fram till att klassen är lottad.')}</p>
            {classes.data!.map((c) => {
              const singles = pairs.data?.get(c.name)?.filter((p) => p.missingPartner).length ?? 0;
              return (
                <details key={c.id} className="fold" open={singles > 1}>
                  <summary>
                    {c.name}
                    {singles > 0 && <span className="muted small"> · {t('{n} utan partner', { n: singles })}</span>}
                  </summary>
                  <PairingPanel tournamentId={tid} classId={c.id} className={c.name} onChanged={() => pairs.reload()} />
                </details>
              );
            })}
          </Section>
        )}
        {tab === 'partner' && user.loggedIn && isOrganiser.data === false && (
          <Notice>{t('Ditt aktiva konto är inte arrangör för tävlingen. Byt konto under Konton för att para ihop spelare här.')}</Notice>
        )}
        {tab === 'partner' && (
          <PartnerTab
            loading={pairs.loading && !pairs.data}
            seekers={seekers}
            noLicence={noLicence}
            signInOpen={tour.signInOpen}
            closes={tour.closeSignInDate}
            classCounts={pairs.data ? [...pairs.data].map(([name, p]) => ({ name, pairs: p.filter((x) => !x.missingPartner).length, singles: p.filter((x) => x.missingPartner).length })) : []}
            adminUrl={rinUrl(tour.url)}
          />
        )}

        {tab === 'lottning' &&
          (user.loggedIn ? (
            <DrawPanel
              tournamentId={tid}
              onChanged={() => matches.reload()}
              singles={pairs.data ? new Map([...pairs.data].map(([name, p]) => [name, p.filter((x) => x.missingPartner).length])) : undefined}
            />
          ) : (
            <Notice>{t('Logga in med kontot som administrerar tävlingen för att lotta här.')}</Notice>
          ))}

        {tab === 'banor' &&
          (!drawn ? (
            <NotDrawn />
          ) : (
            <div className="court-grid">
              {board.map((c) => (
                <CourtCard key={c.court} c={c} onReport={setReporting} />
              ))}
              {board.length === 0 && <Empty>{t('Matcherna har inga banor och tider än. Schemalägg i Rankedin.')}</Empty>}
            </div>
          ))}

        {tab === 'schema' &&
          (!drawn ? (
            <NotDrawn />
          ) : (
            <Section title={t('Schema')}>
              <p className="muted small section-intro">{t('Alla matcher per klockslag. Tryck Flytta för att byta tid eller bana – bara lediga banor visas.')}</p>
              <MatchBoard matches={all} highlight={[]} showClass onEnterResult={setReporting} onMove={user.loggedIn ? setMoving : undefined} status={status} />
            </Section>
          ))}

        {tab === 'resultat' &&
          (!drawn ? (
            <NotDrawn />
          ) : (
            <Section title={missing.length ? t('Saknar resultat ({n})', { n: missing.length }) : t('Resultat')}>
              {missing.length === 0 && <Notice tone="ok">{t('Alla matcher som borde vara klara har resultat.')}</Notice>}
              {missing.length > 0 && !missing.some((m) => m.canEnterResult) && (
                <Notice tone="warn">{t('Ditt inloggade konto får inte rapportera i den här tävlingen. Logga in med kontot som administrerar tävlingen.')}</Notice>
              )}
              <div className="stack">
                {missing.map((m) => (
                  <MatchCard
                    key={m.id}
                    challengeId={m.id}
                    sides={m.sides}
                    sets={m.sets}
                    played={m.played}
                    date={m.date}
                    court={m.court}
                    label={`${m.className}${m.draw ? ` · ${m.draw}` : ''}`}
                    status={status.get(m.id) ?? null}
                    canEnterResult={m.canEnterResult}
                    onEnterResult={() => setReporting(m)}
                    from={t('Tävlingsledning')}
                  />
                ))}
              </div>
              {reported.length > 0 && (
                <details className="fold fold--quiet" open={missing.length === 0}>
                  <summary>{t('Rapporterade ({n}) – ändra eller ta bort', { n: reported.length })}</summary>
                  <div className="stack">
                    {reported.map((m) => (
                      <MatchCard
                        key={m.id}
                        challengeId={m.id}
                        sides={m.sides}
                        sets={m.sets}
                        played={m.played}
                        date={m.date}
                        court={m.court}
                        label={`${m.className}${m.draw ? ` · ${m.draw}` : ''}`}
                        awaitingConfirmation={m.awaitingConfirmation}
                        // Rankedin hides its button on played matches; as organiser you may still change them, and Rankedin decides on send.
                        canEnterResult={user.loggedIn}
                        onEnterResult={() => setReporting(m)}
                        from={t('Tävlingsledning')}
                      />
                    ))}
                  </div>
                </details>
              )}
            </Section>
          ))}

        {tab === 'dela' && <ShareTab tid={tid} name={tour.name} />}

        {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}
      </Page>

      {moving && (
        <MoveSheet
          tournamentId={tid}
          match={moving}
          all={all}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null);
            matches.reload();
          }}
        />
      )}

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

function NotDrawn() {
  return <Notice>{t('Inga matcher är lottade än. Lotta, schemalägg och publicera under fliken Lottning – då dyker allt upp här.')}</Notice>;
}

function CourtCard({ c, onReport }: { c: CourtState; onReport: (m: TournamentMatch) => void }) {
  const names = (m: TournamentMatch) => m.sides.map((s) => (s.names.length ? s.names.join(' / ') : '–')).join('  –  ');
  return (
    <article className={`court-card ${c.lateMinutes > 0 ? 'court-card--late' : ''}`}>
      <header className="court-card__head">
        <strong>{c.court}</strong>
        <span className="muted small">
          {t('{done}/{total} klara', { done: c.done, total: c.total })}
        </span>
      </header>
      {c.now ? (
        <div className="court-card__now">
          <span className="small muted">
            {t('Nu')} · {fmtTime(c.now.date)} · {c.now.className}
            {c.lateMinutes > 0 && <span className="pill pill--warn">{t('{n} min sen', { n: c.lateMinutes })}</span>}
          </span>
          <span className="block">{names(c.now)}</span>
          {c.now.canEnterResult && (
            <button className="btn btn--small" onClick={() => onReport(c.now!)}>
              {t('Rapportera')}
            </button>
          )}
        </div>
      ) : (
        <p className="muted small">{c.next ? t('Ledig just nu') : t('Klar för dagen')}</p>
      )}
      {c.next && (
        <div className="court-card__next small">
          <span className="muted">
            {t('Sedan {time}', { time: fmtTime(c.next.date) })} · {c.next.className}
          </span>
          <span className="block">{names(c.next)}</span>
        </div>
      )}
    </article>
  );
}

function PartnerTab(p: {
  loading: boolean;
  seekers: Map<string, { className: string; playerId: number; name: string; rankedinId: string | null }[]> | null;
  noLicence: { className: string; name: string }[];
  signInOpen: boolean;
  closes: string | null;
  classCounts: { name: string; pairs: number; singles: number }[];
  adminUrl: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  if (p.loading) return <Loading />;
  const total = p.seekers ? [...p.seekers.values()].reduce((n, s) => n + s.length, 0) : 0;
  return (
    <>
      {p.signInOpen && p.closes && (
        <Notice tone="warn">
          <strong>{t('Anmälan stänger {date}.', { date: fmtDayTime(p.closes) })}</strong>{' '}
          {t('Para ihop de som söker partner innan dess – de kommer annars inte med i lottningen.')}
        </Notice>
      )}
      <Section title={total ? t('Söker partner ({n})', { n: total }) : t('Söker partner')}>
        {total === 0 && <Notice tone="ok">{t('Alla anmälda har en partner.')}</Notice>}
        {p.seekers &&
          [...p.seekers].map(([className, list]) => {
            const text = t('Söker partner i {className}: {names}. Hör av er till varandra och anmäl er som par i Rankedin.', { className, names: list.map((s) => s.name).join(', ') });
            return (
              <div key={className} className="seeker-class">
                <div className="row gap seeker-class__head">
                  <strong>
                    {className} · {t('{n} st', { n: list.length })}
                  </strong>
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(text);
                        setCopied(className);
                        setTimeout(() => setCopied(null), 2000);
                      } catch {
                        /* clipboard blocked */
                      }
                    }}
                  >
                    {copied === className ? t('Kopierat') : t('Kopiera som meddelande')}
                  </button>
                </div>
                <div className="list">
                  {list.map((s) =>
                    s.rankedinId ? (
                      <PlayerHitRow key={s.playerId} h={{ id: s.playerId, name: s.name, rankedinId: s.rankedinId }} from={t('Tävlingsledning')} />
                    ) : (
                      <div key={s.playerId} className="item">
                        <strong>{s.name}</strong>
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        <p className="muted small">
          {t('Ihopparning görs i Rankedin (anmälan → byt partner) eller av spelarna själva.')} <ExternalLink href={p.adminUrl}>{t('Öppna tävlingen i Rankedin')}</ExternalLink>
        </p>
      </Section>

      {p.noLicence.length > 0 && (
        <Section title={t('Saknar licens ({n})', { n: p.noLicence.length })}>
          <ul className="small">
            {p.noLicence.map((x) => (
              <li key={`${x.className}-${x.name}`}>
                {x.name} <span className="muted">· {x.className}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">{t('Utan giltig tävlingslicens kan spelaren inte delta i sanktionerade klasser.')}</p>
        </Section>
      )}

      <Section title={t('Anmälda per klass')}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('Klass')}</th>
              <th>{t('Par')}</th>
              <th>{t('Utan partner')}</th>
            </tr>
          </thead>
          <tbody>
            {p.classCounts.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td>{c.pairs}</td>
                <td className={c.singles ? 'text-warn' : 'muted'}>{c.singles || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}

function ShareTab({ tid, name }: { tid: number; name: string }) {
  const url = `${location.origin}/tavling/${tid}`;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480 }).then(setQr, () => setQr(null));
  }, [url]);
  return (
    <>
      <Section title={t('Utskrifter för dagen')}>
        <div className="list">
          <Go className="item" to={`/tavling/${tid}/skriv-ut?typ=schema`} from={t('Tävlingsledning')}>
            <span className="item__main">
              <strong>{t('Dagens schema')}</strong>
              <span className="muted small block">{t('Alla matcher i tidsordning med bana, klass och ruta för resultat')}</span>
            </span>
          </Go>
          <Go className="item" to={`/tavling/${tid}/skriv-ut?typ=deltagare`} from={t('Tävlingsledning')}>
            <span className="item__main">
              <strong>{t('Deltagarlista för avcheckning')}</strong>
              <span className="muted small block">{t('Alla anmälda per klass med rutor för på plats och betalt')}</span>
            </span>
          </Go>
          <Go className="item" to={`/tavling/${tid}/skriv-ut?typ=banor`} from={t('Tävlingsledning')}>
            <span className="item__main">
              <strong>{t('Spelare per bana')}</strong>
              <span className="muted small block">{t('En sida per bana att sätta upp vid banan')}</span>
            </span>
          </Go>
          <Go className="item" to={`/tavling/${tid}/qr?typ=affisch`} from={t('Tävlingsledning')}>
            <span className="item__main">
              <strong>{t('QR-kod för resultat')}</strong>
              <span className="muted small block">{t('Affisch eller lappar – spelare och föräldrar ser matcher och resultat i mobilen')}</span>
            </span>
          </Go>
        </div>
      </Section>
      <Section title={t('QR-kod till tävlingen')}>
        <p className="small">
          {t('Spelare och föräldrar skannar koden och ser direkt sina matcher, tider, banor och resultat i mobilen – ingen app eller inloggning behövs.')}{' '}
          {t('Sidan uppdateras av sig själv under dagen.')}
        </p>
        {qr && <img src={qr} alt={t('QR-kod till {name}', { name })} className="qr" width={200} height={200} />}
        <p className="small">
          <a href={url}>{url}</a>
        </p>
        <div className="row gap wrap">
          <Go className="btn btn--primary btn--small" to={`/tavling/${tid}/qr?typ=lappar`} from={t('Tävlingsledning')}>
            {t('Skriv ut lappar att dela ut')}
          </Go>
          <Go className="btn btn--small" to={`/tavling/${tid}/qr?typ=affisch`} from={t('Tävlingsledning')}>
            {t('Skriv ut affisch')}
          </Go>
          {qr && (
            <a className="btn btn--small btn--ghost" href={qr} download={`qr-tavling-${tid}.png`}>
              {t('Ladda ner bild')}
            </a>
          )}
        </div>
        <p className="muted small">{t('Tips: dela länken eller bilden i klubbens chatt redan innan, så har alla den på morgonen.')}</p>
      </Section>
      <details className="fold">
        <summary>{t('Har ni en TV eller projektor?')}</summary>
        <p className="small muted">{t('Skärmvyn visar varje bana med pågående och nästa match och uppdateras själv.')}</p>
        <Go className="btn btn--small" to={`/tavling/${tid}/skarm`} from={t('Tävlingsledning')}>
          {t('Öppna skärmvy')}
        </Go>
      </details>
    </>
  );
}
