/**
 * Shared domain types for JSON columns and feature payloads.
 * Row-type exports ($inferSelect) live in schema.ts; this file holds the
 * structured shapes those JSON columns hold and the contracts feature agents
 * build against.
 */

// ---------------------------------------------------------------- configs

/** Generation parameters bound to an assistant config. */
export interface ConfigParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** OpenRouter reasoning effort */
  reasoningEffort?: "low" | "medium" | "high";
}

/**
 * Capabilities bound to an assistant config. `enabledTools` holds native tool
 * ids (`NATIVE_TOOL_IDS` from `lib/tools.ts`); `mcpServerIds` references
 * `mcpServers` rows. Both optional — absent/empty ⇒ no tools for that assistant.
 */
export interface ConfigToolConfig {
  enabledTools?: string[];
  mcpServerIds?: string[];
}

// ---------------------------------------------------------------- meetings: transcription

/** A single diarized word from ElevenLabs Scribe v2. */
export interface ScribeWord {
  text: string;
  /** Seconds from start */
  start: number;
  /** Seconds from start */
  end: number;
  /** Diarization label, e.g. "speaker_0" */
  speakerId?: string;
  type?: "word" | "spacing" | "audio_event";
  logprob?: number;
}

// ---------------------------------------------------------------- meetings: summary payloads

export interface ActionItem {
  task: string;
  owner?: string | null;
  due?: string | null;
  priority?: "low" | "medium" | "high" | null;
}

export interface Decision {
  decision: string;
  rationale?: string | null;
  owner?: string | null;
}

export interface QAEntry {
  question: string;
  answer?: string | null;
  askedBy?: string | null;
  answeredBy?: string | null;
}

/** One segment of the server-built minutes (never LLM-authored). */
export interface MinutesSegment {
  speaker: string;
  /** Display timestamp, e.g. "00:12:34" */
  timestamp: string;
  /** Seconds from start */
  startS: number;
  text: string;
}
