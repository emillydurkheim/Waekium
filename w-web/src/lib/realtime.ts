// Realtime store (mock) — simula ações vindas do app mobile dos funcionários.
// Estrutura preparada para futura troca por WebSocket / API real.

import { format } from "date-fns"; // função para formatar datas

// tipos de status

// status possíveis das entregas
export type DeliveryStatus =
  | "em_rota"
  | "finalizado"
  | "aguardando"
  | "livre";

// status possíveis dos funcionários
export type EmployeeStatus =
  | "em_transito"
  | "disponivel"
  | "offline"
  | "ferias"
  | "suspenso";

// tipagem entrega

export type Delivery = {
  id: string; // id interno da entrega
  orderId: string; // número do pedido
  employeeId: string; // funcionário responsável
  client: string; // nome cliente
  route: string; // rota
  startedAt: string; // horário início
  status: DeliveryStatus; // status atual
};

// tipagem funcionário realtime
export type EmployeeRuntime = {
  id: string; // id funcionário
  status: EmployeeStatus; // status atual
  lastActivity: string; // última atividade
  lastSeen: number; // timestamp último acesso
  currentDeliveryId?: string; // entrega atual opcional
};

// tipagem histórico
export type ActivityEntry = {
  id: string; // id atividade
  ts: number; // timestamp
  time: string; // horário
  date: string; // data
  kind:
    | "rota_iniciada"
    | "entrega_finalizada"
    | "ponto"
    | "status"; // tipo atividade

  employeeId?: string; // funcionário opcional
  deliveryId?: string; // entrega opcional
  message: string; // mensagem atividade
};

// tipagem notificações

export type Notification = {
  id: string; // id notificação
  ts: number; // timestamp
  kind: "info" | "success" | "warning"; // tipo
  message: string; // mensagem
  read: boolean; // lida?
};

// estrutura principal store

type State = {
  deliveries: Delivery[]; // entregas
  employees: Record<string, EmployeeRuntime>; // funcionários
  activity: ActivityEntry[]; // histórico
  notifications: Notification[]; // notificações
};

// estado inicial

const initial: State = {
  deliveries: [],
  employees: {},
  activity: [],
  notifications: [],
};

// store global 

// cria cópia do estado inicial
let state: State = JSON.parse(JSON.stringify(initial));

// listeners inscritos
const listeners = new Set<() => void>();

// dispara atualização

function emit() {
  state = { ...state }; // nova referência
  listeners.forEach((l) => l()); // executa listeners
}

// pega data/hora atual

function nowParts() {
  const d = new Date();

  return {
    ts: d.getTime(),

    time: `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`,

    date: format(d, "yyyy-MM-dd"),
  };
}

// =========================
// ADICIONA HISTÓRICO
// =========================

function pushActivity(
  entry: Omit<ActivityEntry, "id" | "ts" | "time" | "date">
) {
  const np = nowParts();

  state.activity = [
    {
      id: `a_${np.ts}_${Math.random().toString(36).slice(2, 7)}`,
      ...np,
      ...entry,
    },

    ...state.activity,
  ].slice(0, 200); // mantém máximo 200
}

// =========================
// ADICIONA NOTIFICAÇÃO
// =========================

function pushNotif(kind: Notification["kind"], message: string) {
  state.notifications = [
    {
      id: `n_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 6)}`,

      ts: Date.now(),
      kind,
      message,
      read: false,
    },

    ...state.notifications,
  ].slice(0, 30); // máximo 30
}

// =========================
// EXPORT PRINCIPAL REALTIME
// =========================

export const realtime = {
  // retorna estado atual
  getState: () => state,

  refresh: () => {
    emit(); // dispara atualização global
  },

  // =========================
  // SUBSCRIBE
  // =========================

  subscribe: (fn: () => void) => {
    listeners.add(fn);

    return () => listeners.delete(fn);
  },

  // =========================
  // GARANTE FUNCIONÁRIO
  // =========================
  // ESSA FUNÇÃO FALTAVA
  // =========================

  ensureEmployee: (employeeId: string) => {
    // se já existir, cancela
    if (state.employees[employeeId]) return;

    // cria funcionário padrão
    state.employees[employeeId] = {
      id: employeeId,
      status: "offline",
      lastActivity: "Funcionário criado automaticamente",
      lastSeen: Date.now(),
    };

    // atualiza sistema
    emit();
  },

    // =========================
  // REMOVE FUNCIONÁRIO
  // =========================

  removeEmployee: (employeeId: string) => {
    // remove funcionário do realtime
    delete state.employees[employeeId];

    // remove vínculo das entregas
    state.deliveries = state.deliveries.map((d) =>
      d.employeeId === employeeId
        ? {
            ...d,
            status: "livre",
            employeeId: "unassigned", // evita quebrar filtros e renders
          }
        : d
    );

    // adiciona histórico
    pushActivity({
      kind: "status",
      employeeId,
      message: `Funcionário removido do sistema`,
    });

    // atualiza tudo
    emit();
  },

  // =========================
  // ALTERA STATUS FUNCIONÁRIO
  // =========================

  setEmployeeStatus: (
    employeeId: string,
    status: EmployeeStatus
  ) => {
    const e = state.employees[employeeId];

    // cancela se não existir
    if (!e) return;

    // atualiza status
    e.status = status;

    // atualiza atividade
    e.lastActivity = `Status alterado para "${status}"`;

    // atualiza horário
    e.lastSeen = Date.now();

    // salva histórico
    pushActivity({
      kind: "status",
      employeeId,
      message: `Status alterado para "${status}"`,
    });

    // atualiza sistema
    emit();
  },

  // =========================
  // MARCA NOTIFICAÇÕES COMO LIDAS
  // =========================

  markAllRead: () => {
    state.notifications = state.notifications.map((n) => ({
      ...n,
      read: true,
    }));

    emit();
  },

  // =========================
  // BATER PONTO
  // =========================

  punchIn: (employeeId: string) => {
    const e = state.employees[employeeId];

    if (!e) return;

    e.status = "disponivel";
    e.lastActivity = "Bateu ponto agora";
    e.lastSeen = Date.now();

    pushActivity({
      kind: "ponto",
      employeeId,
      message: `Funcionário bateu ponto`,
    });

    emit();
  },

  // =========================
  // INICIAR ROTA
  // =========================

  startRoute: (deliveryId: string) => {
    const d = state.deliveries.find((x) => x.id === deliveryId);

    if (!d) return;

    d.status = "em_rota";

    const np = nowParts();

    d.startedAt = np.time;

    const e = state.employees[d.employeeId];

    if (e) {
      e.status = "em_transito";
      e.lastActivity = `Iniciou rota ${d.route}`;
      e.lastSeen = Date.now();
      e.currentDeliveryId = d.id;
    }

    pushActivity({
      kind: "rota_iniciada",
      employeeId: d.employeeId,
      deliveryId: d.id,
      message: `Rota iniciada (${d.orderId} • ${d.route})`,
    });

    pushNotif(
      "info",
      `Pedido ${d.orderId} entrou em rota`
    );

    emit();
  },

  // =========================
  // FINALIZAR ENTREGA
  // =========================

  finishDelivery: (deliveryId: string) => {
    const d = state.deliveries.find((x) => x.id === deliveryId);

    if (!d) return;

    d.status = "finalizado";

    const e = state.employees[d.employeeId];

    if (e) {
      e.status = "disponivel";
      e.lastActivity = `Finalizou entrega ${d.orderId}`;
      e.lastSeen = Date.now();
      e.currentDeliveryId = undefined;
    }

    pushActivity({
      kind: "entrega_finalizada",
      employeeId: d.employeeId,
      deliveryId: d.id,
      message: `Entrega finalizada (${d.orderId})`,
    });

    pushNotif(
      "success",
      `Pedido ${d.orderId} finalizado`
    );

    emit();
  },

  // =========================
  // REABRIR ENTREGA
  // =========================

  reopenDelivery: (deliveryId: string) => {
    const d = state.deliveries.find((x) => x.id === deliveryId);

    if (!d) return;

    d.status = "aguardando";

    d.startedAt = "—";

    pushActivity({
      kind: "status",
      deliveryId: d.id,
      message: `Entrega ${d.orderId} reaberta como aguardando`,
    });

    emit();
  },
};

// =========================
// SIMULAÇÃO REALTIME
// =========================
// ESSA FUNÇÃO TAMBÉM FALTAVA
// =========================

let simulationStarted = false;

// inicia simulação automática
export function startRealtimeSimulation() {
  // evita iniciar várias vezes
  if (simulationStarted) return;

  simulationStarted = true;

  // executa a cada 15 segundos
  setInterval(() => {
    const deliveriesInRoute = state.deliveries.filter(
      (d) => d.status === "em_rota"
    );

    // pega entrega aleatória
    const random =
      deliveriesInRoute[
        Math.floor(Math.random() * deliveriesInRoute.length)
      ];

    // se existir, finaliza
    if (random) {
      realtime.finishDelivery(random.id);
    }
  }, 15000);
}