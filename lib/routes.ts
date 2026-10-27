/**
 * Paths of the notebook app. The app lives under /app; the site (landing
 * page and docs) owns the root of the domain.
 */
export const routes = {
  home: "/app",
  notebook: (id: string) => `/app/notebook/${id}`,
} as const;
