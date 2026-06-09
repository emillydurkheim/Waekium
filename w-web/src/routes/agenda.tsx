import { createFileRoute } from "@tanstack/react-router"; // cria rota
import { useEffect, useState } from "react"; // hooks react
import { Sidebar } from "@/components/Sidebar"; // sidebar
import { Header } from "@/components/Header"; // header
import { EmployeeCard } from "@/components/EmployeeCard"; // card funcionário
import { AgendaPanel } from "@/components/AgendaPanel"; // painel agenda

import { useRealtime } from "@/hooks/useRealtime";
import { realtime } from "@/lib/realtime";

import { funcionariosService } from "@/services/api/funcionarios"; // API funcionários
import type { FuncionarioApi } from "@/services/api/funcionarios";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";

import {
  CalendarIcon,
  RefreshCw,
} from "lucide-react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { apiClient } from "@/services/api/client";

export function requireAuth() {
  const token = apiClient.getToken();

  if (!token) {
    window.location.href = "/login";
  }
}

// ID do administrador
const ADMIN_ID = "1";

// cria rota /agenda
export const Route = createFileRoute("/agenda")({
  component: AgendaPage,

  head: () => ({
    meta: [
      {
        title: "Agenda | Waekium ERP",
      },

      {
        name: "description",
        content:
          "Gerencie agendas de funcionários e administradores.",
      },
    ],
  }),
});

function AgendaPage() {
  // estado realtime
  useRealtime();

  // lista funcionários
  const [employees, setEmployees] =
    useState<FuncionarioApi[]>([]);

  // loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // funcionário selecionado
  const [selectedId, setSelectedId] =
    useState<number | null>(null);

  // data selecionada
  const [date, setDate] =
    useState<Date>(new Date());

  // quantidade funcionários realtime
  // (unused - realtime updates employees list)

  // carrega funcionários da API
  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await funcionariosService.listarFuncionarios();
      setEmployees(list);
      // seleciona primeiro funcionário como padrão
      if (list.length > 0 && selectedId === null) {
        setSelectedId(list[0].id_funcionario);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar funcionários");
      console.error("Erro ao carregar funcionários:", err);
    } finally {
      setLoading(false);
    }
  };

  // atualiza funcionários ao montar
  useEffect(() => {
    loadEmployees();
  }, []);

  // botão atualizar
  const handleRefresh = async () => {
    await loadEmployees();
    realtime.refresh();
  };

  // funcionário atual
  const selected = employees.find(
    (e) => e.id_funcionario === selectedId
  );

  return (
    <div className="flex min-h-screen bg-card">
      {/* sidebar */}
      <Sidebar />

      {/* conteúdo */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* header */}
        <Header title="Agenda" />

        {/* main */}
        <main className="flex-1 bg-[var(--canvas)] p-4">

          <div className="flex flex-col gap-4">

            {/* seção funcionários */}
            <section className="shrink-0 rounded-xl border border-border bg-card p-4">

              {/* topo */}
              <div className="mb-3 flex items-center justify-between">

                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Funcionários
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Selecione o funcionário
                  </p>
                </div>

                {/* ações */}
                <div className="flex items-center gap-2">

                  {/* botão atualizar */}
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />

                    Atualizar
                  </button>

                  {/* calendário */}
                  <Popover>

                    {/* ESSA PARTE FOI O BUG */}
                    {/* precisava de apenas 1 filho */}
                    <PopoverTrigger asChild>

                      <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-secondary">

                        <CalendarIcon className="h-3.5 w-3.5" />

                        {format(
                          date,
                          "dd/MM/yyyy",
                          {
                            locale: ptBR,
                          }
                        )}

                      </button>

                    </PopoverTrigger>

                    {/* conteúdo popover */}
                    <PopoverContent
                      align="end"
                      className="w-auto p-0"
                    >

                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                          if (d) {
                            setDate(d);
                          }
                        }}
                        initialFocus
                      />

                    </PopoverContent>

                  </Popover>

                </div>
              </div>

              {/* grid funcionários */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">

                {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {error && <p className="text-sm text-red-500">{error}</p>}
                
                {employees.map((e) => (
                  <EmployeeCard
                    key={e.id_funcionario}
                    employee={{
                      id: String(e.id_funcionario),
                      name: e.nome,
                      role: e.nome_funcao || "Funcionário",
                      cpf: e.cpf,
                      email: e.email,
                      phone: e.telefone || undefined,
                      status: e.ativo ? "ativo" : "inativo",
                    }}
                    selected={
                      e.id_funcionario === selectedId
                    }
                    onClick={() =>
                      setSelectedId(e.id_funcionario)
                    }
                  />
                ))}

              </div>
            </section>

            {/* agendas */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* agenda funcionário */}
              <AgendaPanel
                title="Agenda do dia"
                subtitle={selected?.nome}
                ownerId={selectedId ? String(selectedId) : "0"}
                date={date}
              />

              {/* agenda admin */}
              <AgendaPanel
                title="Agenda do Administrador"
                ownerId={ADMIN_ID}
                date={date}
              />

            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
