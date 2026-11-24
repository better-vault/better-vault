import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import type { PluginIcon } from "@/lib/plugins/manifest";
import { StarIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { avatarUrl, pictureUrl } from "@/lib/plugins/registry";
import { cn } from "@/lib/utils";
import { pluginIconSet } from "./plugin-icons";

/**
 * A plugin as a card, like a post: its cover picture across the top, fading
 * into the card, its creator's GitHub avatar over the cover's lower edge,
 * then its name, a short summary, the creator and the repository's stars.
 * Plugins without a cover (installed from a file) get a soft gradient.
 */

/** The creator's GitHub avatar, or the plugin's icon when there is none or it can't load. */
export function CreatorAvatar({
  owner,
  icon,
  className,
}: {
  owner?: string;
  icon: PluginIcon;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {owner && !failed ? (
        <img
          src={avatarUrl(owner)}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <Icon icon={pluginIconSet[icon]} size={24} />
      )}
    </span>
  );
}

/** "★ 128", the repository's stars. */
export function Stars({ count, className }: { count: number; className?: string }) {
  const { t, i18n } = useTranslation("settings");
  return (
    <span
      className={cn("flex items-center gap-1 tabular-nums", className)}
      title={t("plugins.card.stars", { count })}
      aria-label={t("plugins.card.stars", { count })}
    >
      <Icon icon={StarIcon} size={13} />
      {new Intl.NumberFormat(i18n.language, { notation: "compact" }).format(count)}
    </span>
  );
}
export function PluginCover({
  cover,
  icon,
  className,
}: {
  cover?: string;
  icon: PluginIcon;
  className?: string;
}) {
  return (
    <span className={cn("relative block aspect-[1200/630] overflow-hidden bg-muted", className)}>
      {cover ? (
        <img
          src={pictureUrl(cover)}
          alt=""
          loading="lazy"
          draggable={false}
          className="size-full object-cover object-top"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--chart-5)_35%,transparent),transparent_60%),radial-gradient(circle_at_80%_70%,color-mix(in_oklch,var(--chart-2)_35%,transparent),transparent_55%)]">
          <Icon icon={pluginIconSet[icon]} size={44} className="text-foreground/40" />
        </span>
      )}
      {/* The picture fades into the card, as in a profile header. */}
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent via-card/70 to-card" />
    </span>
  );
}

export function PluginCard({
  name,
  author,
  summary,
  icon,
  cover,
  tags,
  status,
  owner,
  stars,
  onOpen,
}: {
  name: string;
  author?: string;
  /** The creator's GitHub login, for their avatar. */
  owner?: string;
  /** The repository's stars, when it is listed in the directory. */
  stars?: number;
  summary: string;
  icon: PluginIcon;
  cover?: string;
  /** Short words under the summary, such as "Studio tool". */
  tags: string[];
  status?: { label: string; tone: "on" | "off" | "update" };
  onOpen: () => void;
}) {
  const { t } = useTranslation("settings");
  const punctuated = /[.!?…]$/.test(name.trim());
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full cursor-pointer overflow-hidden rounded-3xl bg-card p-1.5 text-start ring-1 ring-border transition-[box-shadow,scale] duration-150 outline-none hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <PluginCover cover={cover} icon={icon} className="rounded-[1.15rem]" />
      <span className="relative -mt-9 flex items-end justify-between gap-3 px-3">
        <CreatorAvatar owner={owner} icon={icon} className="size-14 shadow-sm ring-4 ring-card" />
        {status ? (
          <span
            className={cn(
              "mb-1 rounded-full px-3 py-1 text-xs font-medium",
              status.tone === "on"
                ? "bg-foreground text-background"
                : status.tone === "update"
                  ? "bg-info/15 text-info"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {status.label}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col gap-1 px-3 pt-2.5 pb-3">
        <span className="truncate text-base font-bold tracking-tight">
          {name}
          {punctuated ? null : "."}
        </span>
        <span className="line-clamp-2 text-sm text-muted-foreground">{summary}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {author ? <span>{t("plugins.card.by", { author })}</span> : null}
          {stars !== undefined ? <Stars count={stars} /> : null}
          {tags.map((tag) => (
            <span key={tag} className="font-medium text-foreground/80">
              {tag}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
