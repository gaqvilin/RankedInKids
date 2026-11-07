// "My" players: the ones saved on this device plus every Rankedin account
// logged in here, so a parent who logs in with their child's account sees the
// child everywhere without saving anything.
import { useMemo } from 'react';
import { useSession } from '../session';
import { getSavedPlayers, type SavedPlayer } from './storage';

export function useKnownPlayers(): SavedPlayer[] {
  const { user, version } = useSession();
  return useMemo(() => {
    const saved = getSavedPlayers();
    const fromAccounts = user.accounts
      .filter((a) => !saved.some((s) => s.rankedinId === a.rankedinId))
      .map((a) => ({ rankedinId: a.rankedinId, name: a.name, id: a.playerId }));
    return [...saved, ...fromAccounts];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.accounts, version]);
}
