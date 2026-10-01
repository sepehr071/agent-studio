"use server";

import { revalidatePath } from "next/cache";
import {
  createConversation,
  deleteMeeting,
  getLatestMeetingSummary,
  getMeeting,
  getSettings,
  listMeetingSpeakers,
  renameMeetingSpeaker,
  updateConversation,
  updateMeeting,
} from "@/lib/db/queries";
import type { MeetingRow } from "@/lib/db/schema";
import { upsertSpeakerName } from "@/lib/meetings/glossary";
import { deleteAudioFile } from "@/lib/meetings/storage";

export async function updateMeetingAction(
  id: string,
  patch: Partial<
    Pick<MeetingRow, "title" | "seriesId" | "emailTone" | "meetingBrief">
  >,
) {
  if (!getMeeting(id)) return;
  updateMeeting(id, patch);
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
}

/** Rename a meeting (title only). */
export async function renameMeetingAction(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed || !getMeeting(id)) return;
  updateMeeting(id, { title: trimmed });
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
}

/** Set the user-provided meeting brief (summarizer context). */
export async function setMeetingBriefAction(id: string, brief: string) {
  if (!getMeeting(id)) return;
  updateMeeting(id, { meetingBrief: brief.trim() || null });
  revalidatePath(`/meetings/${id}`);
}

/** Set the expected speaker count (Scribe diarization hint, pre-process). */
export async function setNumSpeakersAction(id: string, numSpeakers: number) {
  if (!getMeeting(id)) return;
  const value =
    Number.isFinite(numSpeakers) && numSpeakers > 0
      ? Math.floor(numSpeakers)
      : null;
  updateMeeting(id, { numSpeakers: value });
  revalidatePath(`/meetings/${id}`);
}

/** Bind/unbind a meeting to a recurring series. */
export async function assignSeriesAction(id: string, seriesId: string | null) {
  if (!getMeeting(id)) return;
  updateMeeting(id, { seriesId: seriesId || null });
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${id}`);
  if (seriesId) revalidatePath(`/series/${seriesId}`);
}

/**
 * Rename a diarized speaker. Manual-edit-wins (this IS the manual edit), and
 * the name is remembered in the series' speaker-name memory so future meetings
 * in the same series benefit.
 */
export async function renameSpeakerAction(
  meetingId: string,
  speakerId: string,
  displayName: string,
) {
  const name = displayName.trim();
  renameMeetingSpeaker(meetingId, speakerId, name);

  const meeting = getMeeting(meetingId);
  if (meeting?.seriesId && name) {
    upsertSpeakerName(meeting.seriesId, name);
  }
  revalidatePath(`/meetings/${meetingId}`);
}

/** Delete a meeting and its audio file from disk. */
export async function deleteMeetingAction(id: string) {
  const meeting = getMeeting(id);
  if (meeting) await deleteAudioFile(meeting.audioPath);
  deleteMeeting(id);
  revalidatePath("/meetings");
  revalidatePath("/", "layout");
}

/**
 * Spawn a new conversation seeded to discuss this meeting. Mints a conversation
 * row, titles it, and sets `originMeetingId`. Returns the destination `url`
 * plus the composer `seed` text; the client writes the seed into the
 * composer-handoff sessionStorage bridge (`setComposerSeed`) right before
 * navigating, mirroring the template-fill path. A Server Action can't touch
 * sessionStorage, and useChat v6 has no shared store, so the seed must cross
 * the navigation client-side — not in the URL.
 *
 * Returns `{ url, seed }` for the client to seed + `router.push`.
 */
export async function discussMeetingAction(
  meetingId: string,
): Promise<{ url: string; seed: string } | { error: string }> {
  const meeting = getMeeting(meetingId);
  if (!meeting) return { error: "جلسه یافت نشد." };

  const speakers = listMeetingSpeakers(meetingId);
  const summary = getLatestMeetingSummary(meetingId);

  // Build a compact seed the composer pre-fills. Keeps the heavy transcript out
  // of the URL — the user can ask follow-ups against this brief.
  const speakerLine = speakers
    .map((s) => s.displayName || s.speakerId)
    .join("، ");
  const seedParts = [
    `می‌خواهم دربارهٔ این جلسه گفتگو کنم: «${meeting.title}».`,
  ];
  if (speakerLine) seedParts.push(`شرکت‌کنندگان: ${speakerLine}.`);
  if (summary?.execSummary) {
    seedParts.push(`خلاصه: ${summary.execSummary}`);
  }
  const seed = seedParts.join("\n");

  const conversationId = crypto.randomUUID();
  const settings = getSettings();
  createConversation(conversationId, settings.defaultModelId);
  updateConversation(conversationId, {
    title: `گفتگو درباره: ${meeting.title}`,
    originMeetingId: meetingId,
  });

  revalidatePath("/", "layout");

  return { url: `/chat/${conversationId}`, seed };
}
