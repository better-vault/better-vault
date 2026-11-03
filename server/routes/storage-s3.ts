import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { getObject, listObjects, putObject, testBucket } from "@/lib/storage/s3";

const credentialsSchema = z.object({
  service: z.enum(["s3", "r2"]),
  accessKeyId: z.string().min(1).max(200),
  secretAccessKey: z.string().min(1).max(200),
  bucket: z.string().min(1).max(100),
  region: z.string().max(40).optional(),
  endpoint: z.string().max(300).optional(),
  accountId: z.string().max(64).optional(),
  prefix: z.string().max(300).optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test"), credentials: credentialsSchema }),
  z.object({
    action: z.literal("list"),
    credentials: credentialsSchema,
    folder: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("get"),
    credentials: credentialsSchema,
    key: z.string().min(1).max(1000),
  }),
  z.object({
    action: z.literal("put"),
    credentials: credentialsSchema,
    folder: z.enum(["backups", "exports"]),
    name: z.string().min(1).max(200),
    contentType: z.string().max(100),
    /** The file, as base64. */
    data: z.string(),
  }),
]);

/**
 * S3 and R2, with the keys sent in each request: test the keys, list a
 * folder, read a file (answered as the file itself) or write one into
 * better-vault's folders. Nothing is stored or logged.
 */
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Invalid request." }, { status: 415 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "test":
        await testBucket(body.credentials);
        return Response.json({ ok: true });
      case "list":
        return Response.json({ files: await listObjects(body.credentials, body.folder) });
      case "get": {
        const object = await getObject(body.credentials, body.key);
        return new Response(object.body, {
          headers: {
            "content-type": object.headers.get("content-type") ?? "application/octet-stream",
          },
        });
      }
      case "put":
        return Response.json({
          key: await putObject(
            body.credentials,
            body.folder,
            body.name,
            Uint8Array.from(Buffer.from(body.data, "base64")),
            body.contentType,
          ),
        });
    }
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
