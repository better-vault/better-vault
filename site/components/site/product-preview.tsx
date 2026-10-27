import Image from "next/image";

/**
 * The app itself, under the hero: a 2× screenshot in each theme, picked by
 * CSS. Served as the WebP file it is (already compressed for the web) rather
 * than re-encoded by the image optimiser, which softened the text. Not
 * lazy-loaded, since it is near the top of the page.
 */
export function ProductPreview() {
  return (
    <div className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-card p-1.5 shadow-sm">
        <Image
          src="/screenshots/app-light.webp"
          alt="A better-vault notebook with three sources and the Studio open, listing its nine tools beside the chat"
          width={2880}
          height={1720}
          unoptimized
          priority
          className="h-auto w-full rounded-xl dark:hidden"
        />
        <Image
          src="/screenshots/app-dark.webp"
          alt="A better-vault notebook in dark mode, with the Studio tools beside the chat"
          width={2880}
          height={1720}
          unoptimized
          priority
          className="hidden h-auto w-full rounded-xl dark:block"
        />
      </div>
    </div>
  );
}
