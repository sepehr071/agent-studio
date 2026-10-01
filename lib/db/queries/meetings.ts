import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type MeetingRow,
  type MeetingSpeakerRow,
  type MeetingSummaryRow,
  type MeetingTranscriptRow,
  meetingSpeakers,
  meetingSummaries,
  meetingTranscripts,
  meetings,
} from "@/lib/db/schema";
import type {
  ActionItem,
  Decision,
  MinutesSegment,
  QAEntry,
} from "@/lib/db/types";

export type MeetingStatus = MeetingRow["status"];

// ---------------------------------------------------------------- meetings

export interface MeetingListOptions {
  seriesId?: string;
  limit?: number;
}

export function listMeetings({
  seriesId,
  limit = 200,
}: MeetingListOptions = {}): MeetingRow[] {
  return db
    .select()
    .from(meetings)
    .where(seriesId ? eq(meetings.seriesId, seriesId) : undefined)
    .orderBy(desc(meetings.createdAt))
    .limit(limit)
    .all();
}

export function getMeeting(id: string): MeetingRow | undefined {
  return db.select().from(meetings).where(eq(meetings.id, id)).get();
}

export interface CreateMeetingInput {
  id: string;
  title?: string;
  audioPath?: string | null;
  language?: string;
  seriesId?: string | null;
  emailTone?: string | null;
}

export function createMeeting(input: CreateMeetingInput): MeetingRow {
  const now = new Date();
  db.insert(meetings)
    .values({
      id: input.id,
      title: input.title ?? "جلسه بدون عنوان",
      status: "uploaded",
      audioPath: input.audioPath ?? null,
      language: input.language ?? "fas",
      seriesId: input.seriesId ?? null,
      emailTone: input.emailTone ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getMeeting(input.id) as MeetingRow;
}

export function updateMeeting(
  id: string,
  patch: Partial<
    Pick<
      MeetingRow,
      | "title"
      | "status"
      | "stage"
      | "audioPath"
      | "durationS"
      | "numSpeakers"
      | "meetingBrief"
      | "seriesId"
      | "emailTone"
      | "errorMessage"
      | "latestSummaryId"
    >
  >,
): void {
  db.update(meetings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .run();
}

export function setMeetingStatus(
  id: string,
  status: MeetingStatus,
  stage?: string | null,
  errorMessage?: string | null,
): void {
  db.update(meetings)
    .set({
      status,
      stage: stage ?? null,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id))
    .run();
}

export function deleteMeeting(id: string): void {
  db.delete(meetings).where(eq(meetings.id, id)).run();
}

/** Reflect the detected/normalized language code Scribe returned. */
export function setMeetingLanguage(id: string, language: string): void {
  db.update(meetings)
    .set({ language, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .run();
}

/**
 * Flip any meeting stuck mid-pipeline (`transcribing`/`summarizing`) to
 * `failed`. A meeting in those states whose process died can never resume, so
 * the UI should show a retry affordance instead of polling forever.
 *
 * NOTE: this is also run at boot inside `lib/db/index.ts` (right after
 * `migrate()`), wrapped in try/catch so it never blocks boot. This exported
 * variant lets the meetings list page call it defensively as well.
 *
 * Returns the number of rows flipped.
 */
export function reconcileOrphanedMeetings(): number {
  const result = db
    .update(meetings)
    .set({
      status: "failed",
      errorMessage: "پردازش به دلیل راه‌اندازی مجدد سرور قطع شد.",
      updatedAt: new Date(),
    })
    .where(inArray(meetings.status, ["transcribing", "summarizing"]))
    .run();
  return result.changes;
}

// ---------------------------------------------------------------- speakers

export function listMeetingSpeakers(meetingId: string): MeetingSpeakerRow[] {
  return db
    .select()
    .from(meetingSpeakers)
    .where(eq(meetingSpeakers.meetingId, meetingId))
    .orderBy(asc(meetingSpeakers.speakerId))
    .all();
}

/** Insert a speaker label, ignore if it already exists for the meeting. */
export function upsertMeetingSpeaker(input: {
  id: string;
  meetingId: string;
  speakerId: string;
  displayName?: string | null;
}): void {
  const now = new Date();
  db.insert(meetingSpeakers)
    .values({
      id: input.id,
      meetingId: input.meetingId,
      speakerId: input.speakerId,
      displayName: input.displayName ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
}

export function renameMeetingSpeaker(
  meetingId: string,
  speakerId: string,
  displayName: string,
): void {
  db.update(meetingSpeakers)
    .set({ displayName, updatedAt: new Date() })
    .where(
      and(
        eq(meetingSpeakers.meetingId, meetingId),
        eq(meetingSpeakers.speakerId, speakerId),
      ),
    )
    .run();
}

// ---------------------------------------------------------------- transcripts

export function getMeetingTranscript(
  meetingId: string,
): MeetingTranscriptRow | undefined {
  return db
    .select()
    .from(meetingTranscripts)
    .where(eq(meetingTranscripts.meetingId, meetingId))
    .orderBy(desc(meetingTranscripts.createdAt))
    .get();
}

export interface CreateTranscriptInput {
  id: string;
  meetingId: string;
  rawJson?: unknown;
  plainText?: string;
  wordsJson?: MeetingTranscriptRow["wordsJson"];
  languageCode?: string | null;
}

export function createMeetingTranscript(
  input: CreateTranscriptInput,
): MeetingTranscriptRow {
  db.insert(meetingTranscripts)
    .values({
      id: input.id,
      meetingId: input.meetingId,
      rawJson: input.rawJson ?? null,
      plainText: input.plainText ?? "",
      wordsJson: input.wordsJson ?? null,
      languageCode: input.languageCode ?? null,
      createdAt: new Date(),
    })
    .run();
  return getMeetingTranscript(input.meetingId) as MeetingTranscriptRow;
}

// ---------------------------------------------------------------- summaries

export function listMeetingSummaries(
  meetingId: string,
): MeetingSummaryRow[] {
  return db
    .select()
    .from(meetingSummaries)
    .where(eq(meetingSummaries.meetingId, meetingId))
    .orderBy(desc(meetingSummaries.createdAt))
    .all();
}

export function getMeetingSummary(
  id: string,
): MeetingSummaryRow | undefined {
  return db
    .select()
    .from(meetingSummaries)
    .where(eq(meetingSummaries.id, id))
    .get();
}

export interface CreateSummaryInput {
  id: string;
  meetingId: string;
  execSummary?: string | null;
  actionItems?: ActionItem[] | null;
  decisions?: Decision[] | null;
  minutes?: MinutesSegment[] | null;
  qa?: QAEntry[] | null;
  openQuestions?: string[] | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailTone?: string | null;
  model?: string | null;
}

/** Append a summary version and point the meeting's latestSummaryId at it. */
export function createMeetingSummary(
  input: CreateSummaryInput,
): MeetingSummaryRow {
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(meetingSummaries)
      .values({
        id: input.id,
        meetingId: input.meetingId,
        execSummary: input.execSummary ?? null,
        actionItemsJson: input.actionItems ?? null,
        decisionsJson: input.decisions ?? null,
        minutesJson: input.minutes ?? null,
        qaJson: input.qa ?? null,
        openQuestionsJson: input.openQuestions ?? null,
        emailSubject: input.emailSubject ?? null,
        emailBody: input.emailBody ?? null,
        emailTone: input.emailTone ?? null,
        model: input.model ?? null,
        createdAt: now,
      })
      .run();
    tx.update(meetings)
      .set({ latestSummaryId: input.id, updatedAt: now })
      .where(eq(meetings.id, input.meetingId))
      .run();
  });
  return getMeetingSummary(input.id) as MeetingSummaryRow;
}

/**
 * Insert-or-update a summary row by id and point `latestSummaryId` at it.
 *
 * Used by the streaming summarizer to progressively fill ONE summary row in
 * place as `streamObject` yields partial snapshots — so the polling detail page
 * can render growing content during `summarizing` without spawning a new row
 * per chunk. On conflict it overwrites the JSON/email/exec columns (so each
 * partial fully replaces the previous snapshot) while preserving `createdAt`.
 * The final validated result lands through this same path, leaving exactly one
 * authoritative row for the run.
 */
export function upsertMeetingSummary(
  input: CreateSummaryInput,
): MeetingSummaryRow {
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(meetingSummaries)
      .values({
        id: input.id,
        meetingId: input.meetingId,
        execSummary: input.execSummary ?? null,
        actionItemsJson: input.actionItems ?? null,
        decisionsJson: input.decisions ?? null,
        minutesJson: input.minutes ?? null,
        qaJson: input.qa ?? null,
        openQuestionsJson: input.openQuestions ?? null,
        emailSubject: input.emailSubject ?? null,
        emailBody: input.emailBody ?? null,
        emailTone: input.emailTone ?? null,
        model: input.model ?? null,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: meetingSummaries.id,
        set: {
          execSummary: input.execSummary ?? null,
          actionItemsJson: input.actionItems ?? null,
          decisionsJson: input.decisions ?? null,
          minutesJson: input.minutes ?? null,
          qaJson: input.qa ?? null,
          openQuestionsJson: input.openQuestions ?? null,
          emailSubject: input.emailSubject ?? null,
          emailBody: input.emailBody ?? null,
          emailTone: input.emailTone ?? null,
          model: input.model ?? null,
        },
      })
      .run();
    tx.update(meetings)
      .set({ latestSummaryId: input.id, updatedAt: now })
      .where(eq(meetings.id, input.meetingId))
      .run();
  });
  return getMeetingSummary(input.id) as MeetingSummaryRow;
}

/**
 * Discard a streamed (partial) summary revision and restore the meeting's
 * `latestSummaryId` to a prior pointer. Used when a regenerate is cancelled
 * mid-stream: the half-built row is removed and the previously-complete summary
 * is reinstated, so a cancel never leaves a partial standing in for a finished
 * brief. No-op safe if the row never got created.
 */
export function discardSummaryRevision(
  meetingId: string,
  revisionId: string,
  restoreLatestId: string | null,
): void {
  const now = new Date();
  db.transaction((tx) => {
    tx.delete(meetingSummaries)
      .where(eq(meetingSummaries.id, revisionId))
      .run();
    tx.update(meetings)
      .set({ latestSummaryId: restoreLatestId, updatedAt: now })
      .where(eq(meetings.id, meetingId))
      .run();
  });
}

/** The newest summary for a meeting (latestSummaryId pointer or fallback). */
export function getLatestMeetingSummary(
  meetingId: string,
): MeetingSummaryRow | undefined {
  const meeting = getMeeting(meetingId);
  if (meeting?.latestSummaryId) {
    const byPointer = getMeetingSummary(meeting.latestSummaryId);
    if (byPointer) return byPointer;
  }
  return db
    .select()
    .from(meetingSummaries)
    .where(eq(meetingSummaries.meetingId, meetingId))
    .orderBy(desc(meetingSummaries.createdAt))
    .get();
}
