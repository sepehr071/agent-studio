/**
 * MCP tool-result sanitizer — external servers return unbounded payloads
 * (one Gmail read came back as 2.7MB of base64url-encoded HTML, which became
 * a 920k-token prompt). Truncating alone wastes the budget on escaped markup,
 * so this pipeline makes results SMALL AND USEFUL instead:
 *
 *   1. JSON payloads embedded as text (the common MCP shape) are parsed and
 *      walked so each field is sanitized individually.
 *   2. Base64/base64url strings are decoded; text decodes are kept as plain
 *      text, binary decodes are dropped with a marker.
 *   3. HTML is stripped to readable text (styles/scripts/tags/entities).
 *   4. Long fields are capped, and the whole result has a hard backstop.
 *
 * Pure module (no server-only import) so it stays unit-testable from node.
 */

/** Hard cap on a whole tool result, in JSON characters (~12k tokens). */
const MAX_RESULT_CHARS = 50_000;
/** Cap on any single string field after sanitization. */
const MAX_FIELD_CHARS = 8_000;
/** Strings shorter than this pass through untouched. */
const MIN_SUSPECT_CHARS = 2_048;
const MAX_DEPTH = 32;

export function sanitizeMcpToolOutput(output: unknown): unknown {
  const sanitized = sanitizeValue(output, 0);
  const raw = safeStringify(sanitized);
  if (raw === null || raw.length <= MAX_RESULT_CHARS) return sanitized;
  return {
    content: [
      {
        type: "text",
        text: raw.slice(0, MAX_RESULT_CHARS) + truncationNote(raw.length),
      },
    ],
  };
}

function truncationNote(originalLength: number): string {
  return (
    `\n\n[خروجی ابزار بیش از حد بزرگ بود و کوتاه شد (${originalLength} کاراکتر). ` +
    "برای دریافت داده کامل، درخواست را محدودتر کن — فیلدهای کمتر یا تعداد کمتر.]"
  );
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return value;
  if (typeof value === "string") return sanitizeString(value, depth);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = sanitizeValue(item, depth + 1);
    }
    return out;
  }
  return value;
}

function sanitizeString(value: string, depth: number): string {
  if (value.length < MIN_SUSPECT_CHARS) return value;

  // JSON payload embedded as a text field — sanitize its fields individually.
  const head = value.trimStart();
  if (head.startsWith("{") || head.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      const sanitized = safeStringify(sanitizeValue(parsed, depth + 1));
      if (sanitized !== null) return sanitized;
    } catch {
      // not JSON — fall through
    }
  }

  if (isProbablyBase64(value)) {
    const decoded = tryDecodeBase64Text(value);
    if (decoded === null) {
      return `[داده باینری حذف شد — ${value.length} کاراکتر]`;
    }
    return capField(toPlainText(decoded), value.length);
  }

  return capField(toPlainText(value), value.length);
}

/** Whole string is base64/base64url alphabet (sampled, whitespace-tolerant). */
function isProbablyBase64(value: string): boolean {
  const sample = value.slice(0, 1_024).replace(/\s/g, "");
  if (sample.length < 256) return false;
  return /^[A-Za-z0-9+/_=-]+$/.test(sample);
}

/** Decode base64/base64url; return null when the result is binary, not text. */
function tryDecodeBase64Text(value: string): string | null {
  try {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    if (decoded.length === 0) return null;
    let bad = 0;
    const probe = decoded.slice(0, 4_096);
    for (const ch of probe) {
      const code = ch.codePointAt(0) ?? 0;
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0xfffd) {
        bad++;
      }
    }
    return bad / probe.length > 0.1 ? null : decoded;
  } catch {
    return null;
  }
}

/** Strip HTML down to readable text; non-HTML strings pass through. */
function toPlainText(value: string): string {
  if (!looksLikeHtml(value)) return value;
  return value
    .replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&zwnj;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<(?:!doctype|html|head|body|div|p|br|span|table|td|tr|a|img|style|meta)[\s>/]/i.test(
    value.slice(0, 4_096),
  );
}

function capField(value: string, originalLength: number): string {
  if (value.length <= MAX_FIELD_CHARS) return value;
  return (
    value.slice(0, MAX_FIELD_CHARS) +
    ` …[کوتاه شد — ${originalLength} کاراکتر]`
  );
}
