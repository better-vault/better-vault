"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { describeAdds, type PluginEntry } from "@/lib/site/plugin-info";
import { PluginIcon } from "./plugin-icon";

/** The directory's search and tag filter, over the list the server read. */
export function PluginSearch({ plugins }: { plugins: PluginEntry[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(
    () => [...new Set(plugins.flatMap((plugin) => plugin.tags))].sort(),
    [plugins],
  );
  const shown = plugins.filter((plugin) => {
    if (tag && !plugin.tags.includes(tag)) return false;
    const haystack = [plugin.name, plugin.description, plugin.author, plugin.id, ...plugin.tags]
      .join(" ")
      .toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => haystack.includes(word));
  });

  return (
    <div className="flex flex-col gap-6">
      <label className="relative block">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search plugins"
          aria-label="Search plugins"
          className="h-12 w-full rounded-full border bg-background ps-11 pe-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      {tags.length ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => setTag(null)}
            aria-pressed={tag === null}
            className="rounded-full border px-3 py-1 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
          >
            All
          </button>
          {tags.map((each) => (
            <button
              key={each}
              type="button"
              onClick={() => setTag(tag === each ? null : each)}
              aria-pressed={tag === each}
              className="rounded-full border px-3 py-1 text-xs aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {each}
            </button>
          ))}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No plugins match.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((plugin) => (
            <li key={plugin.id}>
              <Link
                href={`/plugins/${plugin.id}`}
                className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <PluginIcon icon={plugin.icon} className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{plugin.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      by {plugin.author || "an unknown author"} · {plugin.version}
                    </span>
                  </span>
                </span>
                <span className="line-clamp-3 text-sm text-muted-foreground">
                  {plugin.description}
                </span>
                <span className="mt-auto flex flex-wrap gap-1.5">
                  {describeAdds(plugin.adds).map((item) => (
                    <span key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {item}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
