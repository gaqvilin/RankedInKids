// Tävlingsledning: everything the organising club needs on the day, on one page.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { MatchCard } from '../components/MatchCard';
import { PlayerHitRow } from '../components/PlayerHitRow';
import { ResultSheet } from '../components/ResultSheet';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { fmtDayTime, fmtTime, isSameDay } from '../lib/format';
import { courtBoard, missingResults, partnerSeekers, unlicensed, type CourtState } from '../lib/organizer';
import { getClasses, getClassPairs, getTournament, getTournamentMatches, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

type Tab = 'partner' | 'banor' | 'resultat' | 'dela';
const TABS: { id: Tab; label: string }[] = [
  { id: 'partner', label: 'Före lottning' },
  { id: 'banor', label: 'Banor' },
  { id: 'resultat', label: 'Resultat' },
  { id: 'dela', label: 'Skärm & QR' },
];

export default function Organizer() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const { version } = useSession();
  const [params, setParams] = useSearchParams();
  const header = useAsync(() => getTournament(tid), [tid]);
  const classes = useAsync(() => getClasses(tid), [tid]);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid, version]);
  const classKey = (classes.data ?? []).map((c) => c.id).join(',');
  const pairs = useAsync(
    async () => new Map(await Promise.all((classes.data ?? []).map(async (c) => [c.name, await getClassPairs(tid, c.id)] as const))),
    [tid, classKey],
  );
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [now, setNow] = useState(() => new Date());

  const t = header.data;
  const all = matches.data ?? [];
  const drawn = all.length > 0;
  const matchDay = !!t && (isSameDay(t.startDate) || isSameDay(t.endDate));
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
  const seekers = useMemo(() => (pairs.data ? partnerSeekers(pairs.data) : null), [pairs.data]);
  const noLicence = useMemo(() => (pairs.data ? unlicensed(pairs.data) : []), [pairs.data]);

  if (header.error) {
    return (
      <>
        <AppHeader back={`/tavling/${tid}`} backLabel="Tävlingen" />
        <Page>
          <ErrorBox error={header.error} onRetry={() => header.reload()} />
        </Page>
      </>
    );
  }
  if (!t) {
    return (
      <>
        <AppHeader back={`/tavling/${tid}`} backLabel="Tävlingen" />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const played = all.filter((m) => m.played).length;
  return (
    <>
      <AppHeader back={`/tavling/${tid}`} backLabel="Tävlingen" title="Tävlingsledning" />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>Tävlingsledning</h1>
            <p className="muted">
              {t.name} · {fmtDayTime(t.startDate)}
            </p>
            {drawn && (
              <p className="muted small">
                {played} av {all.length} matcher klara{missing.length ? ` · ${missing.length} resultat saknas` : ''}
              </p>
            )}
          </div>
          <RefreshButton onClick={() => matches.reload()} loading={matches.loading} />
        </div>

        <div className="chips chips--wrap" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} className={`chip ${tab === x.id ? 'chip--on' : ''}`} onClick={() => setTab(x.id)}>
              {x.label}
              {x.id === 'resultat' && missing.length > 0 && <span className="count-badge">{missing.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'partner' && (
          <PartnerTab
            loading={pairs.loading && !pairs.data}
            seekers={seekers}
            noLicence={noLicence}
            signInOpen={t.signInOpen}
            closes={t.closeSignInDate}
            classCounts={pairs.data ? [...pairs.data].map(([name, p]) => ({ name, pairs: p.filter((x) => !x.missingPartner).length, singles: p.filter((x) => x.missingPartner).length })) : []}
            adminUrl={rinUrl(t.url)}
          />
        )}

        {tab === 'banor' &&
          (!drawn ? (
            <NotDrawn />
          ) : (
            <div className="court-grid">
              {board.map((c) => (
                <CourtCard key={c.court} c={c} onReport={setReporting} />
              ))}
              {board.length === 0 && <Empty>Matcherna har inga banor och tider än. Schemalägg i Rankedin.</Empty>}
            </div>
          ))}

        {tab === 'resultat' &&
          (!drawn ? (
            <NotDrawn />
          ) : (
            <Section title={missing.length ? `Saknar resultat (${missing.length})` : 'Resultat'}>
              {missing.length === 0 && <Notice tone="ok">Alla matcher som borde vara klara har resultat.</Notice>}
              {missing.length > 0 && !missing.some((m) => m.canEnterResult) && (
                <Notice tone="warn">Ditt inloggade konto får inte rapportera i den här tävlingen. Logga in med kontot som administrerar tävlingen.</Notice>
              )}
              <div className="stack">
                {missing.map((m) => (
                  <MatchCard
                    key={m.id}
                    sides={m.sides}
                    sets={m.sets}
                    played={m.played}
                    date={m.date}
                    court={m.court}
                    label={`${m.className}${m.draw ? ` · ${m.draw}` : ''}`}
                    canEnterResult={m.canEnterResult}
                    onEnterResult={() => setReporting(m)}
                    from="Tävlingsledning"
                  />
                ))}
              </div>
            </Section>
          ))}

        {tab === 'dela' && <ShareTab tid={tid} name={t.name} />}

        {matches.error && <ErrorBox error={matches.error} onRetry={() => matches.reload()} />}
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

function NotDrawn() {
  return <Notice>Inga matcher är publicerade än. Lotta, schemalägg och publicera i Rankedin – då dyker allt upp här.</Notice>;
}

function CourtCard({ c, onReport }: { c: CourtState; onReport: (m: TournamentMatch) => void }) {
  const names = (m: TournamentMatch) => m.sides.map((s) => (s.names.length ? s.names.join(' / ') : '–')).join('  –  ');
  return (
    <article className={`court-card ${c.lateMinutes > 0 ? 'court-card--late' : ''}`}>
      <header className="court-card__head">
        <strong>{c.court}</strong>
        <span className="muted small">
          {c.done}/{c.total} klara
        </span>
      </header>
      {c.now ? (
        <div className="court-card__now">
          <span className="small muted">
            Nu · {fmtTime(c.now.date)} · {c.now.className}
            {c.lateMinutes > 0 && <span className="pill pill--warn">{c.lateMinutes} min sen</span>}
          </span>
          <span className="block">{names(c.now)}</span>
          {c.now.canEnterResult && (
            <button className="btn btn--small" onClick={() => onReport(c.now!)}>
              Rapportera
            </button>
          )}
        </div>
      ) : (
        <p className="muted small">{c.next ? 'Ledig just nu' : 'Klar för dagen'}</p>
      )}
      {c.next && (
        <div className="court-card__next small">
          <span className="muted">
            Sedan {fmtTime(c.next.date)} · {c.next.className}
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
          <strong>Anmälan stänger {fmtDayTime(p.closes)}.</strong> Para ihop de som söker partner innan dess – de kommer annars inte med i lottningen.
        </Notice>
      )}
      <Section title={total ? `Söker partner (${total})` : 'Söker partner'}>
        {total === 0 && <Notice tone="ok">Alla anmälda har en partner.</Notice>}
        {p.seekers &&
          [...p.seekers].map(([className, list]) => {
            const text = `Söker partner i ${className}: ${list.map((s) => s.name).join(', ')}. Hör av er till varandra och anmäl er som par i Rankedin.`;
            return (
              <div key={className} className="seeker-class">
                <div className="row gap seeker-class__head">
                  <strong>
                    {className} · {list.length} st
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
                    {copied === className ? 'Kopierat' : 'Kopiera som meddelande'}
                  </button>
                </div>
                <div className="list">
                  {list.map((s) =>
                    s.rankedinId ? (
                      <PlayerHitRow key={s.playerId} h={{ id: s.playerId, name: s.name, rankedinId: s.rankedinId }} from="Tävlingsledning" />
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
          Ihopparning görs i Rankedin (anmälan → byt partner) eller av spelarna själva. <ExternalLink href={p.adminUrl}>Öppna tävlingen i Rankedin</ExternalLink>
        </p>
      </Section>

      {p.noLicence.length > 0 && (
        <Section title={`Saknar licens (${p.noLicence.length})`}>
          <ul className="small">
            {p.noLicence.map((x) => (
              <li key={`${x.className}-${x.name}`}>
                {x.name} <span className="muted">· {x.className}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Utan giltig tävlingslicens kan spelaren inte delta i sanktionerade klasser.</p>
        </Section>
      )}

      <Section title="Anmälda per klass">
        <table className="table">
          <thead>
            <tr>
              <th>Klass</th>
              <th>Par</th>
              <th>Utan partner</th>
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
    <div className="columns">
      <Section title="QR-kod till tävlingen">
        <p className="small muted">Sätt upp i hallen. Föräldrar och spelare ser sina matcher, tider, banor och resultat direkt i mobilen.</p>
        {qr && <img src={qr} alt={`QR-kod till ${name}`} className="qr" width={240} height={240} />}
        <p className="small">
          <a href={url}>{url}</a>
        </p>
        <div className="row gap">
          <button className="btn btn--small" onClick={() => window.print()}>
            Skriv ut
          </button>
          {qr && (
            <a className="btn btn--small btn--ghost" href={qr} download={`qr-tavling-${tid}.png`}>
              Ladda ner bild
            </a>
          )}
        </div>
      </Section>
      <Section title="Skärm i hallen">
        <p className="small muted">Öppna på en dator kopplad till en TV. Visar varje bana med pågående och nästa match och uppdateras själv var 30:e sekund.</p>
        <Go className="btn btn--primary" to={`/tavling/${tid}/skarm`} from="Tävlingsledning">
          Öppna skärmvy
        </Go>
      </Section>
    </div>
  );
}
