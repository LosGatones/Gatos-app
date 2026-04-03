import { ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import {
  authStateQueryKey,
  getAuthorizationStateForSession,
} from "@/data/queries";
import { supabase } from "@/lib/supabase/client";

function clearSessionState(queryClient: QueryClient) {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "auth",
  });
  queryClient.getMutationCache().clear();
}

function AuthStateSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    async function applySignedOutState() {
      await queryClient.cancelQueries();
      clearSessionState(queryClient);
      queryClient.setQueryData(authStateQueryKey, {
        session: null,
        isAuthorized: false,
      });
      await router.navigate("/login", { replace: true });
    }

    async function syncSession(session: Session | null) {
      if (!active) {
        return;
      }

      if (!session) {
        await applySignedOutState();
        return;
      }

      try {
        const nextAuthState = await getAuthorizationStateForSession(session);

        if (!active) {
          return;
        }

        queryClient.setQueryData(authStateQueryKey, nextAuthState);
      } catch {
        if (!active) {
          return;
        }

        await applySignedOutState();
      }
    }

    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        await applySignedOutState();
        return;
      }

      await syncSession(data.session);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void applySignedOutState();
        return;
      }

      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return null;
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthStateSync />
      {children}
    </QueryClientProvider>
  );
}

export function AppProviders() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
