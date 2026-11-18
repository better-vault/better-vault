import { ArrowUpRight01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Tabs } from "@/components/panelui/tabs";
import { Textarea } from "@/components/panelui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSkill } from "@/lib/db/skills";
import { fetchRemoteSkills, type RemoteSkills } from "@/lib/skills/fetch";
import { skillSlug } from "@/lib/skills/format";
import { cn } from "@/lib/utils";

type Tab = "create" | "fetch";

/**
 * Makes skills: written here (Create), or fetched from GitHub the way
 * `npx skills add` from skills.sh would install them (Fetch). Calls
 * `onCreated` with the first new skill, to open it.
 */
export function NewSkillDialog({
  open,
  onOpenChange,
  vaultId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: string;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation("notes");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="lg" closeLabel={tCommon("actions.close")}>
        <Dialog.Header title={t("skills.create.title")} />
        {/* Mounted only while open, so each opening starts empty. */}
        <NewSkillForm
          vaultId={vaultId}
          onDone={(id) => {
            onOpenChange(false);
            if (id) onCreated(id);
          }}
        />
      </Dialog.Content>
    </Dialog>
  );
}

function NewSkillForm({ vaultId, onDone }: { vaultId: string; onDone: (id?: string) => void }) {
  const { t } = useTranslation("notes");
  const { t: tCommon } = useTranslation();
  const [tab, setTab] = useState<Tab>("create");
  const formId = useId();
  const ids = { name: useId(), description: useId(), body: useId(), source: useId() };

  // Create
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  // Fetch
  const [source, setSource] = useState("");
  const [found, setFound] = useState<RemoteSkills | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const skill = await createSkill(vaultId, {
        name: skillSlug(name),
        description: description.trim(),
        body,
      });
      onDone(skill.id);
    });

  const find = () =>
    run(async () => {
      setFound(null);
      const result = await fetchRemoteSkills(source);
      setFound(result);
      setChosen(new Set(result.skills.map((skill) => skill.path)));
    });

  const importChosen = () =>
    run(async () => {
      if (!found) return;
      let first: string | undefined;
      const picked = found.skills.filter((skill) => chosen.has(skill.path));
      for (const skill of picked) {
        const made = await createSkill(vaultId, {
          name: skill.name,
          description: skill.description,
          body: skill.body,
        });
        first ??= made.id;
      }
      toast.success(t("skills.create.imported", { count: picked.length }));
      onDone(first);
    });

  const canSubmit =
    tab === "create" ? name.trim() !== "" : found ? chosen.size > 0 : source.trim() !== "";

  return (
    <>
      <Dialog.Body>
        <Tabs value={tab} onValueChange={(next) => setTab(next === "fetch" ? "fetch" : "create")}>
          <Tabs.List aria-label={t("skills.create.title")} className="w-full">
            <Tabs.Trigger value="create" className="flex-1">
              {t("skills.create.tabCreate")}
            </Tabs.Trigger>
            <Tabs.Trigger value="fetch" className="flex-1">
              {t("skills.create.tabFetch")}
            </Tabs.Trigger>
          </Tabs.List>

          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSubmit || busy) return;
              if (tab === "create") void create();
              else if (found) void importChosen();
              else void find();
            }}
          >
            <Tabs.Content value="create" className="flex flex-col gap-5 pt-5">
              <Field
                label={t("skills.name")}
                htmlFor={ids.name}
                hint={
                  name.trim()
                    ? t("skills.create.slug", { slug: skillSlug(name) })
                    : t("skills.nameHint")
                }
              >
                <Input
                  id={ids.name}
                  value={name}
                  autoFocus
                  maxLength={64}
                  className="font-mono"
                  placeholder={t("skills.create.namePlaceholder")}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field
                label={t("skills.description")}
                htmlFor={ids.description}
                hint={t("skills.descriptionHint")}
              >
                <Textarea
                  id={ids.description}
                  value={description}
                  minRows={2}
                  maxRows={4}
                  maxLength={2000}
                  placeholder={t("skills.create.descriptionPlaceholder")}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
              <Field label={t("skills.body")} htmlFor={ids.body}>
                <Textarea
                  id={ids.body}
                  value={body}
                  minRows={6}
                  maxRows={12}
                  className="font-mono text-sm"
                  placeholder={t("skills.create.bodyPlaceholder")}
                  onChange={(event) => setBody(event.target.value)}
                />
              </Field>
            </Tabs.Content>

            <Tabs.Content value="fetch" className="flex flex-col gap-4 pt-5">
              <Field
                label={t("skills.create.source")}
                htmlFor={ids.source}
                hint={t("skills.create.sourceHint")}
                action={
                  <a
                    href="https://skills.sh"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("skills.create.browse")}
                    <Icon icon={ArrowUpRight01Icon} size={12} />
                  </a>
                }
              >
                <div className="flex gap-2">
                  <Input
                    id={ids.source}
                    value={source}
                    autoFocus={tab === "fetch"}
                    className="min-w-0 flex-1 font-mono text-sm"
                    placeholder={t("skills.create.sourcePlaceholder")}
                    onChange={(event) => {
                      setSource(event.target.value);
                      setFound(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!source.trim() || busy}
                    aria-busy={busy && !found}
                    onClick={() => void find()}
                  >
                    {busy && !found ? (
                      <Icon icon={Loading03Icon} size={16} className="animate-spin" />
                    ) : null}
                    {t("skills.create.find")}
                  </Button>
                </div>
              </Field>

              {found ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {t("skills.create.found", { count: found.skills.length, repo: found.repo })}
                    </span>
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      onClick={() =>
                        setChosen(
                          chosen.size === found.skills.length
                            ? new Set()
                            : new Set(found.skills.map((skill) => skill.path)),
                        )
                      }
                    >
                      {chosen.size === found.skills.length
                        ? t("skills.create.clearAll")
                        : t("skills.create.selectAll")}
                    </button>
                  </div>
                  <ScrollArea
                    className={cn("rounded-xl border", found.skills.length > 4 && "h-64")}
                  >
                    <ul className="flex flex-col p-1">
                      {found.skills.map((skill) => (
                        <li key={skill.path}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-accent/60">
                            <Checkbox
                              className="mt-0.5"
                              checked={chosen.has(skill.path)}
                              onCheckedChange={(on) => {
                                const next = new Set(chosen);
                                if (on) next.add(skill.path);
                                else next.delete(skill.path);
                                setChosen(next);
                              }}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-mono text-sm">{skill.name}</span>
                              {skill.description ? (
                                <span className="line-clamp-2 text-xs text-muted-foreground">
                                  {skill.description}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    {found.truncated
                      ? `${t("skills.create.truncated", { count: found.skills.length })} `
                      : ""}
                    {t("skills.create.extraFiles")}
                  </p>
                </div>
              ) : null}
            </Tabs.Content>
          </form>
        </Tabs>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>
          {tCommon("actions.cancel")}
        </Dialog.Close>
        {tab === "create" ? (
          <Button type="submit" form={formId} disabled={!canSubmit || busy} aria-busy={busy}>
            {busy ? <Icon icon={Loading03Icon} size={16} className="animate-spin" /> : null}
            {t("skills.create.submit")}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!found || chosen.size === 0 || busy}
            aria-busy={busy && Boolean(found)}
            onClick={() => void importChosen()}
          >
            {busy && found ? (
              <Icon icon={Loading03Icon} size={16} className="animate-spin" />
            ) : null}
            {t("skills.create.import", { count: chosen.size })}
          </Button>
        )}
      </Dialog.Footer>
    </>
  );
}
