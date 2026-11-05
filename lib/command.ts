/** Opens the command palette from anywhere (a button, a menu). */
const OPEN = "better-vault:open-command";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN));
}

export function onOpenCommandPalette(listener: () => void) {
  window.addEventListener(OPEN, listener);
  return () => window.removeEventListener(OPEN, listener);
}
