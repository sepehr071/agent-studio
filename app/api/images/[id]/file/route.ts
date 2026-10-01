import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGeneratedImage } from "@/lib/db/queries";

/**
 * Stream a generated image file from disk. The on-disk path is resolved ONLY
 * from the DB row (never from user input) and is re-checked to stay inside
 * `.data/` — no path traversal. Content is immutable once generated, so we set
 * a long immutable cache.
 */

const DATA_ROOT = path.join(process.cwd(), ".data");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const row = getGeneratedImage(id);
  if (!row) {
    return Response.json({ error: "تصویر یافت نشد" }, { status: 404 });
  }

  const abs = path.resolve(DATA_ROOT, row.filePath);
  if (abs !== DATA_ROOT && !abs.startsWith(DATA_ROOT + path.sep)) {
    // Poisoned path — refuse to read outside the data root.
    return Response.json({ error: "تصویر یافت نشد" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return Response.json({ error: "تصویر یافت نشد" }, { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mimeType || "image/png",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
