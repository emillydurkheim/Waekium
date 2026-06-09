import { apiClient } from "@/services/api/client";

export type AgendaStatus = "pendente" | "cancelado" | "finalizado" | string;

export type AgendaResponse = {
  id_agenda: number;
  id_funcionario: number;
  tipo: string;
  titulo: string;
  descricao: string | null;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  data: string;
  horario: string | null;
  status: AgendaStatus;
  criado_por?: number | null;
  rotas?: Array<{
    id_rota: number;
    nome_rota: string;
    descricao: string | null;
    ordem: number | null;
    origem?: string | null;
    destino?: string | null;
    maps_url?: string | null;
    status?: string;
    paradas: Array<Record<string, string | number | null>>;
  }>;
};

export type CriarAgendaInput = {
  id_funcionario: number;
  tipo: string;
  titulo: string;
  descricao?: string;
  endereco: string;
  latitude?: number | null;
  longitude?: number | null;
  data: string;
  horario?: string;
  status?: string;
  criado_por?: number;
};

export async function criarEvento(evento: CriarAgendaInput): Promise<AgendaResponse> {
  return apiClient.request<AgendaResponse>("/agenda", {
    method: "POST",
    body: JSON.stringify(evento),
  });
}

export async function listarAgenda(id_funcionario: number): Promise<AgendaResponse[]> {
  return apiClient.request<AgendaResponse[]>(`/agenda/${id_funcionario}`);
}

export async function atualizarStatusAgenda(
  id_agenda: number,
  status: string,
): Promise<{ status: string }> {
  return apiClient.request<{ status: string }>(`/agenda/status/${id_agenda}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function editarAgenda(
  id_agenda: number,
  evento: Partial<CriarAgendaInput>,
): Promise<AgendaResponse> {
  return apiClient.request<AgendaResponse>(`/agenda/${id_agenda}`, {
    method: "PUT",
    body: JSON.stringify(evento),
  });
}

export async function excluirAgenda(id_agenda: number): Promise<{ status: string }> {
  return apiClient.request<{ status: string }>(`/agenda/${id_agenda}`, {
    method: "DELETE",
  });
}

export async function listarAgendaCompleta(id_funcionario: number): Promise<AgendaResponse[]> {
  return apiClient.request<AgendaResponse[]>(`/agenda/completa/${id_funcionario}`);
}

export const agendaService = {
  criarEvento,
  listarAgenda,
  atualizarStatusAgenda,
  editarAgenda,
  excluirAgenda,
  listarAgendaCompleta,
};
