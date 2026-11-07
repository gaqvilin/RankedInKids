import { fmtDay, relativeDays } from '../lib/format';
import type { AgendaItem } from '../lib/overview';
import { Go } from './shell';

/** A child's schedule: tournaments and team matches, one line each, by date. */
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
                <span className="muted small">{relativeDays(e.event.startDate)}</span>
              </span>
              <span className="item__main">
                <strong>{e.event.name}</strong>
                <span className="small block">
                  Tävling · {e.className ?? 'klass okänd'}
                  {e.partner ? ` · med ${e.partner}` : ''}
                  {e.missingPartner && <span className="tag tag--warn">Partner saknas</span>}
                </span>
              </span>
            </Go>
          );
        }
        const f = it.fixture;
        const home = f.home.id === it.team.teamId;
        const opp = home ? f.away : f.home;
        return (
          <Go key={`f${f.teamMatchId}`} from={from} to={`/lagmatch/${f.teamMatchId}?spelare=${playerId}`} className="item">
            <span className="item__date">
              {fmtDay(f.date)}
              <span className="muted small">{relativeDays(f.date)}</span>
            </span>
            <span className="item__main">
              <strong>
                {it.team.teamName} – {opp.name}
              </strong>
              <span className="small block">
                {it.team.leagueName.replace(/\s*\b(HT|VT)\s*\d{2}\b.*$/i, '')} · {home ? 'hemma' : 'borta'}
                {f.round != null ? ` · omgång ${f.round}` : ''}
              </span>
            </span>
          </Go>
        );
      })}
    </div>
  );
}
