import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Page, Section } from '../components/ui';
import { getClub, getClubLeagues, getClubMembers, getClubTournaments } from '../lib/clubs';
import { fmtDay, soon } from '../lib/format';
import { rinUrl } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { fmtRange } from './Player';

export default function Club() {
  const { id = '' } = useParams();
  const cid = Number(id);
  const club = useAsync(() => getClub(cid), [cid], `club.${cid}`);
  const leagues = useAsync(() => getClubLeagues(cid), [cid], `clubLeagues.${cid}`);
  const members = useAsync(() => getClubMembers(cid), [cid]);
  const name = club.data?.name;
  const tournaments = useAsync(() => (name ? getClubTournaments(name) : Promise.resolve([])), [name]);
  const [memberSearch, setMemberSearch] = useState('');

  const shownMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return (members.data || []).filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [members.data, memberSearch]);

  if (club.error || !club.data) {
    return (
      <>
        <AppHeader back="/" backLabel="Översikt" />
        <Page>{club.error ? <ErrorBox error={club.error} onRetry={() => club.reload()} /> : <Loading />}</Page>
      </>
    );
  }

  const c = club.data;
  const active = (leagues.data || []).filter((l) => l.active);
  const past = (leagues.data || []).filter((l) => !l.active);

  return (
    <>
      <AppHeader back="/" backLabel="Översikt" title={c.name} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{c.name}</h1>
            <p className="muted">
              {[c.city, c.federation ? `medlem i ${c.federation}` : null, c.memberCount ? `${c.memberCount} spelare` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="columns">
          <div>
            <Section title="Lag den här säsongen">
              {!leagues.data && leagues.loading && <Loading />}
              {leagues.error && <ErrorBox error={leagues.error} onRetry={() => leagues.reload()} />}
              {leagues.data && active.length === 0 && <Empty>Inga lag i pågående serier.</Empty>}
              {active.map((l) => (
                <div key={l.id} className="group">
                  <p className="list-label">
                    <Go to={`/liga/${l.id}`} from={c.name}>
                      {l.name}
                    </Go>{' '}
                    · {fmtRange(l.startDate, l.endDate)}
                  </p>
                  <div className="list">
                    {l.teams.map((t) => (
                      <Go key={t.id} to={`/lag/${t.id}`} from={c.name} className="item">
                        <span className="item__main">
                          <strong>{t.name}</strong>
                          {t.division && <span className="muted small block">{t.division}</span>}
                        </span>
                      </Go>
                    ))}
                  </div>
                </div>
              ))}
              {past.length > 0 && (
                <details className="fold">
                  <summary>Tidigare säsonger ({past.length})</summary>
                  <div className="list">
                    {past.map((l) => (
                      <Go key={l.id} to={`/liga/${l.id}`} from={c.name} className="item">
                        <span className="item__main">
                          {l.name}
                          <span className="muted small block">{l.teams.map((t) => t.name).join(', ')}</span>
                        </span>
                      </Go>
                    ))}
                  </div>
                </details>
              )}
            </Section>

            <Section title="Kommande tävlingar på klubben">
              {!tournaments.data && tournaments.loading && <Loading />}
              {tournaments.data && tournaments.data.length === 0 && <Empty>Inga kommande tävlingar hittades.</Empty>}
              {tournaments.data && tournaments.data.length > 0 && (
                <div className="list">
                  {tournaments.data.map((t) => (
                    <Go key={t.id} to={`/tavling/${t.id}`} from={c.name} className="item">
                      <span className="item__date">
                        {fmtDay(t.startDate)}
                        <span className="muted small">{soon(t.startDate)}</span>
                      </span>
                      <span className="item__main">
                        <strong>{t.name}</strong>
                        {t.level !== 'Övrigt' && <span className="muted small block">{t.level}</span>}
                      </span>
                    </Go>
                  ))}
                </div>
              )}
              <p className="muted small">Hittas genom att söka på klubbens namn i Rankedin.</p>
            </Section>
          </div>

          <div>
            <Section title="Kontakt">
              <dl className="facts">
                {c.address && (
                  <>
                    <dt>Adress</dt>
                    <dd>{[c.address, c.city].filter(Boolean).join(', ')}</dd>
                  </>
                )}
                {c.website && (
                  <>
                    <dt>Webb</dt>
                    <dd>
                      <ExternalLink href={c.website}>{c.website.replace(/^https?:\/\/(www\.)?/, '')}</ExternalLink>
                    </dd>
                  </>
                )}
                {c.email && (
                  <>
                    <dt>E-post</dt>
                    <dd>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </dd>
                  </>
                )}
                {c.phone && (
                  <>
                    <dt>Telefon</dt>
                    <dd>
                      <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
                    </dd>
                  </>
                )}
                {c.admins.length > 0 && (
                  <>
                    <dt>Administratörer</dt>
                    <dd>
                      {c.admins.map((a, i) => (
                        <span key={a.name}>
                          {i > 0 && ', '}
                          {a.rankedinId ? (
                            <Go to={`/spelare/${a.rankedinId}`} from={c.name}>
                              {a.name}
                            </Go>
                          ) : (
                            a.name
                          )}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            </Section>

            <details className="fold">
              <summary>Medlemmar {members.data ? `(${members.data.length})` : ''}</summary>
              {members.data && members.data.length > 10 && (
                <input className="input" type="search" placeholder="Sök medlem" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              )}
              {!members.data && <Loading />}
              {members.data && (
                <div className="list list--cols">
                  {shownMembers.map((m) => (
                    <Go key={m.id} to={`/spelare/${m.rankedinId}`} from={c.name} className="item">
                      {m.name}
                    </Go>
                  ))}
                </div>
              )}
            </details>

            <p className="small">
              <ExternalLink href={rinUrl(`/sv/organisation/${c.id}`)}>Klubben på Rankedin</ExternalLink>
            </p>
          </div>
        </div>
      </Page>
    </>
  );
}
