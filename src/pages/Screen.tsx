// Full-screen court board for a TV in the hall. Refreshes itself.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { fmtTime } from '../lib/format';
import { locale, t } from '../lib/i18n';
import { courtBoard } from '../lib/organizer';
import { getTournament, getTournamentMatches, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

export default function Screen() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const header = useAsync(() => getTournament(tid), [tid]);
  const matches = useAsync((fresh) => getTournamentMatches(tid, fresh), [tid]);
  const [now, setNow] = useState(() => new Date());
  const [qr, setQr] = useState<string | null>(null);
  const url = `${location.origin}/tavling/${tid}`;

  useEffect(() => {
    document.body.classList.add('screen-mode');
    const a = setInterval(() => matches.reload(true), 30_000);
    const b = setInterval(() => setNow(new Date()), 15_000);
    QRCode.toDataURL(url, { margin: 1, width: 300 }).then(setQr, () => setQr(null));
    return () => {
      document.body.classList.remove('screen-mode');
      clearInterval(a);
      clearInterval(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  const board = useMemo(() => courtBoard(matches.data ?? [], now), [matches.data, now]);
  const names = (m: TournamentMatch) => m.sides.map((s) => (s.names.length ? s.names.join(' / ') : '–'));

  return (
    <div className="screen">
      <header className="screen__head">
        <div>
          <h1>{header.data?.name ?? ''}</h1>
          <span className="muted">{now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {qr && (
          <div className="screen__qr">
            <img src={qr} alt={t('QR-kod till tävlingen')} width={120} height={120} />
            <span className="small">{t('Följ dina matcher')}</span>
          </div>
        )}
      </header>
      {board.length === 0 && <p className="muted">{t('Inga schemalagda matcher än.')}</p>}
      <div className="screen__grid">
        {board.map((c) => (
          <section key={c.court} className="screen__court">
            <h2>{c.court}</h2>
            {c.now ? (
              <div className="screen__now">
                <span className="screen__label">
                  {t('Nu')} · {fmtTime(c.now.date)} · {c.now.className}
                </span>
                {names(c.now).map((n, i) => (
                  <span key={i} className="block screen__names">
                    {n}
                  </span>
                ))}
              </div>
            ) : (
              <p className="screen__label">{c.next ? t('Ledig') : t('Klar för dagen')}</p>
            )}
            {c.next && (
              <div className="screen__next">
                <span className="screen__label">{t('Sedan {time}', { time: fmtTime(c.next.date) })} · {c.next.className}</span>
                <span className="block">{names(c.next).join(' – ')}</span>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
