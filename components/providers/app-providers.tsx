import type { ReactNode } from "react";
import { AccountWatcher } from "@/components/account/welcome-dialog";
import { CloudSyncRunner } from "@/components/account/cloud-sync-runner";
import { CommandPalette } from "@/components/command/command-palette";
import { OnboardingGate } from "@/components/onboarding/onboarding";
import { PluginThemes } from "@/components/plugins/plugin-themes";
import { Sheet } from "@/components/panelui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UpdatesHost } from "@/components/updates/updates-host";
import { I18nProvider } from "./i18n-provider";
import { ThemeProvider } from "./theme-provider";

/** Everything the app needs around every page. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          {/* The page steps back while a sheet is open. */}
          <Sheet.Stage className="h-dvh">{children}</Sheet.Stage>
          <CommandPalette />
          <Toaster />
          <UpdatesHost />
          <AccountWatcher />
          <CloudSyncRunner />
          <PluginThemes />
          <OnboardingGate />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
