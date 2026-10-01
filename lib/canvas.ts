import type { ChatMessage } from "@/lib/tools";

export interface CanvasArtifact {
  /** Full self-contained HTML document (or fragment) to preview */
  code: string;
}

const HTML_FENCE = /```html\s*\n([\s\S]*?)```/g;

/**
 * Find the last complete fenced ```html block in a message's text parts —
 * the canvas previews the most recent runnable artifact.
 */
export function extractCanvasArtifact(
  parts: ChatMessage["parts"],
): CanvasArtifact | null {
  let last: string | null = null;

  for (const part of parts) {
    if (part.type !== "text") continue;
    for (const match of part.text.matchAll(HTML_FENCE)) {
      const code = match[1].trim();
      if (code) last = code;
    }
  }

  return last ? { code: last } : null;
}

/** Wrap a fragment into a previewable document if it isn't one already. */
export function composeSrcDoc(code: string): string {
  if (/<html[\s>]/i.test(code)) return code;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
${code}
</body>
</html>`;
}
