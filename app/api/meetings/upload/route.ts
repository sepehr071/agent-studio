/**
 * Multipart-free audio upload → stream raw request body to `.data/meetings/`
 * → create meeting row. Metadata travels in query params + headers so the
 * audio body can be piped straight to disk without buffering (Web FormData
 * would buffer the whole file into memory).
 *
 * Client contract:
 *   POST /api/meetings/upload?title=...&seriesId=...&numSpeakers=...&emailTone=...
 *   Content-Type: <audio mime>
 *   X-Filename: <original filename>   (optional, for extension fallback)
 *   body: raw audio bytes
 *
 * Returns `{ id }` on success.
 */
import { createMeeting } from "@/lib/db/queries";
import { AudioTooLargeError, saveAudioStream } from "@/lib/meetings/storage";

export const maxDuration = 300;

export async function POST(req: Request) {
  if (!req.body) {
    return Response.json({ error: "بدنهٔ صوتی خالی است." }, { status: 400 });
  }

  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim() || undefined;
  const seriesId = url.searchParams.get("seriesId")?.trim() || null;
  const emailTone = url.searchParams.get("emailTone")?.trim() || null;
  const numSpeakersRaw = url.searchParams.get("numSpeakers");
  const numSpeakers = numSpeakersRaw ? Number(numSpeakersRaw) : null;
  const meetingBrief = url.searchParams.get("brief")?.trim() || null;

  const meetingId = crypto.randomUUID();
  const contentType = req.headers.get("content-type");
  const filename = req.headers.get("x-filename");

  try {
    const saved = await saveAudioStream(req.body, {
      meetingId,
      contentType,
      filename,
    });

    createMeeting({
      id: meetingId,
      title,
      audioPath: saved.filePath,
      seriesId,
      emailTone,
    });

    // Persist optional brief / speaker-count if provided (createMeeting doesn't
    // take them); a lightweight follow-up update keeps the upload route lean.
    if (meetingBrief || (numSpeakers != null && numSpeakers > 0)) {
      const { updateMeeting } = await import("@/lib/db/queries");
      updateMeeting(meetingId, {
        ...(meetingBrief ? { meetingBrief } : {}),
        ...(numSpeakers != null && numSpeakers > 0 ? { numSpeakers } : {}),
      });
    }

    return Response.json({ id: meetingId });
  } catch (error) {
    // saveAudioStream removes its own partial file on cap-hit / IO error. A
    // failure after a successful save leaves at most an orphaned audio file
    // with no DB row — harmless and reclaimable; not worth a guessing unlink.
    if (error instanceof AudioTooLargeError) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    const message =
      error instanceof Error ? error.message : "بارگذاری صدا ناموفق بود.";
    return Response.json({ error: message }, { status: 500 });
  }
}
