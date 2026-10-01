/**
 * Transcription — wrapper around ElevenLabs Scribe v2 (`@elevenlabs/elevenlabs-js`).
 *
 * Persian-first (`languageCode` from the meeting row, default `'fas'`),
 * diarized, word-level timestamps. Long AbortSignal timeout (full-meeting STT
 * can take 10-20min) + 3-attempt retry — this network flaps (ENOTFOUND).
 *
 * Server-only by construction (reads the filesystem + a secret key). Never
 * import from a client component.
 */
import { createReadStream } from "node:fs";
import { ElevenLabs, ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { ScribeWord } from "@/lib/db/types";

/** Default per-request STT read budget (seconds). Long recordings need it. */
const TIMEOUT_S = Number(process.env.ELEVENLABS_TIMEOUT_S ?? "1800");

/** Word `type` values that contribute to the flat plain-text rendering. */
const TEXT_WORD_TYPES = new Set(["word", "spacing"]);

export interface TranscriptionResult {
  plainText: string;
  words: ScribeWord[];
  /** Distinct diarization labels in first-seen order, e.g. `["speaker_0", …]`. */
  speakerIds: string[];
  /** Raw Scribe response (persisted verbatim for re-processing). */
  raw: unknown;
  languageCode: string;
}

export interface TranscribeOptions {
  numSpeakers?: number | null;
  keyterms?: string[] | null;
  languageCode?: string | null;
  /** Aborts the in-flight Scribe HTTP call at the pipeline's request. */
  signal?: AbortSignal;
}

/**
 * Missing-key marker so the pipeline can surface a readable Persian error and
 * flip the meeting to `failed` instead of dumping a generic SDK stack trace.
 */
export class MissingElevenLabsKeyError extends Error {
  constructor() {
    super("کلید ElevenLabs (ELEVENLABS_API_KEY) تنظیم نشده است.");
    this.name = "MissingElevenLabsKeyError";
  }
}

function resolveApiKey(): string {
  return (process.env.ELEVENLABS_API_KEY ?? "").trim();
}

function serializeWord(word: ElevenLabs.SpeechToTextWordResponseModel): ScribeWord {
  return {
    text: word.text ?? "",
    start: typeof word.start === "number" ? word.start : 0,
    end: typeof word.end === "number" ? word.end : 0,
    speakerId: word.speakerId,
    type:
      word.type === "word" || word.type === "spacing"
        ? word.type
        : "audio_event",
    logprob: word.logprob,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Synchronous-style Scribe v2 call wrapped in 3-attempt retry. Returns a
 * {@link TranscriptionResult}.
 *
 * @throws MissingElevenLabsKeyError when the API key is absent.
 * @throws Error with a readable Persian message on any SDK/network/HTTP failure
 *   after all retries are exhausted.
 */
export async function transcribe(
  audioPath: string,
  options: TranscribeOptions = {},
): Promise<TranscriptionResult> {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new MissingElevenLabsKeyError();

  const client = new ElevenLabsClient({
    apiKey,
    timeoutInSeconds: TIMEOUT_S,
  });

  const languageCode = (options.languageCode ?? "fas").trim() || "fas";

  const request: ElevenLabs.BodySpeechToTextV1SpeechToTextPost = {
    modelId: "scribe_v2",
    languageCode,
    diarize: true,
    timestampsGranularity: "word",
    tagAudioEvents: false,
    noVerbatim: true,
  };
  if (options.numSpeakers != null && options.numSpeakers > 0) {
    request.numSpeakers = Math.floor(options.numSpeakers);
  }
  if (options.keyterms && options.keyterms.length > 0) {
    // Defensive copy — never hand the SDK a live reference to caller state.
    request.keyterms = [...options.keyterms];
  }

  const delays = [0, 1500, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (options.signal?.aborted) {
      throw new Error("رونویسی لغو شد.");
    }
    if (delays[attempt] > 0) await sleep(delays[attempt]);

    try {
      // A fresh read stream per attempt — a consumed stream can't be replayed.
      request.file = createReadStream(audioPath);
      const response = await client.speechToText.convert(request, {
        timeoutInSeconds: TIMEOUT_S,
        abortSignal: options.signal,
        // The SDK retries internally too; we own retry at this layer.
        maxRetries: 0,
      });

      // Narrow the convert() union to the single-channel chunk response.
      if (!("words" in response) || !Array.isArray(response.words)) {
        throw new Error(
          "پاسخ رونویسی فاقد واژگان زمان‌دار بود (پاسخ چندکاناله یا وب‌هوک).",
        );
      }

      const serializedWords = response.words.map(serializeWord);

      const plainTextParts: string[] = [];
      const speakerIds: string[] = [];
      const seenSpeakers = new Set<string>();

      for (const word of serializedWords) {
        if (word.type && TEXT_WORD_TYPES.has(word.type)) {
          plainTextParts.push(word.text ?? "");
        }
        const sid = word.speakerId;
        if (sid != null && !seenSpeakers.has(sid)) {
          seenSpeakers.add(sid);
          speakerIds.push(sid);
        }
      }

      return {
        plainText: plainTextParts.join(""),
        words: serializedWords,
        speakerIds,
        raw: response,
        languageCode: response.languageCode || languageCode,
      };
    } catch (error) {
      lastError = error;
      // An aborted call is final — don't burn the remaining retry budget.
      if (options.signal?.aborted) {
        throw new Error("رونویسی لغو شد.");
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`رونویسی صدا ناموفق بود: ${detail}`);
}
