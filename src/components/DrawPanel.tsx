// Organiser: courts and times, then per class close sign-in → draw → schedule, then publish.
// Each step is one confirmed action; status is read back from Rankedin afterwards.
import { useEffect, useRef, useState } from 'react';
import { drawAction, getDrawStatus, type ClassStatus, type DayRow, type TournamentStatus } from '../lib/draws';
import { fmtDay } from '../lib/format';
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
        setMsg({ tone: 'ok', text: waitingFor.until === 'generated' ? `${c.name} är lottad.` : `${c.name} är schemalagd.` });
        status.reload();
        onChanged();
      } else if (Date.now() > waitingFor.deadline) {
        setWaitingFor(null);
        setMsg({ tone: 'error', text: 'Rankedin har inte blivit klar efter 3 minuter. Tryck Uppdatera om en stund.' });
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
        setMsg({ tone: 'ok', text: `${ok} Rankedin arbetar – det kan ta en minut.` });
      } else setMsg({ tone: 'ok', text: ok });
      status.reload();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message });
      status.reload();
    } finally {
      setBusy(null);
    }
  }

  if (status.error) {
    return (status.error as { code?: string }).code === 'not_admin' ? (
      <Notice>Ditt aktiva konto är inte arrangör för tävlingen. Byt konto under Konton.</Notice>
    ) : (
      <ErrorBox error={status.error} onRetry={() => status.reload()} />
    );
  }
  const s = status.data;
  if (!s) return <Loading label="Hämtar läget från Rankedin…" />;

  const ready = s.courts.length > 0 && s.days.length > 0;
  const published = s.drawsPublished || s.matchesPublished;
  return (
    <div className="draw-panel">
      <AccountSwitcher label="Görs som" />
      {msg && <Notice tone={msg.tone === 'ok' ? 'ok' : 'error'}>{msg.text}</Notice>}
      {waitingFor && <Loading label="Väntar på Rankedin…" />}
      {s.scheduling && <Notice>Rankedin schemalägger just nu. Vänta någon minut och tryck Uppdatera.</Notice>}

      <Section title="1. Banor och tider">
        <Courts tournamentId={tournamentId} status={s} busy={busy} run={run} />
        <Times status={s} busy={busy} run={run} />
      </Section>

      <Section title="2. Klasserna">
        <p className="small muted">Gör varje klass i ordning: stäng anmälan, lotta, schemalägg. Inget syns för spelarna förrän du publicerar.</p>
        <div className="list">
          {s.classes.map((c) => (
            <ClassRow key={c.classId} c={c} singles={singles?.get(c.name) ?? 0} ready={ready} published={published} busy={busy || (waitingFor ? 'wait' : null)} run={run} />
          ))}
        </div>
      </Section>

      <Section title="3. Publicera">
        {!s.allMatchesHaveCourt && <Notice tone="warn">Alla matcher fick inte plats i schemat. Öka antal banor eller förläng dagen och schemalägg igen.</Notice>}
        {published ? (
          <>
            <Notice tone="ok">Lottning och matchtider är publicerade. Spelarna ser dem nu, även via QR-koden.</Notice>
            <button
              className="btn btn--small"
              disabled={!!busy}
              onClick={() => run('unpublish', 'Dölja lottning och matchtider för spelarna igen?', 'unpublish', {}, 'Lottning och matchtider är dolda igen.')}
            >
              Dölj igen
            </button>
          </>
        ) : (
          <>
            <p className="small">Publiceringen gäller hela tävlingen – alla klasser blir synliga på en gång. Gör det när alla klasser är lottade och schemalagda.</p>
            <button
              className="btn btn--primary"
              disabled={!!busy || !s.classes.some((c) => c.scheduled)}
              onClick={() =>
                run(
                  'publish',
                  `Publicera lottning och matchtider för alla klasser?${s.classes.some((c) => !c.scheduled) ? ' Obs: alla klasser är inte schemalagda.' : ''}`,
                  'publish',
                  {},
                  'Publicerat! Spelarna ser nu lottning och matchtider.',
                )
              }
            >
              Publicera lottning och matchtider
            </button>
          </>
        )}
      </Section>
      <p className="center">
        <button className="btn btn--ghost btn--small" onClick={() => status.reload()}>
          Uppdatera läget
        </button>
      </p>
    </div>
  );
}

type Run = (key: string, confirmText: string | null, action: string, extra: Record<string, unknown>, ok: string, wait?: { classId: number; until: 'generated' | 'scheduled' }) => Promise<void>;

function ClassRow({ c, singles, ready, published, busy, run }: { c: ClassStatus; singles: number; ready: boolean; published: boolean; busy: string | null; run: Run }) {
  const [pools, setPools] = useState(1);
  const maxPools = Math.max(1, Math.floor(c.participants / 3));
  const step = c.signInOpen ? 'Anmälan öppen' : !c.generated ? 'Redo att lottas' : !c.scheduled ? 'Lottad' : 'Schemalagd';
  return (
    <div className="item draw-class">
      <span className="item__main">
        <strong>{c.name}</strong>
        <span className="muted small block">
          {singles ? `${c.participants - singles} par + ${singles} utan partner` : `${c.participants} par`} · {step}
        </span>
        {!c.generated && singles > 0 && (
          <span className="small text-warn block">
            {singles} anmälda saknar partner. Para ihop dem under Före lottning – annars lottas de som egna "par" utan partner.
          </span>
        )}
        <span className="row gap wrap draw-class__actions">
          {c.signInOpen && (
            <button
              className="btn btn--small"
              disabled={!!busy}
              onClick={() => run(`close-${c.classId}`, `Stänga anmälan i ${c.name}? Därefter kan inga fler anmäla sig.`, 'closeSignIn', { classId: c.classId }, `Anmälan i ${c.name} är stängd.`)}
            >
              Stäng anmälan
            </button>
          )}
          {!c.generated && (
            <>
              <select className="input input--inline" value={pools} onChange={(e) => setPools(Number(e.target.value))} aria-label="Antal grupper">
                <option value={1}>1 grupp – alla möter alla</option>
                {Array.from({ length: Math.max(0, maxPools - 1) }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} grupper
                  </option>
                ))}
              </select>
              <button
                className="btn btn--small btn--primary"
                disabled={!!busy || c.participants < 2}
                onClick={() =>
                  run(
                    `draw-${c.classId}`,
                    `${singles ? `OBS: ${singles} anmälda saknar fortfarande partner. ` : ''}Lotta ${c.name} i ${pools === 1 ? '1 grupp där alla möter alla' : `${pools} grupper`}? Rankedin fördelar paren efter seedning. Du kan ta bort lottningen igen innan du publicerar.`,
                    pools === 1 ? 'drawOnePool' : 'drawPools',
                    { classId: c.classId, pools },
                    'Lottningen är startad.',
                    { classId: c.classId, until: 'generated' },
                  )
                }
              >
                Lotta
              </button>
            </>
          )}
          {c.generated && !c.scheduled && (
            <button
              className="btn btn--small btn--primary"
              disabled={!!busy || !ready}
              title={ready ? undefined : 'Lägg till banor och tider först'}
              onClick={() =>
                run(`sched-${c.classId}`, `Schemalägg ${c.name} på banorna och tiderna ovan?`, 'schedule', { classId: c.classId }, 'Schemaläggningen är startad.', {
                  classId: c.classId,
                  until: 'scheduled',
                })
              }
            >
              Schemalägg
            </button>
          )}
          {c.scheduled && !published && (
            <button className="btn btn--small btn--ghost" disabled={!!busy} onClick={() => run(`unsched-${c.classId}`, `Ta bort schemat för ${c.name}?`, 'unschedule', { classId: c.classId }, `Schemat för ${c.name} är borttaget.`)}>
              Ta bort schema
            </button>
          )}
          {c.generated && !published && (
            <button
              className="btn btn--small btn--ghost"
              disabled={!!busy}
              onClick={() => run(`clear-${c.classId}`, `Ta bort lottningen och alla matcher i ${c.name}? Du kan lotta igen efteråt.`, 'clearDraw', { classId: c.classId }, `Lottningen i ${c.name} är borttagen.`)}
            >
              Ta bort lottning
            </button>
          )}
        </span>
        {c.generated && !c.scheduled && !ready && <span className="small muted block">Lägg till banor och tider ovan innan du schemalägger.</span>}
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
        <strong>Banor:</strong> {status.courts.length ? status.courts.map((c) => c.name).join(', ') : 'inga än'}
      </p>
      <div className="row gap wrap">
        <label className="toolbar__label">
          Lägg till{' '}
          <select className="input input--inline" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>{' '}
          {count === 1 ? 'bana' : 'banor'}
        </label>
        <button
          className="btn btn--small"
          disabled={!!busy || !venue || !city}
          onClick={async () => {
            if (!window.confirm(`Lägga till ${count} ${count === 1 ? 'bana' : 'banor'} på ${venue}, ${city}?`)) return;
            for (let i = 0; i < count; i++) {
              const n = status.courts.length + i + 1;
              await run(`court-${n}`, null, 'addCourt', { courtName: `Bana ${n}`, locationName: venue, address: address || venue, city, order: n - 1 }, `${count === 1 ? 'Banan' : 'Banorna'} är tillagda.`);
            }
          }}
        >
          Lägg till
        </button>
      </div>
      {(!venue || !city) && <p className="small muted">Tävlingen saknar anläggning eller adress i Rankedin – lägg till banor där.</p>}
    </div>
  );
}

function Times({ status, busy, run }: { status: TournamentStatus; busy: string | null; run: Run }) {
  const [rows, setRows] = useState<(DayRow & { breakFactor: number })[]>([]);
  useEffect(() => {
    setRows(status.days.map((d) => ({ ...d, duration: d.duration || 45, maxCourts: d.maxCourts || Math.max(1, status.courts.length), breakFactor: d.duration ? Math.round(d.minBreak / d.duration) : 0 })));
  }, [status.days, status.courts.length]);
  if (status.days.length === 0) return <Notice tone="warn">Tävlingen har inga speldagar i Rankedin än.</Notice>;
  const set = (i: number, patch: Partial<DayRow & { breakFactor: number }>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="stack">
      <p className="small">
        <strong>Tider</strong>
      </p>
      {rows.map((r, i) => (
        <div key={r.settingsId} className="row gap wrap times-row">
          <span className="small">{fmtDay(r.day)}</span>
          <label className="toolbar__label">
            Start <input className="input input--inline" type="time" value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })} />
          </label>
          <label className="toolbar__label">
            Slut <input className="input input--inline" type="time" value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })} />
          </label>
          <label className="toolbar__label">
            Min/match{' '}
            <select className="input input--inline" value={r.duration} onChange={(e) => set(i, { duration: Number(e.target.value) })}>
              {[20, 25, 30, 35, 40, 45, 50, 60, 75, 90].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="toolbar__label">
            Banor{' '}
            <select className="input input--inline" value={r.maxCourts} onChange={(e) => set(i, { maxCourts: Number(e.target.value) })}>
              {Array.from({ length: Math.max(8, status.courts.length) }, (_, k) => k + 1).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="toolbar__label">
            Vila{' '}
            <select className="input input--inline" value={r.breakFactor} onChange={(e) => set(i, { breakFactor: Number(e.target.value) })}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'ingen' : `${n} match${n > 1 ? 'er' : ''}`}
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
              'Tiderna är sparade.',
            )
          }
        >
          Spara tider
        </button>
        {status.courts.length > 0 && rows.some((r) => r.maxCourts > status.courts.length) && (
          <span className="small muted"> Obs: fler banor per dag än tillagda banor ({status.courts.length}).</span>
        )}
      </div>
    </div>
  );
}
