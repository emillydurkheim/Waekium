// Service de cargos — 3 cargos fixos, valores editáveis
// Substituível por endpoints REST: GET/PUT /cargos
import type { Cargo, CargoId } from "@/types/cargo";

const KEY = "waekium.cargos.v2";

const DEFAULTS: Cargo[] = [
  { id: "cargo_1", label: "Cargo 1", internalName: "Motorista", baseSalary: 2800, hourlyRate: 15, overtimeRate: 22, monthlyHourLimit: 220, color: "#3b82f6" },
  { id: "cargo_2", label: "Cargo 2", internalName: "ADM",       baseSalary: 3400, hourlyRate: 18, overtimeRate: 27, monthlyHourLimit: 220, color: "#10b981" },
  { id: "cargo_3", label: "Cargo 3", internalName: "Gerente",   baseSalary: 5000, hourlyRate: 25, overtimeRate: 38, monthlyHourLimit: 220, color: "#8b5cf6" },
];

function read(): Cargo[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Cargo[];
    return DEFAULTS.map((d) => ({ ...d, ...(parsed.find((p) => p.id === d.id) ?? {}) }));
  } catch {
    return DEFAULTS;
  }
}

function write(list: Cargo[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const cargosService = {
  async list(): Promise<Cargo[]> {
    return read();
  },
  async get(id: CargoId): Promise<Cargo | null> {
    return read().find((c) => c.id === id) ?? null;
  },
  async update(id: CargoId, patch: Partial<Omit<Cargo, "id">>): Promise<Cargo> {
    const list = read().map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(list);
    return list.find((c) => c.id === id)!;
  },
};

/** Minutos esperados por dia útil (22 dias úteis no mês). */
export function expectedDailyMinutes(cargo: Cargo | null | undefined): number {
  if (!cargo || !cargo.monthlyHourLimit) return 8 * 60;
  return Math.round((cargo.monthlyHourLimit * 60) / 22);
}

/** Valor do banco de horas: minutos positivos × valor hora extra. */
export function bancoHorasValue(cargo: Cargo | null | undefined, minutes: number): number {
  if (!cargo || minutes <= 0) return 0;
  return (minutes / 60) * cargo.overtimeRate;
}
