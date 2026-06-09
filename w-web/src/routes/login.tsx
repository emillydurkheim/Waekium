import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {

  // auth context
  const { login, isAuthenticated } = useAuth();

  // navegação
  const navigate = useNavigate();

  // estados
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  // redireciona se já estiver logado
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated]);

  // submit login
  async function onSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");

    // validação simples
    if (!identifier || !password) {
      setError("Preencha os campos.");
      return;
    }

    setLoading(true);

    try {

      // login
      await login({
        identifier,
        password,
      });

      // vai dashboard
      navigate({ to: "/" });

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Erro login"
      );

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4">

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm"
      >

        {/* logo */}
        <div className="mb-8 text-center">

          <h1 className="text-3xl font-bold tracking-[0.25em]">
            WAEKIUM
          </h1>

          <p className="mt-1 text-xs tracking-[0.25em] text-muted-foreground">
            ERP LOGÍSTICO
          </p>
        </div>

        {/* inputs */}
        <div className="space-y-3">

          <input
            type="text"
            placeholder="Email"
            value={identifier}
            onChange={(e) =>
              setIdentifier(e.target.value)
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        {/* erro */}
        {error && (
          <div className="mt-3 text-center text-xs text-destructive">
            {error}
          </div>
        )}

        {/* botão */}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >

          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          Entrar
        </button>
      </form>
    </div>
  );
}
