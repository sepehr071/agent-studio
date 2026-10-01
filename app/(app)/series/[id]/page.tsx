import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeriesDetail } from "@/components/app/series-detail";
import {
  getSeries,
  listMeetings,
  listSeriesKeyterms,
  listSeriesSpeakerNames,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const series = getSeries(id);
  return { title: series ? series.name : "سری جلسات" };
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const series = getSeries(id);
  if (!series) notFound();

  const keyterms = listSeriesKeyterms(id);
  const speakerNames = listSeriesSpeakerNames(id);
  const meetings = listMeetings({ seriesId: id, limit: 200 });

  return (
    <SeriesDetail
      series={series}
      keyterms={keyterms}
      speakerNames={speakerNames}
      meetings={meetings}
    />
  );
}
