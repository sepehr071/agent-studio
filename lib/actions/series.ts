"use server";

import { revalidatePath } from "next/cache";
import {
  addSeriesKeyterm,
  createSeries,
  deleteSeries,
  deleteSeriesKeyterm,
  deleteSeriesSpeakerName,
  rememberSeriesSpeakerName,
  setKeytermSource,
  updateSeries,
} from "@/lib/db/queries";
import type { MeetingSeriesRow } from "@/lib/db/schema";

export async function createSeriesAction(input: {
  name: string;
  emailTone?: string | null;
}): Promise<MeetingSeriesRow> {
  const series = createSeries({ id: crypto.randomUUID(), ...input });
  revalidatePath("/series");
  return series;
}

export async function updateSeriesAction(
  id: string,
  patch: Partial<Pick<MeetingSeriesRow, "name" | "emailTone">>,
) {
  updateSeries(id, patch);
  revalidatePath("/series");
  revalidatePath(`/series/${id}`);
}

export async function deleteSeriesAction(id: string) {
  deleteSeries(id);
  revalidatePath("/series");
}

// ---------------------------------------------------------------- glossary

export async function addKeytermAction(
  seriesId: string,
  term: string,
  source: "manual" | "suggested" | "accepted" = "manual",
) {
  const trimmed = term.trim();
  if (!trimmed) return;
  addSeriesKeyterm({ id: crypto.randomUUID(), seriesId, term: trimmed, source });
  revalidatePath(`/series/${seriesId}`);
}

export async function acceptKeytermAction(seriesId: string, id: string) {
  setKeytermSource(id, "accepted");
  revalidatePath(`/series/${seriesId}`);
}

export async function deleteKeytermAction(seriesId: string, id: string) {
  deleteSeriesKeyterm(id);
  revalidatePath(`/series/${seriesId}`);
}

// ---------------------------------------------------------------- speaker memory

export async function rememberSpeakerNameAction(
  seriesId: string,
  displayName: string,
) {
  const trimmed = displayName.trim();
  if (!trimmed) return;
  rememberSeriesSpeakerName({
    id: crypto.randomUUID(),
    seriesId,
    displayName: trimmed,
  });
  revalidatePath(`/series/${seriesId}`);
}

export async function deleteSpeakerNameAction(seriesId: string, id: string) {
  deleteSeriesSpeakerName(id);
  revalidatePath(`/series/${seriesId}`);
}
