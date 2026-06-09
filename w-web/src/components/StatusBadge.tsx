import type { EmployeeStatus as RuntimeEmployeeStatus } from "@/lib/realtime";

type DeliveryStatus = "em_rota" | "finalizado" | "aguardando" | "livre";

type EmployeeStatus =
  | RuntimeEmployeeStatus
  | "ativo"
  | "inativo"
  | "afastado";

const deliveryMap: Record<DeliveryStatus, { label: string; cls: string }> = {
  em_rota: { label: "Em transito", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  finalizado: { label: "Finalizado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  aguardando: { label: "Aguardando", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  livre: { label: "Livre", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const employeeMap: Record<EmployeeStatus, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ferias: { label: "Ferias", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  afastado: { label: "Afastado", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  inativo: { label: "Inativo", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  em_transito: { label: "Em transito", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  disponivel: { label: "Disponivel", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  offline: { label: "Offline", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  suspenso: { label: "Suspenso", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const config = deliveryMap[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

export function EmployeeBadge({ status }: { status: EmployeeStatus }) {
  const config = employeeMap[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
