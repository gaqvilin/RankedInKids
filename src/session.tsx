import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getSession,
  setActiveAccount,
  login as apiLogin,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  switchAccount as apiSwitch,
  type SessionUser,
} from './lib/api';
import { clearStoredCache } from './lib/useAsync';

type Ctx = {
  /** Active account, plus all accounts logged in on this device in user.accounts. */
  user: SessionUser;
  ready: boolean;
  /** Changes whenever the active account changes; use it as a data dependency. */
  version: number;
  login: (u: string, p: string) => Promise<void>;
  switchAccount: (playerId: number) => Promise<void>;
  logout: (playerId?: number) => Promise<void>;
  logoutAll: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>({ loggedIn: false, accounts: [] });
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async (): Promise<void> => {
    const next = await getSession();
    if (!next) {
      // Rankedin didn't answer: keep the accounts we know and ask again shortly.
      setReady(true);
      setTimeout(() => void refresh(), 15_000);
      return;
    }
    setActiveAccount(next.loggedIn ? next.playerId : 0);
    setUser(next);
    setReady(true);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (u: string, p: string) => {
      await apiLogin(u, p);
      clearStoredCache();
      await refresh();
    },
    [refresh],
  );
  const switchAccount = useCallback(
    async (playerId: number) => {
      await apiSwitch(playerId);
      clearStoredCache();
      await refresh();
    },
    [refresh],
  );
  const logout = useCallback(
    async (playerId?: number) => {
      await apiLogout(playerId);
      clearStoredCache();
      await refresh();
    },
    [refresh],
  );
  const logoutAll = useCallback(async () => {
    await apiLogoutAll();
    clearStoredCache();
    await refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ user, ready, version, login, switchAccount, logout, logoutAll }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider saknas');
  return ctx;
}
