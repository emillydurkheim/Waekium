import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutGrid,
  CalendarDays,
  UserCircle,
  MapPin,
  Wallet,
  Clock,
} from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/funcionario", label: "Funcionários", icon: UserCircle },
  { to: "/ponto", label: "Ponto & Horas", icon: Clock },
  { to: "/rotas", label: "Rotas & Entregas", icon: MapPin },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
];

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start overflow-y-auto border-r border-border bg-card md:flex md:flex-col">
      <div className="px-6 pt-6 pb-8">
        <div className="text-lg font-bold tracking-[0.2em] text-foreground">
          WAEKIUM
        </div>
        <div className="mt-1 text-[10px] tracking-[0.25em] text-muted-foreground">
          ERP LOGÍSTICO
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to === "/agenda" && pathname.startsWith("/agenda"));
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
