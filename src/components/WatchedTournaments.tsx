// Översikt: the tournaments you watch – how many have entered, what is new since you last looked, when entry closes.
import { useEffect, useState } from 'react';
import { fmtDay } from '../lib/format';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { countsOf, getSeen, getWatched, loadWatchStatus, newSince, setSeen, type Seen, type WatchStatus } from '../lib/watch';
import { Go } from './shell';
import { Loading, Section } from './ui';

export function WatchedTournaments() {
  const [watched] = useState(getWatched);
  // What was seen before this visit: the "new" marks stay while the page is open.
  const [before] = useState<Record<number, Seen | null>>(() => Object.fromEntries(watched.map((w) => [w.id, getSeen(w.id)])));
  const data = useAsync(() => Promise.all(watched.map((w) => loadWatchStatus(w).catch(() => null))), [watched.map((w) => w.id).join(',')], 'watch.v1');
  useEffect(() => {
    for (const s of data.data ?? []) if (s && data.at) setSeen(s.id, countsOf(s));
  }, [data.data, data.at]);

  if (watched.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const list = (data.data ?? []).filter((s): s is WatchStatus => !!s && s.startDate.slice(0, 10) >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <Section title={t('Bevakade tävlingar')}>
      {!data.data && <Loading />}
      {data.data && list.length === 0 && <p className="muted">{t('Inga kommande tävlingar bevakas.')}</p>}
      {list.length > 0 && (
        <div className="list">
          {list.map((s) => {
            const fresh = newSince(s, before[s.id] ?? null);
            const pairs = s.classes.reduce((n, c) => n + c.pairs, 0);
            const seeking = s.classes.reduce((n, c) => n + c.seeking, 0);
            return (
              <Go key={s.id} to={`/tavling/${s.id}`} from={t('Översikt')} className="item">
                <span className="item__date">{fmtDay(s.startDate)}</span>
                <span className="item__main">
                  <strong>{s.name.split(/\s[/–-]\s/)[0]}</strong>
                  <span className="muted small block">
                    {pairs === 1 ? t('1 anmält par') : t('{n} anmälda par', { n: pairs })}
                    {seeking > 0 && ` · ${t('{n} söker partner', { n: seeking })}`}
                    {s.signInOpen && s.closeSignInDate ? ` · ${t('anmälan stänger {day}', { day: fmtDay(s.closeSignInDate) })}` : !s.signInOpen ? ` · ${t('anmälan stängd')}` : ''}
                  </span>
                  {fresh && fresh.total > 0 && (
                    <span className="small block">
                      <span className="pill pill--live">{fresh.total === 1 ? t('1 ny anmälan') : t('{n} nya anmälningar', { n: fresh.total })}</span>{' '}
                      <span className="muted">
                        {Object.entries(fresh.byClass)
                          .map(([name, n]) => `${name} +${n}`)
                          .join(' · ')}
                      </span>
                    </span>
                  )}
                </span>
              </Go>
            );
          })}
        </div>
      )}
    </Section>
  );
}
