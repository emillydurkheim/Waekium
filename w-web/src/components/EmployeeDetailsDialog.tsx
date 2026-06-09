import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // componentes do modal

import { EmployeeBadge } from "@/components/StatusBadge"; // badge de status do funcionário

import type { Employee } from "@/lib/storage"; // tipagem Employee

import type { Delivery, EmployeeRuntime } from "@/lib/realtime"; // tipagens de rota e status em tempo real

import { getEvents } from "@/lib/storage"; // função que pega eventos

import { format } from "date-fns"; // formata datas

import { ptBR } from "date-fns/locale"; // deixa data em português

import { Link } from "@tanstack/react-router"; // link de navegação

export function EmployeeDetailsDialog({ // componente modal detalhes funcionário

  employee, // funcionário
  runtime, // dados em tempo real
  delivery, // rota/entrega
  open, // modal aberto ou fechado
  onOpenChange, // função alterar modal

}: {
  employee: Employee | null; // funcionário ou null
  runtime?: EmployeeRuntime; // dados opcionais
  delivery?: Delivery; // entrega opcional
  open: boolean; // true ou false
  onOpenChange: (v: boolean) => void; // função abrir/fechar
}) {

  if (!employee) return null; // se não existir funcionário, não renderiza nada

  const today = new Date(); // pega data atual

  const events = getEvents(employee.id, today); // pega eventos do funcionário hoje

  return (
    <Dialog open={open} onOpenChange={onOpenChange}> {/* modal */}

      <DialogContent> {/* conteúdo modal */}

        <DialogHeader> {/* cabeçalho */}

          <DialogTitle className="flex items-center gap-3"> {/* título */}

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground">
              {employee.name.charAt(0)} {/* primeira letra do nome */}
            </div>

            <div>

              <div className="text-base">
                {employee.name} {/* nome funcionário */}
              </div>

              <div className="text-xs font-normal text-muted-foreground">
                {employee.role} {/* cargo funcionário */}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4"> {/* área das informações */}

          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">

            <span className="text-xs text-muted-foreground">
              Status atual
            </span>

            {runtime ? ( // se existir status

              <EmployeeBadge status={runtime.status as any} /> // mostra badge

            ) : (

              <span className="text-xs">—</span> // se não tiver status
            )}
          </div>

          <div>

            <div className="text-xs font-semibold text-muted-foreground">
              Última atividade
            </div>

            <p className="mt-1 text-sm text-foreground">
              {runtime?.lastActivity ?? "Sem registros"} {/* última atividade */}
            </p>
          </div>

          {delivery && ( // mostra rota se existir entrega

            <div>

              <div className="text-xs font-semibold text-muted-foreground">
                Rota atual
              </div>

              <div className="mt-1 rounded-lg border border-border p-3">

                <div className="text-sm font-medium text-foreground">
                  {delivery.route} {/* nome rota */}
                </div>

                <div className="text-xs text-muted-foreground">
                  {delivery.client} {/* cliente */} • Pedido #{delivery.orderId} {/* id pedido */} • Iniciada às {delivery.startedAt} {/* horário */}
                </div>
              </div>
            </div>
          )}

          <div>

            <div className="mb-2 flex items-center justify-between">

              <div className="text-xs font-semibold text-muted-foreground">

                Agenda — {format(today, "dd 'de' MMMM", { locale: ptBR })} {/* data formatada */}
              </div>

              <Link
                to="/agenda" // página agenda
                className="text-xs font-medium text-foreground hover:underline"
              >
                Abrir agenda
              </Link>
            </div>

            {events.length === 0 ? ( // se não tiver eventos

              <p className="text-xs text-muted-foreground">
                Nenhum evento agendado.
              </p>

            ) : ( // se tiver eventos

              <ul className="space-y-2">

                {events.slice(0, 4).map((ev) => ( // pega no máximo 4 eventos

                  <li
                    key={ev.id}
                    className="flex items-start gap-3 text-sm"
                  >

                    <span className="w-12 text-xs text-muted-foreground">
                      {ev.time} {/* horário */}
                    </span>

                    <span className="text-foreground">
                      {ev.title} {/* título */}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}