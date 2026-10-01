/**
 * Audio upload storage for meetings. Streams a binary body to disk in chunks
 * (never buffers the whole file) under `.data/meetings/<meetingId>.<ext>`.
 * Ported from `meeting_storage.py`.
 *
 * Server-only by construction (filesystem). Never import from a client
 * component.
 */
import { createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Default audio cap: 500 MB. */
const MAX_BYTES = 500 * 1024 * 1024;

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/flac": ".flac",
  "audio/x-flac": ".flac",
  "video/webm": ".webm",
  "video/mp4": ".mp4",
};

const ALLOWED_EXTS = new Set([
  ".webm",
  ".ogg",
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".mp4",
  ".mpga",
  ".oga",
]);

export class AudioTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioTooLargeError";
  }
}

/** `.data/meetings` — the meetings audio root. */
export function meetingsRoot(): string {
  return path.join(process.cwd(), ".data", "meetings");
}

/**
 * Best-effort extension picker. Resolution order:
 *   1. Explicit Content-Type → known mapping.
 *   2. Filename suffix (lower-cased) if in the allow-list.
 *   3. `.webm` fallback (matches getDisplayMedia/getUserMedia default).
 */
export function resolveExtension(
  contentType: string | null,
  filename: string | null,
): string {
  const ct = (contentType ?? "").toLowerCase().split(";")[0].trim();
  if (ct in CONTENT_TYPE_TO_EXT) return CONTENT_TYPE_TO_EXT[ct];

  if (filename) {
    const suffix = path.extname(filename).toLowerCase();
    if (ALLOWED_EXTS.has(suffix)) return suffix;
  }
  return ".webm";
}

export interface SaveAudioResult {
  /** Relative-to-cwd path stored in the DB (`.data/meetings/<id>.<ext>`). */
  filePath: string;
  /** Extension without the leading dot. */
  ext: string;
  bytesWritten: number;
}

/**
 * Stream a Web `ReadableStream` (e.g. `request.body`) to disk in chunks,
 * enforcing the byte cap. Removes the partial file on cap-hit or any IO error.
 *
 * @throws AudioTooLargeError when the payload exceeds the cap.
 */
export async function saveAudioStream(
  body: ReadableStream<Uint8Array>,
  options: {
    meetingId: string;
    contentType: string | null;
    filename: string | null;
    maxBytes?: number;
  },
): Promise<SaveAudioResult> {
  const cap = options.maxBytes ?? MAX_BYTES;
  const root = meetingsRoot();
  await mkdir(root, { recursive: true });

  const ext = resolveExtension(options.contentType, options.filename);
  const absTarget = path.join(root, `${options.meetingId}${ext}`);
  const relTarget = path.relative(process.cwd(), absTarget);

  let written = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength;
      if (written > cap) {
        controller.error(
          new AudioTooLargeError(
            `حجم صدا از سقف مجاز (${cap} بایت) بیشتر شد.`,
          ),
        );
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const nodeReadable = Readable.fromWeb(
    body.pipeThrough(counter) as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  const out = createWriteStream(absTarget);

  try {
    await pipeline(nodeReadable, out);
  } catch (error) {
    await unlink(absTarget).catch(() => {});
    throw error;
  }

  return { filePath: relTarget, ext: ext.replace(/^\./, ""), bytesWritten: written };
}

/** Absolute path on disk from a stored (cwd-relative) audio path. */
export function resolveAudioAbsPath(storedPath: string): string {
  return path.isAbsolute(storedPath)
    ? storedPath
    : path.join(process.cwd(), storedPath);
}

/** Probe a stored audio file's byte size; null if it can't be stat'd. */
export async function audioFileSize(storedPath: string): Promise<number | null> {
  try {
    const info = await stat(resolveAudioAbsPath(storedPath));
    return info.size;
  } catch {
    return null;
  }
}

/** Best-effort delete of a meeting's audio file. Never throws. */
export async function deleteAudioFile(
  storedPath: string | null | undefined,
): Promise<void> {
  if (!storedPath) return;
  await unlink(resolveAudioAbsPath(storedPath)).catch(() => {});
}
