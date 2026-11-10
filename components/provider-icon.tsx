import type { ProviderId } from "@/lib/ai/catalog";
import { Logo } from "@/components/brand/logo";
import { providerMarks } from "@/lib/ai/provider-icons";

/** A provider's logo, in the text colour. Decorative: the name is always shown beside it. */
export function ProviderIcon({
  provider,
  size = 18,
  className,
}: {
  provider: ProviderId;
  size?: number;
  className?: string;
}) {
  // Better Vault AI shows the app's own crow, so it's clear the subscription is in use.
  if (provider === "bettervault") return <Logo size={size} className={className} />;
  const mark = providerMarks[provider];
  return (
    <svg
      aria-hidden
      viewBox={mark.viewBox}
      width={size}
      height={size}
      fill="currentColor"
      fillRule={mark.evenOdd ? "evenodd" : undefined}
      className={className}
    >
      {mark.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
