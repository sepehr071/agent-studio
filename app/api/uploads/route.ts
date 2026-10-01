/**
 * Multipart upload: persist bytes to `.data/uploads/<id>.<ext>`, extract text
 * (docx via mammoth, xlsx via exceljs, plain decode for text family, HTML
 * stripped; PDFs flagged `native-pdf` for the OpenRouter file-parser; images
 * left for vision models), insert a row, and return the upload contract.
 * Owned by the Templates+Usage+Uploads track (F).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createUpload } from "@/lib/db/queries";
import { extractText, inferMimeFromExt } from "@/lib/uploads/extract";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

/**
 * Hard cap on a single upload (25 MB). Route Handlers do NOT inherit the
 * Server-Action `bodySizeLimit`, so without this an arbitrarily large multipart
 * POST would buffer into memory and OOM the process.
 */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Lower cap before invoking the in-memory docx/xlsx parsers (mammoth/exceljs),
 * which decompress + materialize the document on top of the raw buffer — a
 * smaller cap keeps the worst-case memory bounded.
 */
const MAX_PARSE_BYTES = 15 * 1024 * 1024;

/** Allow-list of safe single extensions (lowercased, no dot). */
function safeExt(filename: string): string | null {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const raw = base.slice(dot + 1).toLowerCase();
  // Only word chars — blocks path tricks and double extensions sneaking a slash
  return /^[a-z0-9]{1,12}$/.test(raw) ? raw : null;
}

export async function POST(req: Request) {
  // Reject oversized uploads BEFORE buffering the body into memory. An honest
  // client sends Content-Length; this short-circuits the multipart parse for
  // anything over the cap so we never materialize a huge file.
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "حجم فایل از سقف مجاز (۲۵ مگابایت) بیشتر است" },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "بدنه نامعتبر است (multipart انتظار می‌رفت)" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "هیچ فایلی ارسال نشد" },
      { status: 400 },
    );
  }

  const conversationId = (() => {
    const v = form.get("conversationId");
    return typeof v === "string" && v.length > 0 ? v : null;
  })();

  const filename = file.name || "upload";
  const ext = safeExt(filename);
  const mimeType =
    file.type || inferMimeFromExt(ext) || "application/octet-stream";

  // Defensive cap: a client can lie about / omit Content-Length. `file.size`
  // is known after multipart parse, before we copy bytes out.
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "حجم فایل از سقف مجاز (۲۵ مگابایت) بیشتر است" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  // id is a UUID (no path chars); ext is allow-listed — path is safe by construction
  const storedName = ext ? `${id}.${ext}` : id;
  const filePath = path.join(UPLOAD_DIR, storedName);

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(filePath, bytes);
  } catch {
    return Response.json(
      { error: "ذخیره فایل روی دیسک ناموفق بود" },
      { status: 500 },
    );
  }

  // Independent, lower cap before the in-memory docx/xlsx parsers run. Over the
  // cap, the file is still stored but text extraction is skipped to bound peak
  // memory (PDFs/images already short-circuit inside extractText).
  const { text, status } =
    bytes.byteLength > MAX_PARSE_BYTES
      ? { text: "", status: "unavailable" as const }
      : await extractText(bytes, mimeType, ext);

  // Store a path relative to cwd so the DB stays portable
  const relPath = path.relative(process.cwd(), filePath);

  try {
    createUpload({
      id,
      filename,
      mimeType,
      ext,
      sizeBytes: bytes.byteLength,
      filePath: relPath,
      extractedText: text || null,
      extractStatus: status,
      conversationId,
    });
  } catch {
    return Response.json(
      { error: "ثبت رکورد فایل ناموفق بود" },
      { status: 500 },
    );
  }

  return Response.json({
    id,
    url: `/api/uploads/${id}`,
    filename,
    mimeType,
    extractedText: text,
    extractStatus: status,
  });
}
