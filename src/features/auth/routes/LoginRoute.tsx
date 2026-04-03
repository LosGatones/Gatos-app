import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { authStateQueryKey, getAuthorizationState } from "@/data/queries";
import { supabase } from "@/lib/supabase/client";

export function LoginRoute() {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const authQuery = useQuery({
    queryKey: authStateQueryKey,
    queryFn: getAuthorizationState,
  });

  const signInMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    },
    onError: (error) => {
      setLocalError(error.message);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    signInMutation.mutate();
  }

  const from =
    location.state &&
    typeof location.state === "object" &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/cats";

  if (authQuery.data?.session && authQuery.data.isAuthorized) {
    return <Navigate to={from} replace />;
  }

  const denied = Boolean(
    location.state &&
      typeof location.state === "object" &&
      "denied" in location.state &&
      location.state.denied,
  );

  return (
    <main className="shell__main">
      <section className="panel stack">
        <div>
          <h1>Acceso</h1>
          <p className="muted">Ingresa con tu cuenta autorizada.</p>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {denied ? <p className="error">Tu usuario no tiene acceso a esta app.</p> : null}
          {localError ? <p className="error">{localError}</p> : null}
          <div className="actions">
            <button className="button" type="submit" disabled={signInMutation.isPending}>
              {signInMutation.isPending ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
