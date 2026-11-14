// Organiser: courts and times, then per class close sign-in → draw → schedule, then publish.
// Each step is one confirmed action; status is read back from Rankedin afterwards.
import { useEffect, useRef, useState } from 'react';
import { drawAction, getDrawStatus, type ClassStatus, type DayRow, type TournamentStatus } from '../lib/draws';
import { fmtDay } from '../lib/format';
import { t } from '../lib/i18n';
import { getTournamentDetails, townFromAddress } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { AccountSwitcher } from './AccountSwitcher';
import { ErrorBox, Loading, Notice, Section } from './ui';

/** singles: per class name, how many entries still lack a partner. */
export function DrawPanel({ tournamentId, onChanged, singles }: { tournamentId: number; onChanged: () => void; singles?: Map<string, number> }) {
  const { version } = useSession();
  const status = useAsync(() => getDrawStatus(tournamentId), [tournamentId, version]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [waitingFor, setWaitingFor] = useState<{ classId: number; until: 'generated' | 'scheduled'; deadline: number } | null>(null);
  const poll = useRef<number | null>(null);

  // Generation and scheduling finish later at Rankedin: poll until done (max 3 min).
  useEffect(() => {
    if (!waitingFor) return;
    poll.current = window.setInterval(async () => {
      const s = await getDrawStatus(tournamentId).catch(() => null);
      const c = s?.classes.find((x) => x.classId === waitingFor.classId);
      if (c && c[waitingFor.until]) {
        setWaitingFor(null);
        setMsg({ tone: 'ok', text: waitingFor.until === 'generated' ? t('{name} är lottad.', { name: c.name }) : t('{name} är schemalagd.', { name: c.name }) });
        status.reload();
        onChanged();
      } else if (Date.now() > waitingFor.deadline) {
        setWaitingFor(null);
        setMsg({ tone: 'error', text: t('Rankedin har inte blivit klar efter 3 minuter. Tryck Uppdatera om en stund.') });
        status.reload();
      }
    }, 4000);
    return () => {
      if (poll.current) window.clearInterval(poll.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingFor, tournamentId]);

  async function run(key: string, confirmText: string | null, action: string, extra: Record<string, unknown>, ok: string, wait?: { classId: number; until: 'generated' | 'scheduled' }) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setMsg(null);
    try {
      await drawAction(tournamentId, action, extra);
      if (wait) {
        setWaitingFor({ ...wait, deadline: Date.now() + 180_000 });
        setMsg({ tone: 'ok', text: `${ok} ${t('Rankedin arbetar – det kan ta en minut.')}` });
      } else setMsg({ tone: 'ok', text: ok });
      status.reload();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'error', text: t((e as Error).message) });
      status.reload();
    } finally {
      setBusy(null);
    }
  }

  if (status.error) {
    return (status.error as { code?: string }).code === 'not_admin' ? (
      <Notice>{t('Ditt aktiva konto är inte arrangör för tävlingen. Byt konto under Konton.')}</Notice>
    ) : (
      <ErrorBox error={status.error} onRetry={() => status.reload()} />
    );
  }
  const s = status.data;
  if (!s) return <Loading label={t('Hämtar läget från Rankedin…')} />;

  const ready = s.courts.length > 0 && s.days.length > 0;
  const published = s.drawsPublished || s.matchesPublished;
  return (
    <div className="draw-panel">
      <AccountSwitcher label={t('Görs som')} />
      {msg && <Notice tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Notice>}
      {waitingFor && <Loading label={t('Väntar på Rankedin…')} />}
      {s.scheduling && <Notice>{t('Rankedin schemalägger just nu. Vänta någon minut och tryck Uppdatera.')}</Notice>}

      <Section title={t('1. Banor och tider')}>
        <Courts tournamentId={tournamentId} status={s} busy={busy} run={run} />
        <Times status={s} busy={busy} run={run} />
      </Section>

      <Section title={t('2. Klasserna')}>
        <p className="small muted">{t('Gör varje klass i ordning: stäng anmälan, lotta, schemalägg. Inget syns för spelarna förrän du publicerar.')}</p>
        <div className="list">
          {s.classes.map((c) => (
            <ClassRow key={c.classId} c={c} singles={singles?.get(c.name) ?? 0} ready={ready} published={published} busy={busy || (waitingFor ? 'wait' : null)} run={run} />
          ))}
        </div>
      </Section>

      <Section title={t('3. Publicera')}>
        {!s.allMatchesHaveCourt && <Notice tone="warn">{t('Alla matcher fick inte plats i schemat. Öka antal banor eller förläng dagen och schemalägg igen.')}</Notice>}
        {published ? (
          <>
            <Notice tone="ok">{t('Lottning och matchtider är publicerade. Spelarna ser dem nu, även via QR-koden.')}</Notice>
            <button
              className="btn btn--small"
              disabled={!!busy}
              onClick={() => run('unpublish', t('Dölja lottning och matchtider för spelarna igen?'), 'unpublish', {}, t('Lottning och matchtider är dolda igen.'))}
            >
              {t('Dölj igen')}
            </button>
          </>
        ) : (
          <>
            <p className="small">{t('Publiceringen gäller hela tävlingen – alla klasser blir synliga på en gång. Gör det när alla klasser är lottade och schemalagda.')}</p>
            <button
              className="btn btn--primary"
              disabled={!!busy || !s.classes.some((c) => c.scheduled)}
              onClick={() =>
                run(
                  'publish',
                  `${t('Publicera lottning och matchtider för alla klasser?')}${s.classes.some((c) => !c.scheduled) ? ` ${t('Obs: alla klasser är inte schemalagda.')}` : ''}`,
                  'publish',
                  {},
                  t('Publicerat! Spelarna ser nu lottning och matchtider.'),
                )
              }
            >
              {t('Publicera lottning och matchtider')}
            </button>
          </>
        )}
      </Section>
      <p className="center">
        <button className="btn btn--ghost btn--small" onClick={() => status.reload()}>
          {t('Uppdatera läget')}
        </button>
      </p>
    </div>
  );
}

type Run = (key: string, confirmText: string | null, action: string, extra: Record<string, unknown>, ok: string, wait?: { classId: number; until: 'generated' | 'scheduled' }) => Promise<void>;

function ClassRow({ c, singles, ready, published, busy, run }: { c: ClassStatus; singles: number; ready: boolean; published: boolean; busy: string | null; run: Run }) {
  const [pools, setPools] = useState(1);
  const maxPools = Math.max(1, Math.floor(c.participants / 3));
  const step = c.signInOpen ? t('Anmälan öppen') : !c.generated ? t('Redo att lottas') : !c.scheduled ? t('Lottad') : t('Schemalagd');
  return (
    <div className="item draw-class">
      <span className="item__main">
        <strong>{c.name}</strong>
        <span className="muted small block">
          {singles ? t('{pairs} par + {n} utan partner', { pairs: c.participants - singles, n: singles }) : c.participants === 1 ? t('1 par') : t('{n} par', { n: c.participants })} · {step}
        </span>
        {!c.generated && singles > 0 && (
          <span className="small text-warn block">
            {t('{n} anmälda saknar partner. Para ihop dem under Före lottning – annars lottas de som egna "par" utan partner.', { n: singles })}
          </span>
        )}
        <span className="row gap wrap draw-class__actions">
          {c.signInOpen && (
            <button
              className="btn btn--small"
              disabled={!!busy}
              onClick={() => run(`close-${c.classId}`, t('Stänga anmälan i {name}? Därefter kan inga fler anmäla sig.', { name: c.name }), 'closeSignIn', { classId: c.classId }, t('Anmälan i {name} är stängd.', { name: c.name }))}
            >
              {t('Stäng anmälan')}
            </button>
          )}
          {!c.generated && (
            <>
              <select className="input input--inline" value={pools} onChange={(e) => setPools(Number(e.target.value))} aria-label={t('Antal grupper')}>
                <option value={1}>{t('1 grupp – alla möter alla')}</option>
                {Array.from({ length: Math.max(0, maxPools - 1) }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {t('{n} grupper', { n })}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--small btn--primary"
                disabled={!!busy || c.participants < 2}
                onClick={() =>
                  run(
                    `draw-${c.classId}`,
                    `${singles ? `${t('OBS: {n} anmälda saknar fortfarande partner.', { n: singles })} ` : ''}${
                      pools === 1
                        ? t('Lotta {name} i 1 grupp där alla möter alla? Rankedin fördelar paren efter seedning. Du kan ta bort lottningen igen innan du publicerar.', { name: c.name })
                        : t('Lotta {name} i {n} grupper? Rankedin fördelar paren efter seedning. Du kan ta bort lottningen igen innan du publicerar.', { name: c.name, n: pools })
                    }`,
                    pools === 1 ? 'drawOnePool' : 'drawPools',
                    { classId: c.classId, pools },
                    t('Lottningen är startad.'),
                    { classId: c.classId, until: 'generated' },
                  )
                }
              >
                {t('Lotta')}
              </button>
            </>
          )}
          {c.generated && !c.scheduled && (
            <button
              className="btn btn--small btn--primary"
              disabled={!!busy || !ready}
              title={ready ? undefined : t('Lägg till banor och tider först')}
              onClick={() =>
                run(`sched-${c.classId}`, t('Schemalägg {name} på banorna och tiderna ovan?', { name: c.name }), 'schedule', { classId: c.classId }, t('Schemaläggningen är startad.'), {
                  classId: c.classId,
                  until: 'scheduled',
                })
              }
            >
              {t('Schemalägg')}
            </button>
          )}
          {c.scheduled && !published && (
            <button
              className="btn btn--small btn--ghost"
              disabled={!!busy}
              onClick={() => run(`unsched-${c.classId}`, t('Ta bort schemat för {name}?', { name: c.name }), 'unschedule', { classId: c.classId }, t('Schemat för {name} är borttaget.', { name: c.name }))}
            >
              {t('Ta bort schema')}
            </button>
          )}
          {c.generated && !published && (
            <button
              className="btn btn--small btn--ghost"
              disabled={!!busy}
              onClick={() => run(`clear-${c.classId}`, t('Ta bort lottningen och alla matcher i {name}? Du kan lotta igen efteråt.', { name: c.name }), 'clearDraw', { classId: c.classId }, t('Lottningen i {name} är borttagen.', { name: c.name }))}
            >
              {t('Ta bort lottning')}
            </button>
          )}
        </span>
        {c.generated && !c.scheduled && !ready && <span className="small muted block">{t('Lägg till banor och tider ovan innan du schemalägger.')}</span>}
      </span>
    </div>
  );
}

function Courts({ tournamentId, status, busy, run }: { tournamentId: number; status: TournamentStatus; busy: string | null; run: Run }) {
  const details = useAsync(() => getTournamentDetails(tournamentId).catch(() => null), [tournamentId], `tdetails.${tournamentId}`);
  const [count, setCount] = useState(1);
  const venue = details.data?.venue ?? '';
  const address = (details.data?.address ?? '').split(',')[0] ?? '';
  const city = townFromAddress(details.data?.address ?? null) ?? '';
  return (
    <div className="stack">
      <p className="small">
        <strong>{t('Banor:')}</strong> {status.courts.length ? status.courts.map((c) => c.name).join(', ') : t('inga än')}
      </p>
      <div className="row gap wrap">
        <label className="toolbar__label">
          {t('Lägg till')}{' '}
          <select className="input input--inline" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{' '}
          {count === 1 ? t('bana') : t('banor')}
        </label>
        <button
          className="btn btn--small"
          disabled={!!busy || !venue || !city}
          onClick={async () => {
            if (!window.confirm(count === 1 ? t('Lägga till 1 bana på {venue}, {city}?', { venue, city }) : t('Lägga till {n} banor på {venue}, {city}?', { n: count, venue, city }))) return;
            for (let i = 0; i < count; i++) {
              const n = status.courts.length + i + 1;
              await run(`court-${n}`, null, 'addCourt', { courtName: `Bana ${n}`, locationName: venue, address: address || venue, city, order: n - 1 }, count === 1 ? t('Banan är tillagda.') : t('Banorna är tillagda.'));
            }
          }}
        >
          {t('Lägg till')}
        </button>
      </div>
      {(!venue || !city) && <p className="small muted">{t('Tävlingen saknar anläggning eller adress i Rankedin – lägg till banor där.')}</p>}
    </div>
  );
}

function Times({ status, busy, run }: { status: TournamentStatus; busy: string | null; run: Run }) {
  const [rows, setRows] = useState<(DayRow & { breakFactor: number })[]>([]);
  useEffect(() => {
    setRows(status.days.map((d) => ({ ...d, duration: d.duration || 45, maxCourts: d.maxCourts || Math.max(1, status.courts.length), breakFactor: d.duration ? Math.round(d.minBreak / d.duration) : 0 })));
  }, [status.days, status.courts.length]);
  if (status.days.length === 0) return <Notice tone="warn">{t('Tävlingen har inga speldagar i Rankedin än.')}</Notice>;
  const set = (i: number, patch: Partial<DayRow & { breakFactor: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="stack">
      <p className="small">
        <strong>{t('Tider')}</strong>
      </p>
      {rows.map((r, i) => (
        <div key={r.settingsId} className="row gap wrap times-row">
          <span className="small">{fmtDay(r.day)}</span>
          <label className="toolbar__label">
            {t('Start')} <input className="input input--inline" type="time" value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })} />
          </label>
          <label className="toolbar__label">
            {t('Slut')} <input className="input input--inline" type="time" value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })} />
          </label>
          <label className="toolbar__label">
            {t('Min/match')}{' '}
            <select className="input input--inline" value={r.duration} onChange={(e) => set(i, { duration: Number(e.target.value) })}>
              {[20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="toolbar__label">
            {t('Banor')}{' '}
            <select className="input input--inline" value={r.maxCourts} onChange={(e) => set(i, { maxCourts: Number(e.target.value) })}>
              {Array.from({ length: Math.max(8, status.courts.length) }, (_, k) => k + 1).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="toolbar__label">
            {t('Vila')}{' '}
            <select className="input input--inline" value={r.breakFactor} onChange={(e) => set(i, { breakFactor: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? t('ingen') : n === 1 ? t('1 match') : t('{n} matcher', { n })}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      <div>
        <button
          className="btn btn--small"
          disabled={!!busy}
          onClick={() =>
            run(
              'times',
              null,
              'saveTimes',
              { days: rows.map((r) => ({ settingsId: r.settingsId, startTime: r.startTime, endTime: r.endTime, duration: r.duration, maxCourts: r.maxCourts, breakFactor: r.breakFactor })) },
              t('Tiderna är sparade.'),
            )
          }
        >
          {t('Spara tider')}
        </button>
        {status.courts.length > 0 && rows.some((r) => r.maxCourts > status.courts.length) && (
          <span className="small muted"> {t('Obs: fler banor per dag än tillagda banor ({n}).', { n: status.courts.length })}</span>
        )}
      </div>
    </div>
  );
}
