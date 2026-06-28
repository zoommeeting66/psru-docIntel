"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, setAuthToken } from "./api";

interface AuthState {
  token: string | null;
  role: string | null;
  ready: boolean;
  login: (role: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const TOKEN_KEY = "pb_token";
const ROLE_KEY = "pb_role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // restore from localStorage on mount
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    const r = localStorage.getItem(ROLE_KEY);
    if (t) {
      setAuthToken(t);
      setToken(t);
      setRole(r);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (requested: string) => {
    // Dev login (Keycloak OIDC redirect replaces this in production).
    const res = await api.devToken(requested);
    setAuthToken(res.access_token);
    setToken(res.access_token);
    setRole(res.role);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(ROLE_KEY, res.role);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setRole(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  }, []);

  return (
    <Ctx.Provider value={{ token, role, ready, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
