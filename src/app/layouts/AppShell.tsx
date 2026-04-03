import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  authStateQueryKey,
  currentProfileQueryKey,
  getCurrentProfile,
} from "@/data/queries";
import { supabase } from "@/lib/supabase/client";

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: currentProfileQueryKey,
    queryFn: getCurrentProfile,
  });

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
      queryClient.getMutationCache().clear();
      queryClient.setQueryData(authStateQueryKey, {
        session: null,
        isAuthorized: false,
      });
      navigate("/login", { replace: true });
    },
  });

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__eyebrow">Registro compartido</span>
          <div className="shell__title">Gatos App</div>
          <div className="muted">{profileQuery.data?.display_name ?? "Sesion"}</div>
        </div>
        <nav className="shell__nav">
          <NavLink to="/cats">Gatos</NavLink>
          <NavLink to="/archive">Archivo</NavLink>
          <NavLink to="/settings/categories">Categorias</NavLink>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => {
              void signOutMutation.mutateAsync();
            }}
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </nav>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
