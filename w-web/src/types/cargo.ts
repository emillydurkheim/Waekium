// Cargos do sistema (3 cargos fixos)
// Internamente: cargo_1 = Motorista, cargo_2 = ADM, cargo_3 = Gerente

export type CargoId = "cargo_1" | "cargo_2" | "cargo_3";

export type Cargo = {
  id: CargoId;
  label: string; // "Cargo 1", "Cargo 2", "Cargo 3"
  internalName: string; // Motorista | ADM | Gerente
  baseSalary: number;
  hourlyRate: number;
  overtimeRate: number;
  monthlyHourLimit: number;
  color?: string;
};

export const CARGO_IDS: CargoId[] = ["cargo_1", "cargo_2", "cargo_3"];

export const CARGO_INTERNAL: Record<CargoId, string> = {
  cargo_1: "Motorista",
  cargo_2: "ADM",
  cargo_3: "Gerente",
};
