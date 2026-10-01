import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetailShell } from "@/components/app/meeting-detail-shell";
import {
  getLatestMeetingSummary,
  getMeeting,
  getMeetingTranscript,
  listMeetingSpeakers,
  listSeries,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meeting = getMeeting(id);
  return { title: meeting ? meeting.title : "جلسه" };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = getMeeting(id);
  if (!meeting) notFound();

  const speakers = listMeetingSpeakers(id);
  const transcript = getMeetingTranscript(id);
  const summary = getLatestMeetingSummary(id);
  const series = listSeries();

  return (
    <MeetingDetailShell
      meeting={meeting}
      speakers={speakers}
      transcript={transcript ?? null}
      summary={summary ?? null}
      series={series}
    />
  );
}
