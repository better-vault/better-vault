import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanPrefix, getObject, listObjects, putObject } from "./s3";

const credentials = {
  service: "r2" as const,
  accessKeyId: "id",
  secretAccessKey: "secret",
  bucket: "notes",
  accountId: "0123456789abcdef0123456789abcdef",
  prefix: "vault",
};

afterEach(() => vi.unstubAllGlobals());

describe("S3 and R2", () => {
  it("lists folders and files inside the prefix, signed for R2", async () => {
    const fetch = vi.fn(async (request: Request) => {
      expect(request.url).toContain(
        "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/notes?",
      );
      expect(request.url).toContain("prefix=vault%2F");
      expect(request.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
      return new Response(
        `<ListBucketResult><CommonPrefixes><Prefix>vault/biology/</Prefix></CommonPrefixes>
         <Contents><Key>vault/notes &amp; ideas.md</Key><Size>42</Size><LastModified>2026-11-01T10:00:00.000Z</LastModified></Contents>
         </ListBucketResult>`,
      );
    });
    vi.stubGlobal("fetch", fetch);
    const files = await listObjects(credentials);
    expect(files).toEqual([
      { id: "vault/biology/", name: "biology", folder: true },
      {
        id: "vault/notes & ideas.md",
        name: "notes & ideas.md",
        size: 42,
        modified: Date.parse("2026-11-01T10:00:00.000Z"),
      },
    ]);
  });

  it("refuses files outside the prefix, and turns S3 errors into sentences", async () => {
    await expect(getObject(credentials, "other/secret.txt")).rejects.toThrow("outside the folder");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<Error><Code>SignatureDoesNotMatch</Code></Error>", { status: 403 }),
      ),
    );
    await expect(
      putObject(credentials, "backups", "b.json", new Uint8Array([1]), "application/json"),
    ).rejects.toThrow("secret access key doesn't match");
  });

  it("keeps the prefix to one trailing slash", () => {
    expect(cleanPrefix("/vault")).toBe("vault/");
    expect(cleanPrefix("")).toBe("");
  });
});
