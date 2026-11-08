import { AppHeader, Empty, ErrorBox, Loading, Page } from '../components/ui';
import { listFeedback } from '../lib/feedback';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

const KIND_LABEL = { idea: 'Idé', bug: 'Fel', other: 'Övrigt' } as const;

export default function Feedback() {
  const { version } = useSession();
  const items = useAsync(() => listFeedback(), [version]);
  return (
    <>
      <AppHeader back="/admin" backLabel="Admin" title="Feedback" />
      <Page>
        <div className="page-title">
          <div>
            <h1>Feedback</h1>
            {items.data && <p className="muted">{items.data.length} meddelanden</p>}
          </div>
        </div>
        {items.error && <ErrorBox error={items.error} onRetry={() => items.reload()} />}
        {items.loading && items.data === undefined && <Loading />}
        {items.data === null && <Empty>Bara appens ägare kan läsa feedback.</Empty>}
        {items.data && items.data.length === 0 && <Empty>Ingen feedback än.</Empty>}
        {items.data && items.data.length > 0 && (
          <div className="list">
            {items.data.map((f) => (
              <article key={f.id} className="item feedback-item">
                <span className="item__main">
                  <span className="muted small block">
                    <span className={`pill ${f.kind === 'bug' ? 'pill--warn' : ''}`}>{KIND_LABEL[f.kind]}</span>{' '}
                    {new Date(f.createdAt).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })} · v{f.version || '?'} · {f.page || '–'}
                  </span>
                  <span className="block feedback-item__msg">{f.message}</span>
                  <span className="muted small block">
                    {f.accounts.length ? f.accounts.map((a) => a.name).join(', ') : 'Inte inloggad'}
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
