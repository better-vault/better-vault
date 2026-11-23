/**
 * Checks a mod's CSS before it is installed and again before it is applied:
 * a mod may restyle the app but load nothing and run nothing. Returns what is
 * wrong, or null when the CSS is safe.
 */
export function unsafeCss(css: string): string | null {
  if (css.length > 200_000) return "the CSS is larger than 200 KB.";
  // Comments could hide what follows, and escapes could spell words in hex.
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\\[0-9a-f]/i.test(plain)) return "escaped characters are not allowed.";
  if (/@import/i.test(plain)) return "@import is not allowed.";
  if (/<\/?\s*style/i.test(plain)) return "the CSS may not close its <style>.";
  if (/expression\s*\(|javascript:|behavior\s*:|-moz-binding/i.test(plain))
    return "scripting in CSS is not allowed.";
  for (const match of plain.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    if (!/^data:(image|font)\//i.test(match[2].trim()))
      return "url() may only hold a data: picture or font.";
  }
  if (/image-set\(|src\(/i.test(plain) && !/data:/i.test(plain))
    return "images may only be data: URLs.";
  return null;
}

/** The CSS a turned-on mod adds, or nothing when it fails the check. */
export function safeModCss(css: string | undefined): string {
  return css && !unsafeCss(css) ? css : "";
}
