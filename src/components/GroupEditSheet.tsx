// Create or change a group: its name and which players are in it.
import { useState } from 'react';
import { deleteGroup, saveGroup, type Group } from '../lib/groups';
import { t } from '../lib/i18n';
import { MAX_GROUP_PLAYERS } from '../lib/groupLimits';
import { OutsidePartner } from './PairingPanel';
import { Sheet } from './Sheet';

type Member = { rankedinId: string; name: string };

export function GroupEditSheet({
  group,
  initialPlayers,
  onClose,
  onSaved,
}: {
  group: Group | null;
  /** Names for the players already in the group (or to start a new group from). */
  initialPlayers: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState<Member[]>(initialPlayers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet label={group ? t('Ändra gruppen') : t('Ny grupp')} onClose={onClose}>
      <h2>{group ? t('Ändra gruppen') : t('Ny grupp')}</h2>
      <label className="field">
        <span className="small">{t('Gruppens namn')}</span>
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t('t.ex. P12 tisdag')} />
      </label>

      <h3 className="h3">{t('Spelare ({n})', { n: members.length })}</h3>
      {members.length > 0 && (
        <div className="list">
          {members.map((m) => (
            <div key={m.rankedinId} className="item group-row">
              <span className="item__main">
                <strong>{m.name}</strong>
              </span>
              <button className="link-btn" onClick={() => setMembers(members.filter((x) => x.rankedinId !== m.rankedinId))}>
                {t('Ta bort')}
              </button>
            </div>
          ))}
        </div>
      )}
      {members.length < MAX_GROUP_PLAYERS && (
        <OutsidePartner
          label={t('Lägg till spelare – sök på namn:')}
          disabled={busy}
          exclude={[]}
          onPick={(h) => setMembers((prev) => (prev.some((x) => x.rankedinId === h.rankedinId) ? prev : [...prev, { rankedinId: h.rankedinId, name: h.name }]))}
        />
      )}

      {error && <p className="field-error">{error}</p>}
      <button
        className="btn btn--primary btn--block"
        disabled={busy || !name.trim()}
        onClick={() => run(() => saveGroup({ id: group?.id, name, players: members.map((m) => m.rankedinId) }))}
      >
        {busy ? t('Sparar…') : t('Spara gruppen')}
      </button>
      {group &&
        (confirmDelete ? (
          <div className="reset-confirm">
            <p>{t('Ta bort gruppen? Delningslänken slutar fungera. Spelarna påverkas inte.')}</p>
            <div className="row gap">
              <button className="btn btn--danger btn--small" disabled={busy} onClick={() => run(() => deleteGroup(group.id))}>
                {t('Ja, ta bort')}
              </button>
              <button className="btn btn--ghost btn--small" onClick={() => setConfirmDelete(false)}>
                {t('Nej')}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn--ghost btn--block" disabled={busy} onClick={() => setConfirmDelete(true)}>
            {t('Ta bort gruppen')}
          </button>
        ))}
      <button className="btn btn--ghost btn--block" onClick={onClose}>
        {t('Avbryt')}
      </button>
    </Sheet>
  );
}
