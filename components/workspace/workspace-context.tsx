"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Notebook } from "@/lib/db/database";

export type WorkspaceTab = "chat" | "sources" | "studio";

interface WorkspaceState {
  notebook: Notebook;
  tab: WorkspaceTab;
  setTab: (tab: WorkspaceTab) => void;
  /** The Studio output shown in the Studio tab. */
  openOutputId: string | null;
  openOutput: (id: string) => void;
  closeOutput: () => void;
  studioOpen: boolean;
  setStudioOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  addSourceOpen: boolean;
  setAddSourceOpen: (open: boolean) => void;
  /** The source shown in the reader, and the passage to scroll to. */
  reading: { sourceId: string; passage?: string } | null;
  readSource: (sourceId: string, passage?: string) => void;
  closeReader: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ notebook, children }: { notebook: Notebook; children: ReactNode }) {
  const [tab, setTab] = useState<WorkspaceTab>("chat");
  const [openOutputId, setOpenOutputId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [reading, setReading] = useState<WorkspaceState["reading"]>(null);

  const value = useMemo<WorkspaceState>(
    () => ({
      notebook,
      tab,
      setTab,
      openOutputId,
      openOutput: (id) => {
        setOpenOutputId(id);
        setStudioOpen(false);
        setTab("studio");
      },
      closeOutput: () => setOpenOutputId(null),
      studioOpen,
      setStudioOpen,
      settingsOpen,
      setSettingsOpen,
      addSourceOpen,
      setAddSourceOpen,
      reading,
      readSource: (sourceId, passage) => setReading({ sourceId, passage }),
      closeReader: () => setReading(null),
    }),
    [notebook, tab, openOutputId, studioOpen, settingsOpen, addSourceOpen, reading],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  return context;
}
