import { apiClient } from "@/services/api/client";
import type { Parada } from "@/types/rota";

export type CriarParadaInput = Omit<Parada, "id_parada"> & {
  id_rota: number;
};

export const paradasService = {
  async listar(idRota: string): Promise<Parada[]> {
    return apiClient.request<Parada[]>(`/paradas/rota/${idRota}`);
  },

  async criar(data: CriarParadaInput): Promise<Parada> {
    return apiClient.request<Parada>("/paradas", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async atualizar(idParada: string, data: Partial<Parada>): Promise<Parada> {
    return apiClient.request<Parada>(`/paradas/${idParada}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async remover(idParada: string): Promise<void> {
    await apiClient.request<{ status: string }>(`/paradas/${idParada}`, {
      method: "DELETE",
    });
  },
};
