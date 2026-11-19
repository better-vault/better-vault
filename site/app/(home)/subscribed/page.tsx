import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/panelui/button";
import { absoluteUrl } from "@/lib/site/config";

export const metadata: Metadata = {
  title: "Thank you for subscribing",
  description:
    "Your better-vault plan is active. Go back to the app: Better Vault AI, your monthly AI credits, Better Vault Cloud and synced skills are ready to use.",
  alternates: { canonical: absoluteUrl("/subscribed") },
  robots: { index: false },
};

/**
 * Where Dodo Payments' checkout sends people back from the desktop app (the
 * web app returns to itself). The app reads the new plan when its window
 * comes back into focus.
 */
export default function SubscribedPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center px-6 pt-32 pb-24 text-center sm:pt-40">
        <div className="flex w-full max-w-xl flex-col items-center gap-5">
          <p className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
            Payment received
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Thank you for subscribing
          </h1>
          <p className="text-pretty text-muted-foreground">
            Your plan is active. Go back to better-vault: it picks up the plan on its own, and
            Better Vault AI appears in the model picker. Your skills and plugins now sync across
            your devices.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/docs/subscription" className={buttonVariants({ variant: "outline" })}>
              What your plan includes
            </Link>
            <Link href="/" className={buttonVariants({ variant: "ghost" })}>
              better-vault.dev
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
