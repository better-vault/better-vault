import { CenterFocusIcon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Input } from "@/components/panelui/input";
import { Switch } from "@/components/panelui/switch";
import { buildGraph, type GraphNode } from "@/lib/notes/graph";
import type { LinkWorld } from "@/lib/notes/resolve";
import { itemColor } from "@/lib/notebooks/colors";
import { cn } from "@/lib/utils";
import { GraphCanvas } from "./graph-canvas";

/**
 * The graph view (⌘G): every note as a node, every link as a line, with
 * vaults in their own colours, so links between vaults show. "Local" shows
 * only what is near the open note.
 */
export function GraphView({
  world,
  vaultColors,
  focusId,
  onOpen,
}: {
  world: LinkWorld;
  vaultColors: Record<string, string>;
  focusId: string | null;
  onOpen: (node: GraphNode) => void;
}) {
  const { t } = useTranslation("notes");
  const [scope, setScope] = useState<"global" | "local">(focusId ? "local" : "global");
  const [depth, setDepth] = useState(2);
  const [showTags, setShowTags] = useState(false);
  const [showOrphans, setShowOrphans] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [highlight, setHighlight] = useState("");
  const [fitKey, setFitKey] = useState(0);
  const local = scope === "local" && focusId !== null;

  const graph = useMemo(
    () =>
      buildGraph(world, {
        vaults: null,
        showTags,
        showOrphans,
        showSources,
        around: local ? { noteId: focusId!, depth } : null,
      }),
    [world, showTags, showOrphans, showSources, local, focusId, depth],
  );
  const vaultsShown = world.vaults.filter((vault) =>
    graph.nodes.some((node) => node.vaultId === vault.id),
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <Segmented
          aria-label={t("graph.title")}
          size="sm"
          value={local ? "local" : "global"}
          onValueChange={(next) => setScope(next)}
          options={[
            { value: "local", label: t("graph.local"), disabled: !focusId },
            { value: "global", label: t("graph.global") },
          ]}
        />
        {local ? (
          <Segmented
            aria-label={t("graph.depth")}
            size="sm"
            value={String(depth) as "1" | "2" | "3"}
            onValueChange={(next) => setDepth(Number(next))}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
          />
        ) : null}
        <Input
          size="sm"
          type="search"
          aria-label={t("graph.search")}
          placeholder={t("graph.search")}
          value={highlight}
          onChange={(event) => setHighlight(event.target.value)}
          className="w-40"
        />
        <div className="ms-auto flex items-center gap-3 rounded-full bg-card/90 px-3 py-1 text-xs ring-1 ring-border backdrop-blur">
          <label className="flex cursor-pointer items-center gap-1.5">
            <Switch size="xs" checked={showTags} onCheckedChange={setShowTags} />
            {t("graph.showTags")}
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <Switch size="xs" checked={showSources} onCheckedChange={setShowSources} />
            {t("graph.showSources")}
          </label>
          {local ? null : (
            <label className="flex cursor-pointer items-center gap-1.5">
              <Switch size="xs" checked={showOrphans} onCheckedChange={setShowOrphans} />
              {t("graph.showOrphans")}
            </label>
          )}
          <button
            type="button"
            onClick={() => setFitKey((key) => key + 1)}
            aria-label={t("graph.fit")}
            title={t("graph.fit")}
            className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={CenterFocusIcon} size={14} />
          </button>
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <p className="m-auto max-w-xs text-center text-sm text-muted-foreground">
          {t("graph.empty")}
        </p>
      ) : (
        <GraphCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          vaultColors={vaultColors}
          focusId={focusId}
          highlight={highlight}
          onOpen={onOpen}
          fitKey={fitKey}
          label={t("graph.title")}
        />
      )}

      {vaultsShown.length > 1 ? (
        <div className="absolute start-3 bottom-3 flex flex-wrap items-center gap-3 rounded-full bg-card/90 px-3 py-1 text-xs ring-1 ring-border backdrop-blur">
          <span className="text-muted-foreground">{t("graph.legend")}</span>
          {vaultsShown.map((vault) => (
            <span key={vault.id} className="flex items-center gap-1.5">
              <span
                className={cn("size-2.5 rounded-full", itemColor(vaultColors[vault.id]).swatch)}
              />
              {world.vaultName(vault)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
