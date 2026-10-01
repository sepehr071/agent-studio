/**
 * Re-run summarization against the existing transcript (no re-upload / re-STT).
 * Appends a new summary version and repoints `latestSummaryId`. Detached so the
 * client can poll `/status`; returns immediately after kicking the task.
 */
import { getMeeting, getMeetingTranscript } from "@/lib/db/queries";
import { isJobRunning, regenerateSummary } from "@/lib/meetings/pipeline";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const meeting = getMeeting(id);
  if (!meeting) {
    return Response.json({ error: "جلسه یافت نشد." }, { status: 404 });
  }
  if (isJobRunning(id)) {
    return Response.json(
      { error: "پردازشِ این جلسه در حال انجام است." },
      { status: 409 },
    );
  }
  const transcript = getMeetingTranscript(id);
  if (!transcript || !(transcript.wordsJson?.length ?? 0)) {
    return Response.json(
      { error: "امکان تولید دوباره نیست: این جلسه رونوشتی ندارد." },
      { status: 400 },
    );
  }

  void regenerateSummary(id);

  return Response.json({ id, status: "summarizing" });
}
