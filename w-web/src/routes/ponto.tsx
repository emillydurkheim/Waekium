import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  CalendarDays,
  Wallet,
  TimerReset,
  Check,
  X,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { funcionariosService } from "@/services/api/funcionarios";
import { pontoService, formatMinutes } from "@/services/api/ponto";
import { cargosService, expectedDailyMinutes } from "@/services/api/cargos";
import type { Cargo } from "@/types/cargo";
import {
  PUNCH_LABEL,
  PUNCH_ORDER,
  type DaySummary,
  type OvertimeRequest,
  type PunchType,
} from "@/types/ponto";

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
  cargoId?: string;
};

export const Route = createFileRoute("/ponto")({
  component: PontoPage,
  head: () => ({
    meta: [
      { title: "Ponto & Banco de Horas | Waekium ERP" },
      {
        name: "description",
        content:
          "Controle de ponto, histórico diário, banco de horas e aprovação de horas extras.",
      },
    ],
  }),
});

type Tab = "hoje" | "historico" | "banco" | "extras";

function PontoPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("hoje");
  const [today, setToday] = useState<DaySummary | null>(null);
  const [history, setHistory] = useState<DaySummary[]>([]);
  const [banco, setBanco] = useState<number>(0);
  const [overtime, setOvertime] = useState<OvertimeRequest[]>([]);
  const [tick, setTick] = useState(0);
  const [otModal, setOtModal] = useState(false);
  const [cargos, setCargos] = useState<Cargo[]>([]);

  // Carga inicial de funcionários + cargos
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
          cargoId: `cargo_${f.id_funcao}`, // Mapeamento dinâmico
        }));
        setEmployees(empList);
        if (!employeeId && empList[0]) setEmployeeId(empList[0].id);
      } catch (err) {
        console.error("Erro ao carregar funcionários:", err);
      }
    };

    loadData();
    cargosService.list().then(setCargos);
  }, []);

  const currentEmp = employees.find((e) => e.id === employeeId);
  const currentCargo = cargos.find((c) => c.id === currentEmp?.cargoId) ?? null;
  const expectedMin = expectedDailyMinutes(currentCargo);

  // Recarrega ao mudar funcionário/refresh
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    (async () => {
      const [d, h, b, ot] = await Promise.all([
        pontoService.getDay(employeeId, new Date(), expectedMin),
        pontoService.getHistory(employeeId, 14, expectedMin),
        pontoService.getBancoHoras(employeeId, 30, expectedMin),
        pontoService.listOvertime(),
      ]);
      if (!active) return;
      setToday(d);
      setHistory(h);
      setBanco(b);
      setOvertime(ot);
    })();
    return () => {
      active = false;
    };
  }, [employeeId, tick, expectedMin]);

  const refresh = () => setTick((t) => t + 1);

  const empOvertime = useMemo(
    () => overtime.filter((o) => o.employeeId === employeeId),
    [overtime, employeeId],
  );
  const pendingAll = useMemo(() => overtime.filter((o) => o.status === "pendente"), [overtime]);

  async function handlePunch(type: PunchType) {
    if (!employeeId) return;
    await pontoService.punch(employeeId, type);
    refresh();
  }

  async function handleDeletePunch(id: string) {
    await pontoService.deletePunch(id);
    refresh();
  }

  async function handleReview(id: string, status: "aprovado" | "rejeitado") {
    await pontoService.reviewOvertime(id, status);
    refresh();
  }

  const empName = employees.find((e) => e.id === employeeId)?.name ?? "";

  return (
    <div className="flex min-h-screen bg-card">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Ponto & Banco de Horas" />
        <main className="flex-1 bg-[var(--canvas)] p-4">
          <div className="flex flex-col gap-4">
            {/* Top bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Funcionário
                </label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="h-8 rounded-md border border-border bg-secondary/40 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {currentCargo && (
                  <span
                    className="rounded-md border px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      borderColor: currentCargo.color ?? "var(--border)",
                      color: currentCargo.color ?? "var(--foreground)",
                    }}
                    title={`Jornada esperada ${formatMinutes(expectedMin)}/dia`}
                  >
                    {currentCargo.label} · {formatMinutes(expectedMin)}/dia
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={refresh}
                  className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
                >
                  <RefreshCw className="h-3 w-3" /> Atualizar
                </button>
                <button
                  onClick={() => setOtModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background hover:opacity-90"
                >
                  <Plus className="h-3 w-3" /> Hora extra
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard
                icon={Clock}
                label="Trabalhado hoje"
                value={today ? formatMinutes(today.workedMinutes) : "—"}
                hint={today ? `Esperado ${formatMinutes(today.expectedMinutes)}` : ""}
              />
              <KpiCard
                icon={TimerReset}
                label="Saldo do dia"
                value={today ? formatMinutes(today.diffMinutes) : "—"}
                accent={today ? (today.diffMinutes >= 0 ? "pos" : "neg") : undefined}
              />
              <KpiCard
                icon={Wallet}
                label="Banco de horas (30d)"
                value={formatMinutes(banco)}
                accent={banco >= 0 ? "pos" : "neg"}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
              {(
                [
                  { id: "hoje", label: "Hoje", icon: Clock },
                  { id: "historico", label: "Histórico", icon: CalendarDays },
                  { id: "banco", label: "Banco de Horas", icon: Wallet },
                  { id: "extras", label: "Horas Extras", icon: TimerReset },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                const badge =
                  t.id === "extras" && pendingAll.length > 0 ? pendingAll.length : null;
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
                    {badge && (
                      <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] text-background">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {tab === "hoje" && today && (
              <TabHoje
                day={today}
                onPunch={handlePunch}
                onDelete={handleDeletePunch}
              />
            )}

            {tab === "historico" && <TabHistorico history={history} />}

            {tab === "banco" && <TabBanco banco={banco} history={history} empName={empName} />}

            {tab === "extras" && (
              <TabExtras
                requests={empOvertime}
                pendingAll={pendingAll}
                employees={employees}
                onReview={handleReview}
              />
            )}
          </div>
        </main>
      </div>

      {otModal && (
        <OvertimeModal
          employeeId={employeeId}
          onClose={() => setOtModal(false)}
          onSaved={() => {
            setOtModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: "pos" | "neg";
}) {
  const color =
    accent === "pos"
      ? "text-emerald-600"
      : accent === "neg"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

/* ================== HOJE ================== */
function TabHoje({
  day,
  onPunch,
  onDelete,
}: {
  day: DaySummary;
  onPunch: (t: PunchType) => void;
  onDelete: (id: string) => void;
}) {
  const has = (t: PunchType) => day.punches.some((p) => p.type === t);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Registrar batida</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {PUNCH_ORDER.map((t) => {
            const done = has(t);
            return (
              <button
                key={t}
                onClick={() => onPunch(t)}
                disabled={done}
                className={`rounded-lg border px-3 py-3 text-xs font-medium transition ${
                  done
                    ? "border-border bg-secondary/40 text-muted-foreground"
                    : "border-border bg-card text-foreground hover:bg-secondary"
                }`}
              >
                {PUNCH_LABEL[t]}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {done ? "Registrado" : "Tocar para registrar"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Batidas do dia</h3>
        {day.punches.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Nenhuma batida registrada hoje.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {day.punches.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-medium text-foreground">{PUNCH_LABEL[p.type]}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {format(parseISO(p.at), "HH:mm")}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ================== HISTÓRICO ================== */
function TabHistorico({ history }: { history: DaySummary[] }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">Últimos 14 dias</h3>
      </div>
      <div className="divide-y divide-border">
        {history.map((d) => (
          <div key={d.date} className="grid grid-cols-12 items-center gap-2 px-5 py-3 text-xs">
            <div className="col-span-3 font-medium text-foreground">
              {format(parseISO(d.date), "EEE dd/MM", { locale: ptBR })}
            </div>
            <div className="col-span-5 text-muted-foreground">
              {d.punches.length === 0
                ? "Sem registros"
                : d.punches
                    .map((p) => `${PUNCH_LABEL[p.type].slice(0, 3)} ${format(parseISO(p.at), "HH:mm")}`)
                    .join(" · ")}
            </div>
            <div className="col-span-2 text-right text-foreground">
              {formatMinutes(d.workedMinutes)}
            </div>
            <div
              className={`col-span-2 text-right font-medium ${
                d.punches.length === 0
                  ? "text-muted-foreground"
                  : d.diffMinutes >= 0
                    ? "text-emerald-600"
                    : "text-destructive"
              }`}
            >
              {d.punches.length === 0 ? "—" : formatMinutes(d.diffMinutes)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================== BANCO DE HORAS ================== */
function TabBanco({
  banco,
  history,
  empName,
}: {
  banco: number;
  history: DaySummary[];
  empName: string;
}) {
  const positivos = history.filter((d) => d.punches.length > 0 && d.diffMinutes > 0);
  const negativos = history.filter((d) => d.punches.length > 0 && d.diffMinutes < 0);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-5 md:col-span-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Saldo atual
        </div>
        <div
          className={`mt-2 text-3xl font-semibold ${
            banco >= 0 ? "text-emerald-600" : "text-destructive"
          }`}
        >
          {formatMinutes(banco)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Acumulado de {empName} nos últimos 30 dias.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-sm font-semibold text-foreground">Dias com crédito</h4>
        <div className="mt-2 text-2xl font-semibold text-foreground">{positivos.length}</div>
        <p className="text-xs text-muted-foreground">
          +{formatMinutes(positivos.reduce((a, d) => a + d.diffMinutes, 0))}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-sm font-semibold text-foreground">Dias com débito</h4>
        <div className="mt-2 text-2xl font-semibold text-foreground">{negativos.length}</div>
        <p className="text-xs text-destructive">
          {formatMinutes(negativos.reduce((a, d) => a + d.diffMinutes, 0))}
        </p>
      </div>
    </div>
  );
}

/* ================== HORAS EXTRAS ================== */
function TabExtras({
  requests,
  pendingAll,
  employees,
  onReview,
}: {
  requests: OvertimeRequest[];
  pendingAll: OvertimeRequest[];
  employees: Employee[];
  onReview: (id: string, status: "aprovado" | "rejeitado") => void;
}) {
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Solicitações do funcionário
          </h3>
        </div>
        <div className="divide-y divide-border">
          {requests.length === 0 ? (
            <p className="px-5 py-6 text-xs text-muted-foreground">Sem solicitações.</p>
          ) : (
            requests.map((r) => <OvertimeRow key={r.id} req={r} />)
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            Pendentes de aprovação (ADM)
          </h3>
        </div>
        <div className="divide-y divide-border">
          {pendingAll.length === 0 ? (
            <p className="px-5 py-6 text-xs text-muted-foreground">Nada pendente.</p>
          ) : (
            pendingAll.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-xs">
                <div>
                  <div className="font-medium text-foreground">{nameOf(r.employeeId)}</div>
                  <div className="text-muted-foreground">
                    {format(parseISO(r.date), "dd/MM/yyyy")} · {r.hours}h
                    {r.reason ? ` — ${r.reason}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onReview(r.id, "aprovado")}
                    className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50"
                  >
                    <Check className="h-3 w-3" /> Aprovar
                  </button>
                  <button
                    onClick={() => onReview(r.id, "rejeitado")}
                    className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3 w-3" /> Rejeitar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function OvertimeRow({ req }: { req: OvertimeRequest }) {
  const colors: Record<OvertimeRequest["status"], string> = {
    pendente: "bg-amber-100 text-amber-800",
    aprovado: "bg-emerald-100 text-emerald-800",
    rejeitado: "bg-destructive/15 text-destructive",
  };
  return (
    <div className="flex items-center justify-between px-5 py-3 text-xs">
      <div>
        <div className="font-medium text-foreground">
          {format(parseISO(req.date), "dd/MM/yyyy")} · {req.hours}h
        </div>
        {req.reason && <div className="text-muted-foreground">{req.reason}</div>}
      </div>
      <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${colors[req.status]}`}>
        {req.status}
      </span>
    </div>
  );
}

/* ================== MODAL ================== */
function OvertimeModal({
  employeeId,
  onClose,
  onSaved,
}: {
  employeeId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hours, setHours] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!employeeId) return;
    const h = Number(hours);
    if (!h || h <= 0) return;
    setSaving(true);
    await pontoService.requestOvertime({ employeeId, date, hours: h, reason });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Solicitar hora extra</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-xs">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Data
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Horas
            </span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-foreground"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Motivo (opcional)
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-foreground"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90 disabled:opacity-60"
          >
            Solicitar
          </button>
        </div>
      </div>
    </div>
  );
}
