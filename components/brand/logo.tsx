import Image from "next/image";
import { cn } from "@/lib/utils";

/** The better-vault crow, in the colour that suits the theme. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <Image
        src="/brand/logo-light-transparent.png"
        alt=""
        width={size}
        height={size}
        className="dark:hidden"
        priority
      />
      <Image
        src="/brand/logo-dark-transparent.png"
        alt=""
        width={size}
        height={size}
        className="hidden dark:block"
        priority
      />
    </span>
  );
}
