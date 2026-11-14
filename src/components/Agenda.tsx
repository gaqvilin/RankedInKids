import { t } from '../lib/i18n';
import { fmtDay, soon } from '../lib/format';
import type { AgendaItem } from '../lib/overview';
import { Go } from './shell';

/** A child's schedule: tournaments and speldagar, one line each, by date. */
export function Agenda({ items, playerId, from, limit }: { items: AgendaItem[]; playerId: number; from: string; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="list">
      {shown.map((it) => {
        if (it.kind === 'tournament') {
          const e = it.entry;
          return (
            <Go
              key={`t${e.event.id}`}
              from={from}
              to={`/tavling/${e.event.id}?spelare=${playerId}${e.className ? `&klass=${encodeURIComponent(e.className)}` : ''}`}
              className="item"
            >
              <span className="item__date">
                {fmtDay(e.event.startDate)}
                <span className="muted small">{soon(e.event.startDate)}</span>
              </span>
              <span className="item__main">
                <strong>{e.event.name}</strong>
                <span className="small block">
                  {t('Tävling')} · {e.className ?? t('klass okänd')}
                  {e.partner ? ` · ${t('med {name}', { name: e.partner })}` : ''}
                  {e.missingPartner && <span className="tag tag--warn">{t('Partner saknas')}</span>}
                </span>
              </span>
            </Go>
          );
        }
        const day = it.date.slice(0, 10);
        const opps = it.fixtures.map((f) => (f.home.id === it.team.teamId ? f.away.name : f.home.name));
        return (
          <Go key={`r${it.team.teamId}-${day}`} from={from} to={`/lag/${it.team.teamId}/omgang/${day}`} className="item">
            <span className="item__date">
              {fmtDay(it.date)}
              <span className="muted small">{soon(it.date)}</span>
            </span>
            <span className="item__main">
              <strong>
                {t('{team} mot {opponents}', { team: it.team.teamName, opponents: opps.join(` ${t('och')} `) })}
              </strong>
              <span className="small block">
                {t('Speldag')} · {it.team.leagueName.replace(/\s*\b(HT|VT)\s*\d{2}\b.*$/i, '')}
              </span>
            </span>
          </Go>
        );
      })}
    </div>
  );
}
