import { Go } from '../components/shell';
import { AppHeader, Empty, ErrorBox, Loading, Page, Section } from '../components/ui';
import { ADULT_LEAGUES } from '../lib/features';
import { fmtDay } from '../lib/format';
import { currentKlubbligan, currentSplLeagues, shortKlubbliganName } from '../lib/leagues';
import { getSavedTeams } from '../lib/storage';
import { useAsync } from '../lib/useAsync';

export default function Leagues() {
  const teams = getSavedTeams();
  const klubbligan = useAsync(() => currentKlubbligan(), []);
  const spl = useAsync(() => (ADULT_LEAGUES ? currentSplLeagues() : Promise.resolve([])), []);

  return (
    <>
      <AppHeader title="Klubbligan" />
      <Page wide>
        <div className="page-title">
          <h1>Klubbligan</h1>
        </div>

        {teams.length > 0 && (
          <Section title="Mina lag">
            <div className="list">
              {teams.map((t) => (
                <Go key={t.id} to={`/lag/${t.id}`} from="Klubbligan" className="item">
                  <span className="item__main">
                    <strong>{t.name}</strong>
                    <span className="muted small block">{t.league}</span>
                  </span>
                </Go>
              ))}
            </div>
          </Section>
        )}

        <Section title="Den här säsongen">
          {klubbligan.error && <ErrorBox error={klubbligan.error} onRetry={() => klubbligan.reload()} />}
          {!klubbligan.data && klubbligan.loading && <Loading />}
          {klubbligan.data && klubbligan.data.length === 0 && <Empty>Hittade ingen pågående Klubbliga.</Empty>}
          {klubbligan.data && klubbligan.data.length > 0 && (
            <div className="list">
              {klubbligan.data.map((l) => (
                <Go key={l.id} to={`/liga/${l.id}`} from="Klubbligan" className="item">
                  <span className="item__main">
                    <strong>{shortKlubbliganName(l.name)}</strong>
                    <span className="muted small block">{l.name}</span>
                  </span>
                  {l.startDate && <span className="item__side small muted">från {fmtDay(parseSearchDate(l.startDate))}</span>}
                </Go>
              ))}
            </div>
          )}
        </Section>

        {spl.data && spl.data.length > 0 && (
          <Section title="SPL">
            <div className="list">
              {spl.data.map((l) => (
                <Go key={l.id} to={`/liga/${l.id}`} from="Klubbligan" className="item">
                  <span className="item__main">
                    <strong>{l.name}</strong>
                  </span>
                </Go>
              ))}
            </div>
          </Section>
        )}

        <p className="muted small">Spara ditt barns lag med "Spara lag" på lagsidan, så hamnar det överst här och i menyn.</p>
      </Page>
    </>
  );
}

/** Search results give "17/10/2026 10:00". */
function parseSearchDate(v: string): string {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T00:00:00` : v;
}
