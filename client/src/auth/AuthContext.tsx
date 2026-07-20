import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, LoginRequest, LoginResponse } from "@teacher/shared";
import { api, setUnauthorizedHandler } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  bootstrapping: boolean;
  login(input: LoginRequest): Promise<void>;
  logout(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(localStorage.getItem("teacher-token")));

  useEffect(() => {
    const clearSession = () => {
      localStorage.removeItem("teacher-token");
      setUser(null);
    };
    setUnauthorizedHandler(clearSession);
    const token = localStorage.getItem("teacher-token");
    if (!token) {
      return () => setUnauthorizedHandler(null);
    }
    let active = true;
    api<AuthUser>("/api/auth/me")
      .then((authoritativeUser) => {
        if (active) setUser(authoritativeUser);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });
    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      bootstrapping,
      async login(input) {
        const result = await api<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });
        localStorage.setItem("teacher-token", result.token);
        setUser(result.user);
      },
      async logout() {
        try { await api<void>("/api/auth/logout", { method: "POST" }); } catch { /* local logout remains authoritative */ }
        localStorage.removeItem("teacher-token");
        setUser(null);
      },
    }),
    [user, bootstrapping],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
