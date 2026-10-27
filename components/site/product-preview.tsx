import Image from "next/image";

/**
 * The app itself, under the hero: a screenshot in each theme, picked by CSS.
 * Not lazy-loaded, since it is near the top of the page.
 */
export function ProductPreview() {
  return (
    <div className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-card p-1.5 shadow-sm">
        <Image
          src="/screenshots/app-light.webp"
          alt="A better-vault notebook with the Studio open, listing its nine tools beside the chat"
          width={1470}
          height={748}
          sizes="(min-width: 1152px) 1152px, 100vw"
          priority
          className="h-auto w-full rounded-xl dark:hidden"
        />
        <Image
          src="/screenshots/app-dark.webp"
          alt="A better-vault notebook in dark mode, with the Studio tools beside the chat"
          width={1470}
          height={748}
          sizes="(min-width: 1152px) 1152px, 100vw"
          priority
          className="hidden h-auto w-full rounded-xl dark:block"
        />
      </div>
    </div>
  );
}
