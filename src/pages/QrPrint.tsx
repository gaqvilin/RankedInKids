// Printable QR codes for a tournament: one A4 poster, or a sheet of small cards to hand out.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Go } from '../components/shell';
import { fmtDay } from '../lib/format';
import { getTournament } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

export default function QrPrint() {
  const { id = '' } = useParams();
  const tid = Number(id);
  const [params, setParams] = useSearchParams();
  const layout = params.get('typ') === 'affisch' ? 'affisch' : 'lappar';
  const header = useAsync(() => getTournament(tid), [tid]);
  const [qr, setQr] = useState<string | null>(null);
  const url = `${location.origin}/tavling/${tid}`;
  const shortUrl = url.replace(/^https?:\/\//, '');

  useEffect(() => {
    document.body.classList.add('screen-mode');
    QRCode.toDataURL(url, { margin: 1, width: 600 }).then(setQr, () => setQr(null));
    return () => document.body.classList.remove('screen-mode');
  }, [url]);

  const name = header.data?.name ?? '';
  const date = header.data ? fmtDay(header.data.startDate) : '';
  const card = (big: boolean) => (
    <div className={big ? 'qr-poster' : 'qr-card'}>
      <strong className="qr-title">{name}</strong>
      <span className="qr-sub">{date}</span>
      {qr && <img src={qr} alt="QR-kod till tävlingen" />}
      <span className="qr-cta">Skanna för dina matcher, tider, banor och resultat</span>
      <span className="qr-url">{shortUrl}</span>
    </div>
  );

  return (
    <div className="qr-page">
      <div className="qr-toolbar no-print">
        <Go to={`/tavling/${tid}/ledning?vy=dela`} from="Tävlingen" className="btn btn--ghost btn--small">
          ‹ Tillbaka
        </Go>
        <span className="chips chips--inline">
          <button className={`chip ${layout === 'lappar' ? 'chip--on' : ''}`} onClick={() => setParams({ typ: 'lappar' }, { replace: true })}>
            Lappar att dela ut (8 per A4)
          </button>
          <button className={`chip ${layout === 'affisch' ? 'chip--on' : ''}`} onClick={() => setParams({ typ: 'affisch' }, { replace: true })}>
            Affisch (A4)
          </button>
        </span>
        <button className="btn btn--primary btn--small" onClick={() => window.print()}>
          Skriv ut
        </button>
      </div>
      {layout === 'affisch' ? card(true) : <div className="qr-sheet">{Array.from({ length: 8 }, (_, i) => <div key={i}>{card(false)}</div>)}</div>}
    </div>
  );
}
