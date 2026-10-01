"use client";

import {
  BookMarkedIcon,
  ChevronDownIcon,
  GlobeIcon,
  ImageIcon,
  PlugIcon,
  SquareTerminalIcon,
  WrenchIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { extractCanvasArtifact } from "@/lib/canvas";
import type { ChatMessage } from "@/lib/tools";
import { detectDir } from "@/lib/use-direction";
import { getToolName } from "ai";
import type { ToolUIPart } from "ai";

/** Output shape of the native `generate_image` tool (id + servable URL). */
interface GeneratedImageOutput {
  id: string;
  url: string;
}

function isGeneratedImageOutput(value: unknown): value is GeneratedImageOutput {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GeneratedImageOutput).url === "string"
  );
}

/** `[1]` / `[۱]` style citation markers — ASCII or Persian digits. */
const CITATION_MARKER = /\[(?:\d+|[۰-۹]+)\]/;

interface CitationSource {
  url: string;
  title?: string;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Persian reasoning trigger copy. While streaming → shimmering «در حال
 * اندیشیدن…»; settled → «{n} ثانیه اندیشید» (Persian digits). The SDK reports
 * `duration === undefined` for sub-second / unmeasured thinks → «چند ثانیه».
 */
function thinkingMessage(isStreaming: boolean, duration?: number): ReactNode {
  if (isStreaming || duration === 0) {
    return (
      <Shimmer duration={1} variant="accent">
        در حال اندیشیدن…
      </Shimmer>
    );
  }
  if (duration === undefined) {
    return <p>چند ثانیه اندیشید</p>;
  }
  return <p>{duration.toLocaleString("fa-IR")} ثانیه اندیشید</p>;
}

/** Per-family glyph + tint for tool headers, keyed off the resolved tool name. */
function toolHeaderIcon(toolName: string, isDynamic: boolean): ReactNode {
  const name = toolName.toLowerCase();
  let Icon = WrenchIcon;
  let tint = "var(--chart-1)";
  if (name === "generate_image") {
    Icon = ImageIcon;
    tint = "var(--chart-5)";
  } else if (name === "knowledge_search") {
    Icon = BookMarkedIcon;
    tint = "var(--chart-3)";
  } else if (name.includes("web") || name.includes("search")) {
    Icon = GlobeIcon;
    tint = "var(--chart-3)";
  } else if (isDynamic) {
    // MCP tools surface as `dynamic-tool` parts.
    Icon = PlugIcon;
    tint = "var(--chart-2)";
  }
  return <Icon className="size-4" style={{ color: tint }} />;
}

/**
 * MCP server label for a dynamic tool. Names may be encoded `server__tool`
 * (or `server.tool`) — take the prefix as the server, else the whole name.
 */
function mcpServerName(toolName: string): string {
  const match = toolName.match(/^(.+?)(?:__|\.).+$/);
  return match ? match[1] : toolName;
}

/**
 * Numbered citation chips rendered under a web-search reply. Streamdown owns
 * the markdown render, so in-text `[n]` markers are left intact (no fork); this
 * row is the legend — chip `n` links to the nth source via a hover-card. Shown
 * whenever a reply carries sources, doubling as a compact complement to the
 * Sources collapsible.
 */
function CitationChips({ sources }: { sources: CitationSource[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" dir="ltr">
      {sources.map((source, i) => (
        <InlineCitation key={`${source.url}-${i}`}>
          <InlineCitationCard>
            <HoverCardTrigger asChild>
              <a href={source.url} rel="noreferrer" target="_blank">
                <Badge
                  className="cursor-pointer gap-1 rounded-full transition-colors hover:bg-secondary/70"
                  variant="secondary"
                >
                  <span className="font-mono text-meta text-muted-foreground">
                    {i + 1}
                  </span>
                  {hostname(source.url)}
                </Badge>
              </a>
            </HoverCardTrigger>
            <InlineCitationCardBody className="p-3">
              <InlineCitationSource
                title={source.title ?? hostname(source.url)}
                url={source.url}
              />
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
      ))}
    </div>
  );
}

export function AssistantParts({
  message,
  isLastMessage,
  isStreaming,
  onOpenCanvas,
}: {
  message: ChatMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
  onOpenCanvas?: (code: string) => void;
}) {
  const artifact =
    onOpenCanvas && !(isLastMessage && isStreaming)
      ? extractCanvasArtifact(message.parts)
      : null;
  const sourceParts = message.parts.filter(
    (part) => part.type === "source-url",
  );
  const reasoningParts = message.parts.filter(
    (part) => part.type === "reasoning",
  );
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");

  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";
  const showCursor = isLastMessage && isStreaming && lastPart?.type === "text";

  // Citation chips: rendered when a reply carries BOTH text and web sources.
  // Marker detection (`[n]`/`[۱]`) is informational — the chips show regardless
  // as a numbered legend the in-text markers point at. Hidden while the last
  // message is still streaming so chips don't flicker before sources settle.
  const citationText = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const hasCitationMarkers = CITATION_MARKER.test(citationText);
  const showCitations =
    sourceParts.length > 0 &&
    citationText.trim().length > 0 &&
    !(isLastMessage && isStreaming);

  return (
    <>
      {sourceParts.length > 0 && (
        <Sources>
          <SourcesTrigger count={sourceParts.length}>
            <span className="font-medium">
              {sourceParts.length.toLocaleString("fa-IR")} منبع بررسی شد
            </span>
            <ChevronDownIcon className="size-4" />
          </SourcesTrigger>
          <SourcesContent>
            {sourceParts.map((part) => (
              <Source
                href={part.url}
                key={part.sourceId}
                title={part.title ?? new URL(part.url).hostname}
              />
            ))}
          </SourcesContent>
        </Sources>
      )}
      {reasoningParts.length > 0 && (
        <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
          <ReasoningTrigger getThinkingMessage={thinkingMessage} />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          const isLastTextPart = showCursor && i === message.parts.length - 1;
          return (
            <div
              className="text-start"
              dir={detectDir(part.text)}
              key={`${message.id}-${i}`}
            >
              <MessageResponse>{part.text}</MessageResponse>
              {isLastTextPart && <span className="stream-caret" />}
            </div>
          );
        }
        // Generic tool rendering — works for any future tool without UI changes
        if (part.type === "dynamic-tool") {
          return (
            <Tool key={`${message.id}-${i}`}>
              <ToolHeader
                badge={
                  <span
                    className="rounded-full px-2 py-0.5 text-meta"
                    style={{
                      backgroundColor: "color-mix(in oklab, var(--chart-2) 16%, transparent)",
                      color: "var(--chart-2)",
                    }}
                  >
                    {mcpServerName(part.toolName)}
                  </span>
                }
                icon={toolHeaderIcon(part.toolName, true)}
                state={part.state}
                toolName={part.toolName}
                type={part.type}
              />
              <ToolContent>
                <ToolInput input={part.input} />
                <ToolOutput errorText={part.errorText} output={part.output} />
              </ToolContent>
            </Tool>
          );
        }
        // Typed native tools (`tool-*` parts). Guard on the type prefix rather
        // than `isToolUIPart` alone: while the backend tool set is empty,
        // `ChatTools` is `{}` so `ToolUIPart` narrows to `never` and the typed
        // branch would be unreachable — the prefix check + cast compiles both
        // before and after the native tools land.
        if (part.type.startsWith("tool-")) {
          const toolPart = part as ToolUIPart;
          const toolName = getToolName(toolPart);

          // generate_image returns {id, url} → render the image inline rather
          // than a JSON code block once the output is available.
          if (
            toolName === "generate_image" &&
            toolPart.state === "output-available" &&
            isGeneratedImageOutput(toolPart.output)
          ) {
            return (
              <img
                alt="تصویر تولیدشده"
                className="max-w-sm rounded-xl border border-border"
                key={`${message.id}-${i}`}
                loading="lazy"
                src={toolPart.output.url}
              />
            );
          }

          return (
            <Tool key={`${message.id}-${i}`}>
              <ToolHeader
                icon={toolHeaderIcon(toolName, false)}
                state={toolPart.state}
                type={toolPart.type}
              />
              <ToolContent>
                <ToolInput input={toolPart.input} />
                <ToolOutput
                  errorText={toolPart.errorText}
                  output={toolPart.output}
                />
              </ToolContent>
            </Tool>
          );
        }
        return null;
      })}
      {showCitations && (
        <div>
          {hasCitationMarkers && (
            <p className="text-fg-4 text-xs" dir="rtl">
              منابع ارجاع‌شده در متن:
            </p>
          )}
          <CitationChips
            sources={sourceParts.map((part) => ({
              url: part.url,
              title: part.title,
            }))}
          />
        </div>
      )}
      {artifact && (
        <button
          className="mt-1 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-primary text-xs transition-colors hover:bg-primary/12"
          onClick={() => onOpenCanvas?.(artifact.code)}
          type="button"
        >
          <SquareTerminalIcon className="size-3.5" />
          باز کردن در بوم
        </button>
      )}
    </>
  );
}
