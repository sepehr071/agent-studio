import "server-only";
import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { searchKnowledgeLoose } from "@/lib/db/queries";
import { generateAndPersistImage } from "@/lib/images/generate";

/**
 * Server-only native tool implementations. Kept OUT of `lib/tools.ts` so that
 * file stays client-safe (it's imported by client components for the
 * `ChatMessage`/`ChatTools` types + `NATIVE_TOOL_IDS`/`NATIVE_TOOL_LABELS`).
 * Importing the tool `execute` bodies pulls in `better-sqlite3`/`node:fs`, which
 * must never reach the browser bundle. `lib/tools.ts` derives `ChatTools` from
 * THIS factory's return type via a type-only import (erased at compile time).
 */

/**
 * Build the native tool set for one request. A factory because the image tool
 * needs the request-time image model id resolved from the catalog.
 */
export function buildNativeTools(ctx: { imageModelId: string }) {
  return {
    knowledge_search: tool({
      description: "جستجو در گنجینه دانش کاربر و بازگرداندن گزیده‌های مرتبط",
      inputSchema: z.object({
        query: z.string().describe("عبارت جستجو"),
        limit: z.number().optional().describe("حداکثر تعداد نتایج (پیش‌فرض ۸)"),
      }),
      execute: async ({ query, limit }) =>
        searchKnowledgeLoose(query, Math.min(Math.max(limit ?? 8, 1), 20)).map(
          (item) => ({
            id: item.id,
            title: item.title,
            snippet: item.content.slice(0, 500),
          }),
        ),
    }),
    generate_image: tool({
      description: "تولید تصویر از روی توضیح متنی",
      inputSchema: z.object({
        prompt: z.string().describe("توضیح متنی تصویر"),
      }),
      execute: async ({ prompt }) =>
        generateAndPersistImage({ prompt, modelId: ctx.imageModelId }),
    }),
  } satisfies ToolSet;
}
