import { Add01Icon, Note01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Command } from "@/components/panelui/command";
import type { Note } from "@/lib/db/types";
import { matchNotes } from "./note-list";

/** ⌘O: find a note by name and open it, or create it when nothing matches. */
export function NoteSwitcher({
  open,
  onOpenChange,
  notes,
  vaultLabel,
  onOpen,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  vaultLabel: (note: Note) => string | null;
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const { t } = useTranslation("notes");
  const [search, setSearch] = useState("");
  const shown = matchNotes(notes, search).slice(0, 50);
  const exact = notes.some((note) => note.title.toLowerCase() === search.trim().toLowerCase());
  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSearch("");
        onOpenChange(next);
      }}
      hotkey={null}
      label={t("actions.quickSwitcher")}
    >
      <Command variant="compact" filter={false} search={search} onSearchChange={setSearch}>
        <Command.Input placeholder={t("switcher.placeholder")} />
        <Command.List>
          {shown.map((note) => (
            <Command.Item
              key={note.id}
              value={note.id}
              textValue={note.title}
              icon={<Icon icon={Note01Icon} size={16} />}
              subtitle={[vaultLabel(note), note.folder].filter(Boolean).join(" / ") || undefined}
              onSelect={() => onOpen(note.id)}
            >
              {note.title}
            </Command.Item>
          ))}
          {search.trim() && !exact ? (
            <Command.Item
              value={`create:${search}`}
              textValue={search}
              icon={<Icon icon={Add01Icon} size={16} />}
              onSelect={() => onCreate(search.trim())}
            >
              {t("switcher.create", { title: search.trim() })}
            </Command.Item>
          ) : null}
          <Command.Empty>{t("switcher.empty")}</Command.Empty>
        </Command.List>
      </Command>
    </Command.Dialog>
  );
}
