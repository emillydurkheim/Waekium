// Tipos do módulo de Ponto / Banco de Horas
// Estrutura simples — pronta para mapear endpoints REST:
//   GET  /ponto?employeeId&date
//   POST /ponto                (registrar batida)
//   GET  /ponto/historico?employeeId&from&to
//   GET  /ponto/banco?employeeId
//   GET  /horas-extras
//   POST /horas-extras         (solicitar)
//   PATCH /horas-extras/:id    (aprovar/rejeitar)

export type PunchType = "entrada" | "saida_almoco" | "volta_almoco" | "saida";

export type Punch = {
  id: string;
  employeeId: string;
  type: PunchType;
  /** ISO datetime */
  at: string;
};

export type DaySummary = {
  date: string; // yyyy-MM-dd
  employeeId: string;
  punches: Punch[];
  workedMinutes: number;
  expectedMinutes: number; // jornada esperada (do cargo / default 480)
  diffMinutes: number; // workedMinutes - expectedMinutes
};

export type OvertimeStatus = "pendente" | "aprovado" | "rejeitado";

export type OvertimeRequest = {
  id: string;
  employeeId: string;
  date: string; // yyyy-MM-dd
  hours: number;
  reason?: string;
  status: OvertimeStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
};

export const PUNCH_LABEL: Record<PunchType, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída almoço",
  volta_almoco: "Volta almoço",
  saida: "Saída",
};

export const PUNCH_ORDER: PunchType[] = ["entrada", "saida_almoco", "volta_almoco", "saida"];
