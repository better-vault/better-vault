import { useTranslation } from "react-i18next";
import { Dialog } from "@/components/panelui/dialog";
import { isApple } from "@/lib/platform";

type ShortcutId =
  | "newNote"
  | "quickSwitcher"
  | "palette"
  | "search"
  | "toggleMode"
  | "graph"
  | "back"
  | "forward"
  | "closeTab"
  | "bold"
  | "italic"
  | "strike"
  | "highlight"
  | "link"
  | "task"
  | "deleteLine"
  | "indent"
  | "fold"
  | "openLink"
  | "find"
  | "help";

/** Obsidian's default hotkeys, as this workspace answers them. `Mod` is ⌘ or Ctrl. */
export const noteShortcuts: { group: "workspace" | "editing"; id: ShortcutId; keys: string }[] = [
  { group: "workspace", id: "newNote", keys: "Mod+N" },
  { group: "workspace", id: "quickSwitcher", keys: "Mod+O" },
  { group: "workspace", id: "palette", keys: "Mod+P" },
  { group: "workspace", id: "search", keys: "Mod+Shift+F" },
  { group: "workspace", id: "toggleMode", keys: "Mod+E" },
  { group: "workspace", id: "graph", keys: "Mod+G" },
  { group: "workspace", id: "back", keys: "Mod+Alt+←" },
  { group: "workspace", id: "forward", keys: "Mod+Alt+→" },
  { group: "workspace", id: "closeTab", keys: "Mod+W" },
  { group: "workspace", id: "help", keys: "?" },
  { group: "editing", id: "bold", keys: "Mod+B" },
  { group: "editing", id: "italic", keys: "Mod+I" },
  { group: "editing", id: "strike", keys: "Mod+Shift+X" },
  { group: "editing", id: "highlight", keys: "Mod+Shift+H" },
  { group: "editing", id: "link", keys: "Mod+K" },
  { group: "editing", id: "task", keys: "Mod+L" },
  { group: "editing", id: "deleteLine", keys: "Mod+D" },
  { group: "editing", id: "indent", keys: "Mod+] / Mod+[" },
  { group: "editing", id: "fold", keys: "Mod+↑ / Mod+↓" },
  { group: "editing", id: "openLink", keys: "Mod+Enter" },
  { group: "editing", id: "find", keys: "Mod+F" },
];

/** Writes `Mod+Shift+F` the way this system does: ⌘⇧F on a Mac, Ctrl+Shift+F elsewhere. */
export function keyLabel(keys: string): string {
  if (!isApple()) return keys.replace(/Mod/g, "Ctrl");
  return keys
    .replace(/Mod\+/g, "⌘")
    .replace(/Shift\+/g, "⇧")
    .replace(/Alt\+/g, "⌥")
    .replace(/Enter/g, "↩");
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("notes");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="md" closeLabel={tCommon("actions.close")}>
        <Dialog.Header title={t("shortcuts.title")} description={t("shortcuts.description")} />
        <Dialog.Body>
          <div className="grid gap-6 sm:grid-cols-2">
            {(["workspace", "editing"] as const).map((group) => (
              <section key={group} className="flex flex-col gap-1">
                <h3 className="pb-1 text-xs font-medium text-muted-foreground">
                  {t(`shortcuts.groups.${group}`)}
                </h3>
                {noteShortcuts
                  .filter((each) => each.group === group)
                  .map((each) => (
                    <div key={each.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{t(`shortcuts.items.${each.id}`)}</span>
                      <kbd
                        className="rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {keyLabel(each.keys)}
                      </kbd>
                    </div>
                  ))}
              </section>
            ))}
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  );
}
