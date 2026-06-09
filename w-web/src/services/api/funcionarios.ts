import { apiClient } from "@/services/api/client";

export type CriarInput = {
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  id_cid?: string;
  id_est?: string;
  id_funcao: string;
  senha: string;
  foto: File;
};

export type FuncionarioApi = {
  id_funcionario: number;
  nome: string;
  cpf: string;
  telefone: string | null;
  email: string;
  endereco?: string | null;
  cep?: string | null;
  id_cid: number | null;
  id_est: number | null;
  id_funcao: number;
  banco_horas_ativo?: number;
  ativo: number;
  nome_funcao: string;
  salario_funcao?: number;
  cidade?: string | null;
  estado?: string | null;
  tem_foto?: boolean;
};

export type CriarFuncionarioResponse = {
  status: "sucesso";
  id_funcionario: number;
  tem_foto: boolean;
};

function appendIfPresent(form: FormData, key: string, value?: string) {
  const text = value?.trim();
  if (text) form.append(key, text);
}

export async function criarFuncionario(input: CriarInput): Promise<CriarFuncionarioResponse> {
  if (!input.foto) {
    throw new Error("Foto nao enviada para o backend");
  }

  const form = new FormData();
  form.append("cpf", input.cpf);
  form.append("email", input.email);
  form.append("id_funcao", input.id_funcao);
  form.append("senha", input.senha);
  form.append("nome", input.nome);
  form.append("foto", input.foto);
  appendIfPresent(form, "telefone", input.telefone);
  appendIfPresent(form, "cidade", input.cidade);
  appendIfPresent(form, "estado", input.estado);
  appendIfPresent(form, "id_cid", input.id_cid);
  appendIfPresent(form, "id_est", input.id_est);

  return apiClient.request<CriarFuncionarioResponse>("/cadastrar", {
    method: "POST",
    body: form,
  });
}

export async function listarFuncionarios(): Promise<FuncionarioApi[]> {
  return apiClient.request<FuncionarioApi[]>("/funcionarios");
}

export async function excluirFuncionario(id: string): Promise<{ status: string }> {
  return apiClient.request<{ status: string }>(`/funcionarios/${id}`, {
    method: "DELETE",
  });
}

export const funcionariosService = {
  criarFuncionario,
  listarFuncionarios,
  excluirFuncionario,
};
