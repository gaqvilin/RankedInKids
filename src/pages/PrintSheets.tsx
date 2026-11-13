// Printable sheets for the organiser on the day: schedule, check-in list, one sheet per court.
// Plain tables in black on white, A4, with a toolbar that is hidden when printing.
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { Logo } from '../components/Logo';
import { fmtDay, fmtTime } from '../lib/format';
import { courtOrder } from '../lib/organizer';
import { getClasses, getClassPairs, getTournament, getTournamentMatches, type Pair, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

type Kind = 'schema' | 'deltagare' | 'banor';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'schema', label: 'Dagens schema' },
  { id: 'deltagare', label: 'Deltagarlista (avcheckning)' },
  { id: 'banor', label: 'Spelare per bana' },
];

const pairName = (s: { names: string[] }) => (s.names.length ? s.names.join(' / ') : '–');
const time = (m: TournamentMatch) => (m.date ? new Date(m.date).getTime() : Number.POSITIVE_INFINITY);

export default function PrintSheets() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const [params, setParams] = useSearchParams();
  const kind = (KINDS.find((k) => k.id === params.get('typ'))?.id ?? 'schema') as Kind;
  const header = useAsync(() => getTournament(tid), [tid]);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid]);
  const classes = useAsync(() => getClasses(tid), [tid]);
  const classKey = (classes.data ?? []).map((c) => c.id).join(',');
  const pairs = useAsync(
    async () => Promise.all((classes.data ?? []).map(async (c) => ({ name: c.name, pairs: await getClassPairs(tid, c.id, true) }))),
    [tid, classKey],
  );

  useEffect(() => {
    document.body.classList.add('screen-mode');
    return () => document.body.classList.remove('screen-mode');
  }, []);

  const t = header.data;
  const all = useMemo(() => [...(matches.data ?? [])].sort((a, b) => time(a) - time(b) || courtOrder(a.court ?? '', b.court ?? '')), [matches.data]);
  const scheduled = all.filter((m) => m.date);
  const title = KINDS.find((k) => k.id === kind)!.label;

  return (
    <div className="qr-page print-page">
      <div className="qr-toolbar no-print">
        <Go to={`/tavling/${tid}/ledning?vy=dela`} from="Tävlingen" className="btn btn--ghost btn--small">
          ‹ Tillbaka
        </Go>
        <span className="chips chips--inline">
          {KINDS.map((k) => (
            <button key={k.id} className={`chip ${kind === k.id ? 'chip--on' : ''}`} onClick={() => setParams({ typ: k.id }, { replace: true })}>
              {k.label}
            </button>
          ))}
        </span>
        <button className="btn btn--primary btn--small" onClick={() => window.print()}>
          Skriv ut
        </button>
      </div>

      <header className="print-head">
        <span className="print-logo">
          <Logo size={18} />
        </span>
        <h1>{t?.name ?? ''}</h1>
        <p>
          {title}
          {t ? ` · ${fmtDay(t.startDate)}` : ''} · utskrivet {new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </header>

      {kind !== 'deltagare' && matches.loading && !matches.data && <p>Hämtar matcher…</p>}
      {kind !== 'deltagare' && matches.data && scheduled.length === 0 && (
        <p>Inga matcher med tid än. Lotta och schemalägg först (Tävlingsledning → Lottning), så fylls utskriften i.</p>
      )}

      {kind === 'schema' && scheduled.length > 0 && <Schedule matches={scheduled} />}
      {kind === 'banor' && scheduled.length > 0 && <PerCourt matches={scheduled} />}
      {kind === 'deltagare' && (pairs.data ? <CheckIn classes={pairs.data} /> : <p>Hämtar anmälda…</p>)}
    </div>
  );
}

/** Every match of the day in time order, with an empty result box to fill in by hand. */
function Schedule({ matches }: { matches: TournamentMatch[] }) {
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>Tid</th>
          <th>Bana</th>
          <th>Klass</th>
          <th>Par</th>
          <th>Par</th>
          <th className="print-result">Resultat</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((m, i) => (
          <tr key={m.id} className={i > 0 && fmtTime(matches[i - 1].date) !== fmtTime(m.date) ? 'print-newslot' : undefined}>
            <td>{fmtTime(m.date)}</td>
            <td>{m.court ?? '–'}</td>
            <td>
              {m.className}
              {m.draw ? <span className="print-muted"> · {m.draw}</span> : null}
            </td>
            <td>{pairName(m.sides[0])}</td>
            <td>{pairName(m.sides[1])}</td>
            <td className="print-result">{m.played ? m.sets.map((s) => s.join('–')).join(', ') : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One page per court, to put up at the court. */
function PerCourt({ matches }: { matches: TournamentMatch[] }) {
  const courts = [...new Set(matches.map((m) => m.court ?? 'Ingen bana'))].sort(courtOrder);
  return (
    <>
      {courts.map((c) => (
        <section key={c} className="print-court">
          <h2>{c}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Tid</th>
                <th>Klass</th>
                <th>Par</th>
                <th>Par</th>
                <th className="print-result">Resultat</th>
              </tr>
            </thead>
            <tbody>
              {matches
                .filter((m) => (m.court ?? 'Ingen bana') === c)
                .map((m) => (
                  <tr key={m.id}>
                    <td>{fmtTime(m.date)}</td>
                    <td>{m.className}</td>
                    <td>{pairName(m.sides[0])}</td>
                    <td>{pairName(m.sides[1])}</td>
                    <td className="print-result">{m.played ? m.sets.map((s) => s.join('–')).join(', ') : ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

/** Per class: every entered pair with tick boxes for arrival (and payment), for when checking in online isn't possible. */
function CheckIn({ classes }: { classes: { name: string; pairs: Pair[] }[] }) {
  const total = classes.reduce((n, c) => n + c.pairs.length, 0);
  return (
    <>
      <p className="print-muted">
        {total} anmälningar i {classes.length} klasser. Bocka av när spelaren är på plats.
      </p>
      {classes
        .filter((c) => c.pairs.length > 0)
        .map((c) => (
          <section key={c.name} className="print-class">
            <h2>
              {c.name} <span className="print-muted">({c.pairs.length})</span>
            </h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th className="print-tick">Här</th>
                  <th>Spelare</th>
                  <th className="print-tick">Här</th>
                  <th>Partner</th>
                  <th className="print-tick">Betalt</th>
                  <th>Anteckning</th>
                </tr>
              </thead>
              <tbody>
                {[...c.pairs]
                  .sort((a, b) => (a.players[0]?.name ?? '').localeCompare(b.players[0]?.name ?? '', 'sv'))
                  .map((p, i) => (
                    <tr key={i}>
                      <td className="print-tick">☐</td>
                      <td>
                        {p.players[0]?.name ?? '–'}
                        {p.players[0] && !p.players[0].hasLicense && <span className="print-flag"> licens?</span>}
                      </td>
                      <td className="print-tick">{p.players[1] ? '☐' : ''}</td>
                      <td>
                        {p.players[1]?.name ?? <em>saknar partner</em>}
                        {p.players[1] && !p.players[1].hasLicense && <span className="print-flag"> licens?</span>}
                      </td>
                      <td className="print-tick">☐</td>
                      <td />
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
    </>
  );
}
