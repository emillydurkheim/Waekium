export type RotaStatus =
  | "pendente"
  | "em_andamento"
  | "finalizada"
  | "cancelada";

export type Parada = {
  id_parada?: number;
  id_rota?: number;

  nome_local: string;
  endereco: string;

  horario?: string;

  status?: string;

  ordem?: number;
};

export type Rota = {
  id: string;

  nome: string;

  motoristaId: string;

  origem: string;
  destino: string;

  paradas?: Parada[];

  observacoes?: string;
  mapsUrl?: string;

  data?: string;
  horario?: string;

  status: RotaStatus;

  createdAt: number;
  updatedAt: number;
};

export type NovaRotaInput =
  Omit<Rota, "id" | "status" | "createdAt" | "updatedAt"> & {
    status?: RotaStatus;
  };