import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGeneratedImage } from "@/lib/db/queries";
import { logUsage } from "@/lib/usage/log";

/**
 * Image generation via OpenRouter `chat/completions` with
 * `modalities: ['image','text']`. The model returns the image inside
 * `choices[0].message.images[0].image_url.url` as a base64 data URL (some
 * models instead put the data URL in `message.content`). We decode it, write
 * the file to `.data/images/<id>.<ext>`, persist a row, and log usage.
 *
 * Shared by the `/api/images` route (studio) and the `generate_image` chat
 * tool. Mirrors the reference Python `OpenRouterService.generate_image` payload.
 */

const IMAGES_DIR = path.join(process.cwd(), ".data", "images");

interface OpenRouterImage {
  type?: string;
  image_url?: { url?: string };
}

interface OpenRouterImageResponse {
  model?: string;
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
      images?: OpenRouterImage[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  error?: { message?: string };
}

/** Decode a `data:<mime>;base64,<payload>` URL into bytes + mime type. */
export function decodeDataUrl(
  dataUrl: string,
): { bytes: Buffer; mimeType: string } | null {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { bytes, mimeType };
}

/**
 * Validate a client-supplied http(s) image reference before forwarding it to
 * OpenRouter (which fetches it on our behalf — a blind-SSRF/exfil vector if we
 * pass anything through). Require https, a parseable URL, and a public host
 * (reject loopback / private / link-local / metadata ranges). Returns the
 * normalized URL or null to drop it.
 */
export function safeRemoteImageUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase();
  // Hostnames that are obviously internal.
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return null;
  }
  // Literal IPs: block loopback, private, link-local and the cloud metadata IP.
  // IPv6 hosts arrive bracketed; ::1 / fc00::/7 / fe80::/10 are non-routable.
  if (host.startsWith("[")) {
    const v6 = host.slice(1, -1);
    if (v6 === "::1" || /^f[cd]/i.test(v6) || /^fe[89ab]/i.test(v6)) return null;
  } else {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      if (
        a === 0 || // "this" network
        a === 10 || // 10.0.0.0/8
        a === 127 || // loopback
        (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) // 192.168.0.0/16
      ) {
        return null;
      }
    }
  }
  return url.toString();
}

function extForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

/** POST OpenRouter chat/completions with image modality. */
async function generateImageOnce(
  model: string,
  fullPrompt: string,
  inputImages: string[],
): Promise<OpenRouterImageResponse> {
  const key = process.env.OPENROUTER_API_KEY;
  const content =
    inputImages.length > 0
      ? [
          { type: "text", text: fullPrompt },
          ...inputImages.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ]
      : fullPrompt;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Agent Studio",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const json = (await res.json()) as OpenRouterImageResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `وضعیت ${res.status}`);
  }
  return json;
}

/** 3-attempt retry around `generateImageOnce` (DNS/conn flaps). */
async function generateImageWithRetry(
  model: string,
  fullPrompt: string,
  inputImages: string[],
): Promise<OpenRouterImageResponse> {
  const delays = [0, 800, 2400];
  let lastError: unknown;
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      return await generateImageOnce(model, fullPrompt, inputImages);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Pull the generated image data URL out of the OpenRouter response. */
export function extractImageDataUrl(json: OpenRouterImageResponse): string | null {
  const message = json.choices?.[0]?.message;
  if (!message) return null;
  const fromImages = message.images?.[0]?.image_url?.url;
  if (fromImages && fromImages.startsWith("data:image")) return fromImages;
  if (message.content && message.content.startsWith("data:image")) {
    return message.content;
  }
  return null;
}

export interface GenerateImageOptions {
  prompt: string;
  modelId: string;
  negativePrompt?: string | null;
  aspectHint?: string | null;
  styleHint?: string | null;
  /** i2i reference images as data URLs or pre-validated remote https URLs. */
  inputImages?: string[];
}

export interface GenerateImageResult {
  id: string;
  url: string;
}

/**
 * Generate an image, write it to disk, persist the row, and log usage. Returns
 * the persisted id and its serving URL (`/api/images/<id>/file`). Throws a
 * readable Persian error on any failure (no image returned, undecodable
 * response, disk-write failure) — callers map it to an HTTP status or surface
 * it to the model.
 */
export async function generateAndPersistImage(
  opts: GenerateImageOptions,
): Promise<GenerateImageResult> {
  const inputImages = opts.inputImages ?? [];
  const mode: "t2i" | "i2i" = inputImages.length > 0 ? "i2i" : "t2i";

  const fullPrompt = opts.negativePrompt?.trim()
    ? `${opts.prompt}\n\nNegative prompt: ${opts.negativePrompt.trim()}`
    : opts.prompt;

  const response = await generateImageWithRetry(
    opts.modelId,
    fullPrompt,
    inputImages,
  );

  const dataUrl = extractImageDataUrl(response);
  if (!dataUrl) {
    throw new Error(
      "مدل تصویری بازنگرداند. مدل دیگری را امتحان کنید یا درخواست را بازنویسی کنید.",
    );
  }

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) {
    throw new Error("پاسخ تصویری مدل قابل پردازش نبود.");
  }

  const id = crypto.randomUUID();
  const ext = extForMime(decoded.mimeType);
  const relativePath = path.join("images", `${id}.${ext}`);
  const absolutePath = path.join(IMAGES_DIR, `${id}.${ext}`);

  try {
    await mkdir(IMAGES_DIR, { recursive: true });
    await writeFile(absolutePath, decoded.bytes);
  } catch {
    throw new Error("ذخیره فایل تصویر روی دیسک ناموفق بود.");
  }

  // Persist any i2i reference images so the row's inputImagePaths survive and
  // the original references can be re-shown / cleaned up later.
  const inputImagePaths: string[] = [];
  if (inputImages.length > 0) {
    for (let i = 0; i < inputImages.length; i++) {
      const ref = decodeDataUrl(inputImages[i]);
      if (!ref) continue;
      const refExt = extForMime(ref.mimeType);
      const refRel = path.join("images", `${id}-ref${i}.${refExt}`);
      try {
        await writeFile(
          path.join(IMAGES_DIR, `${id}-ref${i}.${refExt}`),
          ref.bytes,
        );
        inputImagePaths.push(refRel);
      } catch {
        // Reference persistence is best-effort.
      }
    }
  }

  const row = createGeneratedImage({
    id,
    prompt: opts.prompt,
    negativePrompt: opts.negativePrompt?.trim() || null,
    modelId: opts.modelId,
    mode,
    aspectHint: opts.aspectHint ?? null,
    styleHint: opts.styleHint ?? null,
    filePath: relativePath,
    mimeType: decoded.mimeType,
    inputImagePaths: inputImagePaths.length > 0 ? inputImagePaths : null,
  });

  logUsage({
    model: response.model ?? opts.modelId,
    feature: "image",
    imageId: id,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
    costUsd: response.usage?.cost,
    generationId: response.id,
  });

  return { id: row.id, url: `/api/images/${row.id}/file` };
}
