import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { agendaService, type AgendaResponse } from "@/services/api/agenda";

type Props = {
  idFuncionario: number;
  onClose: () => void;
};

export function CalendarView({ idFuncionario, onClose }: Props) {
  const [events, setEvents] = useState<AgendaResponse[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = new Date();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const data = await agendaService.listarAgendaCompleta(idFuncionario);
      setEvents(data);
    } catch (err) {
      console.error("Erro ao carregar calendário:", err);
    }
  }

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const eventsOfDay = (day: Date) =>
    events.filter((ev) => isSameDay(new Date(ev.data), day));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card rounded-xl border border-border p-4">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Calendário - {format(today, "MMMM yyyy", { locale: ptBR })}
          </h2>

          <button
            onClick={onClose}
            className="text-xs px-3 py-1 bg-foreground text-background rounded"
          >
            Fechar
          </button>
        </div>

        {/* GRID DO CALENDÁRIO */}
        <div className="grid grid-cols-7 gap-2 text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="text-center font-semibold text-muted-foreground">
              {d}
            </div>
          ))}

          {days.map((day) => {
            const dayEvents = eventsOfDay(day);

            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className="min-h-[80px] border border-border rounded p-1 cursor-pointer hover:bg-secondary/40"
              >
                <div className="text-[11px] font-medium">
                  {format(day, "d")}
                </div>

                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id_agenda}
                      className="text-[10px] bg-foreground text-background rounded px-1 truncate"
                    >
                      {ev.horario} {ev.titulo}
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayEvents.length - 2} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* DETALHE DO DIA */}
        {selectedDate && (
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-sm font-semibold">
              {format(selectedDate, "dd/MM/yyyy")}
            </h3>

            <div className="mt-2 space-y-2">
              {eventsOfDay(selectedDate).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum evento nesse dia
                </p>
              ) : (
                eventsOfDay(selectedDate).map((ev) => (
                  <div
                    key={ev.id_agenda}
                    className="text-xs border border-border rounded p-2"
                  >
                    <div className="font-medium">{ev.titulo}</div>
                    <div className="text-muted-foreground">
                      {ev.horario} • {ev.tipo}
                    </div>
                    {ev.descricao && (
                      <div className="text-muted-foreground">
                        {ev.descricao}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}