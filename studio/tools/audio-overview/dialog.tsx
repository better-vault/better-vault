import { Loading03Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/common/field";
import { Icon } from "@/components/icon";
import { Alert } from "@/components/panelui/alert";
import { Button } from "@/components/panelui/button";
import { Select } from "@/components/panelui/select";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { Voice } from "@/lib/ai/voices";
import { speechCredentialsFrom, useSettings } from "@/lib/db/settings";
import { ChoiceField, OptionCards } from "@/studio/shared/fields";
import type { ToolFormProps } from "@/studio/shared/form";
import {
  audioFormats,
  audioLengths,
  dialogueModels,
  LENGTH_MINUTES,
  type AudioOverviewOptions,
} from "./definition";

/** Voices per key, for the life of the page: the list rarely changes. */
const voiceLists = new Map<string, Promise<Voice[]>>();

function loadVoices(apiKey: string): Promise<Voice[]> {
  let list = voiceLists.get(apiKey);
  if (!list) {
    list = fetch("/api/voices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as {
        voices?: Voice[];
        error?: string;
      };
      if (!response.ok || !body.voices) throw new Error(body.error ?? response.statusText);
      return body.voices;
    });
    voiceLists.set(apiKey, list);
    list.catch(() => voiceLists.delete(apiKey));
  }
  return list;
}

/** Two different voices to start with: a woman and a man when ElevenLabs says which. */
function defaultHosts(voices: Voice[]): AudioOverviewOptions["hosts"] {
  if (voices.length < 2) return null;
  const first = voices.find((voice) => voice.gender === "female") ?? voices[0];
  const second =
    voices.find((voice) => voice.id !== first.id && voice.gender === "male") ??
    voices.find((voice) => voice.id !== first.id)!;
  return [
    { voiceId: first.id, name: first.name },
    { voiceId: second.id, name: second.name },
  ];
}

export function AudioOverviewForm({ value, onChange }: ToolFormProps<AudioOverviewOptions>) {
  const { t } = useTranslation("studio");
  const { closeTool, setSettingsOpen } = useWorkspace();
  const settings = useSettings();
  const credentials = settings ? speechCredentialsFrom(settings, "elevenlabs") : null;
  const apiKey = credentials?.apiKey ?? "";
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey) return;
    let live = true;
    loadVoices(apiKey)
      .then((list) => live && setVoices(list))
      .catch(
        (failure: unknown) =>
          live && setError(failure instanceof Error ? failure.message : String(failure)),
      );
    return () => {
      live = false;
    };
  }, [apiKey]);

  // The speech model and two voices are filled in once the voices are known.
  useEffect(() => {
    if (!voices) return;
    const known = (id: string) => voices.some((voice) => voice.id === id);
    const hostsOk = value.hosts && known(value.hosts[0].voiceId) && known(value.hosts[1].voiceId);
    const modelOk = value.speechModel?.provider === "elevenlabs";
    if (hostsOk && modelOk) return;
    onChange({
      ...value,
      hosts: hostsOk ? value.hosts : defaultHosts(voices),
      speechModel: modelOk
        ? value.speechModel
        : { provider: "elevenlabs", modelId: dialogueModels[0] },
    });
  }, [voices, value, onChange]);

  if (settings && !apiKey) {
    return (
      <Alert tone="info" variant="plain">
        <Alert.Title>{t("audio-overview.noKey.title")}</Alert.Title>
        <Alert.Description>{t("audio-overview.noKey.body")}</Alert.Description>
        <Alert.Actions>
          <Button
            size="sm"
            onClick={() => {
              closeTool();
              setSettingsOpen(true);
            }}
          >
            {t("audio-overview.noKey.action")}
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <>
      <OptionCards
        label={t("audio-overview.format")}
        value={value.format}
        onChange={(format) => onChange({ ...value, format })}
        columns={3}
        options={audioFormats.map((format) => ({
          value: format,
          title: t(`audio-overview.formats.${format}.name`),
          description: t(`audio-overview.formats.${format}.description`),
        }))}
      />
      <OptionCards
        label={t("audio-overview.length")}
        value={value.length}
        onChange={(length) => onChange({ ...value, length })}
        columns={3}
        options={audioLengths.map((length) => ({
          value: length,
          title: t(`audio-overview.lengths.${length}`),
          description: t("audio-overview.minutes", { count: LENGTH_MINUTES[length] }),
        }))}
      />
      {error ? (
        <p className="text-sm text-destructive">{t("audio-overview.voicesFailed", { error })}</p>
      ) : !voices ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon={Loading03Icon} size={16} className="animate-spin" />
          {t("audio-overview.loadingVoices")}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {([0, 1] as const).map((index) => (
            <VoiceField
              key={index}
              label={t("audio-overview.host", { number: index + 1 })}
              voices={voices}
              value={value.hosts?.[index]?.voiceId ?? null}
              onChange={(voice) => {
                const hosts = value.hosts ?? defaultHosts(voices);
                if (!hosts) return;
                const next = [...hosts] as NonNullable<AudioOverviewOptions["hosts"]>;
                next[index] = { voiceId: voice.id, name: voice.name };
                onChange({ ...value, hosts: next });
              }}
            />
          ))}
        </div>
      )}
      <ChoiceField
        label={t("audio-overview.speechModel")}
        value={value.speechModel?.modelId ?? dialogueModels[0]}
        onChange={(modelId) =>
          onChange({ ...value, speechModel: { provider: "elevenlabs", modelId } })
        }
        options={dialogueModels.map((modelId) => ({ value: modelId, label: modelId }))}
      />
    </>
  );
}

function VoiceField({
  label,
  voices,
  value,
  onChange,
}: {
  label: string;
  voices: Voice[];
  value: string | null;
  onChange: (voice: Voice) => void;
}) {
  const { t } = useTranslation("studio");
  const id = useId();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const chosen = voices.find((voice) => voice.id === value);
  const items = voices.map((voice) => ({ value: voice.id, label: voice.name }));

  useEffect(() => () => audio.current?.pause(), []);

  function preview() {
    if (!chosen?.previewUrl) return;
    if (playing) {
      audio.current?.pause();
      return;
    }
    audio.current?.pause();
    const sample = new Audio(chosen.previewUrl);
    sample.addEventListener("ended", () => setPlaying(false));
    sample.addEventListener("pause", () => setPlaying(false));
    audio.current = sample;
    void sample.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  return (
    <Field label={label} htmlFor={id}>
      <div className="flex gap-2">
        <Select
          items={items}
          value={value}
          onValueChange={(next) => {
            const voice = voices.find((each) => each.id === next);
            if (voice) onChange(voice);
          }}
        >
          <Select.Trigger id={id} className="min-w-0 flex-1">
            <Select.Value />
          </Select.Trigger>
          <Select.Content className="max-h-72">
            {voices.map((voice) => (
              <Select.Item key={voice.id} value={voice.id} description={voice.description}>
                {voice.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Button
          variant="secondary"
          size="icon"
          disabled={!chosen?.previewUrl}
          aria-label={playing ? t("audio-overview.stopPreview") : t("audio-overview.preview")}
          title={playing ? t("audio-overview.stopPreview") : t("audio-overview.preview")}
          onClick={preview}
        >
          <Icon icon={playing ? PauseIcon : PlayIcon} size={16} />
        </Button>
      </div>
    </Field>
  );
}
