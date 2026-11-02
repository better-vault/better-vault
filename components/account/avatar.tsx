import { UserIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/icon";
import { initials, type Profile } from "@/lib/db/profile";
import { cn } from "@/lib/utils";

/** The profile picture, else the name's initials, else a person icon. */
export function Avatar({
  profile,
  size = 36,
  className,
}: {
  profile: Profile | undefined;
  size?: number;
  className?: string;
}) {
  const letters = initials(profile?.name ?? "");
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-foreground select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {profile?.avatar ? (
        <img src={profile.avatar} alt="" className="size-full object-cover" />
      ) : letters ? (
        letters
      ) : (
        <Icon icon={UserIcon} size={Math.round(size * 0.5)} className="text-muted-foreground" />
      )}
    </span>
  );
}
