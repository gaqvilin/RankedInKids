// Printable sheets for the organiser on the day: schedule, check-in list, one sheet per court.
// Plain tables in black on white, A4, with a toolbar that is hidden when printing.
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { Logo } from '../components/Logo';
import { classInEvent, fmtDay, fmtTime } from '../lib/format';
import { locale, t } from '../lib/i18n';
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
/** Class name without what the event name already says, plus the group only when the class has several. */
function classLabel(matches: TournamentMatch[], eventName: string) {
  const draws = new Map<string, Set<string>>();
  for (const m of matches) draws.set(m.className, (draws.get(m.className) ?? new Set()).add(m.draw ?? ''));
  return (m: TournamentMatch) => {
    const name = classInEvent(m.className, eventName);
    return (draws.get(m.className)?.size ?? 0) > 1 && m.draw ? `${name} · ${m.draw}` : name;
  };
}
const NO_COURT = 'Ingen bana';
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

  const tour = header.data;
  const all = useMemo(() => [...(matches.data ?? [])].sort((a, b) => time(a) - time(b) || courtOrder(a.court ?? '', b.court ?? '')), [matches.data]);
  const scheduled = all.filter((m) => m.date);
  const title = KINDS.find((k) => k.id === kind)!.label;

  return (
    <div className="qr-page print-page">
      <div className="qr-toolbar no-print">
        <Go to={`/tavling/${tid}/ledning?vy=dela`} from={t('Tävlingen')} className="btn btn--ghost btn--small">
          ‹ {t('Tillbaka')}
        </Go>
        <span className="chips chips--inline">
          {KINDS.map((k) => (
            <button key={k.id} className={`chip ${kind === k.id ? 'chip--on' : ''}`} onClick={() => setParams({ typ: k.id }, { replace: true })}>
              {t(k.label)}
            </button>
          ))}
        </span>
        <button className="btn btn--primary btn--small" onClick={() => window.print()}>
          {t('Skriv ut')}
        </button>
      </div>

      <header className="print-head">
        <span className="print-logo">
          <Logo size={18} />
        </span>
        <h1>{tour?.name ?? ''}</h1>
        <p>
          {t(title)}
          {tour ? ` · ${fmtDay(tour.startDate)}` : ''} · {t('utskrivet {when}', { when: new Date().toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) })}
        </p>
      </header>

      {kind !== 'deltagare' && matches.loading && !matches.data && <p>{t('Hämtar matcher…')}</p>}
      {kind !== 'deltagare' && matches.data && scheduled.length === 0 && (
        <p>{t('Inga matcher med tid än. Lotta och schemalägg först (Tävlingsledning → Lottning), så fylls utskriften i.')}</p>
      )}

      {kind === 'schema' && scheduled.length > 0 && <Schedule matches={scheduled} label={classLabel(scheduled, tour?.name ?? '')} />}
      {kind === 'banor' && scheduled.length > 0 && <PerCourt matches={scheduled} label={classLabel(scheduled, tour?.name ?? '')} />}
      {kind === 'deltagare' && (pairs.data ? <CheckIn classes={pairs.data} /> : <p>{t('Hämtar anmälda…')}</p>)}
    </div>
  );
}

/** Every match of the day in time order, with an empty result box to fill in by hand. */
function Schedule({ matches, label }: { matches: TournamentMatch[]; label: (m: TournamentMatch) => string }) {
  return (
    <table className="print-table">
      <thead>
        <tr>
          <th>{t('Tid')}</th>
          <th>{t('Bana')}</th>
          <th>{t('Klass')}</th>
          <th>{t('Par')}</th>
          <th>{t('Par')}</th>
          <th className="print-result">{t('Resultat')}</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((m, i) => (
          <tr key={m.id} className={i > 0 && fmtTime(matches[i - 1].date) !== fmtTime(m.date) ? 'print-newslot' : undefined}>
            <td className="print-nowrap">{fmtTime(m.date)}</td>
            <td className="print-nowrap">{m.court ?? '–'}</td>
            <td className="print-nowrap">{label(m)}</td>
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
function PerCourt({ matches, label }: { matches: TournamentMatch[]; label: (m: TournamentMatch) => string }) {
  const courts = [...new Set(matches.map((m) => m.court ?? NO_COURT))].sort(courtOrder);
  return (
    <>
      {courts.map((c) => (
        <section key={c} className="print-court">
          <h2>{c === NO_COURT ? t(NO_COURT) : c}</h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t('Tid')}</th>
                <th>{t('Klass')}</th>
                <th>{t('Par')}</th>
                <th>{t('Par')}</th>
                <th className="print-result">{t('Resultat')}</th>
              </tr>
            </thead>
            <tbody>
              {matches
                .filter((m) => (m.court ?? NO_COURT) === c)
                .map((m) => (
                  <tr key={m.id}>
                    <td className="print-nowrap">{fmtTime(m.date)}</td>
                    <td className="print-nowrap">{label(m)}</td>
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
        {t('{n} anmälningar i {classes} klasser. Bocka av när spelaren är på plats.', { n: total, classes: classes.length })}
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
                  <th className="print-tick">{t('Här')}</th>
                  <th>{t('Spelare')}</th>
                  <th className="print-tick">{t('Här')}</th>
                  <th>{t('Partner')}</th>
                  <th className="print-tick">{t('Betalt')}</th>
                  <th>{t('Anteckning')}</th>
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
                        {p.players[0] && !p.players[0].hasLicense && <span className="print-flag"> {t('licens?')}</span>}
                      </td>
                      <td className="print-tick">{p.players[1] ? '☐' : ''}</td>
                      <td>
                        {p.players[1]?.name ?? <em>{t('saknar partner')}</em>}
                        {p.players[1] && !p.players[1].hasLicense && <span className="print-flag"> {t('licens?')}</span>}
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
