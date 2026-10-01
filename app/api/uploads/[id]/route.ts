/**
 * Stream an uploaded file from disk. The path comes ONLY from the DB row
 * (resolved + confined to `.data/uploads/`); the URL id is just a DB key, so
 * there is no user-controlled path component and no traversal surface.
 * Owned by track F.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getUpload } from "@/lib/db/queries";
import { nodeStreamToWeb } from "@/lib/server/node-stream";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const row = getUpload(id);
  if (!row) {
    return Response.json({ error: "یافت نشد" }, { status: 404 });
  }

  // Resolve the stored (relative) path and confine it under the uploads dir.
  const abs = path.resolve(process.cwd(), row.filePath);
  const rel = path.relative(UPLOAD_DIR, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return Response.json({ error: "مسیر نامعتبر" }, { status: 400 });
  }

  let size: number;
  try {
    const info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
    size = info.size;
  } catch {
    return Response.json({ error: "فایل روی دیسک موجود نیست" }, { status: 404 });
  }

  const nodeStream = createReadStream(abs);
  const webStream = nodeStreamToWeb(nodeStream);

  const asciiName = row.filename.replace(/[^\x20-\x7e]/g, "_");
  const encodedName = encodeURIComponent(row.filename);

  return new Response(webStream, {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
