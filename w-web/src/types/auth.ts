// Tipos de autenticação — desacoplados do backend
// Estrutura preparada para JWT + endpoints REST próprios

// Roles previstos. "admin" e "gerente" têm os mesmos acessos no MVP,
// mas a separação permite restringir permissões no futuro sem refatorar.
export type UserRole = "admin" | "gerente" | "funcionario";

export type AuthUser = {
  id: string;
  username: string;
  cpf?: string;
  name: string;
  role: UserRole;
};

export type LoginPayload = {
  identifier: string; // CPF ou usuário
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

/** Roles considerados "gestão" (acesso total no MVP). */
export const MANAGEMENT_ROLES: UserRole[] = ["admin", "gerente"];

export function isManagement(role?: UserRole | null): boolean {
  return !!role && MANAGEMENT_ROLES.includes(role);
}
