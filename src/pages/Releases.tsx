import { t } from '../lib/i18n';
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
      <AppHeader back="/" backLabel={t('Översikt')} title={t('Nyheter')} />
      <Page>
        <div className="page-title">
          <div>
            <h1>{t('Nyheter')}</h1>
            <p className="muted">{t('Vad som är nytt och ändrat i PadelAdmin.')}</p>
          </div>
        </div>
        {RELEASES.map((r) => (
          <section key={r.version} className="release">
            <h2>
              {t(r.title)} <span className="muted small">version {r.version}</span>
            </h2>
            <p className="muted small">{fmtDay(r.date)}</p>
            <ul>
              {r.items.map((it) => (
                <li key={it}>{t(it)}</li>
              ))}
            </ul>
          </section>
        ))}
      </Page>
    </>
  );
}
