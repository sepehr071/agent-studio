/**
 * Abort an in-flight meeting pipeline. Signals the AbortController registry
 * (best-effort — Scribe HTTP can't be torn down mid-call, so the abort lands
 * at the next stage boundary) AND flips status to `failed` + a cancel sentinel
 * synchronously for instant UI feedback.
 */
import { getMeeting, setMeetingStatus } from "@/lib/db/queries";
import { CANCELLED_SENTINEL, requestCancel } from "@/lib/meetings/pipeline";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const meeting = getMeeting(id);
  if (!meeting) {
    return Response.json({ error: "جلسه یافت نشد." }, { status: 404 });
  }

  const signalled = requestCancel(id);

  // Synchronous flip for instant feedback — the pipeline sees the abort signal
  // at its next boundary and stops without re-touching status.
  if (meeting.status === "transcribing" || meeting.status === "summarizing") {
    setMeetingStatus(id, "failed", null, CANCELLED_SENTINEL);
  }

  return Response.json({ id, cancelled: signalled, status: "failed" });
}
