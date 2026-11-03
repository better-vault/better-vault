import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, inlineScriptHashes } from "./csp";

describe("content security policy", () => {
  it("allows the inline theme script by its hash, and no other inline script", () => {
    const html = `<head><script>var a=1</script><script type="module" src="/assets/index.js"></script></head>`;
    const expected = `'sha256-${createHash("sha256").update("var a=1").digest("base64")}'`;
    expect(inlineScriptHashes(html)).toEqual([expected]);
    const policy = contentSecurityPolicy(inlineScriptHashes(html));
    expect(policy).toContain(`script-src 'self' ${expected}`);
    expect(policy).not.toContain("'unsafe-inline' https://accounts.google.com https://apis");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
  });

  it("keeps plugins, other sites' frames of the app and form posts out", () => {
    const policy = contentSecurityPolicy([]);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
  });
});
