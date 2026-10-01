import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type MeetingSeriesKeytermRow,
  type MeetingSeriesRow,
  type MeetingSeriesSpeakerNameRow,
  meetingSeries,
  meetingSeriesKeyterms,
  meetingSeriesSpeakerNames,
} from "@/lib/db/schema";

// ---------------------------------------------------------------- series

export function listSeries(): MeetingSeriesRow[] {
  return db
    .select()
    .from(meetingSeries)
    .orderBy(desc(meetingSeries.updatedAt))
    .all();
}

export function getSeries(id: string): MeetingSeriesRow | undefined {
  return db
    .select()
    .from(meetingSeries)
    .where(eq(meetingSeries.id, id))
    .get();
}

export interface CreateSeriesInput {
  id: string;
  name: string;
  emailTone?: string | null;
}

export function createSeries(input: CreateSeriesInput): MeetingSeriesRow {
  const now = new Date();
  db.insert(meetingSeries)
    .values({
      id: input.id,
      name: input.name,
      emailTone: input.emailTone ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getSeries(input.id) as MeetingSeriesRow;
}

export function updateSeries(
  id: string,
  patch: Partial<Pick<MeetingSeriesRow, "name" | "emailTone">>,
): void {
  db.update(meetingSeries)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(meetingSeries.id, id))
    .run();
}

export function deleteSeries(id: string): void {
  db.delete(meetingSeries).where(eq(meetingSeries.id, id)).run();
}

// ---------------------------------------------------------------- keyterms (glossary)

export function listSeriesKeyterms(
  seriesId: string,
): MeetingSeriesKeytermRow[] {
  return db
    .select()
    .from(meetingSeriesKeyterms)
    .where(eq(meetingSeriesKeyterms.seriesId, seriesId))
    .orderBy(asc(meetingSeriesKeyterms.term))
    .all();
}

export function addSeriesKeyterm(input: {
  id: string;
  seriesId: string;
  term: string;
  source?: "manual" | "suggested" | "accepted";
}): void {
  db.insert(meetingSeriesKeyterms)
    .values({
      id: input.id,
      seriesId: input.seriesId,
      term: input.term,
      source: input.source ?? "manual",
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .run();
}

export function setKeytermSource(
  id: string,
  source: "manual" | "suggested" | "accepted",
): void {
  db.update(meetingSeriesKeyterms)
    .set({ source })
    .where(eq(meetingSeriesKeyterms.id, id))
    .run();
}

export function deleteSeriesKeyterm(id: string): void {
  db.delete(meetingSeriesKeyterms)
    .where(eq(meetingSeriesKeyterms.id, id))
    .run();
}

// ---------------------------------------------------------------- speaker-name memory

export function listSeriesSpeakerNames(
  seriesId: string,
): MeetingSeriesSpeakerNameRow[] {
  return db
    .select()
    .from(meetingSeriesSpeakerNames)
    .where(eq(meetingSeriesSpeakerNames.seriesId, seriesId))
    .orderBy(desc(meetingSeriesSpeakerNames.lastSeenAt))
    .all();
}

/** Remember a speaker display name within a series; bumps lastSeenAt. */
export function rememberSeriesSpeakerName(input: {
  id: string;
  seriesId: string;
  displayName: string;
}): void {
  const now = new Date();
  db.insert(meetingSeriesSpeakerNames)
    .values({
      id: input.id,
      seriesId: input.seriesId,
      displayName: input.displayName,
      lastSeenAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        meetingSeriesSpeakerNames.seriesId,
        meetingSeriesSpeakerNames.displayName,
      ],
      set: { lastSeenAt: now },
    })
    .run();
}

export function deleteSeriesSpeakerName(id: string): void {
  db.delete(meetingSeriesSpeakerNames)
    .where(eq(meetingSeriesSpeakerNames.id, id))
    .run();
}
