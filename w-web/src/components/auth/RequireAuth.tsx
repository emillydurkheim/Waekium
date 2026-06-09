import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Protege rotas privadas. Usado no __root para envolver o <Outlet />.
 * Estrutura preparada para múltiplos níveis de acesso (passa role mínimo).
 */
export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: "admin" | "funcionario";
}) {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    if (role && user?.role !== role && user?.role !== "admin") {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, loading, role, user, navigate, location.pathname]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  return <>{children}</>;
}
