/** Paths of the notebook app. */
export const routes = {
  home: "/",
  notebook: (id: string) => `/notebook/${id}`,
} as const;
