import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, LoginRequest, LoginResponse } from "@teacher/shared";
import { api } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  login(input: LoginRequest): Promise<void>;
  logout(): void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("teacher-user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(input) {
        const result = await api<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });
        localStorage.setItem("teacher-token", result.token);
        localStorage.setItem("teacher-user", JSON.stringify(result.user));
        setUser(result.user);
      },
      logout() {
        localStorage.removeItem("teacher-token");
        localStorage.removeItem("teacher-user");
        setUser(null);
      },
    }),
    [user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
