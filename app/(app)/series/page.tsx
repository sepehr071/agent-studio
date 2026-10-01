import type { Metadata } from "next";
import { SeriesList } from "@/components/app/series-list";
import { listMeetings, listSeries } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "سری جلسات" };

export default function SeriesPage() {
  const series = listSeries();
  // Count meetings per series in one pass (small single-user dataset).
  const meetings = listMeetings({ limit: 1000 });
  const counts: Record<string, number> = {};
  for (const m of meetings) {
    if (m.seriesId) counts[m.seriesId] = (counts[m.seriesId] ?? 0) + 1;
  }

  const cards = series.map((s) => ({ ...s, meetingCount: counts[s.id] ?? 0 }));
  return <SeriesList series={cards} />;
}
