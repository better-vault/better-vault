export const themeStorageKey = "better-vault:theme";

/**
 * Runs before the page paints (inlined in <head> by the server layout), so a
 * dark theme never flashes light.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(themeStorageKey)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
