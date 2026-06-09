import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, RefreshCw, Plus, Search } from "lucide-react";
import { realtime } from "@/lib/realtime";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { DeliveryBadge, EmployeeBadge } from "@/components/StatusBadge";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { useRealtime } from "@/hooks/useRealtime";
import { Input } from "@/components/ui/input";
import { funcionariosService } from "@/services/api/funcionarios";
import { agendaService, type AgendaResponse } from "@/services/api/agenda";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";

import { apiClient } from "@/services/api/client";

export function requireAuth() {
  const token = apiClient.getToken();

  if (!token) {
    window.location.href = "/login";
  }
}

// Type: Employee (convertido de storage para frontend)
type Employee = {
  id: string;
  name: string;
  role: string;
  cpf?: string;
  phone?: string;
  email?: string;
  base?: string;
  photo?: string;
  status?: "ativo" | "inativo" | "ferias" | "afastado";
};

// Type: AgendaEvent (convertido de storage para API)
type AgendaEvent = {
  id: number;
  time: string;
  title: string;
  description?: string;
  tag?: string;
  data: string;
  status?: string;
};

function mapAgendaEvent(event: AgendaResponse): AgendaEvent {
  return {
    id: event.id_agenda,
    time: event.horario || "",
    title: event.titulo,
    description: event.descricao || undefined,
    tag: event.tipo,
    data: event.data,
    status: event.status,
  };
}

const ADMIN_ID = "1";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  
  head: () => ({
    meta: [
      { title: "Dashboard | Waekium ERP" },
      {
        name: "description",
        content: "Painel administrativo: rotas, entregas, agenda e funcionários.",
      },
    ],
  }),
});

function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const state = useRealtime();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adminEvents, setAdminEvents] = useState<AgendaEvent[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [tick, setTick] = useState(0);
  const today = useMemo(() => new Date(), [tick]);

  // Apenas busca simples nos funcionários
  const [empQuery, setEmpQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({
        to: "/login",
        search: {
          redirect: "/",
        },
      });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Carrega funcionários
        const empData = await funcionariosService.listarFuncionarios();
        const empList: Employee[] = empData.map((f) => ({
          id: String(f.id_funcionario),
          name: f.nome,
          role: f.nome_funcao || "Funcionário",
          cpf: f.cpf,
          email: f.email,
          phone: f.telefone || undefined,
          status: f.ativo ? "ativo" : "inativo",
        }));
        setEmployees(empList);
        empList.forEach((e) => realtime.ensureEmployee(e.id));

        // Carrega eventos do admin
        const adminId = parseInt(ADMIN_ID, 10);
        if (!isNaN(adminId)) {
          const events = await agendaService.listarAgenda(adminId);
          const today = format(new Date(), "yyyy-MM-dd");
          const todayEvents = events.filter((e) => e.data === today).map(mapAgendaEvent);
          setAdminEvents(todayEvents);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      }
    };

    loadData();
  }, [tick]);

  useEffect(() => {
    // Atualiza admin events quando activity muda
    const updateEvents = async () => {
      try {
        const adminId = parseInt(ADMIN_ID, 10);
        if (!isNaN(adminId)) {
          const events = await agendaService.listarAgenda(adminId);
          const today = format(new Date(), "yyyy-MM-dd");
          const todayEvents = events.filter((e) => e.data === today).map(mapAgendaEvent);
          setAdminEvents(todayEvents);
        }
      } catch (err) {
        console.error("Erro ao atualizar eventos:", err);
      }
    };
    updateEvents();
  }, [state.activity.length]);

  const handleRefresh = () => {
    setTick((t) => t + 1);
    realtime.refresh();
  };

  const activeDeliveries = state.deliveries.filter((d) => d.status === "em_rota");
  const pending = state.deliveries.filter((d) => d.status === "aguardando").length;
  const finished = state.deliveries.filter((d) => d.status === "finalizado").length;

  const filteredEmployees = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q),
    );
  }, [employees, empQuery]);

  const selectedRuntime = selected ? state.employees[selected.id] : undefined;
  const selectedDelivery = selectedRuntime?.currentDeliveryId
    ? state.deliveries.find((d) => d.id === selectedRuntime.currentDeliveryId)
    : undefined;

  return (
    <div className="flex min-h-screen bg-card">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Dashboard" />
        <main className="flex-1 bg-[var(--canvas)] p-4 flex flex-col">
          {/* Visão geral header */}
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Visão Geral</h2>
              <p className="text-xs text-muted-foreground capitalize">
                {format(today, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            {/* Coluna principal */}
            <div className="flex flex-col gap-4">
              {/* Status de Rotas e Entregas */}
              <section className="flex flex-col rounded-xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3 shrink-0">
                  <h3 className="text-sm font-semibold text-foreground">Status de Rotas e Entregas</h3>
                  <p className="text-xs text-muted-foreground">
                    Atualizado em tempo real • {state.deliveries.length} registros hoje
                  </p>
                </div>

                <div className="grid grid-cols-3 border-b border-border shrink-0">
                  <Stat label="Em rota" value={activeDeliveries.length} tone="sky" />
                  <Stat label="Aguardando" value={pending} tone="amber" />
                  <Stat label="Finalizadas" value={finished} tone="emerald" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3 font-medium">ID do Pedido</th>
                        <th className="px-5 py-3 font-medium">Cliente</th>
                        <th className="px-5 py-3 font-medium">Funcionário</th>
                        <th className="px-5 py-3 font-medium">Rota</th>
                        <th className="px-5 py-3 font-medium">Saída</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.deliveries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-xs text-muted-foreground">
                            Nenhuma entrega registrada.
                          </td>
                        </tr>
                      ) : (
                        state.deliveries.map((d) => {
                          const emp = employees.find((e) => e.id === d.employeeId);
                          return (
                            <tr key={d.id} className="border-t border-border">
                              <td className="px-5 py-3 font-medium text-foreground">#{d.orderId}</td>
                              <td className="px-5 py-3 text-muted-foreground">{d.client}</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                                    {emp?.name.charAt(0) ?? "?"}
                                  </span>
                                  <span className="text-foreground">{emp?.name ?? "—"}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-muted-foreground">{d.route}</td>
                              <td className="px-5 py-3 text-muted-foreground">{d.startedAt}</td>
                              <td className="px-5 py-3"><DeliveryBadge status={d.status} /></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-5 py-2 text-xs text-muted-foreground shrink-0 border-t border-border">
                  <span>Total: {state.deliveries.length}</span>
                  <Link to="/rotas" className="font-medium text-foreground hover:underline">Gerenciar rotas →</Link>
                </div>
              </section>

              {/* Funcionários */}
              <section className="flex flex-col rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3 shrink-0">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Funcionários</h3>
                    <p className="text-xs text-muted-foreground">
                      {filteredEmployees.length} de {employees.length} exibidos
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={empQuery}
                      onChange={(e) => setEmpQuery(e.target.value)}
                      placeholder="Buscar nome ou cargo"
                      className="h-8 w-48 pl-7 text-xs"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  {filteredEmployees.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {filteredEmployees.map((e) => {
                        const rt = state.employees[e.id];
                        return (
                          <button
                            key={e.id}
                            onClick={() => setSelected(e)}
                            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center transition-all hover:border-foreground/20 hover:shadow-sm"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground">
                              {e.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-medium text-foreground">{e.name}</div>
                              <div className="truncate text-[11px] text-muted-foreground">{e.role}</div>
                            </div>
                            {rt && <EmployeeBadge status={rt.status} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Coluna lateral */}
            <aside className="flex flex-col gap-4">
              {/* Entregas em andamento */}
              <section className="shrink-0 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Entregas em andamento
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                    <Truck className="h-3.5 w-3.5 text-foreground" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-semibold text-foreground">
                  {activeDeliveries.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeDeliveries.length === 1 ? "Entrega em trânsito" : "Entregas em trânsito"}
                </p>
              </section>

              {/* Agenda do administrador */}
              <section className="flex min-h-[320px] flex-col rounded-xl border border-border bg-card">
                <div className="flex shrink-0 items-start justify-between border-b border-border px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Agenda do dia</h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <Link to="/agenda" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                    Ver
                  </Link>
                </div>
                <div className="flex-1 px-4 py-3">
                  {adminEvents.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Nenhum evento na agenda do administrador.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {adminEvents.map((ev) => (
                        <li key={ev.id} className="grid grid-cols-[44px_1fr_auto] items-start gap-2">
                          <span className="pt-0.5 text-xs font-medium text-muted-foreground">{ev.time}</span>
                          <div className="border-l border-border pl-2 min-w-0">
                            <div className="text-sm font-medium text-foreground">{ev.title}</div>
                            {ev.description && (
                              <div className="text-xs text-muted-foreground">{ev.description}</div>
                            )}
                          </div>
                          {ev.tag && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground">
                              {ev.tag}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2">
                  <span className="text-xs text-muted-foreground">{adminEvents.length} eventos hoje</span>
                  <Link
                    to="/agenda"
                    className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-muted-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <EmployeeDetailsDialog
        employee={selected}
        runtime={selectedRuntime}
        delivery={selectedDelivery}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "sky" | "amber" | "emerald" }) {
  const toneCls = {
    sky: "text-sky-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700",
  }[tone];
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}
