/**
 * Summary service — turns a diarized Persian transcript into a structured
 * meeting brief via AI SDK `streamObject` + a permissive Zod schema.
 *
 * Ported from `summary_service.py` + `prompts/meeting_summary_system.txt`,
 * translated to instruct PERSIAN output. The reference used OpenRouter
 * `json_schema` strict mode; here the schema enforces the shape. Schema is
 * intentionally permissive (nullable owner/due, defaulted arrays) so a
 * slightly-off model response doesn't blow up the whole pipeline.
 *
 * Streaming: `summarize` iterates `partialObjectStream`, sanitizes each
 * (DeepPartial) snapshot, and invokes the optional `onPartial` callback on a
 * ~1.5s throttle so the polling UI can fill in sections progressively. The
 * authoritative result is the awaited `.object` promise (validated against the
 * schema); partial snapshots are best-effort and never the source of truth.
 *
 * `minutes` is NOT produced here — the pipeline builds it server-side from the
 * diarized words to dodge output-token truncation on long meetings.
 *
 * Server-only by construction (reads a secret key, logs usage to SQLite).
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamObject } from "ai";
import { z } from "zod";
import type { ActionItem, Decision, QAEntry } from "@/lib/db/types";
import { logUsage } from "@/lib/usage/log";

/** Model hard-locked for summarization (cheap, fast, strong JSON adherence). */
export const MEETING_SUMMARY_MODEL = "google/gemini-3.5-flash";

export const EMAIL_TONE_FORMAL = "formal";
export const EMAIL_TONE_CASUAL = "casual";
export type EmailTone = typeof EMAIL_TONE_FORMAL | typeof EMAIL_TONE_CASUAL;

function normalizeTone(tone: string | null | undefined): EmailTone {
  return tone === EMAIL_TONE_CASUAL ? EMAIL_TONE_CASUAL : EMAIL_TONE_FORMAL;
}

// ---------------------------------------------------------------- schema

const speakerNameSchema = z.object({
  speakerId: z
    .string()
    .describe("شناسهٔ گوینده دقیقاً همان‌گونه که در رونوشت آمده، مثل speaker_0"),
  displayName: z.string().describe("نام واقعی گوینده (فارسی)"),
});

const actionItemSchema = z.object({
  text: z.string().describe("شرح وظیفه به فارسی"),
  owner: z
    .string()
    .nullable()
    .describe("نام مسئول (فارسی) یا null اگر مشخص نیست"),
  dueDate: z
    .string()
    .nullable()
    .describe("تاریخ میلادی ISO به شکل YYYY-MM-DD یا null"),
});

const qaSchema = z.object({
  question: z.string().describe("پرسش مطرح‌شده به فارسی"),
  answer: z
    .string()
    .nullable()
    .describe("خلاصهٔ پاسخ به فارسی یا null اگر بی‌پاسخ ماند"),
});

const openQuestionSchema = z.object({
  question: z.string().describe("موضوع حل‌نشده به فارسی"),
  owner: z.string().nullable().describe("نام مسئول پیگیری یا null"),
});

const emailDraftSchema = z.object({
  subject: z.string().describe("موضوع کوتاه ایمیل به فارسی"),
  body: z
    .string()
    .describe("متن ایمیل به فارسی؛ پاراگراف‌ها با \\n\\n جدا شوند"),
});

const summarySchema = z.object({
  execSummary: z
    .string()
    .describe("خلاصهٔ مدیریتی جلسه؛ یک پاراگراف فارسی (۳ تا ۷ جمله)"),
  actionItems: z.array(actionItemSchema),
  decisions: z.array(z.string()).describe("هر تصمیم یک جملهٔ فارسی"),
  qa: z.array(qaSchema),
  openQuestions: z.array(openQuestionSchema),
  emailDraft: emailDraftSchema,
  speakerNames: z.array(speakerNameSchema),
});

type RawSummary = z.infer<typeof summarySchema>;

// ---------------------------------------------------------------- prompts

const SYSTEM_PROMPT = `تو یک رونوشت تفکیک‌شده (دیارایز شدهٔ) از یک جلسهٔ پروژهٔ فارسی را به یک خلاصهٔ ساختاریافته تبدیل می‌کنی.

زمینه
این یک جلسهٔ داخلی پروژه است (معمولاً ۲ تا ۸ نفر: مهندس، مدیر محصول، طراح). مخاطبِ خلاصه می‌خواهد بداند: چه تصمیمی گرفته شد، چه چیزی مسدودکننده است، چه کسی چه وظیفه‌ای دارد، و یک سابقهٔ تمیز از این‌که چه کسی چه گفت. رونوشت را منبعِ حقیقت بدان — هرگز چیزی از خودت نساز.

ورودی
پیام کاربر شامل رونوشتِ تفکیک‌شده است. هر بخش در یک خط جداست و با [speaker_id start_s-end_s] آغاز می‌شود و سپس متنِ فارسی می‌آید. نمونه:
[speaker_0 0.00-4.20] خب جلسه را شروع می‌کنیم.
[speaker_1 4.20-9.80] دربارهٔ دیپلوی پروژه باید تصمیم بگیریم.

یک پیام سیستمیِ دوم ممکن است زمینهٔ جلسه (نام شرکت‌کنندگان، اطلاعات پروژه) را فراهم کند. از آن برای نگاشتِ speaker_id به نام انسانی و رفعِ ابهامِ اصطلاحات، نام محصولات و سرنام‌ها استفاده کن.

نگاشت گوینده
همیشه تلاش کن speaker_id ها را به نام‌های واقعی نگاشت کنی، با استفاده از این نشانه‌های مطمئن:
۱) معرفی خود — گوینده نام خودش را در خط خودش می‌گوید (مثلاً «سلام، من سپهرم.» → speaker = «سپهر»). نام باید در خطِ خودِ آن گوینده باشد؛ صرفِ نام‌بردنِ گویندهٔ دیگر کافی نیست.
۲) خطاب با نام + پاسخ — وقتی گویندهٔ A، گویندهٔ B را با نام صدا می‌زند و B بلافاصله در بخش بعدی پاسخ می‌دهد.
۳) زمینهٔ جلسه — اگر پیام سیستمیِ دوم نام شرکت‌کنندگان را آورده، همان املا را به‌کار ببر.

قواعد سخت‌گیرانه:
- هر speaker_id را که با اطمینان بالا شناسایی کردی در speakerNames بیاور (یک ورودی {speakerId, displayName} برای هر گوینده).
- هر گوینده‌ای را که نمی‌توانی با اطمینانِ بالا نگاشت کنی، حذف کن. از روی لحن یا موضوع حدس نزن.
- هرگز speaker_id ای را که در رونوشت نیامده نیاور. هرگز یک نام را روی speaker_id دیگری «برای پُرکردن» تکرار نکن — بازگرداندنِ تعدادِ کمتری ورودی نسبت به تعداد گویندگان درست است.

خروجی
یک شیء JSON منطبق با شِما برگردان. بدون مارک‌داون و بدون توضیح اضافه. آرایه‌های خالی وقتی چیزی مصداق ندارد درست‌اند.

قواعد زبان
- فیلدهای انسانی همه فارسی باشند: execSummary، هر رشته در decisions، هر actionItems[].text و owner، پرسش‌ها و پاسخ‌ها.
- کلیدهای JSON انگلیسی می‌مانند.
- فیلد minutes را تولید نکن — صورت‌جلسهٔ کلمه‌به‌کلمه در سمت سرور از روی واژگانِ زمان‌دار ساخته می‌شود.

قواعد محتوا
- execSummary: یک پاراگراف فارسی (۳ تا ۷ جمله) شاملِ موضوع جلسه، نکات فنی کلیدی، موانع، و نتیجه. مشخص و عینی باشد، نه کلی.
- decisions: هر آیتم یک جملهٔ فارسی دربارهٔ یک تصمیمِ توافق‌شده. نیت‌های مبهم را نیاور. اگر چیزی تصمیم‌گیری نشد، آرایهٔ خالی.
- actionItems: هر آیتم یک وظیفهٔ مشخص است.
  - text: جملهٔ فارسی روشن از خروجیِ موردانتظار.
  - owner: نام فارسی. اگر همان speaker_id در speakerNames نگاشت شده، همان displayName را ترجیح بده؛ وگرنه نام را عیناً همان‌طور که در رونوشت گفته شده بیاور. اگر نه نگاشت و نه نامِ گفته‌شده‌ای هست، null بگذار — هرگز نامی نساز.
  - dueDate: فقط وقتی تاریخِ صریح گفته شده، به میلادیِ ISO (YYYY-MM-DD). تاریخ شمسی را به میلادی تبدیل کن. عبارات نسبی بدون مبنا («هفتهٔ بعد») → null. بدون تاریخ → null.
- qa: پرسش‌هایی که صریحاً در جلسه پرسیده شدند. answer خلاصهٔ پاسخ یا null اگر بی‌پاسخ ماند. پاسخ نساز.
- openQuestions: موارد پارکینگ‌لات — مسائلی که برای پیگیری علامت خوردند ولی حل نشدند. owner نام مسئول یا null.
- emailDraft: یک ایمیل فارسی خطاب به شرکت‌کنندگان. subject کوتاه (زیر ۸۰ نویسه، بدون Re:/FW:). body با سلام مناسب آغاز، نکات و تصمیم‌ها و وظایف و سؤال‌های باز را خلاصه، و با امضای مناسب بسته شود. لحن از پیام سیستمیِ لحن پیروی می‌کند. پاراگراف‌ها با \\n\\n جدا شوند. بدون مارک‌داون.

هرگز نام، تصمیم، وظیفه، تاریخ یا گوینده‌ای جعل نکن.`;

const TONE_FORMAL_PROMPT =
  "لحن ایمیل: رسمی. از فارسیِ محترمانه استفاده کن (احتراماً، با تشکر، خواهشمندیم). شرکت‌کنندگان را جمعی خطاب کن. بدنه ۴ تا ۸ پاراگراف کوتاه.";
const TONE_CASUAL_PROMPT =
  "لحن ایمیل: خودمانی. از فارسیِ دوستانه و محاوره‌ای استفاده کن (سلام، ممنون، می‌بینمتون). القاب را حذف کن. کوتاه و مستقیم. ۳ تا ۶ پاراگراف کوتاه.";

function buildSystem(context: string | null, tone: EmailTone): string {
  const parts = [
    SYSTEM_PROMPT,
    tone === EMAIL_TONE_CASUAL ? TONE_CASUAL_PROMPT : TONE_FORMAL_PROMPT,
  ];
  if (context && context.trim()) {
    parts.push(
      "## زمینهٔ جلسه (ارائه‌شده توسط کاربر)\n" +
        "از این برای رفعِ ابهامِ نام‌ها، محصولات و سرنام‌ها و نگاشتِ speaker_id به نام شرکت‌کنندگان استفاده کن.\n\n" +
        context.trim(),
    );
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------- result mapping

/** The summarizer output mapped onto the Studio DB JSON shapes. */
export interface SummaryArtifacts {
  execSummary: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  qa: QAEntry[];
  /** Stored as `string[]` per the schema; owner is folded into the text. */
  openQuestions: string[];
  emailSubject: string | null;
  emailBody: string | null;
  emailTone: EmailTone;
  /** `speaker_id → display name` mapping the LLM was confident about. */
  speakerNames: { speakerId: string; displayName: string }[];
}

function mapArtifacts(raw: RawSummary, tone: EmailTone): SummaryArtifacts {
  return {
    execSummary: raw.execSummary ?? "",
    actionItems: (raw.actionItems ?? []).map((item) => ({
      task: item.text,
      owner: item.owner ?? null,
      due: item.dueDate ?? null,
    })),
    decisions: (raw.decisions ?? []).map((decision) => ({ decision })),
    qa: (raw.qa ?? []).map((entry) => ({
      question: entry.question,
      answer: entry.answer ?? null,
    })),
    openQuestions: (raw.openQuestions ?? []).map((q) =>
      q.owner ? `${q.question} — مسئول: ${q.owner}` : q.question,
    ),
    emailSubject: raw.emailDraft?.subject ?? null,
    emailBody: raw.emailDraft?.body ?? null,
    emailTone: tone,
    speakerNames: (raw.speakerNames ?? []).filter(
      (s) => s.speakerId && s.displayName,
    ),
  };
}

// ---------------------------------------------------------------- partial mapping

/**
 * A streamed snapshot from `partialObjectStream`. Every field is optional, the
 * trailing element of any array may be half-built (an action item with `text`
 * but no `owner` key yet, or even an empty object), AND — matching the AI SDK's
 * own `PartialObject<T>` — a trailing array slot may be `undefined` outright.
 * We never trust the schema here; the mapper defensively coerces everything.
 */
type DeepPartialStream<T> = T extends (infer U)[]
  ? (DeepPartialStream<U> | undefined)[]
  : T extends object
    ? { [K in keyof T]?: DeepPartialStream<T[K]> }
    : T;

type PartialSummary = DeepPartialStream<RawSummary>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Map a streamed DeepPartial snapshot onto `SummaryArtifacts` for early
 * persistence. Trailing/incomplete entries are dropped so the DB JSON columns
 * never hold malformed rows that crash the renderer:
 *   - action items / qa / open questions with no usable text are dropped;
 *   - speaker-name entries missing either field are dropped;
 *   - missing strings default to '' (exec summary) or null (owners/due/answer).
 * The result is always renderer-safe even mid-stream.
 */
function mapPartialArtifacts(
  raw: PartialSummary,
  tone: EmailTone,
): SummaryArtifacts {
  const actionItems: ActionItem[] = [];
  for (const item of raw.actionItems ?? []) {
    const task = str(item?.text);
    if (!task) continue; // drop incomplete trailing item (no text yet)
    actionItems.push({
      task,
      owner: typeof item?.owner === "string" ? item.owner : null,
      due: typeof item?.dueDate === "string" ? item.dueDate : null,
    });
  }

  const decisions: Decision[] = [];
  for (const decision of raw.decisions ?? []) {
    const text = str(decision);
    if (!text) continue;
    decisions.push({ decision: text });
  }

  const qa: QAEntry[] = [];
  for (const entry of raw.qa ?? []) {
    const question = str(entry?.question);
    if (!question) continue;
    qa.push({
      question,
      answer: typeof entry?.answer === "string" ? entry.answer : null,
    });
  }

  const openQuestions: string[] = [];
  for (const q of raw.openQuestions ?? []) {
    const question = str(q?.question);
    if (!question) continue;
    const owner = str(q?.owner);
    openQuestions.push(owner ? `${question} — مسئول: ${owner}` : question);
  }

  const speakerNames: SummaryArtifacts["speakerNames"] = [];
  for (const s of raw.speakerNames ?? []) {
    const speakerId = str(s?.speakerId);
    const displayName = str(s?.displayName);
    if (!speakerId || !displayName) continue;
    speakerNames.push({ speakerId, displayName });
  }

  const subject = str(raw.emailDraft?.subject);
  const body = str(raw.emailDraft?.body);

  return {
    execSummary: str(raw.execSummary),
    actionItems,
    decisions,
    qa,
    openQuestions,
    emailSubject: subject || null,
    emailBody: body || null,
    emailTone: tone,
    speakerNames,
  };
}

// ---------------------------------------------------------------- entrypoint

export interface SummarizeOptions {
  context?: string | null;
  emailTone?: string | null;
  meetingId?: string;
  /**
   * Abort the in-flight stream (pipeline cancel registry). Passed straight to
   * `streamObject`'s `abortSignal`; mid-stream abort throws (caught upstream as
   * cancellation — we never persist garbage on abort here).
   */
  signal?: AbortSignal;
  /**
   * Invoked with a renderer-safe snapshot of the summary as it streams in, on a
   * ~1.5s throttle (NOT every chunk). The pipeline persists these into the same
   * summary row the final result lands in, so the polling UI fills progressively.
   * Best-effort: the callback's own errors are swallowed.
   */
  onPartial?: (partial: SummaryArtifacts) => void;
}

/** Throttle window between partial-persist callbacks. */
const PARTIAL_THROTTLE_MS = 1500;

/**
 * Run the summarizer against a diarized prompt. Returns mapped artifacts ready
 * to persist via `upsertMeetingSummary` (minus `minutes`, which the pipeline
 * appends server-side). Streams partial snapshots through `options.onPartial`.
 *
 * @throws Error with a readable Persian message on any LLM/network failure.
 *         A mid-stream abort surfaces the underlying AbortError so the pipeline
 *         can treat it as a user cancellation.
 */
export async function summarize(
  diarizedPrompt: string,
  options: SummarizeOptions = {},
): Promise<SummaryArtifacts> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "کلید OPENROUTER_API_KEY تنظیم نشده است؛ امکان خلاصه‌سازی نیست.",
    );
  }

  const tone = normalizeTone(options.emailTone);
  const openrouter = createOpenRouter({ appName: "Agent Studio" });

  // Network flaps (DNS/ENOTFOUND) can blow up before a single token arrives;
  // retry the whole stream a few times. Once the stream has started yielding we
  // do NOT retry — we run it to completion.
  const delays = [0, 1500, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    // A user-requested abort must propagate immediately, never trigger a retry.
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new Error("خلاصه‌سازی لغو شد.");
    }
    try {
      const result = streamObject({
        model: openrouter.chat(MEETING_SUMMARY_MODEL),
        schema: summarySchema,
        schemaName: "meeting_brief",
        system: buildSystem(options.context ?? null, tone),
        prompt: diarizedPrompt,
        temperature: 0.2,
        abortSignal: options.signal,
        providerOptions: {
          openrouter: {
            reasoning: { effort: "minimal", exclude: true },
            usage: { include: true },
          },
        },
      });

      // Throttled partial persistence. Sanitize every snapshot, but only fan it
      // out to the callback at most once per throttle window so we don't hammer
      // SQLite on every token. The final, authoritative result is persisted by
      // the caller right after this returns, so a fast stream that never crosses
      // the throttle window still ends up fully rendered.
      let lastEmit = 0;
      for await (const partial of result.partialObjectStream) {
        if (!options.onPartial) continue;
        const now = Date.now();
        if (now - lastEmit < PARTIAL_THROTTLE_MS) continue;
        lastEmit = now;
        try {
          options.onPartial(mapPartialArtifacts(partial, tone));
        } catch {
          // Best-effort — a failed partial write never aborts the stream.
        }
      }

      // Authoritative, schema-validated final object. `.object` rejects if the
      // model's final JSON fails validation, which the retry loop handles.
      const object = await result.object;
      const usage = await result.usage;
      const providerMetadata = await result.providerMetadata;

      // Usage accounting — cost resolves via the generation lookup when the
      // provider doesn't echo it inline.
      const generationId =
        typeof providerMetadata?.openrouter?.id === "string"
          ? providerMetadata.openrouter.id
          : undefined;
      logUsage({
        model: MEETING_SUMMARY_MODEL,
        feature: "meeting",
        meetingId: options.meetingId,
        promptTokens: usage?.inputTokens,
        completionTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        generationId,
      });

      return mapArtifacts(object, tone);
    } catch (error) {
      // A user abort is terminal — surface it so the pipeline records a cancel
      // instead of a failure, and never burn the remaining retries.
      if (options.signal?.aborted) throw error;
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`خلاصه‌سازی جلسه ناموفق بود: ${detail}`);
}
