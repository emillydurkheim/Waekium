import { format } from "date-fns";

import { apiClient } from "@/services/api/client";
import type {
  DaySummary,
  OvertimeRequest,
  OvertimeStatus,
  Punch,
  PunchType,
} from "@/types/ponto";

const DEFAULT_EXPECTED_MIN = 8 * 60;

function dateKey(d: Date | string) {
  return typeof d === "string" ? d : format(d, "yyyy-MM-dd");
}

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const pontoService = {
  async listPunches(): Promise<Punch[]> {
    const history = await this.getHistory("0", 1, DEFAULT_EXPECTED_MIN);
    return history.flatMap((day) => day.punches);
  },

  async getDay(
    employeeId: string,
    date: Date | string,
    expectedMinutes: number = DEFAULT_EXPECTED_MIN,
  ): Promise<DaySummary> {
    const days = await this.getHistory(employeeId, 1, expectedMinutes, dateKey(date));
    return (
      days[0] ?? {
        date: dateKey(date),
        employeeId,
        punches: [],
        workedMinutes: 0,
        expectedMinutes,
        diffMinutes: -expectedMinutes,
      }
    );
  },

  async getHistory(
    employeeId: string,
    fromDays = 14,
    expectedMinutes: number = DEFAULT_EXPECTED_MIN,
    date?: string,
  ): Promise<DaySummary[]> {
    const query = toQuery({
      dias: fromDays,
      expected_minutes: expectedMinutes,
      data: date,
    });
    return apiClient.request<DaySummary[]>(`/ponto/historico/${employeeId}${query}`);
  },

  async punch(employeeId: string, type: PunchType, at: Date = new Date()): Promise<Punch> {
    const response = await apiClient.request<{
      sucesso: boolean;
      tipo: PunchType;
      hora_registrada: string;
    }>("/ponto", {
      method: "POST",
      body: JSON.stringify({
        id_user: Number(employeeId),
        tipo: type,
        data: format(at, "yyyy-MM-dd"),
        hora: format(at, "HH:mm:ss"),
      }),
    });

    return {
      id: `${employeeId}:${type}:${response.hora_registrada}`,
      employeeId,
      type,
      at: `${format(at, "yyyy-MM-dd")}T${response.hora_registrada}`,
    };
  },

  async deletePunch(_punchId: string): Promise<void> {
    throw new Error("Remover batida ainda nao esta disponivel no backend.");
  },

  async getBancoHoras(
    employeeId: string,
    days = 30,
    expectedMinutes: number = DEFAULT_EXPECTED_MIN,
  ): Promise<number> {
    const query = toQuery({
      dias: days,
      expected_minutes: expectedMinutes,
    });
    const data = await apiClient.request<{ saldo_minutos: number }>(
      `/ponto/banco/${employeeId}${query}`,
    );
    return data.saldo_minutos;
  },

  async listOvertime(): Promise<OvertimeRequest[]> {
    return apiClient.request<OvertimeRequest[]>("/horas-extras");
  },

  async requestOvertime(input: {
    employeeId: string;
    date: string;
    hours: number;
    reason?: string;
  }): Promise<OvertimeRequest> {
    return apiClient.request<OvertimeRequest>("/horas-extras", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async reviewOvertime(
    requestId: string,
    status: Exclude<OvertimeStatus, "pendente">,
    reviewerId = "1",
  ): Promise<void> {
    await apiClient.request<{ status: string }>(`/horas-extras/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reviewerId }),
    });
  },

  async deleteOvertime(requestId: string): Promise<void> {
    await apiClient.request<{ status: string }>(`/horas-extras/${requestId}`, {
      method: "DELETE",
    });
  },
};

export function formatMinutes(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
}
