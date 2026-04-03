import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authStateQueryKey, getAuthorizationState } from "@/data/queries";
import { supabase } from "@/lib/supabase/client";

export function AuthGuard() {
  const location = useLocation();
  const signOutRequestedRef = useRef(false);
  const authQuery = useQuery({
    queryKey: authStateQueryKey,
    queryFn: getAuthorizationState,
  });

  useEffect(() => {
    if (!authQuery.data?.session || authQuery.data.isAuthorized) {
      signOutRequestedRef.current = false;
      return;
    }

    if (!signOutRequestedRef.current) {
      signOutRequestedRef.current = true;
      void supabase.auth.signOut();
    }
  }, [authQuery.data?.isAuthorized, authQuery.data?.session]);

  if (authQuery.isLoading || (authQuery.isFetching && !authQuery.data)) {
    return (
      <section className="shell__main">
        <div className="panel">
          <p>Cargando...</p>
        </div>
      </section>
    );
  }

  if (!authQuery.data?.session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!authQuery.data.isAuthorized) {
    return <Navigate to="/login" replace state={{ denied: true }} />;
  }

  return <Outlet />;
}
