import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A screenshot of the app in a docs page, in the reader's theme: the light
 * and dark files in public/screenshots/docs/<name>-light|dark.webp, picked
 * by CSS. They are 1600×1000 WebP already, so the image optimiser is skipped.
 * Lazy-loaded, since docs pictures sit below the opening paragraph.
 */
export function Screenshot({
  name,
  alt,
  caption,
  className,
}: {
  /** The file's name without theme or extension, like "bots". */
  name: string;
  /** What the picture shows, for screen readers and search engines. */
  alt: string;
  caption?: string;
  className?: string;
}) {
  const image = (theme: "light" | "dark") => (
    <Image
      src={`/screenshots/docs/${name}-${theme}.webp`}
      alt={alt}
      width={1600}
      height={1000}
      unoptimized
      className={cn("m-0 h-auto w-full rounded-lg", theme === "light" ? "dark:hidden" : "hidden dark:block")}
    />
  );
  return (
    <figure className={cn("not-prose my-6 flex flex-col gap-2", className)}>
      <div className="overflow-hidden rounded-xl border bg-card p-1">
        {image("light")}
        {image("dark")}
      </div>
      {caption ? (
        <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
