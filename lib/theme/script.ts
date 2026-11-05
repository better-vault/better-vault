export const themeStorageKey = "better-vault:theme";
export const accentStorageKey = "better-vault:accent";

/** The primary colours in Settings → Appearance; `default` is the neutral one. */
export const accents = [
  "default",
  "blue",
  "violet",
  "teal",
  "green",
  "amber",
  "orange",
  "rose",
] as const;

export type Accent = (typeof accents)[number];

/**
 * Runs before the page paints (inlined in <head> by the server layout), so a
 * dark theme never flashes light, nor the primary colour the default one.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";var a=localStorage.getItem(${JSON.stringify(accentStorageKey)});if(a&&a!=="default")r.dataset.accent=a}catch(e){}})()`;
