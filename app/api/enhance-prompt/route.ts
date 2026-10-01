import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { logUsage } from "@/lib/usage/log";

/**
 * "بهبود با هوش مصنوعی" — rewrite/expand an assistant's system prompt with a
 * cheap model. Ports the spirit of ai-aggregator's POST /api/configs/
 * enhance-prompt (prompt-engineer rewrite, single-shot, low max tokens), but:
 *   - runs on the curated cheap model (no per-user attribution needed here)
 *   - replies in the SAME language as the input (the personas are Persian-first)
 *   - logs the generation against the `enhancer` feature for usage analytics
 *   - wraps the network call in a 3-attempt retry (this network flaps).
 */

const ENHANCER_MODEL_ID = "google/gemini-3.5-flash";
const MAX_INPUT = 10_000;

const SYSTEM = [
  "You are an expert prompt engineer. You improve an assistant's *system prompt*",
  "so it is clearer, more specific, and more effective — without changing its",
  "core intent.",
  "",
  "Apply these improvements:",
  "- Add a clear role definition if one is missing.",
  "- Add specific, actionable behavioral guidelines.",
  "- Add output-format instructions when relevant.",
  "- Make every instruction explicit and unambiguous.",
  "- Keep the original intent and persona fully intact.",
  "",
  "Reply in the SAME language as the original prompt (most are in Persian).",
  "Return ONLY the improved system prompt — no preamble, no explanations,",
  "no surrounding quotes or code fences.",
].join("\n");

interface EnhanceRequest {
  prompt?: string;
}

async function enhanceWithRetry(prompt: string): Promise<string> {
  const openrouter = createOpenRouter({ appName: "Agent Studio" });
  const delays = [400, 1200, 3000];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    try {
      const result = await generateText({
        model: openrouter.chat(ENHANCER_MODEL_ID),
        system: SYSTEM,
        prompt: `Original system prompt:\n\n${prompt}`,
        temperature: 0.7,
        maxOutputTokens: 1024,
      });

      logUsage({
        model: ENHANCER_MODEL_ID,
        feature: "enhancer",
        promptTokens: result.usage?.inputTokens,
        completionTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
      });

      return result.text.trim();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("enhancement failed");
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error:
          "OPENROUTER_API_KEY تنظیم نشده است. آن را در .env.local قرار دهید و سرور را دوباره راه‌اندازی کنید.",
      },
      { status: 500 },
    );
  }

  let body: EnhanceRequest;
  try {
    body = (await req.json()) as EnhanceRequest;
  } catch {
    body = {};
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return Response.json(
      { error: "متن پرامپت الزامی است." },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_INPUT) {
    return Response.json(
      { error: `پرامپت بیش از حد طولانی است (حداکثر ${MAX_INPUT} نویسه).` },
      { status: 400 },
    );
  }

  try {
    const enhanced = await enhanceWithRetry(prompt);
    if (!enhanced) {
      return Response.json(
        { error: "پاسخ نامعتبری از مدل دریافت شد." },
        { status: 502 },
      );
    }
    return Response.json({ enhancedPrompt: enhanced });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "بهبود پرامپت با خطا مواجه شد.",
      },
      { status: 502 },
    );
  }
}
