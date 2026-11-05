"use client";

import { type ComponentType, createContext, useContext } from "react";

/**
 * Where base-ui portals render. `<Kloq>` provides a body-level container that
 * carries `data-kloq-root`, so menus, popovers and dialogs keep the calendar's
 * tokens instead of inheriting the host page's. Null until mounted (SSR) —
 * base-ui then falls back to `document.body`, which is what it did before.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}

type PortalLike = { container?: unknown; children?: React.ReactNode };

/** A base-ui `Portal` that defaults `container` to the calendar's. */
export function ScopedPortal<P extends PortalLike>({
  as: Portal,
  ...props
}: { as: ComponentType<P> } & P): React.ReactElement {
  const container = usePortalContainer();
  const merged = { container: container ?? undefined, ...props } as unknown as P;
  return <Portal {...merged} />;
}
