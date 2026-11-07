import { AccountSwitcher } from '../components/AccountSwitcher';
import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, ExternalLink, Loading, Page, Section } from '../components/ui';
import { getAdminEvents, getAdminOrganisations } from '../lib/clubs';
import { fmtDay } from '../lib/format';
import { appPathFromRankedinUrl, parseRinDate, rinUrl } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

/** Rankedin dates here can be ISO or "dd/MM/yyyy HH:mm". */
const toIso = (d: string | null) => (d && /^\d{2}\//.test(d) ? parseRinDate(d) : d);

export default function Admin() {
  const { user, version } = useSession();
  const orgs = useAsync(() => (user.loggedIn ? getAdminOrganisations() : Promise.resolve([])), [user.loggedIn, version]);
  const events = useAsync(() => (user.loggedIn ? getAdminEvents() : Promise.resolve([])), [user.loggedIn, version]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const all = (events.data || []).map((e) => ({ ...e, date: toIso(e.startDate) }));
  const upcoming = all.filter((e) => !e.date || new Date(e.date) >= new Date(today.getTime() - 120 * 86_400_000)).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const older = all.filter((e) => !upcoming.includes(e));

  return (
    <>
      <AppHeader title="Admin" />
      <Page wide>
        <div className="page-title">
          <div>
            <h1>Admin</h1>
            <p className="muted">Det du administrerar i Rankedin. Öppna ett event här för att rapportera resultat och sätta uppställningar.</p>
          </div>
        </div>

        {!user.loggedIn ? (
          <Empty>
            <Go to="/konto" from="Admin">
              Logga in med ditt Rankedin-konto
            </Go>{' '}
            för att se klubbar och event du administrerar.
          </Empty>
        ) : (
          <>
            <AccountSwitcher label="Visar för" />
            <div className="columns">
              <div>
                <Section title="Event du arrangerar">
                  {events.error && <ErrorBox error={events.error} onRetry={() => events.reload()} />}
                  {!events.data && events.loading && <Loading />}
                  {events.data && all.length === 0 && <Empty>Inga event där du är admin.</Empty>}
                  {upcoming.length > 0 && <EventList items={upcoming} />}
                  {older.length > 0 && (
                    <details className="fold">
                      <summary>Äldre event ({older.length})</summary>
                      <EventList items={older} />
                    </details>
                  )}
                </Section>
              </div>
              <div>
                <Section title="Klubbar du administrerar">
                  {orgs.error && <ErrorBox error={orgs.error} onRetry={() => orgs.reload()} />}
                  {!orgs.data && orgs.loading && <Loading />}
                  {orgs.data && orgs.data.length === 0 && <Empty>Inga klubbar.</Empty>}
                  {orgs.data && orgs.data.length > 0 && (
                    <div className="list">
                      {orgs.data.map((o) => (
                        <div key={o.id} className="item">
                          <span className="item__main">
                            <Go to={`/klubb/${o.id}`} from="Admin">
                              <strong>{o.name}</strong>
                            </Go>
                            <span className="muted small block">
                              {[o.location, `${o.eventsCount} event`].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          {o.managerUrl && (
                            <span className="item__side small">
                              <ExternalLink href={rinUrl(o.managerUrl)}>Hantera i Rankedin</ExternalLink>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
                <p className="muted small">
                  Att skapa event, lotta och hantera anmälningar görs än så länge i Rankedin. Säg till vad du gör oftast, så bygger vi in det här.
                </p>
              </div>
            </div>
          </>
        )}
      </Page>
    </>
  );
}

function EventList({ items }: { items: { id: number; name: string; date: string | null; link: string; adminLink: string | null }[] }) {
  return (
    <div className="list">
      {items.map((e) => {
        const inApp = appPathFromRankedinUrl(e.link);
        return (
          <div key={`${e.id}-${e.link}`} className="item">
            <span className="item__date">{fmtDay(e.date)}</span>
            <span className="item__main">
              {inApp ? (
                <Go to={inApp} from="Admin">
                  <strong>{e.name}</strong>
                </Go>
              ) : (
                <strong>{e.name}</strong>
              )}
            </span>
            {e.adminLink && (
              <span className="item__side small">
                <ExternalLink href={rinUrl(e.adminLink)}>Admin i Rankedin</ExternalLink>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
