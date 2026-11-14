import { t } from '../lib/i18n';
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
        <AppHeader back="/" backLabel={t('Översikt')} />
        <Page>{club.error ? <ErrorBox error={club.error} onRetry={() => club.reload()} /> : <Loading />}</Page>
      </>
    );
  }

  const c = club.data;
  const active = (leagues.data || []).filter((l) => l.active);
  const past = (leagues.data || []).filter((l) => !l.active);

  return (
    <>
      <AppHeader back="/" backLabel={t('Översikt')} title={c.name} />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>{c.name}</h1>
            <p className="muted">
              {[c.city, c.federation ? t('medlem i {federation}', { federation: c.federation }) : null, c.memberCount ? t('{n} spelare', { n: c.memberCount }) : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="columns">
          <div>
            <Section title={t('Lag den här säsongen')}>
              {!leagues.data && leagues.loading && <Loading />}
              {leagues.error && <ErrorBox error={leagues.error} onRetry={() => leagues.reload()} />}
              {leagues.data && active.length === 0 && <Empty>{t('Inga lag i pågående serier.')}</Empty>}
              {active.map((l) => (
                <div key={l.id} className="group">
                  <p className="list-label">
                    <Go to={`/liga/${l.id}`} from={c.name}>
                      {l.name}
                    </Go>{' '}
                    · {fmtRange(l.startDate, l.endDate)}
                  </p>
                  <div className="list">
                    {l.teams.map((tm) => (
                      <Go key={tm.id} to={`/lag/${tm.id}`} from={c.name} className="item">
                        <span className="item__main">
                          <strong>{tm.name}</strong>
                          {tm.division && <span className="muted small block">{tm.division}</span>}
                        </span>
                      </Go>
                    ))}
                  </div>
                </div>
              ))}
              {past.length > 0 && (
                <details className="fold">
                  <summary>{t('Tidigare säsonger ({n})', { n: past.length })}</summary>
                  <div className="list">
                    {past.map((l) => (
                      <Go key={l.id} to={`/liga/${l.id}`} from={c.name} className="item">
                        <span className="item__main">
                          {l.name}
                          <span className="muted small block">{l.teams.map((tm) => tm.name).join(', ')}</span>
                        </span>
                      </Go>
                    ))}
                  </div>
                </details>
              )}
            </Section>

            <Section title={t('Kommande tävlingar på klubben')}>
              {!tournaments.data && tournaments.loading && <Loading />}
              {tournaments.data && tournaments.data.length === 0 && <Empty>{t('Inga kommande tävlingar hittades.')}</Empty>}
              {tournaments.data && tournaments.data.length > 0 && (
                <div className="list">
                  {tournaments.data.map((ev) => (
                    <Go key={ev.id} to={`/tavling/${ev.id}`} from={c.name} className="item">
                      <span className="item__date">
                        {fmtDay(ev.startDate)}
                        <span className="muted small">{soon(ev.startDate)}</span>
                      </span>
                      <span className="item__main">
                        <strong>{ev.name}</strong>
                        {ev.level !== 'Övrigt' && <span className="muted small block">{ev.level}</span>}
                      </span>
                    </Go>
                  ))}
                </div>
              )}
              <p className="muted small">{t('Hittas genom att söka på klubbens namn i Rankedin.')}</p>
            </Section>
          </div>

          <div>
            <Section title={t('Kontakt')}>
              <dl className="facts">
                {c.address && (
                  <>
                    <dt>{t('Adress')}</dt>
                    <dd>{[c.address, c.city].filter(Boolean).join(', ')}</dd>
                  </>
                )}
                {c.website && (
                  <>
                    <dt>{t('Webb')}</dt>
                    <dd>
                      <ExternalLink href={c.website}>{c.website.replace(/^https?:\/\/(www\.)?/, '')}</ExternalLink>
                    </dd>
                  </>
                )}
                {c.email && (
                  <>
                    <dt>{t('E-post')}</dt>
                    <dd>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </dd>
                  </>
                )}
                {c.phone && (
                  <>
                    <dt>{t('Telefon')}</dt>
                    <dd>
                      <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
                    </dd>
                  </>
                )}
                {c.admins.length > 0 && (
                  <>
                    <dt>{t('Administratörer')}</dt>
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
              <summary>{t('Medlemmar')} {members.data ? `(${members.data.length})` : ''}</summary>
              {members.data && members.data.length > 10 && (
                <input className="input" type="search" placeholder={t('Sök medlem')} value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
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
              <ExternalLink href={rinUrl(`/sv/organisation/${c.id}`)}>{t('Klubben på Rankedin')}</ExternalLink>
            </p>
          </div>
        </div>
      </Page>
    </>
  );
}
