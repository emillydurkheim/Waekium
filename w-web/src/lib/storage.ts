import { format } from "date-fns";

export type AgendaEvent = {
  id: string;
  time: string; // HH:mm
  title: string;
  description?: string;
  tag?: string; // Entrega, Reunião, Organização...
};

export type EmployeeStatusValue =
  | "ativo"
  | "ferias"
  | "afastado"
  | "inativo";

export type Employee = {
  id: string;
  name: string;
  role: string; // descrição livre (ex: "Motorista São Paulo")
  cpf?: string;
  cargoId?: import("@/types/cargo").CargoId;
  phone?: string;
  email?: string;
  base?: string;
  photo?: string; // data URL (base64) — opcional
  salary?: number; // salário individual (sobrescreve o base do cargo)
  status?: EmployeeStatusValue; // status cadastral
  password?: string; // senha temporária inicial (substituível por hash no backend)
};

export const ADMIN_ID = "admin";

export const DEFAULT_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Carlos Mendes", role: "Motorista", cargoId: "cargo_1", cpf: "11122233344", phone: "+55 (11) 99001-1010", email: "carlos.mendes@waekium.com", base: "São Paulo — SP", status: "ativo" },
  { id: "e2", name: "Luis Antônio",  role: "Motorista", cargoId: "cargo_1", cpf: "22233344455", phone: "+55 (11) 99002-2020", email: "luis.antonio@waekium.com",  base: "São Paulo — SP", status: "ativo" },
  { id: "e3", name: "Karen Luz",     role: "ADM",       cargoId: "cargo_2", cpf: "33344455566", phone: "+55 (11) 99003-3030", email: "karen.luz@waekium.com",     base: "Campinas — SP",  status: "ativo" },
  { id: "e4", name: "José Bezerra",  role: "Motorista", cargoId: "cargo_1", cpf: "44455566677", phone: "+55 (11) 99004-4040", email: "jose.bezerra@waekium.com",  base: "Santos — SP",    status: "ativo" },
  { id: "e5", name: "Kauã Silva",    role: "Gerente",   cargoId: "cargo_3", cpf: "55566677788", phone: "+55 (11) 99005-5050", email: "kaua.silva@waekium.com",    base: "São Paulo — SP", status: "ativo" },
];

const STORAGE_KEY = "waekium.agendas.v1";
const EMP_KEY = "waekium.employees.v2";

type Store = Record<string, Record<string, AgendaEvent[]>>; // [ownerId][YYYY-MM-DD] = events

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function write(s: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function getEvents(ownerId: string, date: Date): AgendaEvent[] {
  const s = read();
  return s[ownerId]?.[dateKey(date)] ?? [];
}

export function addEvent(ownerId: string, date: Date, ev: AgendaEvent) {
  const s = read();
  const key = dateKey(date);
  s[ownerId] = s[ownerId] || {};
  s[ownerId][key] = [...(s[ownerId][key] || []), ev].sort((a, b) =>
    a.time.localeCompare(b.time),
  );
  write(s);
}

export function deleteEvent(ownerId: string, date: Date, id: string) {
  const s = read();
  const key = dateKey(date);
  if (!s[ownerId]?.[key]) return;
  s[ownerId][key] = s[ownerId][key].filter((e) => e.id !== id);
  write(s);
}

export function getDatesWithEvents(ownerId: string): string[] {
  const s = read();
  return Object.keys(s[ownerId] || {});
}

export function getEmployees(): Employee[] {
  if (typeof window === "undefined") return DEFAULT_EMPLOYEES;
  try {
    const raw = localStorage.getItem(EMP_KEY);
    if (!raw) return DEFAULT_EMPLOYEES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_EMPLOYEES;
    return parsed;
  } catch {
    return DEFAULT_EMPLOYEES;
  }
}

export function saveEmployees(list: Employee[]) {
  localStorage.setItem(EMP_KEY, JSON.stringify(list));
}

export function addEmployee(emp: Omit<Employee, "id"> & { id?: string }): Employee {
  const list = getEmployees();
  const id = emp.id || `e_${Date.now().toString(36)}`;
  const next: Employee = { ...emp, id };
  const updated = [...list, next];
  saveEmployees(updated);
  return next;
}

export function updateEmployee(id: string, patch: Partial<Omit<Employee, "id">>) {
  const list = getEmployees().map((e) => (e.id === id ? { ...e, ...patch } : e));
  saveEmployees(list);
}

export function deleteEmployee(id: string) {
  const list = getEmployees().filter((e) => e.id !== id);
  saveEmployees(list);
}

// =================== Financeiro ===================

export type PaymentStatus = "pago" | "pendente";

export type Payment = {
  id: string;
  employeeId: string;
  monthRef: string; // yyyy-MM
  amount: number;
  paidAt?: string; // yyyy-MM-dd
  note?: string;
  status: PaymentStatus;
  createdAt: number;
};

export type FinanceConfig = {
  // Por funcionário: salário/valor base mensal definido pelo administrador
  baseSalary: Record<string, number>;
};

const PAY_KEY = "waekium.payments.v1";
const FIN_KEY = "waekium.finance.v1";

const DEFAULT_FINANCE: FinanceConfig = {
  baseSalary: {
    e1: 3200,
    e2: 3000,
    e3: 2800,
    e4: 3100,
    e5: 2900,
  },
};

export function getPayments(): Payment[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PAY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePayments(list: Payment[]) {
  localStorage.setItem(PAY_KEY, JSON.stringify(list));
}

export function addPayment(input: Omit<Payment, "id" | "createdAt">): Payment {
  const list = getPayments();
  const p: Payment = {
    ...input,
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };
  savePayments([p, ...list]);
  return p;
}

export function updatePayment(id: string, patch: Partial<Omit<Payment, "id">>) {
  const list = getPayments().map((p) => (p.id === id ? { ...p, ...patch } : p));
  savePayments(list);
}

export function deletePayment(id: string) {
  savePayments(getPayments().filter((p) => p.id !== id));
}

export function getFinanceConfig(): FinanceConfig {
  if (typeof window === "undefined") return DEFAULT_FINANCE;
  try {
    const raw = localStorage.getItem(FIN_KEY);
    if (!raw) return DEFAULT_FINANCE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FINANCE, ...parsed };
  } catch {
    return DEFAULT_FINANCE;
  }
}

export function saveFinanceConfig(cfg: FinanceConfig) {
  localStorage.setItem(FIN_KEY, JSON.stringify(cfg));
}

export function setBaseSalary(employeeId: string, value: number) {
  const cfg = getFinanceConfig();
  cfg.baseSalary = { ...cfg.baseSalary, [employeeId]: value };
  saveFinanceConfig(cfg);
}


export function currentMonthRef(d: Date = new Date()): string {
  return format(d, "yyyy-MM");
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
