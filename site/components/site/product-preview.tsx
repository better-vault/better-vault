import Image from "next/image";

/**
 * The app itself, under the hero: a notebook with the Studio sheet open,
 * listing every tool and the outputs made from its sources, a 2× screenshot
 * in each theme, picked by CSS.
 * Served as the WebP file it is (already compressed for the web) rather than
 * re-encoded by the image optimiser, which softened the text. Not
 * lazy-loaded, since it is near the top of the page.
 */
export function ProductPreview() {
  return (
    <div className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-card p-1.5 shadow-sm">
        <Image
          src="/screenshots/studio-light.webp"
          alt="A better-vault notebook with three sources and the Studio open, listing its twelve tools and the outputs made from the sources beside the chat"
          width={2880}
          height={1800}
          unoptimized
          priority
          className="h-auto w-full rounded-xl dark:hidden"
        />
        <Image
          src="/screenshots/studio-dark.webp"
          alt="A better-vault notebook in dark mode, with the Studio tools and outputs beside the chat"
          width={2880}
          height={1800}
          unoptimized
          priority
          className="hidden h-auto w-full rounded-xl dark:block"
        />
      </div>
    </div>
  );
}
