import type { MCPClient } from "@ai-sdk/mcp";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import type { ConfigRow } from "@/lib/db/schema";
import {
  createConversation,
  deleteMessagesFrom,
  getConfig,
  getConversation,
  getLatestMeetingSummary,
  getMeeting,
  getMeetingTranscript,
  getSettings,
  incrementConfigUsage,
  loadChatMessages,
  saveChatMessages,
  updateConversation,
} from "@/lib/db/queries";
import { closeMcpClients, collectMcpTools } from "@/lib/mcp/client";
import { sanitizeMcpToolOutput } from "@/lib/mcp/sanitize";
import { TITLE_MODEL_ID } from "@/lib/models";
import { getCatalog } from "@/lib/openrouter-models";
import { buildSystemPrompt } from "@/lib/system-prompt";
import type { ChatMessage } from "@/lib/tools";
import { buildNativeTools } from "@/lib/tools-native";
import { logUsage } from "@/lib/usage/log";

export const maxDuration = 60;

interface ChatRequest {
  conversationId: string;
  /** Only the last message — server rebuilds history from the DB */
  message?: ChatMessage;
  modelId?: string;
  /** Bound assistant config (null/absent ⇒ quick model, no persona) */
  configId?: string | null;
  webSearch?: boolean;
  trigger?: "submit-message" | "regenerate-message";
  /** On regenerate: the assistant message to drop and re-stream */
  messageId?: string;
}

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** Cap a string at `max` chars, appending an ellipsis when truncated. */
function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Build the meeting-context system block injected into a conversation that was
 * spawned from a meeting ("بحث درباره این جلسه"). Prepended only on the first
 * exchange so later turns stay lean — the model has the context in history.
 * Returns null when there's nothing useful to seed.
 */
function buildMeetingSeed(meetingId: string): string | null {
  const meeting = getMeeting(meetingId);
  if (!meeting) return null;

  const lines: string[] = [];
  lines.push(
    "کاربر می‌خواهد درباره‌ی یک جلسه گفتگو کند. خلاصه و متن جلسه در ادامه آمده است؛ " +
      "به فارسی و با تکیه بر همین اطلاعات پاسخ بده.",
  );
  lines.push(`\n[عنوان جلسه]\n${meeting.title}`);
  if (meeting.meetingBrief?.trim()) {
    lines.push(`\n[شرح جلسه]\n${clamp(meeting.meetingBrief.trim(), 1500)}`);
  }

  const summary = getLatestMeetingSummary(meetingId);
  if (summary?.execSummary?.trim()) {
    lines.push(`\n[خلاصه‌ی مدیریتی]\n${clamp(summary.execSummary.trim(), 4000)}`);
  }
  if (summary?.decisionsJson?.length) {
    const decisions = summary.decisionsJson
      .map((d) => `- ${d.decision}`)
      .join("\n");
    lines.push(`\n[تصمیم‌ها]\n${clamp(decisions, 2000)}`);
  }
  if (summary?.actionItemsJson?.length) {
    const actions = summary.actionItemsJson
      .map((a) => `- ${a.task}${a.owner ? ` (${a.owner})` : ""}`)
      .join("\n");
    lines.push(`\n[اقدام‌ها]\n${clamp(actions, 2000)}`);
  }
  if (summary?.openQuestionsJson?.length) {
    const open = summary.openQuestionsJson.map((q) => `- ${q}`).join("\n");
    lines.push(`\n[پرسش‌های باز]\n${clamp(open, 1500)}`);
  }

  // A transcript excerpt grounds the model when no summary exists yet (or to
  // answer detail questions the summary glosses over). Kept short to stay
  // within the context window — the full transcript can be megabytes.
  const transcript = getMeetingTranscript(meetingId);
  if (transcript?.plainText?.trim()) {
    lines.push(
      `\n[گزیده‌ای از متن جلسه]\n${clamp(transcript.plainText.trim(), 8000)}`,
    );
  }

  // Nothing beyond the title — not worth seeding.
  return lines.length > 2 ? lines.join("\n") : null;
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error:
          "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  const {
    conversationId,
    message,
    modelId,
    configId,
    webSearch,
    trigger,
    messageId,
  } = (await req.json()) as ChatRequest;

  if (!conversationId) {
    return Response.json({ error: "conversationId is required" }, { status: 400 });
  }

  const settings = getSettings();

  // Resolve the bound assistant config (if any). An explicit per-request
  // modelId still wins over the config's default model — the user can switch
  // models mid-conversation while keeping the assistant persona/params.
  const config: ConfigRow | null =
    (configId ? getConfig(configId) : undefined) ?? null;

  // Raw slug — full OpenRouter catalog is selectable, not just the quick list.
  const activeModelId = modelId ?? config?.modelId ?? settings.defaultModelId;

  // First message of a new chat creates the row (client already navigated
  // optimistically with its minted UUID)
  createConversation(conversationId, activeModelId);
  const existing = getConversation(conversationId);
  if (existing?.modelId !== activeModelId) {
    updateConversation(conversationId, { modelId: activeModelId });
  }
  // Persist the assistant binding too — the new-chat pane remounts after
  // router.replace and rehydrates configId from this row; without this sync
  // the binding (and with it ALL tools) silently dropped after turn one.
  if ((existing?.configId ?? null) !== (configId ?? null)) {
    updateConversation(conversationId, { configId: configId ?? null });
  }

  // Regenerate: drop the targeted assistant message + everything after it
  if (trigger === "regenerate-message" && messageId) {
    deleteMessagesFrom(conversationId, messageId);
  }
  // Edited (resent) user message: truncate from its old position, then append
  // the new version below. No-op for brand-new ids.
  if (message) {
    deleteMessagesFrom(conversationId, message.id);
  }

  const history = loadChatMessages(conversationId);
  // Heal oversized MCP tool outputs persisted before the execution-time
  // sanitizer existed — otherwise one 2.7MB Gmail payload in history re-enters
  // the model as a ~920k-token prompt on EVERY later turn. The reconciled
  // thread is re-persisted in onFinish, so this also heals the stored rows.
  for (const m of history) {
    for (const part of m.parts) {
      if (part.type === "dynamic-tool" && part.state === "output-available") {
        part.output = sanitizeMcpToolOutput(part.output);
      }
    }
  }
  const thread: ChatMessage[] = message ? [...history, message] : history;
  // Regenerating the FIRST turn empties history (both the assistant message and
  // the preceding user message get truncated above), which would otherwise look
  // like a brand-new exchange and re-trigger auto-titling. Gate on the trigger.
  const isFirstExchange =
    trigger !== "regenerate-message" &&
    history.length === 0 &&
    message?.role === "user";

  // Meeting-spawned conversation: seed the meeting context on the first turn.
  let systemPrompt = buildSystemPrompt(settings, config);
  if (isFirstExchange && existing?.originMeetingId) {
    const seed = buildMeetingSeed(existing.originMeetingId);
    if (seed) systemPrompt = `${systemPrompt}\n\n${seed}`;
  }

  // Bump the assistant's usage on the first send of the conversation.
  if (isFirstExchange && config) {
    incrementConfigUsage(config.id);
  }

  // Apply the config's generation params. maxTokens === 0 means "auto" (let the
  // model decide), so it's omitted. reasoningEffort maps onto OpenRouter's
  // provider option.
  const params = config?.params ?? undefined;
  const temperature = params?.temperature;
  const topP = params?.topP;
  const maxOutputTokens =
    params?.maxTokens && params.maxTokens > 0 ? params.maxTokens : undefined;
  const providerOptions = {
    openrouter: {
      // Usage accounting → final billed cost arrives on the finish event.
      usage: { include: true },
      ...(params?.reasoningEffort
        ? { reasoning: { effort: params.reasoningEffort } }
        : {}),
    },
  };

  // ---- Tool assembly (assistant-scoped) -------------------------------------
  // Tools are bound to assistants only: config-less chats get none. We gate on
  // the catalog's supportsTools for the active model (unknown model ⇒ allow,
  // since the catalog can be stale/offline), filter native tools by the
  // assistant's selection, and merge in tools from its enabled MCP servers.
  // MCP clients open per-request and MUST be closed on every exit path.
  const toolConfig = config?.toolConfig ?? null;
  let assembledTools: ToolSet = {};
  let mcpClients: MCPClient[] = [];

  if (toolConfig) {
    let catalog: Awaited<ReturnType<typeof getCatalog>> | null = null;
    try {
      catalog = await getCatalog();
    } catch {
      // Catalog offline — fall through and allow tools (unknown ⇒ allow).
    }
    const catalogEntry = catalog?.find((m) => m.id === activeModelId);
    const modelSupportsTools = catalogEntry?.supportsTools ?? true;

    if (modelSupportsTools) {
      const enabledNative = new Set(toolConfig.enabledTools ?? []);
      if (enabledNative.size > 0) {
        // Image tool targets the first image-output model (the studio default),
        // independent of the chat model.
        const imageModelId =
          catalog?.find((m) => m.supportsImageOutput)?.id ?? activeModelId;
        const native = buildNativeTools({ imageModelId });
        for (const [id, def] of Object.entries(native)) {
          if (enabledNative.has(id)) {
            assembledTools[id] = def;
          }
        }
      }

      const mcpServerIds = toolConfig.mcpServerIds ?? [];
      if (mcpServerIds.length > 0) {
        const collected = await collectMcpTools(mcpServerIds);
        mcpClients = collected.clients;
        Object.assign(assembledTools, collected.tools);
      }
    }
  }

  // Tool-economy guidance: external MCP tools (email, issue trackers, …)
  // return huge payloads when asked broadly. Steer the model toward narrow
  // requests up front — the sanitizer in lib/mcp/sanitize.ts is the backstop.
  if (Object.keys(assembledTools).length > 0) {
    systemPrompt +=
      "\n\nهنگام فراخوانی ابزارها داده را کوچک نگه دار: همیشه کمترین تعداد نتیجه و " +
      "فقط فیلدهای لازم را درخواست کن (مثلاً برای ایمیل فقط فرستنده، موضوع و " +
      "خلاصه — نه بدنه کامل). اگر خروجی ابزار با علامت کوتاه‌شدن همراه بود، " +
      "به جای درخواست مجدد همان داده، درخواست را محدودتر کن.";
  }

  const openrouter = createOpenRouter({ appName: "Agent Studio" });

  // PDFs ride along as file parts; the file-parser plugin must be requested
  // explicitly or OpenRouter silently drops them on non-multimodal models.
  // mistral-ocr handles scanned (image-only) PDFs too.
  const hasPdf = thread.some((m) =>
    m.parts.some(
      (part) => part.type === "file" && part.mediaType === "application/pdf",
    ),
  );

  // The UI-stream `finish` part exposes `totalUsage` but NOT providerMetadata —
  // only `finish-step` parts carry it, and they arrive in-stream BEFORE the
  // final `finish` part (streamText's onFinish fires in a flush() that runs
  // AFTER downstream already consumed `finish`, so a closure set there would
  // lose the race). Accumulate per-step billed cost as steps finish instead.
  let billedCostUsd: number | undefined;

  const result = streamText({
    // `:online` enables OpenRouter web search, which emits source parts
    model: openrouter.chat(
      webSearch ? `${activeModelId}:online` : activeModelId,
      hasPdf
        ? { plugins: [{ id: "file-parser", pdf: { engine: "mistral-ocr" } }] }
        : undefined,
    ),
    system: systemPrompt,
    messages: await convertToModelMessages(thread),
    tools: assembledTools,
    stopWhen: stepCountIs(5),
    // Stop server-side generation when the client aborts (Stop button /
    // disconnect); consumeSseStream below still persists the partial reply.
    abortSignal: req.signal,
    // Smooth chunky provider deltas into a word-by-word reveal.
    experimental_transform: smoothStream({ chunking: "word" }),
    temperature,
    topP,
    maxOutputTokens,
    providerOptions,
    onFinish: ({ totalUsage, response, providerMetadata }) => {
      // OpenRouter returns the authoritative billed cost via usage accounting;
      // logUsage falls back to a background generation lookup when absent.
      const openrouterMeta = providerMetadata?.openrouter as
        | { usage?: { cost?: number } }
        | undefined;
      logUsage({
        feature: "chat",
        model: activeModelId,
        conversationId,
        generationId: response.id,
        costUsd: openrouterMeta?.usage?.cost,
        promptTokens: totalUsage.inputTokens,
        completionTokens: totalUsage.outputTokens,
        reasoningTokens: totalUsage.outputTokenDetails?.reasoningTokens,
        cachedTokens: totalUsage.inputTokenDetails?.cacheReadTokens,
        totalTokens: totalUsage.totalTokens,
      });
      // Close per-request MCP clients once the tool loop has settled — no
      // leaked stdio child processes. Errors during streaming hit onError
      // instead, where we also close (below).
      void closeMcpClients(mcpClients);
    },
    onError: () => {
      // streamText error (incl. before the first chunk) — close MCP clients so
      // a failed turn never leaks stdio processes.
      void closeMcpClients(mcpClients);
    },
  });

  const stream = createUIMessageStream<ChatMessage>({
    originalMessages: thread,
    generateId: () => crypto.randomUUID(),
    execute: async ({ writer }) => {
      writer.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          sendSources: true,
          messageMetadata: ({ part }) => {
            if (part.type === "start") {
              return { modelId: activeModelId, createdAt: Date.now() };
            }
            if (part.type === "finish-step") {
              // Per-step billed cost (usage accounting) — summed across steps;
              // the final `finish` part below reports the total.
              const stepMeta = part.providerMetadata?.openrouter as
                | { usage?: { cost?: number } }
                | undefined;
              const stepCost = stepMeta?.usage?.cost;
              if (typeof stepCost === "number") {
                billedCostUsd = (billedCostUsd ?? 0) + stepCost;
              }
              return;
            }
            if (part.type === "finish") {
              return {
                modelId: activeModelId,
                totalTokens: part.totalUsage.totalTokens,
                inputTokens: part.totalUsage.inputTokens,
                outputTokens: part.totalUsage.outputTokens,
                costUsd: billedCostUsd,
              };
            }
          },
        }),
      );

      // Auto-title the first exchange while the reply streams; transient part
      // updates the client without being persisted into message parts
      if (isFirstExchange && message) {
        try {
          const titleResult = await generateText({
            model: openrouter.chat(TITLE_MODEL_ID),
            system:
              "Generate a conversation title of at most 6 words for the user's message, " +
              "written in Persian (فارسی) script — never transliterate. Match the message's " +
              "language only when it is clearly non-Persian. " +
              "Reply with the title only — no quotes, no punctuation at the end.",
            prompt: messageText(message).slice(0, 2000),
            providerOptions: { openrouter: { usage: { include: true } } },
          });
          const title = titleResult.text.trim().slice(0, 80);
          if (title) {
            updateConversation(conversationId, { title });
            writer.write({
              type: "data-conversation",
              data: { id: conversationId, title },
              transient: true,
            });
          }
          // Account for the cheap title-generation call too.
          const titleMeta = titleResult.providerMetadata?.openrouter as
            | { usage?: { cost?: number } }
            | undefined;
          logUsage({
            feature: "title",
            model: TITLE_MODEL_ID,
            conversationId,
            generationId: titleResult.response.id,
            costUsd: titleMeta?.usage?.cost,
            promptTokens: titleResult.usage.inputTokens,
            completionTokens: titleResult.usage.outputTokens,
            totalTokens: titleResult.usage.totalTokens,
          });
        } catch {
          // Titling is best-effort; keep "New chat" on failure
        }
      }
    },
    onFinish: ({ messages }) => {
      // Full reconciled thread (partial assistant text included on abort)
      saveChatMessages(conversationId, messages);
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Stream failed",
  });

  // consumeSseStream keeps a tee'd copy of the stream pumping server-side so
  // onFinish (and the partial-on-abort save above) runs even when the client
  // aborts or disconnects — without it, Stop loses the partial reply.
  return createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream });
}
