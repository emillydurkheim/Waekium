import { apiClient } from "@/services/api/client";
import type { NovaRotaInput, Rota, RotaStatus } from "@/types/rota";

export async function listRotas(): Promise<Rota[]> {
  return apiClient.request<Rota[]>("/rotas");
}

export async function createRota(input: NovaRotaInput): Promise<Rota> {
  return apiClient.request<Rota>("/rotas", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateRota(id: string, data: Partial<Rota>): Promise<Rota> {
  return apiClient.request<Rota>(`/rotas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRota(id: string): Promise<void> {
  await apiClient.request<{ status: string }>(`/rotas/${id}`, {
    method: "DELETE",
  });
}

export async function setStatus(id: string, status: RotaStatus): Promise<void> {
  await apiClient.request<{ status: string }>(`/rotas/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export const rotasService = {
  list: listRotas,
  create: createRota,
  update: updateRota,
  remove: deleteRota,
  setStatus,
};
