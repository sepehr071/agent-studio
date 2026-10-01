/**
 * Series glossary — keyterms (manual/suggested/accepted) + speaker-name memory
 * per recurring meeting series. Ported from `meeting_glossary.py`.
 *
 * `getActiveKeyterms` feeds Scribe v2 (`keyterms` bias); manual + accepted only
 * (suggested terms are unconfirmed). Speaker-name memory carries display names
 * across meetings in the same series so the summarizer maps speakers
 * consistently.
 *
 * Server-only by construction (imports the query layer).
 */
import {
  addSeriesKeyterm,
  listSeriesKeyterms,
  listSeriesSpeakerNames,
  rememberSeriesSpeakerName,
} from "@/lib/db/queries";

/** Scribe v2 keyterm caps (batch). Keyterms >50 chars / >5 words are dropped. */
const MAX_TERMS = 1000;
const MAX_CHARS = 50;
const MAX_WORDS = 5;

/** Splits on whitespace + common Persian/Latin punctuation for word counting. */
const TOKEN_PUNCT = /[\s،.,;:!?()[\]{}"'«»\-_/\\|]+/u;

function isValidKeyterm(term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_CHARS) return false;
  const wordCount = trimmed.split(TOKEN_PUNCT).filter(Boolean).length;
  if (wordCount > MAX_WORDS) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

/**
 * De-duplicated, validated MANUAL + ACCEPTED keyterms for a series, capped at
 * {@link MAX_TERMS}. Suggested terms are excluded (unconfirmed by the user).
 */
export function getActiveKeyterms(seriesId: string | null | undefined): string[] {
  if (!seriesId) return [];

  const rows = listSeriesKeyterms(seriesId);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const source of ["manual", "accepted"] as const) {
    for (const row of rows) {
      if (row.source !== source) continue;
      const term = (row.term ?? "").trim();
      if (seen.has(term)) continue;
      if (!isValidKeyterm(term)) continue;
      seen.add(term);
      out.push(term);
      if (out.length >= MAX_TERMS) return out;
    }
  }
  return out;
}

/**
 * Upsert SUGGESTED terms; existing rows (any source) are left alone so manual
 * wins. Returns the count of newly-inserted rows.
 */
export function addSuggestedTerms(
  seriesId: string | null | undefined,
  terms: string[],
): number {
  if (!seriesId || terms.length === 0) return 0;

  const existing = new Set(
    listSeriesKeyterms(seriesId).map((row) => (row.term ?? "").trim()),
  );

  let added = 0;
  for (const raw of terms) {
    const term = (raw ?? "").trim();
    if (!isValidKeyterm(term)) continue;
    if (existing.has(term)) continue;
    addSeriesKeyterm({
      id: crypto.randomUUID(),
      seriesId,
      term,
      source: "suggested",
    });
    existing.add(term);
    added += 1;
  }
  return added;
}

/** Insert-or-bump a speaker name in this series' memory. */
export function upsertSpeakerName(
  seriesId: string | null | undefined,
  displayName: string,
): void {
  if (!seriesId) return;
  const name = (displayName ?? "").trim();
  if (!name) return;
  rememberSeriesSpeakerName({
    id: crypto.randomUUID(),
    seriesId,
    displayName: name,
  });
}

/** Recent display names for this series, newest-first. */
export function listKnownSpeakerNames(
  seriesId: string | null | undefined,
): string[] {
  if (!seriesId) return [];
  return listSeriesSpeakerNames(seriesId)
    .map((row) => row.displayName)
    .filter((name): name is string => Boolean(name));
}
