// Server-only by construction: imports the better-sqlite3-backed query layer,
// which cannot be bundled into a client component.
import { insertUsageLog, setUsageLogCost } from "@/lib/db/queries";

export type UsageFeature = "chat" | "image" | "meeting" | "enhancer" | "title";

/** A single usage event to persist. Signature frozen by the foundation. */
export interface UsageEntry {
  model: string;
  feature: UsageFeature;
  conversationId?: string;
  meetingId?: string;
  imageId?: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  generationId?: string;
  provider?: string;
}

interface OpenRouterGeneration {
  data?: {
    total_cost?: number;
    usage?: number;
    native_tokens_prompt?: number;
    native_tokens_completion?: number;
    native_tokens_reasoning?: number;
    provider_name?: string;
  };
}

/**
 * Look up authoritative cost for a generation. OpenRouter exposes the final
 * billed cost at GET /api/v1/generation?id= a beat after the stream ends.
 * 3-attempt retry — this network flaps (ENOTFOUND). Returns null on failure.
 */
async function fetchGenerationCost(
  generationId: string,
): Promise<number | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const delays = [400, 1200, 3000];
  let lastError: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delays[i - 1]));
    try {
      const res = await fetch(
        `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
        {
          headers: { Authorization: `Bearer ${key}`, "X-Title": "Agent Studio" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.status === 404) {
        // Generation not yet indexed; wait and retry
        lastError = new Error("generation not ready");
        continue;
      }
      if (!res.ok) throw new Error(`generation lookup failed: ${res.status}`);
      const json = (await res.json()) as OpenRouterGeneration;
      const cost = json.data?.total_cost;
      return typeof cost === "number" ? cost : null;
    } catch (error) {
      lastError = error;
    }
  }
  void lastError;
  return null;
}

/**
 * Persist a usage event. Inserts immediately; if costUsd is unknown but a
 * generationId is present, fires a background cost lookup that patches the
 * row when it resolves (never blocks the caller / the response stream).
 */
export function logUsage(entry: UsageEntry): void {
  const id = crypto.randomUUID();
  try {
    insertUsageLog({
      id,
      model: entry.model,
      provider: entry.provider ?? null,
      feature: entry.feature,
      conversationId: entry.conversationId ?? null,
      meetingId: entry.meetingId ?? null,
      imageId: entry.imageId ?? null,
      promptTokens: entry.promptTokens ?? null,
      completionTokens: entry.completionTokens ?? null,
      reasoningTokens: entry.reasoningTokens ?? null,
      cachedTokens: entry.cachedTokens ?? null,
      totalTokens: entry.totalTokens ?? null,
      costUsd: entry.costUsd ?? null,
      generationId: entry.generationId ?? null,
    });
  } catch {
    // Usage logging is best-effort — never break the feature that called it.
    return;
  }

  if (entry.costUsd === undefined && entry.generationId) {
    void fetchGenerationCost(entry.generationId).then((cost) => {
      if (cost !== null) {
        try {
          setUsageLogCost(id, cost);
        } catch {
          // ignore
        }
      }
    });
  }
}
