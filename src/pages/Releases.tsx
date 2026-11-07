import { useEffect } from 'react';
import { AppHeader, Page } from '../components/ui';
import { fmtDay } from '../lib/format';
import { RELEASES, markReleasesSeen } from '../lib/releases';

export default function Releases() {
  useEffect(() => {
    markReleasesSeen();
    window.dispatchEvent(new Event('releases-seen'));
  }, []);

  return (
    <>
      <AppHeader back="/" backLabel="Översikt" title="Nyheter" />
      <Page>
        <div className="page-title">
          <div>
            <h1>Nyheter</h1>
            <p className="muted">Vad som är nytt och ändrat i PadelAdmin.</p>
          </div>
        </div>
        {RELEASES.map((r) => (
          <section key={r.version} className="release">
            <h2>
              {r.title} <span className="muted small">version {r.version}</span>
            </h2>
            <p className="muted small">{fmtDay(r.date)}</p>
            <ul>
              {r.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </section>
        ))}
      </Page>
    </>
  );
}
