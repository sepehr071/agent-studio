/**
 * Server-only document text extraction for uploads.
 *
 * docx  → mammoth.extractRawText (plain text)
 * xlsx  → exceljs, one block per sheet, cells joined with tabs (csv-ish)
 * txt / csv / json / md / log → decoded as UTF-8 verbatim
 * html / htm  → stripped to text
 * pdf   → NOT extracted locally; flagged `native-pdf` so the chat route can
 *         attach it as a `file` part for the OpenRouter file-parser plugin.
 * images (image/*) → no extraction (handled by vision models as image parts)
 *
 * Extracted text is capped; callers persist `extractStatus` to the DB.
 * Never imported from a client component (uses Node Buffers + native libs).
 */
import type { ExtractStatus } from "@/lib/db/queries";

/** Hard cap on stored extracted text (~400k chars). */
export const MAX_EXTRACTED_CHARS = 400_000;

export interface ExtractResult {
  text: string;
  status: ExtractStatus;
}

/** Plain-text-ish extensions we decode straight as UTF-8. */
const PLAIN_TEXT_EXTS = new Set([
  "txt",
  "text",
  "csv",
  "tsv",
  "json",
  "md",
  "markdown",
  "log",
  "yml",
  "yaml",
  "xml",
]);

/** Cap text and report whether it was truncated. */
function capText(text: string): ExtractResult {
  if (text.length > MAX_EXTRACTED_CHARS) {
    return { text: text.slice(0, MAX_EXTRACTED_CHARS), status: "truncated" };
  }
  return { text, status: "ok" };
}

/** Naive HTML → text: drop script/style, strip tags, decode a few entities. */
function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutBlocks
    .replace(/<\/(p|div|li|tr|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  // Use the ArrayBuffer input path — avoids a Buffer-generic type mismatch
  // between @types/node's `Buffer<ArrayBufferLike>` and mammoth's `Buffer`.
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);

  const blocks: string[] = [];
  workbook.eachSheet((sheet) => {
    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        // `cell.text` renders the displayed value (handles dates/formulas)
        cells.push(cell.text ?? "");
      });
      const line = cells.join("\t").replace(/\t+$/, "");
      if (line.trim()) lines.push(line);
    });
    if (lines.length) {
      blocks.push(`# ${sheet.name}\n${lines.join("\n")}`);
    }
  });
  return blocks.join("\n\n");
}

/**
 * Extract text from an uploaded file. Pure: takes bytes + metadata, returns
 * `{ text, status }`. Wrap each branch defensively — a malformed office file
 * must downgrade to `error`, never throw.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  ext: string | null,
): Promise<ExtractResult> {
  const e = (ext ?? "").toLowerCase().replace(/^\./, "");
  const mime = mimeType.toLowerCase();

  // PDFs: not extracted locally — sent as a file part to the OpenRouter parser
  if (mime === "application/pdf" || e === "pdf") {
    return { text: "", status: "native-pdf" };
  }

  // Images: no text extraction (vision models read them as image parts)
  if (mime.startsWith("image/")) {
    return { text: "", status: "unavailable" };
  }

  try {
    // Word (.docx) — mammoth. Legacy .doc is not supported by mammoth.
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      e === "docx"
    ) {
      return capText(await extractDocx(buffer));
    }

    // Excel (.xlsx) — exceljs. Legacy .xls is not supported.
    if (
      mime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      e === "xlsx"
    ) {
      return capText(await extractXlsx(buffer));
    }

    // HTML — strip to text
    if (mime === "text/html" || e === "html" || e === "htm") {
      return capText(htmlToText(buffer.toString("utf-8")));
    }

    // Plain-text family — decode verbatim
    if (mime.startsWith("text/") || PLAIN_TEXT_EXTS.has(e)) {
      return capText(buffer.toString("utf-8"));
    }
  } catch {
    // Malformed document, unsupported variant, etc. — never throw.
    return { text: "", status: "error" };
  }

  // Unknown binary type we can't extract.
  return { text: "", status: "unavailable" };
}

/** Map an extension to a sane fallback mime when the browser sent none. */
export function inferMimeFromExt(ext: string | null): string | null {
  switch ((ext ?? "").toLowerCase().replace(/^\./, "")) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "txt":
    case "text":
    case "log":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "tsv":
      return "text/tab-separated-values";
    case "json":
      return "application/json";
    case "md":
    case "markdown":
      return "text/markdown";
    case "html":
    case "htm":
      return "text/html";
    default:
      return null;
  }
}
