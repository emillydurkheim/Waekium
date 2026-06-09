import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Truck,
  CalendarDays,
  User,
  Package,
  Clock,
  CheckCircle2,
  Activity,
  Plus,
  Pencil,
  Trash2,
  X,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { generateTempPassword } from "@/lib/password";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { EmployeeBadge, DeliveryBadge } from "@/components/StatusBadge";
import { useRealtime } from "@/hooks/useRealtime";
import { realtime } from "@/lib/realtime";
import {
  criarFuncionario,
  listarFuncionarios,
  excluirFuncionario,
} from "@/services/api/funcionarios";
import { agendaService, type AgendaResponse } from "@/services/api/agenda";
import type { EmployeeStatus } from "@/lib/realtime";
import { parseISO } from "date-fns";
import { cargosService } from "@/services/api/cargos";
import type { Cargo, CargoId } from "@/types/cargo";
import { CARGO_INTERNAL } from "@/types/cargo";
import { Settings2 } from "lucide-react";

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
  cargoId?: CargoId;
  phone?: string;
  email?: string;
  base?: string;
  photo?: string;
  salary?: number;
  status?: "ativo" | "inativo" | "ferias" | "afastado";
  password?: string;
};

export const Route = createFileRoute("/funcionario")({
  component: FuncionarioPage,
  head: () => ({
    meta: [
      { title: "Funcionário | Waekium ERP" },
      {
        name: "description",
        content:
          "Gestão de funcionários: status em tempo real, dados, financeiro, agenda, rotas e entregas.",
      },
    ],
  }),
});

type Tab = "dados" | "agenda" | "rotas";

const STATUS_FILTERS: { value: "all" | EmployeeStatus; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "em_transito", label: "Em trânsito" },
  { value: "disponivel", label: "Disponível" },
  { value: "offline", label: "Offline" },
  { value: "ferias", label: "Férias" },
  { value: "suspenso", label: "Suspenso" },
];

function FuncionarioPage() {
  const state = useRealtime();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dados");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmployeeStatus>("all");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; emp?: Employee } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
  const [cargosModalOpen, setCargosModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ employee: Employee; password: string } | null>(null);

  async function carregarFuncionarios() {
  try {
    const data = await listarFuncionarios();

    const lista: Employee[] = data.map((f) => ({
      id: String(f.id_funcionario),
      name: f.nome,
      role: f.nome_funcao,
      cpf: f.cpf,
      email: f.email,
      phone: f.telefone ?? "",
      cargoId: "cargo_1",
      status: f.ativo ? "ativo" : "inativo",
    }));

    setEmployees(lista);

    if (lista.length > 0) {
      setSelectedId(String(lista[0].id));
    }
  } catch (err) {
    console.error(err);
    toast.error("Erro ao carregar funcionários");
  }
}

  async function reload(selectId?: string | null) {
  await carregarFuncionarios();

    if (selectId !== undefined) {
      setSelectedId(selectId);
    }
  }
  
  useEffect(() => {
  carregarFuncionarios();
  }, []);

  const handleRefresh = () => {
    reload();
    realtime.refresh();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const rt = state.employees[e.id];
      if (statusFilter !== "all" && rt?.status !== statusFilter) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.role.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [employees, state.employees, query, statusFilter]);

  const selected = employees.find((e) => e.id === selectedId) ?? null;
  const runtime = selected ? state.employees[selected.id] : undefined;

  const empDeliveries = selected
    ? state.deliveries.filter((d) => d.employeeId === selected.id)
    : [];
  const finishedCount = empDeliveries.filter((d) => d.status === "finalizado").length;
  const inRouteCount = empDeliveries.filter((d) => d.status === "em_rota").length;
  const empActivity = selected
    ? state.activity.filter((a) => a.employeeId === selected.id).slice(0, 8)
    : [];

  return (
    <div className="flex min-h-screen bg-card">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Funcionário" />
        <main className="flex-1 bg-[var(--canvas)] p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            {/* LISTA DE FUNCIONÁRIOS */}
            <aside className="flex flex-col rounded-xl border border-border bg-card">
              <div className="border-b border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Funcionários</h3>
                    <p className="text-xs text-muted-foreground">
                      {filtered.length} de {employees.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCargosModalOpen(true)}
                      className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                      title="Configurar cargos e valores"
                    >
                      <Settings2 className="h-3 w-3" /> Cargos
                    </button>
                    <button
                      onClick={() => setModal({ mode: "create" })}
                      className="flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background hover:opacity-90"
                      title="Adicionar funcionário"
                    >
                      <Plus className="h-3 w-3" /> Adicionar
                    </button>
                  </div>
                </div>
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> Modo administrador
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-lg border border-border bg-secondary/40 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                        statusFilter === f.value
                          ? "bg-foreground text-background"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Nenhum funcionário encontrado.
                  </div>
                ) : (
                  filtered.map((e) => {
                    const rt = state.employees[e.id];
                    const isSel = e.id === selectedId;
                    return (
                      <button
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={`mb-1 flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                          isSel
                            ? "bg-secondary"
                            : "hover:bg-secondary/60"
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {e.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {e.name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {e.role}
                          </div>
                        </div>
                        {rt && <EmployeeBadge status={rt.status} />}
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* DETALHES */}
            <section className="flex flex-col gap-4">
              {selected ? (
                <>
                  {/* Cabeçalho funcionário */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
                          {selected.name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">
                            {selected.name}
                          </h2>
                          <p className="text-xs text-muted-foreground">{selected.role}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {runtime && <EmployeeBadge status={runtime.status} />}
                            <span className="text-[11px] text-muted-foreground">
                              {runtime?.lastActivity ?? "Sem registros"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Status (ADM)
                            </label>
                            <select
                              value={runtime?.status ?? "disponivel"}
                              onChange={(e) =>
                                realtime.setEmployeeStatus(
                                  selected.id,
                                  e.target.value as EmployeeStatus,
                                )
                              }
                              className="h-7 rounded-md border border-border bg-secondary/40 px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                            >
                              <option value="disponivel">Disponível</option>
                              <option value="em_transito">Em rota</option>
                              <option value="offline">Offline</option>
                              <option value="ferias">Férias</option>
                              <option value="suspenso">Suspenso</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRefresh}
                            className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                            title="Atualizar dados"
                          >
                            <RefreshCw className="h-3 w-3" /> Atualizar
                          </button>
                          <button
                            onClick={() => setModal({ mode: "edit", emp: selected })}
                            className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </button>
                          <button
                            onClick={() => setConfirmDelete(selected)}
                            className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <MiniStat icon={Truck} label="Em rota" value={inRouteCount} />
                          <MiniStat icon={CheckCircle2} label="Finalizadas" value={finishedCount} />
                          <MiniStat icon={Package} label="Total" value={empDeliveries.length} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                    {(
                      [
                        { id: "dados", label: "Dados", icon: User },
                        { id: "agenda", label: "Agenda", icon: CalendarDays },
                        { id: "rotas", label: "Rotas & Entregas", icon: MapPin },
                      ] as const
                    ).map((t) => {
                      const Icon = t.icon;
                      const active = tab === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTab(t.id)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                            active
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Conteúdo das abas */}
                  {tab === "dados" && <TabDados employee={selected} activity={empActivity} />}
                  {tab === "agenda" && <TabAgenda employee={selected} />}
                  {tab === "rotas" && (
                    <TabRotas
                      deliveries={empDeliveries}
                      currentDeliveryId={runtime?.currentDeliveryId}
                    />
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-border bg-card p-12 text-sm text-muted-foreground">
                  Selecione um funcionário
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {modal && (
        <EmployeeModal
          mode={modal.mode}
          employee={modal.emp}
          onClose={() => setModal(null)}
          onSaved={(emp, generatedPassword) => {
            setModal(null);
            reload(emp.id);
            if (modal.mode === "create" && generatedPassword) {
              setCredentials({ employee: emp, password: generatedPassword });
            }
          }}
        />
      )}

      {credentials && (
        <CredentialsDialog
          employee={credentials.employee}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDelete
          employee={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await excluirFuncionario(confirmDelete.id);

              realtime.removeEmployee(confirmDelete.id);

              setConfirmDelete(null);

              await reload(null);

              toast.success("Funcionário excluído com sucesso");
            } catch (err) {
              console.error(err);
              toast.error("Erro ao excluir funcionário");
            }
          }}
        />
      )}

      {cargosModalOpen && <CargosConfigModal onClose={() => setCargosModalOpen(false)} />}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <Icon className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
      <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ---- ABA: DADOS ---- */
function TabDados({
  employee,
  activity,
}: {
  employee: Employee;
  activity: { id: string; time: string; message: string }[];
}) {
  const phone = employee.phone || "—";
  const email = employee.email || "—";
  const base = employee.base || "—";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Informações Pessoais">
        <ul className="space-y-3 text-sm">
          <Field icon={User} label="Nome">{employee.name}</Field>
          <Field icon={Truck} label="Cargo">{employee.role}</Field>
          <Field icon={Phone} label="Telefone">{phone}</Field>
          <Field icon={Mail} label="E-mail">{email}</Field>
          <Field icon={MapPin} label="Base">{base}</Field>
        </ul>
      </Card>
      <Card title="Atividade Recente">
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem atividade registrada hoje.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{a.message}</div>
                  <div className="text-[11px] text-muted-foreground">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm text-foreground">{children}</div>
      </div>
    </li>
  );
}

/* ---- ABA: AGENDA ---- */
function TabAgenda({ employee }: { employee: Employee }) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  // Estados para carregamento de agenda
  const [events, setEvents] = useState<AgendaResponse[]>([]);
  const [history, setHistory] = useState<{ date: string; events: AgendaResponse[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega agenda do funcionário
  useEffect(() => {
    const loadAgenda = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Converte employee.id (string) para número
        const empId = parseInt(employee.id, 10);
        if (isNaN(empId)) {
          setError("ID do funcionário inválido");
          return;
        }

        const allEvents = await agendaService.listarAgenda(empId);
        
        // Filtra eventos de hoje
        const todayEvents = allEvents.filter((e) => e.data === todayStr);
        setEvents(todayEvents);

        // Filtra histórico (últimos 6 dias diferentes)
        const uniqueDates = [...new Set(allEvents.map((e) => e.data))];
        const historyDates = uniqueDates
          .filter((d) => d !== todayStr)
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 6);

        const historyData = historyDates.map((date) => ({
          date,
          events: allEvents.filter((e) => e.data === date),
        }));

        setHistory(historyData);
      } catch (err) {
        console.error("Erro ao carregar agenda:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar agenda");
      } finally {
        setLoading(false);
      }
    };

    loadAgenda();
  }, [employee.id, todayStr]);

  const showEvents = events.length > 0 ? events : [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        title={`Agenda — ${format(today, "dd 'de' MMMM", { locale: ptBR })}`}
        action={
          <Link to="/agenda" className="text-xs font-medium text-foreground hover:underline">
            Editar →
          </Link>
        }
      >
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : showEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum compromisso hoje.</p>
        ) : (
          <ul className="space-y-3">
            {showEvents.map((ev) => (
              <li key={ev.id_agenda} className="flex items-start gap-3 text-sm">
                <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
                  {ev.horario}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{ev.titulo}</div>
                  {ev.tipo && (
                    <span className="mt-0.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {ev.tipo}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Histórico de Agendas">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem agendas anteriores registradas.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li
                key={h.date}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-foreground capitalize">
                    {format(parseISO(h.date), "EEE, dd MMM yyyy", { locale: ptBR })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {h.events.length} compromisso(s)
                  </div>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---- ABA: ROTAS & ENTREGAS ---- */
function TabRotas({
  deliveries,
  currentDeliveryId,
}: {
  deliveries: ReturnType<typeof useRealtime>["deliveries"];
  currentDeliveryId?: string;
}) {
  const active = deliveries.filter(
    (d) => d.status === "em_rota" || d.status === "aguardando",
  );
  const history = deliveries.filter((d) => d.status === "finalizado");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Em andamento">
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma rota em andamento.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((d) => (
              <li
                key={d.id}
                className={`rounded-lg border p-3 ${
                  d.id === currentDeliveryId
                    ? "border-foreground/30 bg-secondary/40"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      #{d.orderId} — {d.client}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {d.route}
                    </div>
                  </div>
                  <DeliveryBadge status={d.status} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Saída: {d.startedAt}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Histórico de entregas">
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma entrega finalizada ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">
                    #{d.orderId} — {d.client}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {d.route} • {d.startedAt}
                  </div>
                </div>
                <DeliveryBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---- MODAL: ADICIONAR / EDITAR FUNCIONÁRIO (admin) ---- */
function EmployeeModal({
  mode,
  employee,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  employee?: Employee;
  onClose: () => void;
  onSaved: (emp: Employee, generatedPassword?: string) => void;
}) {
  const [name, setName] = useState(employee?.name ?? "");
  const [role, setRole] = useState(employee?.role ?? "Motorista");
  const [cpf, setCpf] = useState(employee?.cpf ?? "");
  const [cargoId, setCargoId] = useState<CargoId>(employee?.cargoId ?? "cargo_1");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [base, setBase] = useState(employee?.base ?? "");
  const idCid = "";
  const idEst = "";
  const [photo, setPhoto] = useState<string | undefined>(employee?.photo);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [salary, setSalary] = useState<string>(
    employee?.salary != null ? String(employee.salary) : "",
  );
  const [status, setStatus] = useState<NonNullable<Employee["status"]>>(
    employee?.status ?? "ativo",
  );
  // Senha: no modo "create" começamos com auto-geração ligada e senha já gerada.
  const [autoPassword, setAutoPassword] = useState(mode === "create");
  const [password, setPassword] = useState<string>(() =>
    mode === "create" ? generateTempPassword(10) : employee?.password ?? "",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  // Guarda o role anterior para detectar quando o usuário deixou no padrão do cargo
  const prevAutoRoleRef = useState({ value: CARGO_INTERNAL[employee?.cargoId ?? "cargo_1"] })[0];

  useEffect(() => {
    cargosService.list().then(setCargos);
  }, []);

  function handleCargoChange(next: CargoId) {
    setCargoId(next);
    // Se o role atual estava como o internal name do cargo anterior (ou vazio), atualiza
    const prev = prevAutoRoleRef.value;
    if (!role.trim() || role.trim() === prev) {
      const nextLabel = CARGO_INTERNAL[next];
      setRole(nextLabel);
      prevAutoRoleRef.value = nextLabel;
    }
    // Auto-preenche salário sugerido quando vazio
    const cargo = cargos.find((c) => c.id === next);
    if (cargo && !salary) setSalary(String(cargo.baseSalary));
  }

  function handlePhotoFile(file: File | null) {
  if (!file) return;

  setPhotoFile(file); // 👈 ISSO é o que Flask precisa

  const reader = new FileReader();
  reader.onload = () => {
    setPhoto(reader.result as string); // preview só
  };
  reader.readAsDataURL(file);
}

  function parseBaseLocation(value: string) {
    const normalized = value.replace("—", "-");
    const parts = normalized
      .split("-")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      cidade: parts[0] ?? "",
      estado: parts[1] ?? "",
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    if (mode === "create" && !password.trim()) {
      toast.error("Defina uma senha ou ative a geração automática.");
      return;
    }
    const salaryNum = salary.trim() ? Number(salary.replace(",", ".")) : undefined;
    const payload = {
      name: name.trim(),
      role: role.trim(),
      cpf: cpf.replace(/\D/g, ""),
      cargoId,
      phone,
      email,
      base,
      photo,
      salary: Number.isFinite(salaryNum) ? salaryNum : undefined,
      status,
      // Senha enviada no payload — backend Flask deve receber e armazenar como hash.
      ...(password.trim() ? { password: password.trim() } : {}),
    };
    if (mode === "create") {
      if (!photoFile) {
        toast.error("Envie uma foto do funcionário (obrigatório).");
        return;
      }
      try {
        // chamar backend
        const mapaCargo = {
          cargo_1: "1",
          cargo_2: "2",
          cargo_3: "3",
        };

        const resp = await criarFuncionario({
          nome: payload.name,
          cpf: payload.cpf,
          email: payload.email ?? "",
          telefone: payload.phone ?? "",
          ...parseBaseLocation(payload.base),
          id_cid: idCid,
          id_est: idEst,
          senha: password.trim(),
          id_funcao: mapaCargo[payload.cargoId] ?? "1",
          foto: photoFile,
        });

        // Inserir no estado local para exibição imediata
        const newEmp: Employee = {
          id: String(resp.id_funcionario),
          name: payload.name,
          role: payload.role,
          cpf: payload.cpf,
          cargoId: payload.cargoId,
          phone: payload.phone,
          email: payload.email,
          base: payload.base,
          photo: photo,
          salary: payload.salary,
          status: payload.status,
          password: password.trim(),
        };

        onSaved(newEmp, password.trim());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error("Erro ao cadastrar: " + message);
      }
    } else if (employee) {
      // TODO: Implementar PUT /funcionarios/{id} para atualizar dados
      onSaved({ ...employee, ...payload });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {mode === "create" ? "Adicionar funcionário" : "Editar funcionário"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Apenas administradores podem alterar estes dados.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {/* Foto */}
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-lg font-medium text-muted-foreground">
              {photo ? (
                <img src={photo} alt="Foto" className="h-full w-full object-cover" />
              ) : (
                (name.charAt(0) || "?").toUpperCase()
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary">
                {photo ? "Trocar foto" : "Adicionar foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto(undefined)}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Remover foto
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">JPG/PNG até 2MB</span>
            </div>
          </div>
          <Input2 label="Nome" value={name} onChange={setName} required />
          <div className="grid grid-cols-2 gap-3">
            <Input2 label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00" />
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Cargo
              </span>
              <select
                value={cargoId}
                onChange={(e) => handleCargoChange(e.target.value as CargoId)}
                className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                {cargos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — {c.internalName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Input2 label="Função (descrição)" value={role} onChange={setRole} required />
          <div className="grid grid-cols-2 gap-3">
            <Input2 label="Telefone" value={phone} onChange={setPhone} placeholder="+55 (11) 9..." />
            <Input2 label="Base" value={base} onChange={setBase} placeholder="Cidade — UF" />
          </div>
          <Input2 label="E-mail" value={email} onChange={setEmail} type="email" placeholder="nome@waekium.com" />
          <div className="grid grid-cols-2 gap-3">
            <Input2
              label="Salário (R$)"
              value={salary}
              onChange={setSalary}
              type="number"
              placeholder="0,00"
            />
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NonNullable<Employee["status"]>)}
                className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="afastado">Afastado</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>

          {/* Senha inicial (somente no cadastro) */}
          {mode === "create" && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="h-3 w-3" /> Senha inicial
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground">
                  <input
                    type="checkbox"
                    checked={autoPassword}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAutoPassword(checked);
                      if (checked) setPassword(generateTempPassword(10));
                    }}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  Gerar automaticamente
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    readOnly={autoPassword}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha temporária"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 pr-9 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generateTempPassword(10));
                    setAutoPassword(true);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] font-medium text-foreground hover:bg-secondary"
                  title="Gerar nova senha"
                >
                  <RefreshCw className="h-3 w-3" /> Nova
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                A senha será exibida após o cadastro para você repassar ao funcionário.
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
          >
            {mode === "create" ? "Adicionar" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input2({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
    </label>
  );
}

function ConfirmDelete({
  employee,
  onCancel,
  onConfirm,
}: {
  employee: Employee;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Excluir funcionário?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Esta ação removerá <span className="font-medium text-foreground">{employee.name}</span> do sistema.
          Não é possível desfazer.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-4 py-2 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- MODAL: Configuração inline de CARGOS (substitui página /cargos) ---- */
function CargosConfigModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Cargo[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    cargosService.list().then(setList);
  }, []);

  function patch(id: string, p: Partial<Cargo>) {
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  async function save(c: Cargo) {
    setSavingId(c.id);
    try {
      await cargosService.update(c.id, c);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Configurar cargos</h3>
            <p className="text-xs text-muted-foreground">
              3 cargos fixos: Motorista, ADM e Gerente. Edite valores, hora normal, hora extra e limite mensal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {list.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4"
              style={{ borderTop: `3px solid ${c.color ?? "var(--border)"}` }}
            >
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <div className="text-sm font-semibold text-foreground">{c.internalName}</div>
              </div>
              <div className="space-y-2">
                <NumRow label="Salário base" value={c.baseSalary} onChange={(v) => patch(c.id, { baseSalary: v })} />
                <NumRow label="Limite mensal (h)" value={c.monthlyHourLimit} onChange={(v) => patch(c.id, { monthlyHourLimit: v })} />
                <NumRow label="Hora normal (R$)" value={c.hourlyRate} onChange={(v) => patch(c.id, { hourlyRate: v })} />
                <NumRow label="Hora extra (R$)" value={c.overtimeRate} onChange={(v) => patch(c.id, { overtimeRate: v })} />
              </div>
              <button
                onClick={() => save(c)}
                disabled={savingId === c.id}
                className="mt-3 w-full rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-60"
              >
                {savingId === c.id ? "Salvando..." : "Salvar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-24 rounded-md border border-border bg-secondary/30 px-2 py-1 text-right text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
      />
    </label>
  );
}

/* ---- DIALOG: CREDENCIAIS GERADAS ---- */
function CredentialsDialog({
  employee,
  password,
  onClose,
}: {
  employee: Employee;
  password: string;
  onClose: () => void;
}) {
  const login = employee.email?.trim() || employee.cpf || employee.name;

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  function copyAll() {
    const text = `Funcionário: ${employee.name}\nLogin: ${login}\nSenha temporária: ${password}`;
    copy(text, "Credenciais");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Funcionário criado com sucesso</h3>
              <p className="text-xs text-muted-foreground">Repasse as credenciais ao funcionário.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <CredRow label="Nome" value={employee.name} onCopy={(v) => copy(v, "Nome")} />
          <CredRow label="Login" value={login} onCopy={(v) => copy(v, "Login")} />
          <CredRow label="Senha temporária" value={password} mono onCopy={(v) => copy(v, "Senha")} />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={copyAll}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar tudo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}

function CredRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`truncate text-sm text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value)}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
        title="Copiar"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
