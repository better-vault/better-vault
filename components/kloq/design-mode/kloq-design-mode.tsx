"use client";

import * as React from "react";
import { DesignModeHint } from "./design-mode-hint";
import { DesignModeProvider, useDesignMode } from "./design-mode-provider";

const DesignModeOverlay = React.lazy(() =>
  import("./design-mode-overlay").then((m) => ({
    default: m.DesignModeOverlay,
  })),
);

function LazyOverlay(): React.ReactElement | null {
  const { enabled } = useDesignMode();
  if (!enabled) return null;
  return (
    <React.Suspense fallback={null}>
      <DesignModeOverlay />
    </React.Suspense>
  );
}

/** Standalone design mode: wrap any subtree to get the ⌥D panel and hover inspector. */
export function KloqDesignMode({
  children,
  hint = true,
}: {
  children?: React.ReactNode;
  hint?: boolean;
}) {
  return (
    <DesignModeProvider>
      {children}
      <LazyOverlay />
      {hint ? <DesignModeHint /> : null}
    </DesignModeProvider>
  );
}
