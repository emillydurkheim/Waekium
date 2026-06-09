import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { cargosService } from "@/services/api/cargos";
import type { Cargo } from "@/types/cargo";
import { Save, Loader2 } from "lucide-react";

import { apiClient } from "@/services/api/client";

export function requireAuth() {
  const token = apiClient.getToken();

  if (!token) {
    window.location.href = "/login";
  }
}

export const Route = createFileRoute("/cargos")({
  component: () => (
    <RequireAuth role="admin">
      <CargosPage />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Cargos | Waekium ERP" },
      { name: "description", content: "Configuração de cargos e regras financeiras." },
    ],
  }),
});

function CargosPage() {
  const [list, setList] = useState<Cargo[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    cargosService.list().then(setList);
  }, []);

  function update(id: string, patch: Partial<Cargo>) {
    setList((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
    <div className="flex min-h-screen bg-card">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header title="Cargos" />
        <main className="flex-1 bg-[var(--canvas)] p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Configuração de Cargos</h2>
            <p className="text-xs text-muted-foreground">
              Quatro cargos fixos. Edite valores, hora normal, hora extra e limite mensal.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card p-5"
                style={{ borderTop: `3px solid ${c.color ?? "var(--border)"}` }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <input
                      value={c.label}
                      onChange={(e) => update(c.id, { label: e.target.value })}
                      className="border-none bg-transparent text-base font-semibold text-foreground focus:outline-none"
                    />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.id}
                    </div>
                  </div>
                  <input
                    type="color"
                    value={c.color ?? "#3b82f6"}
                    onChange={(e) => update(c.id, { color: e.target.value })}
                    className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
                    title="Cor identificadora"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <NumField
                    label="Salário base (R$)"
                    value={c.baseSalary}
                    onChange={(v) => update(c.id, { baseSalary: v })}
                  />
                  <NumField
                    label="Limite mensal (h)"
                    value={c.monthlyHourLimit}
                    onChange={(v) => update(c.id, { monthlyHourLimit: v })}
                  />
                  <NumField
                    label="Hora normal (R$)"
                    value={c.hourlyRate}
                    onChange={(v) => update(c.id, { hourlyRate: v })}
                  />
                  <NumField
                    label="Hora extra (R$)"
                    value={c.overtimeRate}
                    onChange={(v) => update(c.id, { overtimeRate: v })}
                  />
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => save(c)}
                    disabled={savingId === c.id}
                    className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:opacity-90 disabled:opacity-60"
                  >
                    {savingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salvar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
      />
    </label>
  );
}
