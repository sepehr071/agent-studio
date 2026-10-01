import type { InferUITools, UIMessage } from "ai";
import type { buildNativeTools } from "@/lib/tools-native";

/**
 * Client-safe tool contract. This file is imported by client components (for
 * `ChatMessage`/`ChatTools` types + `NATIVE_TOOL_IDS`/`NATIVE_TOOL_LABELS`), so
 * it must NOT pull in server-only deps. The native tool `execute` bodies (which
 * touch `better-sqlite3`/`node:fs`) live in `lib/tools-native.ts`; here we only
 * import its TYPE (erased at compile time) to derive `ChatTools`.
 *
 * Web search runs server-side via the OpenRouter `:online` slug suffix — not a
 * tool. MCP tools are merged in at request time (`lib/mcp/client.ts`) and render
 * as `dynamic-tool` parts; native tools render as typed `tool-*` parts.
 */

/** Stable ids of the built-in tools — the assistant editor toggles these. */
export const NATIVE_TOOL_IDS = ["knowledge_search", "generate_image"] as const;
export type NativeToolId = (typeof NATIVE_TOOL_IDS)[number];

/** Persian display labels for the assistant editor's tool switches. */
export const NATIVE_TOOL_LABELS: Record<NativeToolId, string> = {
  knowledge_search: "جستجو در گنجینه دانش",
  generate_image: "تولید تصویر",
};

export type ChatTools = InferUITools<ReturnType<typeof buildNativeTools>>;

/** Metadata streamed alongside each assistant message */
export interface ChatMetadata {
  modelId?: string;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Epoch ms when the assistant turn started (sent on the `start` part) */
  createdAt?: number;
  /** OpenRouter billed cost in USD (sent on `finish`, when reported) */
  costUsd?: number;
}

/** Custom data parts streamed outside message content */
export interface ChatData {
  /** Emitted after auto-titling the first exchange (`data-conversation`) */
  conversation: {
    id: string;
    title: string;
  };
  [key: string]: unknown;
}

/** The single message contract shared by route handler and UI */
export type ChatMessage = UIMessage<ChatMetadata, ChatData, ChatTools>;
