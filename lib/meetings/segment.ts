/**
 * Word → segment helpers, ported verbatim from the reference pipeline
 * (`meetings_pipeline.py` lines 118-239). Pure functions, no IO — drives both
 * the diarized prompt fed to the summarizer and the server-built minutes.
 *
 * Minutes are built here (NOT by the LLM) so 1h+ meetings don't get truncated
 * by output-token limits.
 */
import type { MinutesSegment, ScribeWord } from "@/lib/db/types";

/**
 * Gap (seconds) between consecutive words large enough to split a segment even
 * when the speaker hasn't changed. Mirrors the upstream pipeline (1.2s).
 */
const GAP_THRESHOLD_S = 1.2;

/** A grouped same-speaker run: [speakerId, startS, endS, text]. */
type Segment = readonly [string, number, number, string];

function wordText(word: ScribeWord): string {
  return word.text ?? "";
}

function wordSpeaker(word: ScribeWord): string | null {
  const sid = word.speakerId;
  return sid == null ? null : String(sid);
}

function wordStart(word: ScribeWord): number | null {
  return typeof word.start === "number" && Number.isFinite(word.start)
    ? word.start
    : null;
}

function wordEnd(word: ScribeWord): number | null {
  return typeof word.end === "number" && Number.isFinite(word.end)
    ? word.end
    : null;
}

/**
 * Group consecutive same-speaker words into segments.
 *
 * Split rules:
 *   - speaker change
 *   - `word.start - prevEnd > GAP_THRESHOLD_S` (1.2s)
 * Missing timestamps fall back to the previous segment's endpoints so grouping
 * keeps making progress.
 */
export function segmentWords(words: ScribeWord[]): Segment[] {
  const segments: Segment[] = [];

  let curSpeaker: string | null = null;
  let curStart: number | null = null;
  let curEnd: number | null = null;
  let curTextParts: string[] = [];

  const flush = () => {
    if (curSpeaker === null || curStart === null || curEnd === null) return;
    const text = curTextParts.join("").trim();
    if (!text) return;
    segments.push([curSpeaker, curStart, curEnd, text]);
  };

  for (const word of words) {
    const speaker = wordSpeaker(word) ?? "speaker_0";
    const start = wordStart(word);
    const end = wordEnd(word);
    const text = wordText(word);

    // Fall back to previous endpoints when timing is missing so grouping
    // doesn't stall.
    const effectiveStart: number | null = start ?? curEnd;
    const effectiveEnd: number | null = end ?? effectiveStart;

    let gap: number | null = null;
    if (curEnd !== null && effectiveStart !== null) {
      gap = effectiveStart - curEnd;
    }

    const speakerChanged = curSpeaker !== null && speaker !== curSpeaker;
    const gapTooBig = gap !== null && gap > GAP_THRESHOLD_S;

    if (curSpeaker === null) {
      curSpeaker = speaker;
      curStart = effectiveStart ?? 0;
      curEnd = effectiveEnd ?? curStart;
      curTextParts = [text];
      continue;
    }

    if (speakerChanged || gapTooBig) {
      flush();
      curSpeaker = speaker;
      curStart = effectiveStart ?? curEnd ?? 0;
      curEnd = effectiveEnd ?? curStart;
      curTextParts = [text];
    } else {
      curTextParts.push(text);
      if (effectiveEnd !== null) curEnd = effectiveEnd;
    }
  }

  flush();
  return segments;
}

/** `[speaker_id start-end] text` lines for the summarizer prompt. */
export function buildDiarizedPrompt(words: ScribeWord[]): string {
  return segmentWords(words)
    .map(
      ([speaker, start, end, text]) =>
        `[${speaker} ${start.toFixed(2)}-${end.toFixed(2)}] ${text}`,
    )
    .join("\n");
}

/** `12345` seconds → `"03:25:45"` / `"05:45"` for minutes display timestamps. */
function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Server-side minutes built directly from the diarized words. Bypasses the LLM
 * so long meetings don't get truncated by output-token limits.
 */
export function buildMinutesSegments(words: ScribeWord[]): MinutesSegment[] {
  return segmentWords(words).map(([speaker, start, , text]) => ({
    speaker,
    timestamp: formatTimestamp(start),
    startS: start,
    text,
  }));
}
