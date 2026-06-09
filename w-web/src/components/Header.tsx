import { LogOut } from "lucide-react"; // ícone logout

import { useAuth } from "@/contexts/AuthContext"; // auth

export function Header({
  title,
}: {
  title: string;
}) {
  // pega usuário logado
  const { user, logout } = useAuth();

  // primeira letra nome
  const initial =
    user?.name?.charAt(0).toUpperCase() || "?";

  // função sair
  async function handleLogout() {
    await logout();

    // recarrega página
    window.location.href = "/login";
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">

      {/* título página */}
      <h1 className="text-lg font-semibold text-foreground">
        {title}
      </h1>

      {/* área direita */}
      <div className="flex items-center gap-3">

        {/* perfil */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2">

          {/* bolinha */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {initial}
          </div>

          {/* infos */}
          <div className="leading-tight">
            <div className="text-sm font-medium text-foreground">
              {user?.name || "Usuário"}
            </div>

            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {user?.role || "—"}
            </div>
          </div>
        </div>

        {/* botão sair */}
        <button
          onClick={handleLogout}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}