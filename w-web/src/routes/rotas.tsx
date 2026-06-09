import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MapPin,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  Truck,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

import { RouteCard } from "@/components/rotas/RouteCard";
import { RouteFormModal } from "@/components/rotas/RouteFormModal";

import { rotasService } from "@/services/api/rotas";
import { funcionariosService } from "@/services/api/funcionarios";

import { apiClient } from "@/services/api/client";

export function requireAuth() {
  const token = apiClient.getToken();

  if (!token) {
    window.location.href = "/login";
  }
}

import type { Rota, RotaStatus } from "@/types/rota";

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

export const Route = createFileRoute("/rotas")({
  component: RotasPage,
  head: () => ({
    meta: [
      { title: "Rotas | Waekium ERP" },
      {
        name: "description",
        content:
          "Cadastro e gestão de rotas integradas ao Google Maps e ao app mobile dos motoristas.",
      },
    ],
  }),
});

function RotasPage() {
  // lista de rotas
  const [rotas, setRotas] = useState<Rota[]>([]);

  // funcionários
  const [employees, setEmployees] = useState<Employee[]>([]);

  // modal aberta/fechada
  const [createOpen, setCreateOpen] = useState(false);

  // busca
  const [query, setQuery] = useState("");

  // filtro de status
  const [statusFilter, setStatusFilter] =
    useState<"todas" | RotaStatus>("todas");

  // filtro motorista
  const [motoristaFilter, setMotoristaFilter] =
    useState<string>("todos");

  // carrega rotas
  async function reload() {
    const data = await rotasService.list();
    setRotas(data);
  }

  // carrega funcionários + rotas
  useEffect(() => {
    const loadData = async () => {
      try {
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
      } catch (err) {
        console.error("Erro ao carregar funcionários:", err);
      }
    };

    loadData();
    void reload();
  }, []);

  // aplica filtros
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rotas.filter((r) => {
      // filtro status
      if (
        statusFilter !== "todas" &&
        r.status !== statusFilter
      ) {
        return false;
      }

      // filtro motorista
      if (
        motoristaFilter !== "todos" &&
        r.motoristaId !== motoristaFilter
      ) {
        return false;
      }

      // sem busca
      if (!q) return true;

      // busca por nome/origem/destino
      return (
        r.nome.toLowerCase().includes(q) ||
        r.origem.toLowerCase().includes(q) ||
        r.destino.toLowerCase().includes(q)
      );
    });
  }, [
    rotas,
    query,
    statusFilter,
    motoristaFilter,
  ]);

  // métricas
  const stats = useMemo(
    () => ({
      total: rotas.length,

      andamento: rotas.filter(
        (r) => r.status === "em_andamento"
      ).length,

      pendentes: rotas.filter(
        (r) => r.status === "pendente"
      ).length,

      finalizadas: rotas.filter(
        (r) => r.status === "finalizada"
      ).length,
    }),
    [rotas]
  );

  // pega nome do motorista
  function nomeMotorista(id: string) {
    return (
      employees.find((e) => e.id === id)?.name ??
      "—"
    );
  }

  // cria rota
  async function handleCreate(
    input: Parameters<
      typeof rotasService.create
    >[0]
  ) {
    await rotasService.create(input);

    setCreateOpen(false);

    void reload();
  }

  // exclui rota
  async function handleDelete(id: string) {
    const ok = confirm(
      "Excluir esta rota?"
    );

    if (!ok) return;

    await rotasService.remove(id);

    void reload();
  }

  // altera status
  async function handleStatus(
    id: string,
    status: RotaStatus
  ) {
    await rotasService.setStatus(
      id,
      status
    );

    void reload();
  }

  return (
    <div className="flex min-h-screen bg-card">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Rotas" />

        <main className="flex-1 bg-[var(--canvas)] p-4">
          {/* topo */}
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Gestão de rotas
              </h2>

              <p className="text-xs text-muted-foreground capitalize">
                {format(
                  new Date(),
                  "EEEE, d 'de' MMMM 'de' yyyy",
                  {
                    locale: ptBR,
                  }
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Modo administrador
              </span>

              <button
                onClick={() =>
                  setCreateOpen(true)
                }
                className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova rota
              </button>
            </div>
          </div>

          {/* cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Total"
              value={stats.total}
              icon={MapPin}
            />

            <Stat
              label="Em andamento"
              value={stats.andamento}
              icon={Truck}
              tone="sky"
            />

            <Stat
              label="Pendentes"
              value={stats.pendentes}
              icon={Clock}
              tone="amber"
            />

            <Stat
              label="Finalizadas"
              value={stats.finalizadas}
              icon={CheckCircle2}
              tone="emerald"
            />
          </div>

          {/* filtros */}
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                placeholder="Buscar rota..."
                className="w-full rounded-lg border border-border bg-secondary/30 py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </label>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as typeof statusFilter
                  )
                }
                className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              >
                <option value="todas">
                  Todos status
                </option>

                <option value="pendente">
                  Pendente
                </option>

                <option value="em_andamento">
                  Em andamento
                </option>

                <option value="finalizada">
                  Finalizada
                </option>

                <option value="cancelada">
                  Cancelada
                </option>
              </select>
            </div>

            <select
              value={motoristaFilter}
              onChange={(e) =>
                setMotoristaFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            >
              <option value="todos">
                Todos motoristas
              </option>

              {employees.map((e) => (
                <option
                  key={e.id}
                  value={e.id}
                >
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* lista */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />

              <p className="mt-3 text-sm font-medium text-foreground">
                Nenhuma rota encontrada
              </p>

              <button
                onClick={() =>
                  setCreateOpen(true)
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova rota
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <RouteCard
                  key={r.id}
                  rota={r}
                  motoristaNome={nomeMotorista(
                    r.motoristaId
                  )}
                  onDelete={handleDelete}
                  onChangeStatus={
                    handleStatus
                  }
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* modal */}
      {createOpen && (
        <RouteFormModal
          employees={employees}
          onClose={() =>
            setCreateOpen(false)
          }
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  tone?: "sky" | "amber" | "emerald";
}) {
  const toneCls =
    tone === "sky"
      ? "bg-sky-100 text-sky-700"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-secondary text-foreground";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>

        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full ${toneCls}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="mt-2 text-2xl font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}
