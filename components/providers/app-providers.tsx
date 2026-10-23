"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Sheet } from "@/components/panelui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "./i18n-provider";

/** Everything the app needs around every page. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <TooltipProvider>
          {/* The page steps back while a sheet is open. */}
          <Sheet.Stage className="h-dvh">{children}</Sheet.Stage>
          <Toaster />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
