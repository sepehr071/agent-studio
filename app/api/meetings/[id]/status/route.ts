/**
 * Poll meeting pipeline status. The detail page hits this every ~2s while a
 * meeting is mid-pipeline.
 *
 * Returns `summaryRevision` — the meeting's `updatedAt` epoch — so the client
 * can detect *content* changes within a single in-progress summary row. The
 * streaming summarizer upserts the same `latestSummaryId` row repeatedly during
 * `summarizing`, bumping `updatedAt` each time, while `latestSummaryId` itself
 * stays constant; the client refreshes whenever this token moves to pull the
 * growing partial summary that was server-rendered.
 */
import { getMeeting } from "@/lib/db/queries";
import { isJobRunning } from "@/lib/meetings/pipeline";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const meeting = getMeeting(id);
  if (!meeting) {
    return Response.json({ error: "جلسه یافت نشد." }, { status: 404 });
  }

  return Response.json({
    id,
    status: meeting.status,
    stage: meeting.stage ?? null,
    error: meeting.errorMessage ?? null,
    running: isJobRunning(id),
    latestSummaryId: meeting.latestSummaryId ?? null,
    summaryRevision: meeting.updatedAt?.getTime() ?? 0,
  });
}
