/**
 * Meetings pipeline — drives a meeting through
 * `uploaded → transcribing → summarizing → done` (or `failed`).
 *
 * Kicked as a detached background task by the upload/process/regenerate routes
 * (`void runPipeline(id)`). The DB row's `status`/`stage`/`errorMessage` is the
 * single source of truth; the detail page polls `/api/meetings/[id]/status`.
 *
 * Cancellation is process-local: an `AbortController` registry on `globalThis`
 * (same globalThis-guard pattern as `lib/db`). The cancel route flips status to
 * `failed` synchronously for instant UI feedback; this module just stops doing
 * more work at the next stage boundary so we don't burn another Scribe /
 * OpenRouter call.
 *
 * Server-only by construction (filesystem + secret keys + SQLite). Never import
 * from a client component.
 */
import {
  createMeetingTranscript,
  discardSummaryRevision,
  getLatestMeetingSummary,
  getMeeting,
  getMeetingTranscript,
  getSeries,
  listMeetingSpeakers,
  renameMeetingSpeaker,
  setMeetingLanguage,
  setMeetingStatus,
  upsertMeetingSpeaker,
  upsertMeetingSummary,
} from "@/lib/db/queries";
import type { MeetingRow, MeetingSpeakerRow } from "@/lib/db/schema";
import type { ScribeWord } from "@/lib/db/types";
import {
  addSuggestedTerms,
  getActiveKeyterms,
  listKnownSpeakerNames,
  upsertSpeakerName,
} from "@/lib/meetings/glossary";
import { buildDiarizedPrompt, buildMinutesSegments } from "@/lib/meetings/segment";
import {
  MEETING_SUMMARY_MODEL,
  type SummaryArtifacts,
  summarize,
} from "@/lib/meetings/summary";
import { transcribe } from "@/lib/meetings/transcription";

/** Marker written into `errorMessage` when the user cancels a run. */
export const CANCELLED_SENTINEL = "لغو شده توسط کاربر";

/** Stage labels surfaced to the polling UI (Persian). */
export const STAGE = {
  transcribing: "در حال رونویسی صدا…",
  summarizing: "در حال خلاصه‌سازی…",
} as const;

// ---------------------------------------------------------------- cancel registry

type JobRegistry = Map<string, AbortController>;

const globalForJobs = globalThis as unknown as {
  __studioMeetingJobs?: JobRegistry;
};

function jobs(): JobRegistry {
  return (globalForJobs.__studioMeetingJobs ??= new Map());
}

function registerJob(meetingId: string): AbortController {
  const controller = new AbortController();
  jobs().set(meetingId, controller);
  return controller;
}

function unregisterJob(meetingId: string): void {
  jobs().delete(meetingId);
}

/**
 * Signal an in-flight pipeline to abort at its next stage boundary. Returns
 * false if no in-flight pipeline is registered for this id.
 */
export function requestCancel(meetingId: string): boolean {
  const controller = jobs().get(meetingId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** True if a pipeline is currently registered (in-flight) for this meeting. */
export function isJobRunning(meetingId: string): boolean {
  return jobs().has(meetingId);
}

class CancelledByUser extends Error {
  constructor() {
    super(CANCELLED_SENTINEL);
    this.name = "CancelledByUser";
  }
}

function checkCancel(signal: AbortSignal): void {
  if (signal.aborted) throw new CancelledByUser();
}

// ---------------------------------------------------------------- context

interface MeetingContext {
  audioPath: string | null;
  numSpeakers: number | null;
  meetingBrief: string | null;
  seriesId: string | null;
  emailTone: string;
  keyterms: string[];
  seriesName: string | null;
  language: string;
}

function loadContext(meeting: MeetingRow): MeetingContext {
  let emailTone = meeting.emailTone ?? "formal";
  let seriesName: string | null = null;
  let keyterms: string[] = [];

  if (meeting.seriesId) {
    const series = getSeries(meeting.seriesId);
    if (series) {
      seriesName = series.name;
      // Meeting tone wins; fall back to series default.
      if (!meeting.emailTone && series.emailTone) emailTone = series.emailTone;
    }
    keyterms = getActiveKeyterms(meeting.seriesId);
  }

  return {
    audioPath: meeting.audioPath,
    numSpeakers: meeting.numSpeakers,
    meetingBrief: meeting.meetingBrief,
    seriesId: meeting.seriesId,
    emailTone,
    keyterms,
    seriesName,
    language: meeting.language ?? "fas",
  };
}

/**
 * Assemble the per-meeting context block fed to the summarizer: user brief +
 * series name + known speaker-name memory (for consistent speaker mapping
 * across recurring meetings).
 */
function buildSummaryContext(ctx: MeetingContext): string | null {
  const sections: string[] = [];
  if (ctx.seriesName) sections.push(`سری جلسات: ${ctx.seriesName}`);
  if (ctx.seriesId) {
    const knownNames = listKnownSpeakerNames(ctx.seriesId);
    if (knownNames.length > 0) {
      sections.push(
        "گویندگانِ شناخته‌شده از جلسات پیشینِ این سری: " +
          knownNames.slice(0, 20).join("، "),
      );
    }
  }
  if (ctx.meetingBrief && ctx.meetingBrief.trim()) {
    sections.push(ctx.meetingBrief.trim());
  }
  return sections.length ? sections.join("\n\n") : null;
}

// ---------------------------------------------------------------- persistence

/**
 * Write the transcript row, append any newly-discovered speaker labels without
 * clobbering manual `displayName` edits, reflect the detected language. Returns
 * the words for downstream prompt/minutes building.
 */
function persistTranscript(
  meetingId: string,
  result: Awaited<ReturnType<typeof transcribe>>,
): ScribeWord[] {
  createMeetingTranscript({
    id: crypto.randomUUID(),
    meetingId,
    rawJson: result.raw,
    plainText: result.plainText,
    wordsJson: result.words,
    languageCode: result.languageCode || "fas",
  });

  const existing = new Set(
    listMeetingSpeakers(meetingId).map((s) => s.speakerId),
  );
  for (const sid of result.speakerIds) {
    if (existing.has(sid)) continue;
    upsertMeetingSpeaker({
      id: crypto.randomUUID(),
      meetingId,
      speakerId: sid,
      displayName: null,
    });
    existing.add(sid);
  }

  if (result.languageCode) setMeetingLanguage(meetingId, result.languageCode);

  return result.words;
}

/**
 * Apply LLM-suggested speaker names. Manual-edit-wins: any speaker that already
 * has a non-empty `displayName` is left alone. Newly-applied names are pushed
 * into the series glossary + speaker-name memory. Returns the count updated.
 */
function applySpeakerNames(
  meetingId: string,
  seriesId: string | null,
  mapping: SummaryArtifacts["speakerNames"],
): number {
  if (!mapping.length) return 0;

  const existing: MeetingSpeakerRow[] = listMeetingSpeakers(meetingId);
  const named = new Map(
    existing.map((s) => [s.speakerId, (s.displayName ?? "").trim()]),
  );

  let applied = 0;
  const appliedNames: string[] = [];
  for (const entry of mapping) {
    const speakerId = entry.speakerId;
    const newName = (entry.displayName ?? "").trim();
    if (!speakerId || !newName) continue;
    // Skip speakers Scribe never produced.
    if (!named.has(speakerId)) continue;
    // Manual-edit-wins.
    if (named.get(speakerId)) continue;
    renameMeetingSpeaker(meetingId, speakerId, newName);
    named.set(speakerId, newName);
    appliedNames.push(newName);
    applied += 1;
  }

  if (seriesId && appliedNames.length) {
    for (const name of appliedNames) upsertSpeakerName(seriesId, name);
    addSuggestedTerms(seriesId, appliedNames);
  }
  return applied;
}

/**
 * Upsert a summary version into a fixed `summaryId` row. Minutes are server-built
 * (from the diarized words) so long meetings don't get truncated by the LLM, and
 * are carried through every partial snapshot so the row is always renderable.
 *
 * Used for BOTH the progressive partials (streaming) and the final authoritative
 * result — same id, so partials fill the row in place and the validated object
 * overwrites it, leaving exactly one row per run. `markDone` flips status to
 * `done`; partial writes leave the meeting in `summarizing`.
 */
function persistSummary(
  meetingId: string,
  summaryId: string,
  artifacts: SummaryArtifacts,
  words: ScribeWord[],
  model: string,
  markDone: boolean,
): string {
  upsertMeetingSummary({
    id: summaryId,
    meetingId,
    execSummary: artifacts.execSummary,
    actionItems: artifacts.actionItems,
    decisions: artifacts.decisions,
    minutes: buildMinutesSegments(words),
    qa: artifacts.qa,
    openQuestions: artifacts.openQuestions,
    emailSubject: artifacts.emailSubject,
    emailBody: artifacts.emailBody,
    emailTone: artifacts.emailTone,
    model,
  });
  // upsertMeetingSummary already points latestSummaryId at the row.
  if (markDone) setMeetingStatus(meetingId, "done", null, null);
  return summaryId;
}

/**
 * Build the `onPartial` callback that progressively writes streamed snapshots
 * into the run's summary row. Cheap, best-effort, and synchronous from the
 * stream loop's perspective; failures are swallowed by `summarize`.
 */
function partialWriter(
  meetingId: string,
  summaryId: string,
  words: ScribeWord[],
  model: string,
): (artifacts: SummaryArtifacts) => void {
  return (artifacts) => {
    persistSummary(meetingId, summaryId, artifacts, words, model, false);
  };
}

function fail(meetingId: string, errorText: string): void {
  try {
    setMeetingStatus(meetingId, "failed", null, errorText);
  } catch {
    // Defensive — never throw from the failure path.
  }
}

// ---------------------------------------------------------------- state machine

/**
 * Drive a meeting through transcribing → summarizing → done. Idempotent: a
 * DONE meeting returns immediately. Errors flip the row to `failed` with a
 * readable Persian `errorMessage`; never rethrows (it's a detached task).
 */
export async function runPipeline(meetingId: string): Promise<void> {
  let meeting = getMeeting(meetingId);
  if (!meeting) return;
  if (meeting.status === "done") return;

  const controller = registerJob(meetingId);
  const { signal } = controller;

  // Set once the summary stream begins; lifted out of the try so the cancel
  // path can drop a half-built partial (a first run has no prior summary to
  // restore, so we discard to null).
  let summaryId: string | null = null;

  try {
    // ---- TRANSCRIBE ----
    setMeetingStatus(meetingId, "transcribing", STAGE.transcribing, null);
    checkCancel(signal);

    meeting = getMeeting(meetingId) ?? meeting;
    let ctx = loadContext(meeting);
    if (!ctx.audioPath) throw new Error("این جلسه فایل صوتی ندارد.");

    const result = await transcribe(ctx.audioPath, {
      numSpeakers: ctx.numSpeakers,
      keyterms: ctx.keyterms.length ? ctx.keyterms : null,
      languageCode: ctx.language,
      signal,
    });
    checkCancel(signal);

    const words = persistTranscript(meetingId, result);
    if (!words.length) {
      throw new Error("رونوشت ذخیره شد اما هیچ واژهٔ زمان‌داری نداشت.");
    }
    checkCancel(signal);

    // ---- SUMMARIZE ----
    setMeetingStatus(meetingId, "summarizing", STAGE.summarizing, null);
    checkCancel(signal);

    meeting = getMeeting(meetingId) ?? meeting;
    ctx = loadContext(meeting);
    const prompt = buildDiarizedPrompt(words);
    const summaryContext = buildSummaryContext(ctx);

    // One fixed row id for the whole run: partial snapshots fill it in place,
    // the final validated result overwrites it. The polling UI renders whatever
    // is there while status='summarizing'.
    summaryId = crypto.randomUUID();

    const artifacts = await summarize(prompt, {
      context: summaryContext,
      emailTone: ctx.emailTone,
      meetingId,
      signal,
      onPartial: partialWriter(
        meetingId,
        summaryId,
        words,
        MEETING_SUMMARY_MODEL,
      ),
    });
    checkCancel(signal);

    applySpeakerNames(meetingId, ctx.seriesId, artifacts.speakerNames);
    persistSummary(meetingId, summaryId, artifacts, words, MEETING_SUMMARY_MODEL, true);
  } catch (error) {
    // A `CancelledByUser` at a stage boundary OR an AbortError thrown from
    // mid-stream `streamObject` both mean the user cancelled.
    if (error instanceof CancelledByUser || signal.aborted) {
      // Drop any partial we streamed (a first run has no prior summary).
      if (summaryId) {
        try {
          discardSummaryRevision(meetingId, summaryId, null);
        } catch {
          // best-effort cleanup
        }
      }
      // The cancel route already flipped status to failed + sentinel; if it
      // didn't (programmatic abort), record it now.
      const current = getMeeting(meetingId);
      if (current && current.status !== "failed") {
        fail(meetingId, CANCELLED_SENTINEL);
      }
      return;
    }
    fail(meetingId, error instanceof Error ? error.message : String(error));
  } finally {
    unregisterJob(meetingId);
  }
}

/**
 * Re-run summarization against an existing transcript (no re-upload / re-STT).
 * Appends a new summary version + repoints `latestSummaryId`. Returns the new
 * summary id, or empty string on cancellation. Flips to `failed` on error.
 */
export async function regenerateSummary(meetingId: string): Promise<string> {
  const meeting = getMeeting(meetingId);
  if (!meeting) throw new Error(`جلسهٔ ${meetingId} یافت نشد.`);

  const transcript = getMeetingTranscript(meetingId);
  const words = (transcript?.wordsJson ?? []) as ScribeWord[];
  if (!words.length) {
    throw new Error("امکان تولید دوباره نیست: این جلسه رونوشتی ندارد.");
  }

  const controller = registerJob(meetingId);
  const { signal } = controller;

  // The summary standing before this regenerate; restored if we get cancelled
  // mid-stream so a half-built partial never replaces a finished brief.
  const priorLatestId = meeting.latestSummaryId ?? null;
  // Regenerate streams into a fresh row id (a new summary version), filling it
  // progressively just like the first run.
  const summaryId = crypto.randomUUID();

  try {
    setMeetingStatus(meetingId, "summarizing", STAGE.summarizing, null);
    checkCancel(signal);

    const fresh = getMeeting(meetingId) ?? meeting;
    const ctx = loadContext(fresh);
    const prompt = buildDiarizedPrompt(words);
    const summaryContext = buildSummaryContext(ctx);

    const artifacts = await summarize(prompt, {
      context: summaryContext,
      emailTone: ctx.emailTone,
      meetingId,
      signal,
      onPartial: partialWriter(
        meetingId,
        summaryId,
        words,
        MEETING_SUMMARY_MODEL,
      ),
    });
    checkCancel(signal);

    applySpeakerNames(meetingId, ctx.seriesId, artifacts.speakerNames);
    return persistSummary(
      meetingId,
      summaryId,
      artifacts,
      words,
      MEETING_SUMMARY_MODEL,
      true,
    );
  } catch (error) {
    if (error instanceof CancelledByUser || signal.aborted) {
      // Drop any partial we streamed and reinstate the prior summary.
      try {
        discardSummaryRevision(meetingId, summaryId, priorLatestId);
      } catch {
        // best-effort cleanup
      }
      const current = getMeeting(meetingId);
      if (current && current.status !== "failed") {
        fail(meetingId, CANCELLED_SENTINEL);
      }
      return "";
    }
    fail(meetingId, error instanceof Error ? error.message : String(error));
    return "";
  } finally {
    unregisterJob(meetingId);
  }
}

/** Re-export for callers that want the latest summary after a regenerate. */
export { getLatestMeetingSummary };
