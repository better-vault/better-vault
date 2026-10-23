"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Notebook, StudioOutput } from "@/lib/db/database";
import type { StudioToolId } from "@/studio/tools";

export type WorkspaceTab = "chat" | "sources" | "studio";

/** A rename or delete asked for on a Studio output. */
export interface OutputAction {
  kind: "rename" | "delete";
  output: StudioOutput;
}

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
  /** The Studio tool whose dialog is open. */
  activeTool: StudioToolId | null;
  /** Closes the Studio sheet and opens a tool's dialog. */
  openTool: (id: StudioToolId) => void;
  closeTool: () => void;
  outputAction: OutputAction | null;
  /** Closes the Studio sheet and asks to rename or delete an output. */
  requestOutputAction: (action: OutputAction) => void;
  clearOutputAction: () => void;
  /** The source shown in the reader, and the passage to scroll to. */
  reading: { sourceId: string; passage?: string } | null;
  readSource: (sourceId: string, passage?: string) => void;
  closeReader: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

/**
 * The notebook screen's state. Dialogs opened from a sheet live here, outside
 * the sheet, so the sheet can close as its dialog opens.
 */
export function WorkspaceProvider({ notebook, children }: { notebook: Notebook; children: ReactNode }) {
  const [tab, setTab] = useState<WorkspaceTab>("chat");
  const [openOutputId, setOpenOutputId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<StudioToolId | null>(null);
  const [outputAction, setOutputAction] = useState<OutputAction | null>(null);
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
      activeTool,
      openTool: (id) => {
        setStudioOpen(false);
        setActiveTool(id);
      },
      closeTool: () => setActiveTool(null),
      outputAction,
      requestOutputAction: (action) => {
        setStudioOpen(false);
        setOutputAction(action);
      },
      clearOutputAction: () => setOutputAction(null),
      reading,
      readSource: (sourceId, passage) => setReading({ sourceId, passage }),
      closeReader: () => setReading(null),
    }),
    [notebook, tab, openOutputId, studioOpen, settingsOpen, addSourceOpen, activeTool, outputAction, reading],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside <WorkspaceProvider>.");
  return context;
}
