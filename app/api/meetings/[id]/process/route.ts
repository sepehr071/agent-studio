/**
 * Kick the transcription → summary pipeline as a detached background task
 * (`void runPipeline(id)`). The DB row's status/stage is the source of truth;
 * the client polls `/api/meetings/[id]/status`.
 */
import { getMeeting } from "@/lib/db/queries";
import { isJobRunning, runPipeline } from "@/lib/meetings/pipeline";

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
  if (!meeting.audioPath) {
    return Response.json(
      { error: "این جلسه فایل صوتی ندارد." },
      { status: 400 },
    );
  }
  if (
    isJobRunning(id) ||
    meeting.status === "transcribing" ||
    meeting.status === "summarizing"
  ) {
    return Response.json(
      { error: "پردازشِ این جلسه در حال انجام است." },
      { status: 409 },
    );
  }

  // Detached: fire-and-forget. Pipeline owns its own error/status handling.
  void runPipeline(id);

  return Response.json({ id, status: "transcribing" });
}
