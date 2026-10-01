"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import {
  BookmarkIcon,
  CopyIcon,
  GlobeIcon,
  PencilIcon,
  RefreshCcwIcon,
  SparklesIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { AssistantParts } from "@/components/app/assistant-parts";
import { AssistantPresence } from "@/components/app/assistant-presence";
import { CodeCanvas } from "@/components/app/code-canvas";
import {
  ModelPicker,
  type SelectedModel,
} from "@/components/app/model-picker";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { bindConfigAction, setModelAction } from "@/lib/actions";
import { bookmarkReply } from "@/lib/actions/knowledge";
import { consumeComposerSeed } from "@/lib/composer-handoff";
import type { ConfigRow } from "@/lib/db/schema";
import { getModel, models } from "@/lib/models";
import type { ChatMessage } from "@/lib/tools";
import { detectDir } from "@/lib/use-direction";

const SUGGESTIONS = [
  "کوئاین را با یک مثال کد توضیح بده",
  "یک بازی مار رترو در قالب یک فایل HTML بساز",
  "مزایا و معایب SSE و WebSocket را برای استریم مقایسه کن",
  "یک هایکو درباره‌ی شب‌های کدنویسی بنویس",
];

const STATUS_LABELS = {
  ready: "آماده",
  submitted: "در حال اتصال",
  streaming: "در حال پاسخ",
  error: "خطا",
} as const;

/** Cap on the extracted-document text spliced into an outgoing message. */
const MAX_DOC_CHARS = 24_000;

function messageText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n");
}

/** Time-of-day in Persian locale, e.g. "۱۴:۳۲". */
const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** OpenRouter cost as `$0.0042` (LTR, 4 decimals). */
function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

/**
 * Friendly display name for a model slug: prefer the curated quick-list name,
 * fall back to the slug tail (`anthropic/claude-opus-4.8` → `claude-opus-4.8`)
 * for non-curated catalog models.
 */
function friendlyModelName(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined;
  const curated = models.find((m) => m.id === modelId);
  return curated?.name ?? modelId.split("/").at(-1) ?? modelId;
}

/** Tailwind `lg` breakpoint — the point where the canvas docks as an aside. */
const LG_BREAKPOINT = 1024;

/**
 * True below the `lg` breakpoint. Drives the canvas Sheet vs. static aside
 * split off the SAME width the CSS switches at, so the canvas never renders
 * twice (two iframes = double sandbox cost). The shared `useIsMobile` hook
 * uses 768px, which wouldn't line up with the `lg` aside.
 */
function useIsBelowLg(): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`);
    const onChange = () => setBelow(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return below;
}

function isImage(mediaType: string | undefined): boolean {
  return Boolean(mediaType?.startsWith("image/"));
}

function isPdf(mediaType: string | undefined, filename?: string): boolean {
  return (
    mediaType === "application/pdf" ||
    Boolean(filename && /\.pdf$/i.test(filename))
  );
}

const PromptAttachments = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

export interface ChatPaneProps {
  conversationId: string;
  initialMessages: ChatMessage[];
  initialModelId: string;
  initialTitle?: string;
  /** New chat at "/" — URL is upgraded to /chat/:id on first send */
  isNew?: boolean;
  /** The user's assistant configs — feeds the picker's "دستیارهای من" group. */
  configs?: ConfigRow[];
  /** Bound assistant id on a hydrated conversation (null ⇒ quick model). */
  initialConfigId?: string | null;
}

export function ChatPane({
  conversationId,
  initialMessages,
  initialModelId,
  initialTitle,
  isNew = false,
  configs = [],
  initialConfigId = null,
}: ChatPaneProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [input, setInput] = useState("");
  // Title is held in state so the auto-title (delivered as a transient
  // `data-conversation` part mid-stream) can crossfade in without waiting on a
  // router.refresh remount. Seeded from the prop; kept in sync below.
  const [title, setTitle] = useState(initialTitle);
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(() => {
    const quick = getModel(initialModelId);
    const base =
      quick.id === initialModelId
        ? quick
        : // Non-curated catalog slug persisted on the conversation — context
          // window unknown until reselected from the catalog
          {
            id: initialModelId,
            name: initialModelId.split("/").at(-1) ?? initialModelId,
            contextWindow: 0,
            supportsVision: true,
          };
    return { ...base, configId: initialConfigId };
  });
  const [webSearch, setWebSearch] = useState(false);
  const [canvasCode, setCanvasCode] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [uploading, setUploading] = useState(false);
  const isBelowLg = useIsBelowLg();

  const changeModel = (model: SelectedModel) => {
    const prevConfigId = selectedModel.configId ?? null;
    const nextConfigId = model.configId ?? null;
    setSelectedModel(model);
    if (!isNew) {
      void setModelAction(conversationId, model.id);
      // Persist (or clear) the bound assistant when it changed.
      if (nextConfigId !== prevConfigId) {
        void bindConfigAction(conversationId, nextConfigId);
      }
    }
  };

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({
          id,
          messages,
          trigger,
          messageId,
          body,
        }) => ({
          // Server rebuilds history from the DB — send only the last message
          body: {
            conversationId: id,
            message: messages.at(-1),
            trigger,
            messageId,
            ...body,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, setMessages, regenerate, stop, status, error } =
    useChat<ChatMessage>({
      id: conversationId,
      messages: initialMessages,
      transport,
      onData: (part) => {
        if (part.type === "data-conversation") {
          const data = part.data as { id: string; title: string };
          document.title = `${data.title} · استودیو`;
          // Crossfade the in-header title to the freshly minted auto-title
          // without a remount (the AnimatePresence below keys off this state).
          setTitle(data.title);
          // On "/" the router must NOT refresh mid-stream — it would re-mint
          // the UUID and remount an empty pane. Sidebar catches up on finish.
          if (!isNew) {
            router.refresh();
          }
        }
      },
      onFinish: () => {
        if (isNew) {
          // Messages are persisted now — promote to the real route. The
          // remounted pane rehydrates from the DB.
          router.replace(`/chat/${conversationId}`);
        } else {
          router.refresh();
        }
      },
    });

  useEffect(() => {
    if (initialTitle) {
      document.title = `${initialTitle} · استودیو`;
    }
  }, [initialTitle]);

  // Composer handoff: a pending seed (template fill / discuss-meeting) lands
  // in the composer once, on mount. useChat v6 has no shared store, so the
  // bridge is a one-shot sessionStorage read.
  useEffect(() => {
    const seed = consumeComposerSeed();
    if (seed) setInput(seed);
  }, []);

  // Deep-link from a knowledge card: /chat/[id]#msg-<id> → scroll the source
  // message into view once the thread has hydrated.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#msg-")) return;
    const id = hash.slice("#msg-".length);
    // Defer to the next frame so the message nodes are mounted.
    const raf = requestAnimationFrame(() => {
      const node = document.getElementById(`msg-${id}`);
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length]);

  const model = selectedModel;
  const isStreaming = status === "streaming";
  const requestBody = {
    modelId: model.id,
    webSearch,
    configId: model.configId ?? null,
  };

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const usedTokens = lastAssistant?.metadata?.totalTokens ?? 0;

  /**
   * Resolve attachments into outgoing message parts.
   * - Images → file part (vision models read them directly).
   * - PDFs → uploaded, then attached as an application/pdf file part so the
   *   OpenRouter file-parser plugin can OCR them.
   * - docx/xlsx/txt/csv/md → uploaded, text extracted server-side and spliced
   *   into the message text as a clearly-delimited quoted block (capped).
   *
   * Returns the parts to send, or null if upload failed (caller aborts).
   */
  const resolveAttachments = async (
    text: string,
    files: FileUIPart[],
  ): Promise<ChatMessage["parts"] | null> => {
    const fileParts: FileUIPart[] = [];
    const docBlocks: string[] = [];

    for (const file of files) {
      if (isImage(file.mediaType)) {
        // Keep images as-is (data URL already produced by PromptInput).
        fileParts.push(file);
        continue;
      }

      // Everything else goes through the upload+extract pipeline.
      let uploaded: {
        id: string;
        url: string;
        filename: string;
        mimeType: string;
        extractedText: string;
        extractStatus: string;
      };
      try {
        const form = new FormData();
        // Reconstruct a File from the data URL the composer produced.
        const blob = await (await fetch(file.url)).blob();
        form.append(
          "file",
          new File([blob], file.filename ?? "upload", {
            type: file.mediaType,
          }),
        );
        form.append("conversationId", conversationId);
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          toast.error(`بارگذاری «${file.filename ?? "فایل"}» ناموفق بود`);
          return null;
        }
        uploaded = json as typeof uploaded;
      } catch {
        toast.error(`بارگذاری «${file.filename ?? "فایل"}» ناموفق بود`);
        return null;
      }

      if (isPdf(uploaded.mimeType, uploaded.filename)) {
        // Attach as a file part for the OpenRouter file-parser. Use the
        // composer's data URL (not the relative /api/uploads URL) — the AI
        // SDK calls `new URL(part.url)` server-side to download the bytes,
        // which throws on a relative path. The upload row still persists for
        // history/serving; the LLM reads the inline data URL.
        fileParts.push({
          type: "file",
          mediaType: "application/pdf",
          filename: uploaded.filename,
          url: file.url,
        });
        continue;
      }

      // Office / text family: splice the extracted text as a quoted block.
      const extracted = uploaded.extractedText?.trim();
      if (extracted) {
        const capped =
          extracted.length > MAX_DOC_CHARS
            ? `${extracted.slice(0, MAX_DOC_CHARS)}\n…[محتوا کوتاه شد]`
            : extracted;
        docBlocks.push(
          `--- محتوای فایل «${uploaded.filename}» ---\n${capped}\n--- پایان فایل ---`,
        );
      } else {
        toast.error(`متنی از «${uploaded.filename}» استخراج نشد`);
      }
    }

    const composedText = [text.trim(), ...docBlocks]
      .filter(Boolean)
      .join("\n\n");

    const parts: ChatMessage["parts"] = [];
    if (composedText) {
      parts.push({ type: "text", text: composedText });
    }
    for (const fp of fileParts) {
      parts.push(fp);
    }
    // Guarantee a non-empty message (e.g. only a PDF attached, no text).
    if (parts.length === 0) {
      parts.push({ type: "text", text: "پیام همراه با پیوست" });
    }
    return parts;
  };

  const submitPrompt = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim());
    const files = message.files ?? [];
    const hasAttachments = files.length > 0;

    if (!(hasText || hasAttachments)) {
      return;
    }

    // Fast path: no attachments → send plain text immediately.
    if (!hasAttachments) {
      sendMessage({ text: message.text ?? "" }, { body: requestBody });
      setInput("");
      return;
    }

    setUploading(true);
    try {
      const parts = await resolveAttachments(message.text ?? "", files);
      if (!parts) return; // upload failed; PromptInput keeps the attachments
      sendMessage({ parts }, { body: requestBody });
      setInput("");
    } finally {
      setUploading(false);
    }
  };

  const sendSuggestion = (suggestion: string) => {
    sendMessage({ text: suggestion }, { body: requestBody });
  };

  // Destructive edit: drop the edited message + everything after it locally,
  // then resend with the SAME id — the server truncates from its old position
  const commitEdit = (message: ChatMessage) => {
    const text = editDraft.trim();
    setEditingId(null);
    if (!text || text === messageText(message)) return;

    const index = messages.findIndex((m) => m.id === message.id);
    if (index === -1) return;

    setMessages(messages.slice(0, index));
    sendMessage(
      { id: message.id, role: "user", parts: [{ type: "text", text }] },
      { body: requestBody },
    );
  };

  const handleBookmark = async (message: ChatMessage) => {
    const content = messageText(message).trim();
    if (!content) return;
    try {
      await bookmarkReply(
        message.id,
        conversationId,
        content,
        undefined,
        message.metadata?.modelId ?? model.id,
      );
      setBookmarkedIds((prev) => new Set(prev).add(message.id));
      toast.success("در گنجینه دانش ذخیره شد");
    } catch {
      toast.error("ذخیره در گنجینه ناموفق بود");
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="mx-auto flex h-full min-w-0 flex-1 flex-col px-4 lg:max-w-4xl">
      {/* Titlebar */}
      <header className="glass sticky top-2 z-10 my-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ms-1 text-fg-3" />
          <span
            className="status-dot shrink-0"
            data-state={
              isStreaming || status === "submitted"
                ? "active"
                : status === "error"
                  ? "error"
                  : "idle"
            }
          />
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              className="truncate font-medium text-fg-1"
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              key={title ?? "گفتگوی جدید"}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {title ?? "گفتگوی جدید"}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3">
          <Context
            // Unknown window (catalog slug restored from DB) — assume 1M so
            // the meter still renders; corrected on reselect from catalog
            maxTokens={model.contextWindow || 1_000_000}
            modelId={model.id}
            usage={{
              inputTokens: lastAssistant?.metadata?.inputTokens,
              inputTokenDetails: {
                noCacheTokens: undefined,
                cacheReadTokens: undefined,
                cacheWriteTokens: undefined,
              },
              outputTokens: lastAssistant?.metadata?.outputTokens,
              outputTokenDetails: {
                reasoningTokens: undefined,
                textTokens: undefined,
              },
              totalTokens: lastAssistant?.metadata?.totalTokens,
            }}
            usedTokens={usedTokens}
          >
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
              <ContextContentBody>
                <ContextInputUsage />
                <ContextOutputUsage />
              </ContextContentBody>
            </ContextContent>
          </Context>
        </div>
      </header>

      {/* Thread */}
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <span
                aria-hidden
                className="ai-breathe grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary"
              >
                <SparklesIcon className="size-7" />
              </span>
              <div className="space-y-1.5">
                <h3 className="font-heading font-bold text-xl">
                  چطور می‌توانم کمک کنم؟
                </h3>
                <p className="text-fg-3 text-sm">
                  یک پرسش بنویسید یا یکی از پیشنهادها را انتخاب کنید.
                </p>
              </div>
              <div className="glass mt-1 max-w-md rounded-xl p-3.5 text-start text-fg-3 text-xs leading-relaxed">
                <p>• پاسخ‌های استریمی همراه با ردیابی استدلال</p>
                <p>
                  • دسترسی به وب با کلید{" "}
                  <span className="font-medium text-primary">وب</span>
                </p>
                <p>
                  • پاسخ‌های{" "}
                  <span dir="ltr" className="font-mono text-primary">
                    HTML
                  </span>{" "}
                  در بوم پیش‌نمایش باز می‌شوند
                </p>
              </div>
              {/* Bound the scroll area to a concrete width: inside the centered
                  (items-center) empty state the ai-elements Suggestions wrapper
                  (w-full + inner w-max) had no width to scroll within, so at
                  wide viewports the last chip overran the start edge instead of
                  scrolling. The RTL-safe edge fade signals "scroll for more". */}
              <div className="mt-4 w-full max-w-xl px-1 [mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%-2rem),transparent)]">
                <Suggestions>
                  {SUGGESTIONS.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      onClick={sendSuggestion}
                      suggestion={suggestion}
                    >
                      {suggestion}
                    </Suggestion>
                  ))}
                </Suggestions>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message, index) => (
              <Message from={message.role} id={`msg-${message.id}`} key={message.id}>
                <MessageContent>
                  {message.role === "user" ? (
                    editingId === message.id ? (
                      <div className="flex w-full flex-col gap-2">
                        <Textarea
                          autoFocus
                          className="resize-y text-sm"
                          dir={detectDir(editDraft)}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                              commitEdit(message);
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          value={editDraft}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => commitEdit(message)}
                            size="sm"
                            type="button"
                          >
                            ارسال مجدد
                          </Button>
                          <Button
                            onClick={() => setEditingId(null)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            انصراف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="whitespace-pre-wrap text-start"
                        dir={detectDir(messageText(message))}
                      >
                        {messageText(message)}
                      </p>
                    )
                  ) : (
                    <AssistantParts
                      isLastMessage={index === messages.length - 1}
                      isStreaming={isStreaming}
                      message={message}
                      onOpenCanvas={setCanvasCode}
                    />
                  )}
                </MessageContent>
                {message.role === "user" &&
                  status === "ready" &&
                  editingId !== message.id && (
                    <MessageActions>
                      <MessageAction
                        onClick={() => {
                          setEditDraft(messageText(message));
                          setEditingId(message.id);
                        }}
                        tooltip="ویرایش و ارسال مجدد (پیام‌های بعدی حذف می‌شوند)"
                      >
                        <PencilIcon className="size-3.5" />
                      </MessageAction>
                    </MessageActions>
                  )}
                {message.role === "assistant" &&
                  status === "ready" &&
                  messageText(message).trim().length > 0 && (
                    <MessageActions>
                      <MessageAction
                        onClick={() =>
                          navigator.clipboard.writeText(messageText(message))
                        }
                        tooltip="کپی پاسخ"
                      >
                        <CopyIcon className="size-3.5" />
                      </MessageAction>
                      <MessageAction
                        onClick={() => handleBookmark(message)}
                        tooltip={
                          bookmarkedIds.has(message.id)
                            ? "در گنجینه ذخیره شد"
                            : "ذخیره در گنجینه"
                        }
                      >
                        <BookmarkIcon
                          className={`size-3.5 ${bookmarkedIds.has(message.id) ? "fill-primary text-primary" : ""}`}
                        />
                      </MessageAction>
                      {index === messages.length - 1 && (
                        <MessageAction
                          onClick={() => regenerate({ body: requestBody })}
                          tooltip="تولید دوباره"
                        >
                          <RefreshCcwIcon className="size-3.5" />
                        </MessageAction>
                      )}
                    </MessageActions>
                  )}
                {message.role === "assistant" &&
                  index === messages.length - 1 &&
                  isStreaming && (
                    <div className="mt-1 px-1">
                      <AssistantPresence
                        modelName={friendlyModelName(
                          message.metadata?.modelId ?? model.id,
                        )}
                        size="sm"
                        state="streaming"
                      />
                    </div>
                  )}
                {message.role === "assistant" &&
                  message.metadata &&
                  !(index === messages.length - 1 && isStreaming) && (
                    <motion.div
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 text-meta text-fg-4"
                      initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      {message.metadata.modelId && (
                        <span dir="ltr" className="font-mono">
                          {message.metadata.modelId.split("/").at(-1)}
                        </span>
                      )}
                      {typeof message.metadata.totalTokens === "number" && (
                        <span>
                          {message.metadata.totalTokens.toLocaleString("fa-IR")}{" "}
                          توکن
                        </span>
                      )}
                      {typeof message.metadata.costUsd === "number" && (
                        <span dir="ltr" className="font-mono">
                          {formatCost(message.metadata.costUsd)}
                        </span>
                      )}
                      {typeof message.metadata.createdAt === "number" && (
                        <span dir="ltr" className="font-mono">
                          {timeFormatter.format(message.metadata.createdAt)}
                        </span>
                      )}
                    </motion.div>
                  )}
              </Message>
            ))
          )}
          {status === "submitted" && (
            // Assistant bubble shell: occupies the same visual slot the real
            // streaming message lands in (.glass rounded-2xl), so the swap on
            // first token is a content replace, not a layout pop. The accent
            // glow + skeleton sheen read as "the model is thinking".
            <div className="glass ai-glow-pulse w-fit max-w-full space-y-3 rounded-2xl p-4">
              <AssistantPresence
                modelName={friendlyModelName(model.id)}
                size="md"
                state="thinking"
              />
              <div className="space-y-2">
                <div className="glass-sheen h-3 w-64 max-w-full rounded-full bg-fg-4/10" />
                <div className="glass-sheen h-3 w-48 max-w-full rounded-full bg-fg-4/10" />
                <div className="glass-sheen h-3 w-36 max-w-full rounded-full bg-fg-4/10" />
              </div>
            </div>
          )}
          {error && (
            <div className="glass flex items-start gap-2.5 rounded-xl p-3">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-err" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-medium text-fg-1 text-sm">خطایی رخ داد</p>
                <p className="break-words text-fg-2 text-sm">{error.message}</p>
                <Button
                  onClick={() => regenerate({ body: requestBody })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCcwIcon className="size-3.5" />
                  تلاش دوباره
                </Button>
              </div>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <PromptInput
        className="glass mb-2 rounded-2xl"
        globalDrop
        multiple
        onSubmit={submitPrompt}
      >
        <PromptInputHeader>
          <PromptAttachments />
        </PromptInputHeader>
        <PromptInputBody>
          <PromptInputTextarea
            dir={detectDir(input)}
            onChange={(e) => setInput(e.target.value)}
            placeholder="پیام خود را بنویسید…"
            value={input}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {/* Attachments: documents (PDF/Word/Excel/متن) always available;
                images only for vision-capable models. */}
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="افزودن سند یا تصویر" />
                {model.supportsVision && (
                  <PromptInputActionAddScreenshot label="گرفتن اسکرین‌شات" />
                )}
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputButton
              onClick={() => setWebSearch(!webSearch)}
              tooltip={{ content: "جستجوی وب از طریق OpenRouter" }}
              variant={webSearch ? "default" : "ghost"}
            >
              <GlobeIcon className="size-4" />
              <span className="text-xs">وب</span>
            </PromptInputButton>
            <ModelPicker
              configs={configs}
              onChange={changeModel}
              value={selectedModel}
            />
          </PromptInputTools>
          {isStreaming ? (
            <PromptInputButton
              aria-label="توقف"
              onClick={() => stop()}
              variant="default"
            >
              <SquareIcon className="size-4" />
            </PromptInputButton>
          ) : (
            <PromptInputSubmit
              disabled={status === "submitted" || uploading}
              status={uploading ? "submitted" : status}
            />
          )}
        </PromptInputFooter>
      </PromptInput>

      {/* Status bar */}
      <footer className="flex items-center justify-between border-t py-2 text-meta text-fg-4">
        <span>
          وضعیت:{" "}
          <span
            className={status === "error" ? "text-destructive" : "text-primary"}
          >
            {uploading ? "در حال بارگذاری پیوست" : STATUS_LABELS[status]}
          </span>
        </span>
        <span dir="ltr" className="hidden font-mono sm:block">
          {model.id}
        </span>
        <span>
          وب:{" "}
          <span className={webSearch ? "text-primary" : ""}>
            {webSearch ? "روشن" : "خاموش"}
          </span>
        </span>
      </footer>
      </div>

      {/* Code canvas — static aside ≥lg; a full-width Sheet below lg. The
          isBelowLg gate (same 1024px the CSS switches at) guarantees only one
          CodeCanvas — and therefore one sandboxed iframe — mounts at a time. */}
      {canvasCode && !isBelowLg && (
        <aside className="fixed inset-0 z-50 bg-background lg:static lg:z-auto lg:w-[30rem] lg:shrink-0 lg:border-s xl:w-[36rem]">
          <CodeCanvas code={canvasCode} onClose={() => setCanvasCode(null)} />
        </aside>
      )}

      {isBelowLg && (
        <Sheet
          onOpenChange={(open) => {
            if (!open) setCanvasCode(null);
          }}
          open={canvasCode !== null}
        >
          <SheetContent
            className="w-screen max-w-none gap-0 p-0 sm:max-w-none"
            showCloseButton={false}
            side="left"
          >
            <SheetTitle className="sr-only">بوم پیش‌نمایش کد</SheetTitle>
            {canvasCode !== null && (
              <CodeCanvas
                code={canvasCode}
                onClose={() => setCanvasCode(null)}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

    </div>
  );
}
