import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { AppHeader, ErrorBox, ExternalLink, Loading, Page, Section } from '../components/ui';
import { fmtDay } from '../lib/format';
import { getLeague, type Pool } from '../lib/leagues';
import { getLeagueRegulations, rinUrl } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

export default function League() {
  const { id = '' } = useParams();
  const league = useAsync(() => getLeague(Number(id)), [id], `league.${id}`);
  const regs = useAsync(() => getLeagueRegulations(Number(id)), [id], `leagueRegs.${id}`);
  const [filter, setFilter] = useState('');

  const regions = useMemo(() => {
    const groups = new Map<string, Pool[]>();
    for (const p of league.data?.pools || []) {
      if (filter && !p.name.toLowerCase().includes(filter.toLowerCase())) continue;
      const key = p.region || 'Divisioner';
      groups.set(key, [...(groups.get(key) || []), p]);
    }
    return [...groups.entries()];
  }, [league.data, filter]);

  return (
    <>
      <AppHeader back="/serier" backLabel="Serier" title={league.data?.name ?? 'Serie'} />
      <Page wide>
        {league.error && <ErrorBox error={league.error} onRetry={() => league.reload()} />}
        {!league.data && !league.error && <Loading />}
        {league.data && (
          <>
            <div className="event-head">
              <p className="muted small">
                {fmtDay(league.data.startDate)} – {fmtDay(league.data.endDate)}
                {league.data.teamsCount ? ` · ${league.data.teamsCount} lag` : ''}
              </p>
              <h1>{league.data.name}</h1>
              <ExternalLink href={rinUrl(`/sv/teamleague/${league.data.id}`)}>Öppna i Rankedin</ExternalLink>
              {regs.data && regs.data.length > 0 && (
                <details className="fold">
                  <summary>Seriens regler och information</summary>
                  <div className="regulations">
                    {regs.data.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
            {league.data.pools.length > 8 && (
              <input className="input" type="search" placeholder="Filtrera, t.ex. Sydväst eller Div 2" value={filter} onChange={(e) => setFilter(e.target.value)} />
            )}
            {regions.map(([region, pools]) => (
              <Section key={region} title={region}>
                <ul className="card-list">
                  {pools.map((p) => (
                    <li key={p.id}>
                      <Go to={`/division/${p.id}?liga=${league.data!.id}`} from={league.data!.name} className="event-row">
                        <span className="event-row__main">
                          <strong>{p.division}</strong>
                        </span>
                      </Go>
                    </li>
                  ))}
                </ul>
              </Section>
            ))}
          </>
        )}
      </Page>
    </>
  );
}
