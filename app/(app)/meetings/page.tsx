import type { Metadata } from "next";
import { MeetingsList } from "@/components/app/meetings-list";
import { listMeetings, listSeries } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "جلسات" };

export default function MeetingsPage() {
  const meetings = listMeetings({ limit: 200 });
  const series = listSeries();
  return <MeetingsList meetings={meetings} series={series} />;
}
