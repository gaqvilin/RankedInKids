// A trainer's group: what needs doing first, who plays this week, the rest folded away.
import { useEffect } from 'react';
import { fmtDay } from '../lib/format';
import { groupBlocks, loadGroupPlayers, type GroupPlayer, type PlayerStatus } from '../lib/groups';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { Go } from './shell';
import { Avatar, Empty, ErrorBox, Loading, Section } from './ui';

/** The line under the name: where the player stands right now. */
/** "Step In Varberg Padelklubb / Flickor och pojkar 12, 14 & 16" → "Step In Varberg Padelklubb": the row has room for the name, not the subtitle. */
const shortEvent = (name: string) => name.split(/\s[/–-]\s/)[0];

function statusText(st: PlayerStatus): string {
  const s = 'event' in st ? { ...st, event: shortEvent(st.event) } : st;
  switch (s.kind) {
    case 'partner':
      return s.closes ? t('Söker partner till {event} · anmälan stänger {day}', { event: s.event, day: fmtDay(s.closes) }) : t('Söker partner till {event}', { event: s.event });
    case 'license':
      return t('Licens saknas · anmäld till {event}', { event: s.event });
    case 'tournament':
      return s.partner ? t('{day} · {event} · med {partner}', { day: fmtDay(s.date), event: s.event, partner: s.partner }) : t('{day} · {event}', { day: fmtDay(s.date), event: s.event });
    case 'matchday':
      return t('{day} · speldag med {team}', { day: fmtDay(s.date), team: s.team });
    default:
      return t('Inget inplanerat');
  }
}

function Row({ p, from }: { p: GroupPlayer; from: string }) {
  const s = p.status;
  const action =
    s.kind === 'partner' ? { label: t('Hitta partner'), to: `/tavling/${s.eventId}?spelare=${p.id}` } : s.kind === 'license' ? { label: t('Lös det'), to: `/tavling/${s.eventId}?spelare=${p.id}` } : null;
  return (
    <div className="item group-row">
      <Go to={`/spelare/${p.rankedinId}`} from={from} className="group-row__who">
        <Avatar name={p.name} imageUrl={p.imageUrl} />
        <span className="item__main">
          <strong>{p.name}</strong>
          {p.age && <span className="muted small"> {t('{n} år', { n: p.age })}</span>}
          <span className={`small block ${s.kind === 'partner' || s.kind === 'license' ? 'text-warn' : 'muted'}`}>
            {p.failed ? t('Kunde inte hämtas från Rankedin') : statusText(s)}
          </span>
        </span>
      </Go>
      {action && (
        <Go to={action.to} from={from} className="btn btn--small group-row__action">
          {action.label}
        </Go>
      )}
    </div>
  );
}

export function GroupView({
  players,
  cacheKey,
  from,
  onLoaded,
}: {
  players: string[];
  cacheKey: string;
  from: string;
  /** Told the players' names once they are read (the edit sheet needs them). */
  onLoaded?: (players: GroupPlayer[]) => void;
}) {
  const data = useAsync(() => loadGroupPlayers(players), [players.join(',')], `group.v1.${cacheKey}`);
  useEffect(() => {
    if (data.data) onLoaded?.(data.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.data]);
  if (players.length === 0) return <Empty>{t('Gruppen har inga spelare än.')}</Empty>;
  if (data.error && !data.data) return <ErrorBox error={data.error} onRetry={() => data.reload()} />;
  if (!data.data) return <Loading label={t('Hämtar gruppen…')} />;
  const b = groupBlocks(data.data);
  return (
    <>
      {b.action.length > 0 && (
        <Section title={t('Behöver åtgärd ({n})', { n: b.action.length })}>
          <div className="list">
            {b.action.map((p) => (
              <Row key={p.rankedinId} p={p} from={from} />
            ))}
          </div>
        </Section>
      )}
      {b.soon.length > 0 && (
        <Section title={t('Spelar den här veckan ({n})', { n: b.soon.length })}>
          <div className="list">
            {b.soon.map((p) => (
              <Row key={p.rankedinId} p={p} from={from} />
            ))}
          </div>
        </Section>
      )}
      {b.action.length === 0 && b.soon.length === 0 && <p className="muted">{t('Inget att göra just nu, och ingen spelar den här veckan.')}</p>}
      {b.rest.length > 0 && (
        <details className="fold fold--quiet" open={b.action.length === 0 && b.soon.length === 0}>
          <summary>{t('Övriga ({n})', { n: b.rest.length })}</summary>
          <div className="list">
            {b.rest.map((p) => (
              <Row key={p.rankedinId} p={p} from={from} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
