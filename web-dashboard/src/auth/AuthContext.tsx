// SPDX-License-Identifier: MIT
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, tokenStore, userStore } from '../api/client';
import type { User } from '../api/types';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => userStore.get());

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.token);
    userStore.set(res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
