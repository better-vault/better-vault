"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { db, type StudioOutput } from "@/lib/db/database";
import {
  createOutput,
  createReadyOutput,
  failOutput,
  finishOutput,
  markInterruptedOutputs,
} from "@/lib/db/outputs";
import { activeModel, getSettings } from "@/lib/db/settings";
import {
  imageCredentialsFor,
  modelRequestFor,
  NoImageModelError,
  NoModelError,
  NoSourcesError,
} from "@/lib/studio/request";
import { toolDefinitions } from "@/studio/definitions";
import type { StudioToolId } from "@/studio/tools";
import type { SavedOptions } from "@/studio/types";

/** Outputs being generated in this page, whichever notebook they belong to. */
const running = new Set<string>();

interface StudioRunner {
  /** Starts a new output with these options. */
  create: (toolId: StudioToolId, options: SavedOptions) => Promise<void>;
  /** Runs a failed output again with its saved options. */
  retry: (output: StudioOutput) => Promise<void>;
  /** Saves an output made in the browser (a local tool) and returns its id. */
  createLocal: (
    toolId: StudioToolId,
    input: { title: string; data: unknown; sourceIds?: string[] },
  ) => Promise<string>;
}

const RunnerContext = createContext<StudioRunner | null>(null);

export function StudioRunnerProvider({
  notebookId,
  children,
}: {
  notebookId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("studio");

  // Outputs left "generating" by a closed page will never finish.
  useEffect(() => {
    void markInterruptedOutputs(running, t("status.interrupted"));
  }, [t]);

  const value = useMemo<StudioRunner>(() => {
    async function run(outputId: string, toolId: StudioToolId, saved: SavedOptions) {
      running.add(outputId);
      try {
        const { model, credentials, passages } = await modelRequestFor(
          saved.common.sourceIds,
          saved.common.focus,
        );
        const imageRef = toolDefinitions[toolId]?.imageModel?.(saved.tool) ?? null;
        const imageCredentials = imageRef ? await imageCredentialsFor(imageRef) : undefined;

        const response = await fetch("/api/studio", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tool: toolId,
            options: saved.tool,
            language: saved.common.language,
            focus: saved.common.focus,
            passages,
            model,
            credentials,
            imageCredentials,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          title?: string;
          data?: unknown;
          error?: string;
        };
        if (!response.ok || body.title === undefined)
          throw new Error(body.error ?? response.statusText);
        await finishOutput(outputId, { title: body.title, data: body.data });
      } catch (error) {
        const message =
          error instanceof NoModelError
            ? t("errors.noModel")
            : error instanceof NoSourcesError
              ? t("errors.noSources")
              : error instanceof NoImageModelError
                ? t("errors.noImageModel")
                : error instanceof Error
                  ? error.message
                  : String(error);
        await failOutput(outputId, message);
      } finally {
        running.delete(outputId);
      }
    }

    return {
      create: async (toolId, options) => {
        const settings = await getSettings();
        const model = activeModel(settings);
        if (!model) throw new Error(t("errors.noModel"));
        const id = await createOutput({
          notebookId,
          toolId,
          title: t(`tools.${toolId}.name`),
          options,
          sourceIds: options.common.sourceIds,
          model,
        });
        void run(id, toolId, options);
      },
      createLocal: async (toolId, input) => {
        const definition = toolDefinitions[toolId];
        if (!definition) throw new Error(`Unknown tool: ${toolId}`);
        return createReadyOutput({
          notebookId,
          toolId,
          title: input.title,
          options: {
            common: { language: "auto", focus: "", sourceIds: input.sourceIds ?? [] },
            tool: definition.defaults,
          },
          sourceIds: input.sourceIds ?? [],
          data: definition.data.parse(input.data),
        });
      },
      retry: async (output) => {
        await db.outputs.update(output.id, {
          status: "generating",
          error: undefined,
          updatedAt: Date.now(),
        });
        void run(output.id, output.toolId as StudioToolId, output.options as SavedOptions);
      },
    };
  }, [notebookId, t]);

  return <RunnerContext.Provider value={value}>{children}</RunnerContext.Provider>;
}

export function useStudioRunner(): StudioRunner {
  const context = useContext(RunnerContext);
  if (!context) throw new Error("useStudioRunner must be used inside <StudioRunnerProvider>.");
  return context;
}
