import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, LoginRequest, LoginResponse } from "@teacher/shared";
import { api, ApiError, setUnauthorizedHandler } from "../api/client";
import {
  clearRememberedUsername,
  clearToken,
  getToken,
  saveRememberedUsername,
  saveRememberPreference,
  saveToken,
} from "./authStorage";

interface AuthContextValue {
  user: AuthUser | null;
  bootstrapping: boolean;
  sessionMessage: string;
  clearSessionMessage(): void;
  login(input: LoginRequest, remember: boolean): Promise<void>;
  logout(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(getToken()));
  const [sessionMessage, setSessionMessage] = useState("");

  useEffect(() => {
    const clearSession = () => {
      clearToken();
      setUser(null);
      setSessionMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    };
    setUnauthorizedHandler(clearSession);
    const token = getToken();
    if (!token) {
      return () => setUnauthorizedHandler(null);
    }
    let active = true;
    api<AuthUser>("/api/auth/me")
      .then((authoritativeUser) => {
        if (active) setUser(authoritativeUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 0) {
          setUser(null);
          setSessionMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
        } else {
          clearSession();
        }
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
      sessionMessage,
      clearSessionMessage() { setSessionMessage(""); },
      async login(input, remember) {
        const result = await api<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });
        saveToken(result.token, remember);
        saveRememberPreference(remember);
        if (remember) saveRememberedUsername(input.username);
        else clearRememberedUsername();
        setSessionMessage("");
        setUser(result.user);
      },
      async logout() {
        try { await api<void>("/api/auth/logout", { method: "POST" }); } catch { /* local logout remains authoritative */ }
        clearToken();
        // Keep the explicitly remembered username/preference for the next login.
        setUser(null);
      },
    }),
    [user, bootstrapping, sessionMessage],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
