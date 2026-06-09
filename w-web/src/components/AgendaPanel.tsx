import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";

import { agendaService, type AgendaResponse } from "@/services/api/agenda";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgendaPanelProps = {
  title: string;
  subtitle?: string;
  ownerId: string;
  date: Date;
  onOpenCalendar?: () => void;
};

export function AgendaPanel({
  title,
  subtitle,
  ownerId,
  date,
}: AgendaPanelProps) {
  const [events, setEvents] = useState<AgendaResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);

  const [time, setTime] = useState("08:00");
  const [text, setText] = useState("");
  const [desc, setDesc] = useState("");
  const [tag, setTag] = useState("Reunião");

  const idFuncionario = parseInt(ownerId, 10);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // =============================
  // LOAD EVENTS (PROFISSIONAL)
  // =============================
  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await agendaService.listarAgenda(idFuncionario);

      const filtered = data.filter(
        (event) =>
          event.data === format(date, "yyyy-MM-dd") &&
          event.status !== "cancelado"
      );

      setEvents(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar eventos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [ownerId, date]);

  // =============================
  // ADD EVENT (OTIMIZADO)
  // =============================
  const handleAdd = async () => {
    if (!text.trim()) return;

    try {
      const newEvent = await agendaService.criarEvento({
        id_funcionario: idFuncionario,
        tipo: tag,
        titulo: text.trim(),
        descricao: desc.trim() || undefined,
        data: format(date, "yyyy-MM-dd"),
        horario: time,
        endereco: "Local não especificado",
      });

      // adiciona instantaneamente no front (sem reload)
      setEvents((prev) => [
        ...prev,
        {
          id_agenda: newEvent.id_agenda,
          id_funcionario: idFuncionario,
          tipo: tag,
          titulo: text.trim(),
          descricao: desc || null,
          endereco: "Local não especificado",
          latitude: null,
          longitude: null,
          data: format(date, "yyyy-MM-dd"),
          horario: time,
          status: "pendente",
        },
      ]);

      setText("");
      setDesc("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar evento");
    }
  };

  // =============================
  // DELETE EVENT (INSTANTÂNEO)
  // =============================
  const handleDelete = async (id: number) => {
    try {
      await agendaService.atualizarStatusAgenda(id, "cancelado");

      // remove instantâneo do front
      setEvents((prev) =>
        prev.filter((event) => event.id_agenda !== id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover evento");
    }
  };

  return (
    <div className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">

      {/* HEADER */}
      <div className="flex items-start justify-between border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && (
              <span className="text-sm text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <button
          onClick={() => setCalendarOpen(true)}
          className="text-xs"
        >
          Ver calendário
        </button>
      </div>

      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6">
            <h2 className="text-sm font-bold">Calendário</h2>
            <p className="text-xs text-muted-foreground">
              Aqui você vai integrar seu calendário depois (full calendar ou agenda mensal).
            </p>

            <button
              onClick={() => setCalendarOpen(false)}
              className="mt-4 text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="flex-1 px-5 py-4">
        {error && <div className="text-xs text-red-500">{error}</div>}

        {loading ? (
          <div className="text-xs">Carregando...</div>
        ) : events.length === 0 ? (
          <div className="text-xs">Nenhum evento</div>
        ) : (
          <ul className="space-y-4">
            {events.map((ev) => (
              <li
                key={ev.id_agenda}
                className="grid grid-cols-[60px_1fr_auto_auto] gap-3"
              >
                <span className="text-xs">{ev.horario}</span>

                <div>
                  <div className="text-sm font-medium">{ev.titulo}</div>
                  {ev.descricao && (
                    <div className="text-xs text-muted-foreground">
                      {ev.descricao}
                    </div>
                  )}
                </div>

                <span className="text-xs">{ev.tipo}</span>

                <button onClick={() => handleDelete(ev.id_agenda)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex justify-between border-t px-5 py-3">
        <span className="text-xs">{events.length} eventos</span>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost">
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar evento</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Título"
              />
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descrição"
              />
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Tipo"
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
