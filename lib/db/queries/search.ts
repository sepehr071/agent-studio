import { db } from "@/lib/db";
import type {
  KnowledgeItemRow,
  MeetingTranscriptRow,
  MessageRow,
} from "@/lib/db/schema";
import { getKnowledgeItem } from "./knowledge";
import { getMessage } from "./messages";

/**
 * FTS5 query sanitizer. The FTS5 `MATCH` mini-language treats characters like
 * `*` `:` `^` `(` `)` `"` `-` `+` as operators — passing raw user input lets
 * malformed queries throw "fts5: syntax error". We split on whitespace and
 * wrap each token in double quotes (escaping embedded quotes), turning the
 * query into a safe phrase-AND match. Empty input yields "".
 */
export function sanitizeFtsQuery(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" ");
}

/**
 * OR-variant of the sanitizer for LLM-generated tool queries. Models pad
 * queries with extra words ("SSE پروتکل") that phrase-AND turns into zero
 * hits; any-token matching keeps recall, `ORDER BY rank` keeps precision.
 */
export function sanitizeFtsQueryAny(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(" OR ");
}

const client = () =>
  (db as unknown as { $client: import("better-sqlite3").Database }).$client;

export interface MessageSearchHit {
  conversationId: string;
  messageId: string;
  message: MessageRow | undefined;
}

/** Full-text search over message bodies. Returns ids + the hydrated rows. */
export function searchMessages(
  query: string,
  limit = 50,
): MessageSearchHit[] {
  const match = sanitizeFtsQuery(query);
  if (!match) return [];
  const rows = client()
    .prepare(
      `SELECT row_id, conversation_id FROM messages_fts
       WHERE messages_fts MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(match, limit) as { row_id: string; conversation_id: string }[];
  return rows.map((r) => ({
    conversationId: r.conversation_id,
    messageId: r.row_id,
    message: getMessage(r.conversation_id, r.row_id),
  }));
}

/** Full-text search over knowledge items. Returns hydrated rows. */
export function searchKnowledge(
  query: string,
  limit = 50,
): KnowledgeItemRow[] {
  const match = sanitizeFtsQuery(query);
  if (!match) return [];
  return runKnowledgeMatch(match, limit);
}

/**
 * Recall-first knowledge search for the chat tool: exact phrase-AND first,
 * then any-token OR when that comes up empty (LLM queries over-specify).
 */
export function searchKnowledgeLoose(
  query: string,
  limit = 50,
): KnowledgeItemRow[] {
  const strict = searchKnowledge(query, limit);
  if (strict.length > 0) return strict;
  const match = sanitizeFtsQueryAny(query);
  if (!match) return [];
  return runKnowledgeMatch(match, limit);
}

function runKnowledgeMatch(match: string, limit: number): KnowledgeItemRow[] {
  const rows = client()
    .prepare(
      `SELECT row_id FROM knowledge_fts
       WHERE knowledge_fts MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(match, limit) as { row_id: string }[];
  return rows
    .map((r) => getKnowledgeItem(r.row_id))
    .filter((item): item is KnowledgeItemRow => item !== undefined);
}

export interface TranscriptSearchHit {
  transcriptId: string;
  meetingId: string;
}

/** Full-text search over meeting transcripts. Returns ids only. */
export function searchTranscripts(
  query: string,
  limit = 50,
): TranscriptSearchHit[] {
  const match = sanitizeFtsQuery(query);
  if (!match) return [];
  const rows = client()
    .prepare(
      `SELECT row_id, meeting_id FROM transcripts_fts
       WHERE transcripts_fts MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(match, limit) as { row_id: string; meeting_id: string }[];
  return rows.map((r) => ({ transcriptId: r.row_id, meetingId: r.meeting_id }));
}

// Re-export the transcript row type so consumers can hydrate if needed.
export type { MeetingTranscriptRow };
