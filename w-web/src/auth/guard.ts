import { apiClient } from "@/services/api/client";

export function requireAuth() {
  const token = apiClient.getToken();

  if (!token) {
    window.location.href = "/login";
  }
}