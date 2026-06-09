import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wallet,
  Plus,
  CheckCircle2,
  Clock,
  X,
  Smartphone,
  Pencil,
  Trash2,
  Search,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { useRealtime } from "@/hooks/useRealtime";
import { funcionariosService } from "@/services/api/funcionarios";
import {
  cargosService,
  expectedDailyMinutes,
  bancoHorasValue,
} from "@/services/api/cargos";
import type { Cargo, CargoId } from "@/types/cargo";
import { pontoService, formatMinutes } from "@/services/api/ponto";

import { apiClient } from "@/services/api/client";

import { rhService, type FolhaPagamento, type PagamentoStatus } from "@/services/api/rh";

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
  cargoId?: CargoId;
  cpf?: string;
  phone?: string;
  email?: string;
  base?: string;
  photo?: string;
  salary?: number;
  status?: "ativo" | "inativo" | "ferias" | "afastado";
};

type Payment = {
  id: string;
  employeeId: string;
  monthRef: string;
  amount: number;
  baseSalary: number;
  paidAt?: string;
  note?: string;
  status: PagamentoStatus;
  createdAt: number;
};

export const Route = createFileRoute("/financeiro")({
  component: FinanceiroPage,
  head: () => ({
    meta: [
      { title: "Financeiro | Waekium ERP" },
      {
        name: "description",
        content:
          "Gestão financeira dos funcionários: salários, horas trabalhadas e registro de pagamentos.",
      },
    ],
  }),
});

type DraftPayment = {
  employeeId: string;
  monthRef: string;
  amount: string;
  paidAt: string;
  note: string;
  status: PagamentoStatus;
};

function currentMonthRef(d: Date = new Date()): string {
  return format(d, "yyyy-MM");
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function folhaToPayment(folha: FolhaPagamento): Payment {
  return {
    id: String(folha.id_rh),
    employeeId: String(folha.id_funcionario),
    monthRef: folha.mes_referencia,
    amount: folha.salario_final,
    baseSalary: folha.salario_base,
    status: folha.status_pagamento,
    createdAt: folha.id_rh,
  };
}

function FinanceiroPage() {
  // mantém o realtime simulado disparando — não precisamos do estado aqui
  useRealtime();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [bancoMap, setBancoMap] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pago" | "pendente">("all");

  const [payOpen, setPayOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editSalaryOpen, setEditSalaryOpen] = useState(false);

  const month = currentMonthRef();

  const refresh = async (sourceEmployees: Employee[] = employees) => {
    const [cargosList, folhaGroups] = await Promise.all([
      cargosService.list(),
      Promise.all(
        sourceEmployees.map((employee) =>
          rhService.listarFolhas(Number(employee.id)).catch(() => []),
        ),
      ),
    ]);

    setCargos(cargosList);
    setPayments(
      folhaGroups
        .flat()
        .map(folhaToPayment)
        .sort((a, b) => b.createdAt - a.createdAt),
    );
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const empData = await funcionariosService.listarFuncionarios();
        const empList: Employee[] = empData.map((f) => ({
          id: String(f.id_funcionario),
          name: f.nome,
          role: f.nome_funcao || "Funcionário",
          cargoId: `cargo_${f.id_funcao}` as CargoId,
          cpf: f.cpf,
          email: f.email,
          phone: f.telefone || undefined,
          salary: f.salario_funcao,
          status: f.ativo ? "ativo" : "inativo",
        }));
        setEmployees(empList);
        await refresh(empList);
      } catch (err) {
        console.error("Erro ao carregar funcionários:", err);
      }
    };
    
    loadData();
  }, []);

  // Carrega banco de horas (30d) por funcionário, considerando jornada do cargo
  useEffect(() => {
    if (employees.length === 0 || cargos.length === 0) return;
    let active = true;
    (async () => {
      const entries = await Promise.all(
        employees.map(async (e) => {
          const cargo = cargos.find((c) => c.id === e.cargoId) ?? null;
          const min = await pontoService.getBancoHoras(
            e.id,
            30,
            expectedDailyMinutes(cargo),
          );
          return [e.id, min] as const;
        }),
      );
      if (!active) return;
      setBancoMap(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [employees, cargos]);

  const cargoOf = (e: Employee) => cargos.find((c) => c.id === e.cargoId) ?? null;

  const summaries = useMemo(() => {
    return employees.map((e) => {
      const cargo = cargoOf(e);
      const currentFolha = payments.find((p) => p.employeeId === e.id && p.monthRef === month);
      const base = currentFolha?.baseSalary ?? e.salary ?? cargo?.baseSalary ?? 0;
      const pays = payments.filter((p) => p.employeeId === e.id && p.monthRef === month);
      const paid = pays.filter((p) => p.status === "pago").reduce((s, p) => s + p.amount, 0);
      const bancoMin = bancoMap[e.id] ?? 0;
      const overtimeBRL = bancoHorasValue(cargo, bancoMin);
      const total = base + overtimeBRL;
      const pending = Math.max(0, total - paid);
      const status: "pago" | "pendente" = pending <= 0 && total > 0 ? "pago" : "pendente";
      return { employee: e, cargo, base, paid, pending, status, bancoMin, overtimeBRL, total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, payments, month, cargos, bancoMap]);

  const filtered = summaries.filter((s) => {
    const matchSearch = s.employee.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === "all" ? true : s.status === filter;
    return matchSearch && matchStatus;
  });

  const totals = useMemo(() => {
    const totalMonth = summaries.reduce((s, x) => s + x.base, 0);
    const totalPaid = summaries.reduce((s, x) => s + x.paid, 0);
    const totalPending = summaries.reduce((s, x) => s + x.pending, 0);
    const paidCount = summaries.filter((s) => s.status === "pago").length;
    return { totalMonth, totalPaid, totalPending, paidCount, total: summaries.length };
  }, [summaries]);

  const selected =
    summaries.find((s) => s.employee.id === selectedId) ?? summaries[0] ?? null;
  const selectedHistory = selected
    ? payments
        .filter((p) => p.employeeId === selected.employee.id)
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  const handleSavePayment = async (draft: DraftPayment) => {
    const amount = Number(draft.amount.replace(",", "."));
    if (!draft.employeeId || !draft.monthRef || !amount) return;

    const payload = {
      id_funcionario: Number(draft.employeeId),
      mes_referencia: draft.monthRef,
      salario_base: amount,
      horas_trabalhadas: 0,
      horas_extras: 0,
      valor_hora_extra: 0,
      descontos: 0,
      bonus: 0,
      status_pagamento: draft.status,
    };

    if (editPayment) {
      await rhService.atualizarFolha(Number(editPayment.id), payload);
    } else {
      await rhService.gerarFolha(payload);
    }
    await refresh();
    setPayOpen(false);
    setEditPayment(null);
  };

  const handleDeletePayment = async (id: string) => {
    await rhService.deletarFolha(Number(id));
    await refresh();
  };

  return (
    <div className="flex min-h-screen bg-card">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Financeiro" />
        <main className="flex-1 bg-[var(--canvas)] p-4 md:p-6">
          {/* Aviso de permissão */}
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Apenas o administrador pode definir valores e registrar pagamentos. Funcionários visualizam pelo app mobile.
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
              icon={<Wallet className="h-4 w-4" />}
              label="Folha do mês"
              value={formatBRL(totals.totalMonth)}
              hint={format(new Date(), "MMMM yyyy", { locale: ptBR })}
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Já pago"
              value={formatBRL(totals.totalPaid)}
              hint={`${totals.paidCount} de ${totals.total} funcionários`}
            />
            <SummaryCard
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              label="Pendente"
              value={formatBRL(totals.totalPending)}
              hint="A pagar este mês"
            />
            <SummaryCard
              icon={<FileText className="h-4 w-4 text-sky-600" />}
              label="Pagamentos"
              value={String(payments.length)}
              hint="Registros totais"
            />
          </div>

          {/* Toolbar */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar funcionário..."
                  className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm outline-none focus:border-foreground/30"
                />
              </div>
              <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs">
                {(["all", "pago", "pendente"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-md px-3 py-1.5 transition-colors ${
                      filter === s
                        ? "bg-secondary text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "all" ? "Todos" : s === "pago" ? "Pagos" : "Pendentes"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setEditPayment(null);
                setPayOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Adicionar pagamento
            </button>
          </div>

          {/* Conteúdo principal: lista + detalhes */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_400px]">
            {/* Lista */}
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">Funcionários</div>
                <div className="text-xs text-muted-foreground">
                  Resumo financeiro do mês ({format(new Date(), "MMM/yyyy", { locale: ptBR })})
                </div>
              </div>
              <div className="divide-y divide-border">
                {filtered.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Nenhum funcionário encontrado.
                  </div>
                )}
                {filtered.map((s) => {
                  const isSel = selected?.employee.id === s.employee.id;
                  return (
                    <button
                      key={s.employee.id}
                      onClick={() => setSelectedId(s.employee.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSel ? "bg-secondary/60" : "hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {s.employee.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium">{s.employee.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {s.employee.role}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatBRL(s.base)}</div>
                        <PaymentStatusBadge status={s.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detalhes */}
            <aside className="rounded-xl border border-border bg-card">
              {!selected ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Selecione um funcionário para ver os detalhes.
                </div>
              ) : (
                <div>
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{selected.employee.name}</div>
                        <div className="text-xs text-muted-foreground">{selected.employee.role}</div>
                      </div>
                      <button
                        onClick={() => setEditSalaryOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
                      >
                        <Pencil className="h-3 w-3" />
                        Salário
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-4">
                    <MiniInfo label="Salário base" value={formatBRL(selected.base)} />
                    <MiniInfo
                      label="Pago"
                      value={formatBRL(selected.paid)}
                      tone="success"
                    />
                    <MiniInfo
                      label="Pendente"
                      value={formatBRL(selected.pending)}
                      tone={selected.pending > 0 ? "warning" : "default"}
                    />
                  </div>

                  {/* Cargo & Banco de Horas */}
                  <div className="border-t border-border px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Cargo & Horas (30d)
                      </div>
                      {selected.cargo && (
                        <span
                          className="rounded-md border px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            borderColor: selected.cargo.color ?? "var(--border)",
                            color: selected.cargo.color ?? "var(--foreground)",
                          }}
                        >
                          {selected.cargo.label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <MiniInfo
                        label="Banco de horas"
                        value={formatMinutes(selected.bancoMin)}
                        tone={selected.bancoMin >= 0 ? "success" : "warning"}
                      />
                      <MiniInfo
                        label="Hora extra (R$)"
                        value={selected.cargo ? formatBRL(selected.cargo.overtimeRate) : "—"}
                      />
                      <MiniInfo
                        label="A pagar (extras)"
                        value={formatBRL(selected.overtimeBRL)}
                        tone={selected.overtimeBRL > 0 ? "success" : "default"}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Total sugerido do mês: <span className="font-semibold text-foreground">{formatBRL(selected.total)}</span>
                    </div>
                  </div>

                  <div className="border-t border-border px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Histórico de pagamentos
                      </div>
                      <button
                        onClick={() => {
                          setEditPayment(null);
                          setPayOpen(true);
                        }}
                        className="text-xs font-medium text-foreground hover:underline"
                      >
                        + Novo
                      </button>
                    </div>
                    <div className="space-y-2">
                      {selectedHistory.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                          Nenhum pagamento registrado.
                        </div>
                      )}
                      {selectedHistory.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{formatBRL(p.amount)}</div>
                              <div className="text-xs text-muted-foreground">
                                Ref. {formatMonth(p.monthRef)}
                                {p.paidAt && ` • Pago em ${formatDateBR(p.paidAt)}`}
                              </div>
                            </div>
                            <PaymentStatusBadge status={p.status} />
                          </div>
                          {p.note && (
                            <div className="mt-1.5 text-xs text-muted-foreground">{p.note}</div>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Smartphone className="h-3 w-3" />
                              Visível no mobile do funcionário
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditPayment(p);
                                  setPayOpen(true);
                                }}
                                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePayment(p.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </main>
      </div>

      {payOpen && (
        <PaymentModal
          employees={employees}
          initial={editPayment}
          defaultEmployeeId={selected?.employee.id}
          onClose={() => {
            setPayOpen(false);
            setEditPayment(null);
          }}
          onSave={handleSavePayment}
        />
      )}

      {editSalaryOpen && selected && (
        <SalaryModal
          employee={selected.employee}
          baseSalary={selected.base}
          cargo={selected.cargo}
          onClose={() => setEditSalaryOpen(false)}
          onSave={async (salary) => {
            await rhService.gerarFolha({
              id_funcionario: Number(selected.employee.id),
              mes_referencia: month,
              salario_base: salary,
              horas_trabalhadas: 0,
              horas_extras: 0,
              valor_hora_extra: 0,
              descontos: 0,
              bonus: 0,
              status_pagamento: selected.status,
            });
            await refresh();
            setEditSalaryOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* -------------------- Subcomponentes -------------------- */

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground capitalize">{hint}</div>}
    </div>
  );
}

function MiniInfo({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
      ? "text-amber-700"
      : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: "pago" | "pendente" }) {
  const cls =
    status === "pago"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-amber-100 text-amber-700 border-amber-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "pago" ? "Pago" : "Pendente"}
    </span>
  );
}

function PaymentModal({
  employees,
  initial,
  defaultEmployeeId,
  onClose,
  onSave,
}: {
  employees: Employee[];
  initial: Payment | null;
  defaultEmployeeId?: string;
  onClose: () => void;
  onSave: (draft: DraftPayment) => void;
}) {
  const [draft, setDraft] = useState<DraftPayment>({
    employeeId: initial?.employeeId || defaultEmployeeId || employees[0]?.id || "",
    monthRef: initial?.monthRef || currentMonthRef(),
    amount: initial ? String(initial.amount) : "",
    paidAt: initial?.paidAt || format(new Date(), "yyyy-MM-dd"),
    note: initial?.note || "",
    status: initial?.status || "pago",
  });

  // Calculadora opcional: horas × valor por hora
  const [hours, setHours] = useState("");
  const [hourly, setHourly] = useState("");
  const calcTotal = (() => {
    const h = Number(hours.replace(",", "."));
    const r = Number(hourly.replace(",", "."));
    if (!h || !r) return 0;
    return h * r;
  })();

  return (
    <ModalShell
      title={initial ? "Editar pagamento" : "Adicionar pagamento"}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Funcionário" full>
          <select
            value={draft.employeeId}
            onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mês de referência">
          <input
            type="month"
            value={draft.monthRef}
            onChange={(e) => setDraft({ ...draft, monthRef: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          />
        </Field>
        <Field label="Valor (R$)">
          <input
            inputMode="decimal"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            placeholder="0,00"
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          />
        </Field>
        <Field label="Data do pagamento">
          <input
            type="date"
            value={draft.paidAt}
            onChange={(e) => setDraft({ ...draft, paidAt: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          />
        </Field>
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as "pago" | "pendente" })
            }
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </Field>
        <Field label="Observação (opcional)" full>
          <textarea
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Ex.: bônus de produtividade, adiantamento..."
          />
        </Field>
      </div>

      {/* Calculadora opcional por hora */}
      <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 p-3">
        <div className="mb-2 text-xs font-medium text-foreground">
          Calculadora opcional por hora
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Horas">
            <input
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0"
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            />
          </Field>
          <Field label="Valor / hora (R$)">
            <input
              inputMode="decimal"
              value={hourly}
              onChange={(e) => setHourly(e.target.value)}
              placeholder="0,00"
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            />
          </Field>
          <div className="flex flex-col justify-end">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Total
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">{formatBRL(calcTotal)}</div>
              <button
                type="button"
                disabled={calcTotal <= 0}
                onClick={() =>
                  setDraft({ ...draft, amount: calcTotal.toFixed(2).replace(".", ",") })
                }
                className="h-7 rounded-md bg-foreground px-2 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-40"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smartphone className="h-3.5 w-3.5" />
          O funcionário verá no app mobile
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
          >
            Salvar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function SalaryModal({
  employee,
  baseSalary,
  cargo,
  onClose,
  onSave,
}: {
  employee: Employee;
  baseSalary: number;
  cargo?: Cargo | null;
  onClose: () => void;
  onSave: (salary: number) => void;
}) {
  const [salary, setSalary] = useState(String(baseSalary));
  return (
    <ModalShell title={`Definir salário — ${employee.name}`} onClose={onClose}>
      <Field label="Salário base mensal (R$)" full>
        <input
          inputMode="decimal"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
        />
      </Field>
      {cargo && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Sugestão do {cargo.label}: <span className="font-semibold text-foreground">{formatBRL(cargo.baseSalary)}</span>
          </span>
          <button
            type="button"
            onClick={() => setSalary(String(cargo.baseSalary))}
            className="h-7 rounded-md bg-foreground px-2 text-[11px] font-medium text-background hover:opacity-90"
          >
            Aplicar
          </button>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(Number(salary.replace(",", ".")) || 0)}
          className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
        >
          Salvar
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

/* -------------------- helpers -------------------- */

function formatMonth(ref: string) {
  // ref = yyyy-MM
  const [y, m] = ref.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, "MMM/yyyy", { locale: ptBR });
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
