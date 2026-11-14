// Enter a tournament: pick class and partner, confirm, and the entry is made in Rankedin as the active account.
// Payment and licences are finished on rankedin.com; withdrawing is also done there.
import { useState } from 'react';
import { getJoinOptions, joinClass, JoinApiError, type JoinClass, type JoinResult } from '../lib/join';
import type { PlayerHit } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { AccountSwitcher } from './AccountSwitcher';
import { OutsidePartner } from './PairingPanel';
import { Sheet } from './Sheet';
import { ErrorBox, ExternalLink, Loading } from './ui';

type Partner = PlayerHit | 'none' | null;

export function JoinSheet({
  tournamentId,
  tournamentName,
  rankedinUrl,
  fees,
  onClose,
  onDone,
}: {
  tournamentId: number;
  tournamentName: string;
  rankedinUrl: string;
  fees: { className: string; price: number; currency: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { user, version } = useSession();
  const options = useAsync(() => getJoinOptions(tournamentId), [tournamentId, version]);
  const [cls, setCls] = useState<JoinClass | null>(null);
  const [partner, setPartner] = useState<Partner>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<JoinApiError | null>(null);
  const [done, setDone] = useState<JoinResult | null>(null);
  const who = user.loggedIn ? user.name : 'Spelaren';

  const why = (c: JoinClass) =>
    c.signedIn ? (c.lookingForPartner ? 'Anmäld – söker partner' : 'Redan anmäld') : !c.doubles ? 'Anmäls på rankedin.com' : !c.signInOpen ? 'Anmälan stängd' : c.blocked ? c.blocked : c.full ? 'Fullt' : null;
  const fee = cls ? fees.find((f) => f.className === cls.name) : undefined;
  const partnerName = partner === 'none' ? 'utan partner (söker partner)' : partner ? `med ${partner.name}` : '';

  async function send() {
    if (!cls || !partner) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await joinClass(tournamentId, cls.classId, partner === 'none' ? null : partner.id));
      onDone();
    } catch (e) {
      setError(e instanceof JoinApiError ? e : new JoinApiError('error', (e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label="Anmäl" onClose={onClose}>
      <h2>Anmäl till tävlingen</h2>
      {done ? (
        <>
          <p className="notice notice--ok">
            <strong>{who} är anmäld</strong> i {cls?.name} {partnerName}.
            {!done.verified && ' Rankedin visar inte anmälan än – kontrollera listan om en stund.'}
          </p>
          {done.paymentUrl && (
            <p>
              Avgiften betalas i Rankedin: <ExternalLink href={done.paymentUrl}>Betala anmälan</ExternalLink>
            </p>
          )}
          <button className="btn btn--primary btn--block" onClick={onClose}>
            Klar
          </button>
        </>
      ) : (
        <>
          <AccountSwitcher label="Anmäl som" />
          {options.error && <ErrorBox error={options.error} onRetry={() => options.reload()} />}
          {!options.data && options.loading && <Loading label="Hämtar klasser…" />}
          {options.data && (
            <>
              <h3 className="h3">Klass</h3>
              <div className="list">
                {options.data.classes.map((c) => {
                  const reason = why(c);
                  return (
                    <button
                      key={c.classId}
                      className={`item item--button ${cls?.classId === c.classId ? 'is-on' : ''}`}
                      disabled={!!reason}
                      onClick={() => {
                        setCls(c);
                        setPartner(null);
                        setError(null);
                      }}
                    >
                      <span className="item__main">
                        <strong>{c.name}</strong>
                        {reason && <span className="muted small block">{reason}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {options.data.classes.length === 0 && <p className="muted">Tävlingen har inga klasser att anmäla sig till.</p>}

              {cls && (
                <>
                  <h3 className="h3">Partner</h3>
                  {partner && partner !== 'none' ? (
                    <p>
                      <strong>{partner.name}</strong>{' '}
                      <button className="link-btn" onClick={() => setPartner(null)}>
                        Byt
                      </button>
                    </p>
                  ) : (
                    <>
                      <OutsidePartner label="Sök partnern på namn:" disabled={busy} exclude={[options.data.playerId]} onPick={(h) => setPartner(h)} />
                      <label className="toolbar__check">
                        <input type="checkbox" checked={partner === 'none'} onChange={(e) => setPartner(e.target.checked ? 'none' : null)} /> Anmäl utan partner
                        (söker partner)
                      </label>
                    </>
                  )}
                </>
              )}

              {cls && partner && (
                <div className="reset-confirm">
                  <p>
                    <strong>{who}</strong> anmäls till <strong>{tournamentName}</strong>, {cls.name}, {partnerName}.
                    {fee ? ` Avgift ${fee.price} ${fee.currency === 'SEK' ? 'kr' : fee.currency}.` : ''}
                  </p>
                  <p className="muted small">Anmälan görs direkt i Rankedin. Avanmälan görs på rankedin.com.</p>
                  <button className="btn btn--primary btn--block" disabled={busy} onClick={send}>
                    {busy ? 'Anmäler…' : 'Anmäl'}
                  </button>
                </div>
              )}
              {error && (
                <p className="field-error">
                  {error.message} {error.url && <ExternalLink href={error.url}>Öppna i Rankedin</ExternalLink>}
                </p>
              )}
            </>
          )}
          <p className="small">
            <ExternalLink href={rankedinUrl}>Anmäl på rankedin.com i stället</ExternalLink>
          </p>
          <button className="btn btn--ghost btn--block" onClick={onClose}>
            Avbryt
          </button>
        </>
      )}
    </Sheet>
  );
}
