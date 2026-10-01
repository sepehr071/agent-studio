/**
 * Curated OpenRouter quick-model list.
 * Slugs verified against https://openrouter.ai/api/v1/models on 2026-06-04.
 * All entries support tool calling + reasoning.
 * The full live catalog is served by /api/models; this list keeps the picker
 * fast and gives vision gating a baseline before the catalog loads.
 */
export interface ChatModel {
  /** OpenRouter model slug */
  id: string;
  name: string;
  provider: string;
  /** Context window in tokens — feeds the Context usage meter */
  contextWindow: number;
  /** Accepts image input (vision) — gates the attachment button */
  supportsVision: boolean;
}

export const models: ChatModel[] = [
  {
    id: "anthropic/claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    contextWindow: 1_000_000,
    supportsVision: true,
  },
  {
    id: "anthropic/claude-opus-4.8",
    name: "Claude Opus 4.8",
    provider: "Anthropic",
    contextWindow: 1_000_000,
    supportsVision: true,
  },
  {
    id: "openai/gpt-5.5",
    name: "GPT-5.5",
    provider: "OpenAI",
    contextWindow: 1_050_000,
    supportsVision: true,
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    contextWindow: 1_048_576,
    supportsVision: true,
  },
  {
    id: "deepseek/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    contextWindow: 1_048_576,
    supportsVision: false,
  },
];

export const DEFAULT_MODEL_ID = models[0].id;

/** Cheap, fast model for background auto-titling */
export const TITLE_MODEL_ID = "google/gemini-3.5-flash";

export function getModel(id: string | undefined): ChatModel {
  return models.find((m) => m.id === id) ?? models[0];
}
