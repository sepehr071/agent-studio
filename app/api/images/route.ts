import path from "node:path";
import { getGeneratedImage, getUpload } from "@/lib/db/queries";
import { generateAndPersistImage, safeRemoteImageUrl } from "@/lib/images/generate";

/**
 * Thin wrapper over `generateAndPersistImage` (lib/images/generate.ts): this
 * route owns request parsing/validation and i2i reference-image resolution
 * (upload-id lookup + SSRF guard), then delegates generation, the file write,
 * persistence, and usage logging to the shared core. The `generate_image` chat
 * tool calls that same core directly.
 */

/** Hard cap on i2i reference images regardless of model. */
const MAX_INPUT_IMAGES = 4;

interface GenerateImageRequest {
  prompt?: string;
  negativePrompt?: string | null;
  modelId?: string;
  mode?: "t2i" | "i2i";
  aspectHint?: string | null;
  styleHint?: string | null;
  /** Base64 data URLs (or validated https public-host URLs) — dropzone path. */
  inputImages?: string[];
  /** Upload ids resolved server-side to data URLs — the /api/uploads path. */
  inputImageIds?: string[];
}

/** Resolve upload ids to data URLs by reading the stored file off disk. */
async function resolveInputImageIds(ids: string[]): Promise<string[]> {
  const { readFile } = await import("node:fs/promises");
  const dataRoot = path.join(process.cwd(), ".data");
  const out: string[] = [];
  for (const id of ids) {
    const row = getUpload(id);
    if (!row || !row.mimeType.startsWith("image/")) continue;
    const abs = path.resolve(dataRoot, row.filePath);
    if (abs !== dataRoot && !abs.startsWith(dataRoot + path.sep)) continue;
    try {
      const bytes = await readFile(abs);
      out.push(`data:${row.mimeType};base64,${bytes.toString("base64")}`);
    } catch {
      // Missing file — skip silently.
    }
  }
  return out;
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error:
          "کلید OPENROUTER_API_KEY تنظیم نشده است. آن را در .env.local قرار دهید و سرور را دوباره راه‌اندازی کنید.",
      },
      { status: 500 },
    );
  }

  let body: GenerateImageRequest;
  try {
    body = (await req.json()) as GenerateImageRequest;
  } catch {
    return Response.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  const modelId = body.modelId?.trim();
  if (!prompt) {
    return Response.json(
      { error: "متن درخواست (پرامپت) را وارد کنید." },
      { status: 400 },
    );
  }
  if (!modelId) {
    return Response.json({ error: "یک مدل تصویر انتخاب کنید." }, { status: 400 });
  }

  // Gather i2i reference images from both supported sources, capped. Inline
  // data URLs pass through; remote references must survive SSRF validation
  // (https + public host) before OpenRouter is asked to fetch them.
  const directImages = (body.inputImages ?? [])
    .filter((u): u is string => typeof u === "string")
    .map((u) => {
      if (u.startsWith("data:image/")) return u;
      return safeRemoteImageUrl(u);
    })
    .filter((u): u is string => u !== null);
  const resolvedFromIds = body.inputImageIds?.length
    ? await resolveInputImageIds(body.inputImageIds)
    : [];
  const inputImages = [...directImages, ...resolvedFromIds].slice(
    0,
    MAX_INPUT_IMAGES,
  );

  let result: { id: string; url: string };
  try {
    result = await generateAndPersistImage({
      prompt,
      modelId,
      negativePrompt: body.negativePrompt ?? null,
      aspectHint: body.aspectHint ?? null,
      styleHint: body.styleHint ?? null,
      inputImages,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "خطای ناشناخته";
    return Response.json(
      { error: `تولید تصویر ناموفق بود: ${detail}` },
      { status: 502 },
    );
  }

  const row = getGeneratedImage(result.id);
  return Response.json({
    id: result.id,
    url: result.url,
    prompt: row?.prompt ?? prompt,
    mode: row?.mode ?? (inputImages.length > 0 ? "i2i" : "t2i"),
    createdAt: row?.createdAt,
  });
}
