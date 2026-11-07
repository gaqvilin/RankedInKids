import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSession, login as apiLogin, logout as apiLogout, type SessionUser } from './lib/api';

type Ctx = {
  user: SessionUser;
  ready: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>({ loggedIn: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSession().then((u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    setUser(await apiLogin(u, p));
  }, []);
  const logout = useCallback(async () => {
    await apiLogout();
    setUser({ loggedIn: false });
  }, []);

  return <SessionContext.Provider value={{ user, ready, login, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('SessionProvider saknas');
  return ctx;
}
