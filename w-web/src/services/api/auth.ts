import { apiClient } from "@/services/api/client";
import type { AuthUser, LoginPayload, LoginResponse, UserRole } from "@/types/auth";

const SESSION_KEY = "waekium.auth.session.v1";

type BackendLoginResponse = {
  status: string;
  token: string;
  user: {
    id: number | string;
    nome: string;
    email: string;
    roles: string[];
  };
};

function mapRole(roles: string[]): UserRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("gerente")) return "gerente";
  return "funcionario";
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const data = await apiClient.request<BackendLoginResponse>("/login", {
      method: "POST",
      body: JSON.stringify({
        email: payload.identifier,
        senha: payload.password,
      }),
    });

    const loginResponse: LoginResponse = {
      token: data.token,
      user: {
        id: String(data.user.id),
        username: data.user.email || data.user.nome,
        cpf: "",
        name: data.user.nome,
        role: mapRole(data.user.roles || []),
      },
    };

    apiClient.setToken(loginResponse.token);
    this.persist(loginResponse);

    return loginResponse;
  },

  async me(): Promise<AuthUser | null> {
    const session = this.read();
    return session?.user || null;
  },

  async logout() {
    apiClient.setToken(null);
    localStorage.removeItem(SESSION_KEY);
  },

  persist(data: LoginResponse) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  },

  read(): LoginResponse | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as LoginResponse;
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    return apiClient.getToken();
  },
};
