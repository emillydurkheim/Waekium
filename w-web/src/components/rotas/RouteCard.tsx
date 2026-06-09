// Card visual de uma rota cadastrada.

import { ExternalLink, MapPin, Trash2, User2, Clock, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import type { Rota, RotaStatus } from "@/types/rota";
import { buildMapsUrl } from "@/lib/rotasStorage";

const STATUS_LABEL: Record<RotaStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const STATUS_CLASS: Record<RotaStatus, string> = {
  pendente: "bg-amber-100 text-amber-700",
  em_andamento: "bg-sky-100 text-sky-700",
  finalizada: "bg-emerald-100 text-emerald-700",
  cancelada: "bg-rose-100 text-rose-700",
};

export type RouteCardProps = {
  rota: Rota;
  motoristaNome?: string;
  onDelete?: (id: string) => void;
  onChangeStatus?: (id: string, status: RotaStatus) => void;
};

export function RouteCard({ rota, motoristaNome, onDelete, onChangeStatus }: RouteCardProps) {
  const url = buildMapsUrl(rota);

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition hover:border-foreground/20">
      {/* topo: nome + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{rota.nome}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <User2 className="h-3 w-3" />
            <span className="truncate">{motoristaNome ?? "Motorista —"}</span>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[rota.status]}`}>
          {STATUS_LABEL[rota.status]}
        </span>
      </div>

      {/* origem -> destino */}
      <div className="space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Origem</div>
            <div className="truncate text-foreground">{rota.origem}</div>
          </div>
        </div>
        <div className="ml-1 h-3 border-l border-dashed border-border" />
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3 w-3 text-rose-500" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Destino</div>
            <div className="truncate text-foreground">{rota.destino}</div>
          </div>
        </div>
      </div>

      {/* meta */}
      {(rota.data || rota.horario) && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {rota.data ?? ""} {rota.horario ?? ""}
        </div>
      )}

      {rota.observacoes && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{rota.observacoes}</p>
      )}

      {/* ações */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background hover:opacity-90"
        >
          <ExternalLink className="h-3 w-3" /> Abrir rota
        </a>

        {onChangeStatus && rota.status === "pendente" && (
          <button
            onClick={() => onChangeStatus(rota.id, "em_andamento")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            <PlayCircle className="h-3 w-3" /> Iniciar
          </button>
        )}
        {onChangeStatus && rota.status === "em_andamento" && (
          <button
            onClick={() => onChangeStatus(rota.id, "finalizada")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-secondary"
          >
            <CheckCircle2 className="h-3 w-3" /> Finalizar
          </button>
        )}
        {onChangeStatus && rota.status !== "cancelada" && rota.status !== "finalizada" && (
          <button
            onClick={() => onChangeStatus(rota.id, "cancelada")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-secondary"
          >
            <XCircle className="h-3 w-3" /> Cancelar
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => onDelete(rota.id)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" /> Excluir
          </button>
        )}
      </div>
    </div>
  );
}
