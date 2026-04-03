import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/layouts/AppShell";
import { ArchiveRoute } from "@/features/archive/routes/ArchiveRoute";
import { AuthGuard } from "@/features/auth/AuthGuard";
import { LoginRoute } from "@/features/auth/routes/LoginRoute";
import { CatDetailRoute } from "@/features/cats/routes/CatDetailRoute";
import { CatsRoute } from "@/features/cats/routes/CatsRoute";
import { ProcessDetailRoute } from "@/features/processes/routes/ProcessDetailRoute";
import { CategoriesRoute } from "@/features/settings/routes/CategoriesRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: <AuthGuard />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="/cats" replace />,
          },
          {
            path: "/cats",
            element: <CatsRoute />,
          },
          {
            path: "/cats/:catId",
            element: <CatDetailRoute />,
          },
          {
            path: "/cats/:catId/processes/:processId",
            element: <ProcessDetailRoute />,
          },
          {
            path: "/archive",
            element: <ArchiveRoute />,
          },
          {
            path: "/settings/categories",
            element: <CategoriesRoute />,
          },
        ],
      },
    ],
  },
]);
