// Modal de cadastro de uma nova rota.

import { useState } from "react";
import { X, MapPin, Link2 } from "lucide-react";
import type { Employee } from "@/lib/storage";
import type { NovaRotaInput } from "@/types/rota";

export type RouteFormModalProps = {
  employees: Employee[];
  onClose: () => void;
  onSubmit: (data: NovaRotaInput) => void;
};

export function RouteFormModal({ employees, onClose, onSubmit }: RouteFormModalProps) {
  const motoristas = employees.filter(
    (e) => (e.cargoId ?? "cargo_1") === "cargo_1" || /motorista/i.test(e.role),
  );
  const lista = motoristas.length > 0 ? motoristas : employees;

  const [nome, setNome] = useState("");
  const [motoristaId, setMotoristaId] = useState(lista[0]?.id ?? "");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");

  const [paradas, setParadas] = useState([
    {
      nome_local: "",
      endereco: "",
      horario: "",
    },
  ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !motoristaId || !origem.trim() || !destino.trim()) return;
    onSubmit({
      nome: nome.trim(),
      motoristaId,
      origem: origem.trim(),
      destino: destino.trim(),

      paradas,

      mapsUrl: mapsUrl.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      data: data || undefined,
      horario: horario || undefined,
    });
  }

  function addParada() {
    setParadas((prev) => [
      ...prev,
      {
        nome_local: "",
        endereco: "",
        horario: "",
      },
    ]);
  }

  function updateParada(
    index: number,
    field: string,
    value: string
  ) {
    setParadas((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, [field]: value }
          : p
      )
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <MapPin className="h-4 w-4" /> Nova rota
            </h3>
            <p className="text-xs text-muted-foreground">
              A rota será disponibilizada para o motorista no app mobile.
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

        <div className="grid grid-cols-2 gap-3">
          <Field className="col-span-2" label="Nome da rota" value={nome} onChange={setNome} placeholder="Ex: Entrega Centro - SP" required />

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Motorista responsável
            </span>
            <select
              value={motoristaId}
              onChange={(e) => setMotoristaId(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              required
            >
              {lista.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.role}
                </option>
              ))}
            </select>
          </label>

          <Field label="Endereço de origem" value={origem} onChange={setOrigem} placeholder="Rua, nº — Cidade" required />
          <Field label="Endereço de destino" value={destino} onChange={setDestino} placeholder="Rua, nº — Cidade" required />

          <Field label="Data" type="date" value={data} onChange={setData} />
          <Field label="Horário" type="time" value={horario} onChange={setHorario} />

          <div className="col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Paradas
              </span>

              <button
                type="button"
                onClick={addParada}
                className="rounded-md border px-2 py-1 text-xs"
              >
                + Adicionar parada
              </button>
            </div>

            <div className="space-y-3">
              {paradas.map((parada, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3"
                >
                  <Field
                    label={`Local ${index + 1}`}
                    value={parada.nome_local}
                    onChange={(v) =>
                      updateParada(
                        index,
                        "nome_local",
                        v
                      )
                    }
                  />

                  <Field
                    label="Endereço"
                    value={parada.endereco}
                    onChange={(v) =>
                      updateParada(
                        index,
                        "endereco",
                        v
                      )
                    }
                  />

                  <Field
                    label="Horário"
                    type="time"
                    value={parada.horario}
                    onChange={(v) =>
                      updateParada(
                        index,
                        "horario",
                        v
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="col-span-2 block">
            <span className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" /> Link Google Maps ou coordenadas (opcional)
            </span>
            <input
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/... ou -23.5505,-46.6333"
              className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              Se vazio, será gerado automaticamente a partir de origem/destino.
            </span>
          </label>

          <label className="col-span-2 block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Observações
            </span>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Instruções para o motorista..."
              className="w-full resize-none rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </label>
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
            Cadastrar rota
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
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
