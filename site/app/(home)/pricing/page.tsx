import type { Metadata } from "next";
import Link from "next/link";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { buttonVariants } from "@/components/panelui/button";
import { absoluteUrl } from "@/lib/site/config";
import { comparisonGroups, plans, pricingFaq, type Cell } from "@/lib/site/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "better-vault is free and open source with your own API keys. Pro and Max add Better Vault AI without a key, monthly AI credits and Better Vault Cloud storage.",
  alternates: { canonical: absoluteUrl("/pricing") },
};

function Mark({ value }: { value: Cell }) {
  if (typeof value === "string") return <span className="text-sm">{value}</span>;
  return value ? (
    <span className="inline-flex text-success">
      <HugeiconsIcon icon={Tick02Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="inline-flex text-muted-foreground">
      <HugeiconsIcon icon={Cancel01Icon} className="size-4" aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </span>
  );
}

export default function PricingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="px-6 pt-20 pb-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Free with your keys. A plan when you&rsquo;d rather not.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            better-vault is open source and works fully with your own API keys. Pro and Max add
            Better Vault AI, so you can ask without a key, and cloud storage for your backups.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20" aria-label="Plans">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={
                plan.featured
                  ? "relative flex flex-col gap-6 rounded-3xl bg-card p-6 ring-2 ring-foreground"
                  : "flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-border"
              }
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {plan.featured ? (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.per}</span>
                </p>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>
              <Link
                href={plan.cta.href}
                className={buttonVariants({
                  variant: plan.featured ? "default" : "outline",
                  size: "lg",
                })}
              >
                {plan.cta.label}
              </Link>
              <ul className="flex flex-col gap-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-center text-sm text-muted-foreground">
          Prices in US dollars, billed monthly through Polar. Subscribe from the app in Settings →
          Subscription.
        </p>
      </section>

      <section className="border-t px-6 py-20" aria-labelledby="compare-title">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <h2 id="compare-title" className="font-heading text-3xl font-semibold tracking-tight">
            Compare plans
          </h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-xl text-start text-sm">
              <caption className="sr-only">What each better-vault plan includes</caption>
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="w-2/5 p-3 text-start font-medium">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.id} scope="col" className="p-3 text-start font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              {comparisonGroups.map((group) => (
                <tbody key={group.title}>
                  <tr className="border-t bg-muted/30">
                    <th
                      scope="colgroup"
                      colSpan={4}
                      className="p-3 text-start text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-t">
                      <th scope="row" className="p-3 text-start font-normal text-muted-foreground">
                        {row.label}
                      </th>
                      <td className="p-3">
                        <Mark value={row.free} />
                      </td>
                      <td className="p-3">
                        <Mark value={row.pro} />
                      </td>
                      <td className="p-3">
                        <Mark value={row.max} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-20" aria-labelledby="pricing-faq-title">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <h2 id="pricing-faq-title" className="font-heading text-3xl font-semibold tracking-tight">
            Questions about plans
          </h2>
          <div className="flex flex-col divide-y rounded-xl border">
            {pricingFaq.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  <h3>{item.question}</h3>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t px-6 py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance">
            Start free. Upgrade in the app.
          </h2>
          <Link href="/download" className={buttonVariants({ size: "lg" })}>
            Download better-vault
          </Link>
        </div>
      </section>
    </main>
  );
}
