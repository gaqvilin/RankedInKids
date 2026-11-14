import { locale, t } from '../lib/i18n';
import { AppHeader, Empty, ErrorBox, Loading, Page } from '../components/ui';
import { listErrors, type ErrorSummary } from '../lib/errors';
import { listFeedback } from '../lib/feedback';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

const KIND_LABEL = { idea: 'Idé', bug: 'Fel', other: 'Övrigt' } as const;
const ERROR_LABEL = { crash: 'Krasch', shown: 'Visat fel', call: 'Anrop' } as const;

export default function Feedback() {
  const { version } = useSession();
  const items = useAsync(() => listFeedback(), [version]);
  const errors = useAsync(() => listErrors(), [version]);
  return (
    <>
      <AppHeader back="/admin" backLabel={t('Admin')} title={t('Feedback')} />
      <Page>
        <div className="page-title">
          <div>
            <h1>{t('Feedback')}</h1>
            {items.data && <p className="muted">{t('{n} meddelanden', { n: items.data.length })}</p>}
          </div>
        </div>
        {errors.data && <Errors items={errors.data} />}
        {items.error && <ErrorBox error={items.error} onRetry={() => items.reload()} />}
        {items.loading && items.data === undefined && <Loading />}
        {items.data === null && <Empty>{t('Bara appens ägare kan läsa feedback.')}</Empty>}
        {items.data && items.data.length === 0 && <Empty>{t('Ingen feedback än.')}</Empty>}
        {items.data && items.data.length > 0 && (
          <div className="list">
            {items.data.map((f) => (
              <article key={f.id} className="item feedback-item">
                <span className="item__main">
                  <span className="muted small block">
                    <span className={`pill ${f.kind === 'bug' ? 'pill--warn' : ''}`}>{t(KIND_LABEL[f.kind])}</span>{' '}
                    {new Date(f.createdAt).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' })} · v{f.version || '?'} · {f.page || '–'}
                  </span>
                  <span className="block feedback-item__msg">{f.message}</span>
                  <span className="muted small block">
                    {f.accounts.length ? f.accounts.map((a) => a.name).join(', ') : t('Inte inloggad')}
                    {f.contact ? ` · ${f.contact}` : ''}
                  </span>
                </span>
              </article>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}

/** Errors the app reported itself, last 7 days, most frequent first. Folded: feedback is the main thing here. */
function Errors({ items }: { items: ErrorSummary[] }) {
  const total = items.reduce((n, e) => n + e.count, 0);
  if (items.length === 0) return <p className="muted small">{t('Inga fel i appen de senaste 7 dagarna.')}</p>;
  return (
    <details className="fold">
      <summary>
        {t('Fel i appen senaste 7 dagarna: {kinds} olika, {total} gånger', { kinds: items.length, total })}
      </summary>
      <div className="list">
        {items.map((e, i) => (
          <article key={i} className="item feedback-item">
            <span className="item__main">
              <span className="muted small block">
                <span className={`pill ${e.kind === 'crash' ? 'pill--warn' : ''}`}>{t(ERROR_LABEL[e.kind])}</span> {t('{n} gånger', { n: e.count })}
                {e.days > 1 ? ` ${t('på {n} dagar', { n: e.days })}` : ''} · {t('senast {day}', { day: e.lastDay })} · v{e.version || '?'}
              </span>
              <span className="block feedback-item__msg">
                {e.message}
                {e.call ? ` – ${e.call}` : ''}
              </span>
              <span className="muted small block">
                {e.page || '–'} · {e.browser}
              </span>
            </span>
          </article>
        ))}
      </div>
    </details>
  );
}
