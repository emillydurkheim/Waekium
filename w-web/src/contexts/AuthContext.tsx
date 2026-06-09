import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authService } from "@/services/api/auth";
import { isManagement, type AuthUser, type LoginPayload } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Admin OU gerente (mesmos acessos no MVP, mas separáveis no futuro). */
  isAdmin: boolean;
  isManagement: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authService.me().then((u) => {
      if (active) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: isManagement(user?.role),
    isManagement: isManagement(user?.role),
    async login(payload) {
      const res = await authService.login(payload);
      setUser(res.user);
    },
    async logout() {
      await authService.logout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
