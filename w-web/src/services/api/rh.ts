import { apiClient } from "@/services/api/client";

export type PagamentoStatus = "pago" | "pendente";

export type FolhaPagamento = {
  id_rh: number;
  id_funcionario: number;
  mes_referencia: string;
  salario_base: number;
  horas_trabalhadas: number;
  horas_extras: number;
  valor_hora_extra: number;
  descontos: number;
  bonus: number;
  salario_final: number;
  status_pagamento: PagamentoStatus;
};

export type FolhaPagamentoInput = {
  id_funcionario: number;
  mes_referencia: string;
  salario_base?: number;
  horas_trabalhadas?: number;
  horas_extras?: number;
  valor_hora_extra?: number;
  descontos?: number;
  bonus?: number;
  status_pagamento?: PagamentoStatus;
};

export const rhService = {
  async gerarFolha(data: FolhaPagamentoInput): Promise<FolhaPagamento> {
    return apiClient.request<FolhaPagamento>("/rh/folha", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async atualizarFolha(
    idRh: number,
    data: Partial<FolhaPagamentoInput>,
  ): Promise<FolhaPagamento> {
    return apiClient.request<FolhaPagamento>(`/rh/folha/${idRh}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async listarFolhas(idFuncionario: number): Promise<FolhaPagamento[]> {
    return apiClient.request<FolhaPagamento[]>(`/rh/${idFuncionario}`);
  },

  async deletarFolha(idRh: number): Promise<{ status: string }> {
    return apiClient.request<{ status: string }>(`/rh/${idRh}`, {
      method: "DELETE",
    });
  },
};
