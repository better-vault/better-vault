import type { ReactNode } from "react";

/**
 * A plain legal page (privacy policy, terms): a title, the date it last
 * changed, and sections of short paragraphs. Readable width, no decoration.
 */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** "November 3, 2026" */
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="px-6 pt-16 pb-24">
      <article className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="font-mono text-xs text-muted-foreground">Last updated {updated}</p>
          <div className="text-base leading-7 text-muted-foreground">{intro}</div>
        </header>
        {children}
      </article>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-[0.9375rem] leading-7 text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
