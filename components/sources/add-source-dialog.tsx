"use client";

import { CloudUploadIcon, Globe02Icon, Loading03Icon, TextIcon } from "@hugeicons/core-free-icons";
import { useId, useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { Textarea } from "@/components/panelui/textarea";
import {
  ACCEPTED_FILES,
  IngestError,
  ingestFile,
  ingestText,
  ingestUrl,
} from "@/lib/sources/ingest";
import { cn } from "@/lib/utils";

type Mode = "file" | "url" | "text";

interface AddSourceDialogProps {
  notebookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Adds sources from files, a web page or pasted text. */
export function AddSourceDialog({ notebookId, open, onOpenChange }: AddSourceDialogProps) {
  const { t } = useTranslation("sources");
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="lg" closeLabel={tCommon("actions.close")}>
        <Dialog.Header title={t("addDialog.title")} description={t("addDialog.description")} />
        <AddSourceForm notebookId={notebookId} onDone={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog>
  );
}

function AddSourceForm({ notebookId, onDone }: { notebookId: string; onDone: () => void }) {
  const { t } = useTranslation("sources");
  const { t: tCommon } = useTranslation();
  const formId = useId();
  const urlId = useId();
  const titleId = useId();
  const textId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function describe(error: unknown): string {
    if (error instanceof IngestError) {
      if (error.reason === "read") return t("errors.read", { name: error.subject, error: error.detail });
      return t(`errors.${error.reason}`, { name: error.subject });
    }
    return error instanceof Error ? error.message : String(error);
  }

  /** Runs the adds, reports what happened and closes when everything worked. */
  async function run(tasks: (() => Promise<unknown>)[]) {
    setBusy(true);
    setErrors([]);
    const results = await Promise.allSettled(tasks.map((task) => task()));
    setBusy(false);
    const added = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.flatMap((result) => (result.status === "rejected" ? [describe(result.reason)] : []));
    if (added > 0) toast.success(t("added", { count: added }));
    if (failed.length > 0) setErrors(failed);
    else onDone();
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files];
    if (list.length > 0) void run(list.map((file) => () => ingestFile(notebookId, file)));
  }

  function submit() {
    if (mode === "url") {
      const address = url.trim();
      if (!/^https?:\/\/\S+$/i.test(address)) {
        setErrors([t("errors.url")]);
        return;
      }
      void run([() => ingestUrl(notebookId, address)]);
    } else if (mode === "text" && text.trim()) {
      void run([() => ingestText(notebookId, title.trim() || t("addDialog.textTitlePlaceholder"), text)]);
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const canSubmit = !busy && (mode === "url" ? url.trim() !== "" : mode === "text" ? text.trim() !== "" : false);

  return (
    <>
      <Dialog.Body>
        <Segmented<Mode>
          aria-label={t("addDialog.title")}
          value={mode}
          onValueChange={(next) => {
            setMode(next);
            setErrors([]);
          }}
          className="w-full *:flex-1"
          options={[
            { value: "file", label: t("addDialog.tabs.file"), icon: <Icon icon={CloudUploadIcon} size={16} /> },
            { value: "url", label: t("addDialog.tabs.url"), icon: <Icon icon={Globe02Icon} size={16} /> },
            { value: "text", label: t("addDialog.tabs.text"), icon: <Icon icon={TextIcon} size={16} /> },
          ]}
        />

        {mode === "file" ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-10 text-center transition-colors",
              dragging && "border-info bg-info/5",
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon icon={busy ? Loading03Icon : CloudUploadIcon} size={22} className={busy ? "animate-spin" : undefined} />
            </span>
            <p className="text-sm font-medium">{busy ? t("addDialog.adding") : t("addDialog.drop")}</p>
            <Button
              type="button"
              variant="outline"
              shape="pill"
              size="sm"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {t("addDialog.choose")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("addDialog.fileTypes")}</p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              className="hidden"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        ) : (
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {mode === "url" ? (
              <Field label={t("addDialog.urlLabel")} htmlFor={urlId} hint={t("addDialog.urlHint")}>
                <Input
                  id={urlId}
                  type="url"
                  inputMode="url"
                  autoFocus
                  placeholder={t("addDialog.urlPlaceholder")}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label={t("addDialog.textTitle")} htmlFor={titleId}>
                  <Input
                    id={titleId}
                    placeholder={t("addDialog.textTitlePlaceholder")}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field label={t("addDialog.textLabel")} htmlFor={textId}>
                  <Textarea
                    id={textId}
                    minRows={6}
                    maxRows={14}
                    placeholder={t("addDialog.textPlaceholder")}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </Field>
              </>
            )}
          </form>
        )}

        {errors.length > 0 ? (
          <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            {errors.map((error, at) => (
              <li key={at}>{error}</li>
            ))}
          </ul>
        ) : null}
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Close render={<Button variant="secondary" />}>{tCommon("actions.cancel")}</Dialog.Close>
        {mode !== "file" ? (
          <Button type="submit" form={formId} disabled={!canSubmit} loading={busy}>
            {t("addDialog.submit")}
          </Button>
        ) : null}
      </Dialog.Footer>
    </>
  );
}
