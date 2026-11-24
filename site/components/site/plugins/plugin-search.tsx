"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  avatarUrl,
  kindsOf,
  rawUrl,
  type PluginEntry,
  type PluginKind,
} from "@/lib/site/plugin-info";
import { PluginIcon } from "./plugin-icon";

const tabs: { id: "all" | PluginKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tools", label: "Studio tools" },
  { id: "mods", label: "Mods" },
  { id: "themes", label: "Themes" },
];

const compact = new Intl.NumberFormat("en", { notation: "compact" });

/**
 * The directory as a gallery of posts: kind tabs, a search ("/" focuses it)
 * and Popular or New, over cards with each plugin's picture, its creator's
 * GitHub avatar and its repository's stars.
 */
export function PluginSearch({ plugins }: { plugins: PluginEntry[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("all");
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        field.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  const counts = useMemo(() => {
    const count = (id: (typeof tabs)[number]["id"]) =>
      id === "all"
        ? plugins.length
        : plugins.filter((plugin) => kindsOf(plugin.adds).includes(id)).length;
    return Object.fromEntries(tabs.map(({ id }) => [id, count(id)]));
  }, [plugins]);

  const shown = plugins
    .filter((plugin) => tab === "all" || kindsOf(plugin.adds).includes(tab))
    .filter((plugin) => {
      const haystack = [
        plugin.name,
        plugin.description,
        plugin.owner ?? plugin.author,
        plugin.id,
        ...plugin.tags,
      ]
        .join(" ")
        .toLowerCase();
      return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
    })
    .sort((a, b) =>
      sort === "popular"
        ? b.stars - a.stars || a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Kinds of plugin">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="flex items-center gap-2 rounded-xl border border-transparent px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-selected:border-border aria-selected:bg-card aria-selected:text-foreground"
            >
              {label}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ms-auto">
          <label className="relative flex-1 sm:w-64 sm:flex-none">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground"
            >
              /
            </span>
            <input
              ref={field}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plugins"
              aria-label="Search plugins"
              className="h-10 w-full rounded-xl border bg-card ps-8 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "popular" | "new")}
            aria-label="Sort plugins"
            className="h-10 rounded-xl border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="popular">Popular</option>
            <option value="new">New</option>
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No plugins match here right now.
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((plugin) => (
            <li key={plugin.id}>
              <PluginPost plugin={plugin} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PluginPost({ plugin }: { plugin: PluginEntry }) {
  const owner = plugin.owner ?? plugin.author;
  return (
    <Link
      href={`/plugins/${plugin.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-foreground/25"
    >
      <span className="relative block aspect-[16/10] overflow-hidden border-b bg-muted">
        {plugin.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- pictures from the plugins repo
          <img
            src={rawUrl(plugin.cover)}
            alt=""
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <PluginIcon icon={plugin.icon} className="size-10 text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="flex items-center gap-3 px-4 py-3.5">
        {plugin.owner ? (
          // eslint-disable-next-line @next/next/no-img-element -- the creator's GitHub avatar
          <img
            src={avatarUrl(plugin.owner)}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded-lg bg-muted"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <PluginIcon icon={plugin.icon} className="size-4" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{plugin.name}</span>
          <span className="truncate text-sm text-muted-foreground">{owner}</span>
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
          aria-label={`${plugin.stars} stars on GitHub`}
        >
          <HugeiconsIcon icon={StarIcon} className="size-4" aria-hidden="true" />
          {compact.format(plugin.stars)}
        </span>
      </span>
    </Link>
  );
}
