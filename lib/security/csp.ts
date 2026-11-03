import { createHash } from "node:crypto";

/**
 * The Content-Security-Policy and other headers the built app is served
 * with, by the web server (server/node.ts) and the desktop app
 * (desktop/src/protocol.ts). The page may run only its own scripts, plus
 * Google's sign-in and Picker, and may send data only to itself and the
 * storage services' APIs. AI providers are reached through the app's own
 * API, so they need no entry here. The dev server goes without, since Vite
 * injects scripts of its own.
 */

/** The hashes of the inline scripts in index.html (the theme script), for script-src. */
export function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
  );
}

export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  const google = {
    script: ["https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com"],
    connect: [
      "https://accounts.google.com",
      "https://www.googleapis.com",
      "https://content.googleapis.com",
    ],
    frame: [
      "https://accounts.google.com",
      "https://docs.google.com",
      "https://drive.google.com",
      "https://content.googleapis.com",
    ],
  };
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...scriptHashes, ...google.script],
    // React and Panel set inline styles; Tailwind's are in files.
    "style-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "blob:", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      // The web app's update check and Google, Microsoft and OneDrive's APIs.
      "https://api.github.com",
      ...google.connect,
      "https://graph.microsoft.com",
      "https://login.microsoftonline.com",
      // OneDrive's upload sessions answer with addresses on these hosts.
      "https://*.sharepoint.com",
      "https://*.files.1drv.com",
    ],
    "frame-src": google.frame,
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** Every header the app's pages are sent with. */
export function securityHeaders(scriptHashes: readonly string[]): Record<string, string> {
  return {
    "content-security-policy": contentSecurityPolicy(scriptHashes),
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  };
}
