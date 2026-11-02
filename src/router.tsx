import { createBrowserRouter, Outlet, useParams } from "react-router";
import { AppProviders } from "@/components/providers/app-providers";
import { routes } from "@/lib/routes";

/** The app's pages; their paths come from lib/routes.ts. Each page loads on first visit. */
export const router = createBrowserRouter([
  {
    element: (
      <AppProviders>
        <Outlet />
      </AppProviders>
    ),
    children: [
      {
        path: routes.home,
        lazy: async () => ({
          Component: (await import("@/components/home/notebook-home")).NotebookHome,
        }),
      },
      {
        path: routes.notebook(":id"),
        lazy: async () => {
          const { Workspace } = await import("@/components/workspace/workspace");
          function NotebookPage() {
            const { id = "" } = useParams();
            // A new key per notebook, so switching notebooks starts from a clean screen.
            return <Workspace key={id} notebookId={id} />;
          }
          return { Component: NotebookPage };
        },
      },
      {
        path: "*",
        lazy: async () => ({
          Component: (await import("@/components/home/notebook-home")).NotebookHome,
        }),
      },
    ],
  },
]);
