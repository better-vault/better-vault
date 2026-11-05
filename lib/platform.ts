import { desktopBridge } from "@/lib/desktop/bridge";

/** Whether this is a Mac (or iPad), where shortcuts use ⌘ instead of Ctrl. */
export function isApple(): boolean {
  const platform = desktopBridge()?.platform;
  if (platform) return platform === "darwin";
  if (typeof navigator === "undefined") return false;
  const hint = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  return /mac|iphone|ipad|ipod/i.test(hint || navigator.platform || navigator.userAgent);
}

/** The keys of a `mod+…` shortcut as this system writes them: `["⌘", "K"]` or `["Ctrl", "K"]`. */
export function shortcutKeys(key: string): string[] {
  return [isApple() ? "⌘" : "Ctrl", key.toUpperCase()];
}
