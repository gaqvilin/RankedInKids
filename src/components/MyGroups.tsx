// The trainer's groups on Översikt: pick a group, see it, share it, change it.
import { useState } from 'react';
import { listGroups, type Group, type GroupPlayer } from '../lib/groups';
import { t } from '../lib/i18n';
import type { SavedPlayer } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { GroupEditSheet } from './GroupEditSheet';
import { GroupView } from './GroupView';

const CHOSEN = 'padeladmin.group';

/** Returns null when there is nothing to show (not logged in, or no group and too few players to suggest one). */
export function MyGroups({ saved }: { saved: SavedPlayer[] }) {
  const { user, version } = useSession();
  const playerId = user.loggedIn ? user.playerId : 0;
  const groups = useAsync(() => (playerId ? listGroups() : Promise.resolve([] as Group[])), [playerId, version], `groups.${playerId}`);
  const [chosen, setChosen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CHOSEN);
    } catch {
      return null;
    }
  });
  const [editing, setEditing] = useState<{ group: Group | null } | null>(null);
  const [loaded, setLoaded] = useState<GroupPlayer[]>([]);
  const [copied, setCopied] = useState(false);

  if (!user.loggedIn) return null;
  const list = groups.data ?? [];
  const group = list.find((g) => g.id === chosen) ?? list[0] ?? null;
  const pick = (id: string) => {
    setChosen(id);
    setLoaded([]);
    try {
      localStorage.setItem(CHOSEN, id);
    } catch {
      /* private mode */
    }
  };

  async function share(g: Group) {
    const url = `${window.location.origin}/grupp/${g.shareId}`;
    try {
      if (navigator.share) await navigator.share({ title: g.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* cancelled or blocked */
    }
  }

  const sheet = editing && (
    <GroupEditSheet
      group={editing.group}
      initialPlayers={
        editing.group
          ? editing.group.players.map((rid) => ({ rankedinId: rid, name: loaded.find((p) => p.rankedinId === rid)?.name ?? rid }))
          : saved.map((p) => ({ rankedinId: p.rankedinId, name: p.name }))
      }
      onClose={() => setEditing(null)}
      onSaved={() => {
        setEditing(null);
        groups.reload();
      }}
    />
  );

  if (!group) {
    // Suggest a group only to someone who follows several players.
    if (saved.length < 4 || !groups.data) return null;
    return (
      <>
        <p className="notice small">
          {t('Följer du många spelare, t.ex. som tränare? Samla dem i en grupp och se vad som behöver göras.')}{' '}
          <button className="link-btn" onClick={() => setEditing({ group: null })}>
            {t('Gör en grupp')}
          </button>
        </p>
        {sheet}
      </>
    );
  }

  return (
    <section className="group">
      <div className="group__head">
        <div>
          <h2 className="group__name">{group.name}</h2>
          <p className="muted small">
            {group.players.length === 1 ? t('1 spelare') : t('{n} spelare', { n: group.players.length })} ·{' '}
            <button className="link-btn" onClick={() => share(group)}>
              {copied ? t('Länken är kopierad') : t('Dela gruppen')}
            </button>{' '}
            ·{' '}
            <button className="link-btn" onClick={() => setEditing({ group })}>
              {t('Ändra')}
            </button>
          </p>
        </div>
      </div>
      {(
        <div className="chips">
          {list.map((g) => (
            <button key={g.id} className={`chip ${g.id === group.id ? 'chip--on' : ''}`} onClick={() => pick(g.id)}>
              {g.name}
            </button>
          ))}
          <button className="chip" onClick={() => setEditing({ group: null })}>
            {t('+ Ny grupp')}
          </button>
        </div>
      )}
      <GroupView players={group.players} cacheKey={group.id} from={t('Översikt')} onLoaded={setLoaded} />
      {sheet}
    </section>
  );
}
