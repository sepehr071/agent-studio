"use client";

import {
  CalendarIcon,
  CheckIcon,
  CircleDashedIcon,
  CopyIcon,
  Loader2Icon,
  RefreshCwIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActionItem,
  Decision,
  MinutesSegment,
  QAEntry,
} from "@/lib/db/types";
import { detectDir } from "@/lib/use-direction";
import { EMAIL_TONE_OPTIONS, toneLabel } from "./meeting-shared";

/** Quiet per-section empty placeholder. */
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-xl px-6 py-12 text-center">
      <p className="text-fg-4 text-sm">{children}</p>
    </div>
  );
}

export function ExecSummaryBody({ text }: { text: string }) {
  return (
    <p dir={detectDir(text)} className="text-fg-1 text-sm leading-relaxed">
      {text}
    </p>
  );
}

export function ActionItemsList({ items }: { items: ActionItem[] }) {
  if (!items.length) {
    return <SectionEmpty>وظیفه‌ای ثبت نشد.</SectionEmpty>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2.5 rounded-lg bg-foreground/4 px-3.5 py-3"
        >
          <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok" />
          <div className="min-w-0 flex-1 space-y-1">
            <p dir={detectDir(item.task)} className="text-fg-1 text-sm">
              {item.task}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-4 text-xs">
              {item.owner && (
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {item.owner}
                </span>
              )}
              {item.due && (
                <span className="inline-flex items-center gap-1" dir="ltr">
                  <CalendarIcon className="size-3" />
                  {item.due}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DecisionsList({ items }: { items: Decision[] }) {
  if (!items.length) {
    return <SectionEmpty>تصمیمی ثبت نشد.</SectionEmpty>;
  }
  return (
    <ul className="space-y-3">
      {items.map((d, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg bg-foreground/4 px-3.5 py-3"
        >
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1 space-y-1">
            <p dir={detectDir(d.decision)} className="text-fg-1 text-sm">
              {d.decision}
            </p>
            {d.rationale && (
              <p dir={detectDir(d.rationale)} className="text-fg-3 text-xs">
                {d.rationale}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function QaList({ items }: { items: QAEntry[] }) {
  if (!items.length) {
    return <SectionEmpty>پرسش و پاسخی ثبت نشد.</SectionEmpty>;
  }
  return (
    <ul className="space-y-3">
      {items.map((qa, i) => (
        <li key={i} className="rounded-lg bg-foreground/4 px-3.5 py-3 space-y-1.5">
          <p
            dir={detectDir(qa.question)}
            className="font-medium text-fg-1 text-sm"
          >
            {qa.question}
          </p>
          {qa.answer ? (
            <p dir={detectDir(qa.answer)} className="text-fg-3 text-sm">
              {qa.answer}
            </p>
          ) : (
            <p className="text-fg-4 text-xs">بدون پاسخ</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function OpenQuestionsList({ items }: { items: string[] }) {
  if (!items.length) {
    return <SectionEmpty>موردی باز نمانده است.</SectionEmpty>;
  }
  return (
    <ul className="space-y-2">
      {items.map((q, i) => (
        <li
          key={i}
          dir={detectDir(q)}
          className="flex items-start gap-2.5 rounded-lg bg-foreground/4 px-3.5 py-3 text-fg-1 text-sm"
        >
          <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-warn" />
          <span>{q}</span>
        </li>
      ))}
    </ul>
  );
}

export function MinutesTimeline({ segments }: { segments: MinutesSegment[] }) {
  if (!segments.length) {
    return <SectionEmpty>صورت‌جلسه‌ای در دسترس نیست.</SectionEmpty>;
  }
  return (
    <ol className="space-y-4 border-foreground/10 border-s ps-4">
      {segments.map((seg, i) => (
        <li key={i} className="relative">
          <span className="-start-[1.3125rem] absolute top-1 size-2 rounded-full bg-primary/60" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-fg-4 text-xs" dir="ltr">
              {seg.timestamp}
            </span>
            <span className="font-medium text-fg-2 text-xs">{seg.speaker}</span>
          </div>
          <p dir={detectDir(seg.text)} className="text-fg-1 text-sm leading-relaxed">
            {seg.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function EmailDraft({
  subject,
  body,
  tone,
  onRegenerate,
  regenerating,
}: {
  subject: string | null;
  body: string | null;
  tone: string | null;
  onRegenerate: (tone: string) => void;
  regenerating: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedTone, setSelectedTone] = useState(tone ?? "formal");

  const copyEmail = async () => {
    const text = [subject ? `موضوع: ${subject}` : null, body]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort
    }
  };

  if (!subject && !body) {
    return <SectionEmpty>پیش‌نویس ایمیلی ساخته نشده است.</SectionEmpty>;
  }

  return (
    <div className="space-y-3">
      {subject && (
        <div className="rounded-lg bg-foreground/4 px-3.5 py-2.5">
          <p className="text-fg-4 text-xs">موضوع</p>
          <p dir={detectDir(subject)} className="font-medium text-fg-1 text-sm">
            {subject}
          </p>
        </div>
      )}
      {body && (
        <div
          dir={detectDir(body)}
          className="whitespace-pre-wrap rounded-lg bg-foreground/4 px-3.5 py-3.5 text-fg-1 text-sm leading-relaxed"
        >
          {body}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copyEmail}>
          {copied ? (
            <CheckIcon className="size-4 text-ok" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          {copied ? "کپی شد" : "کپی ایمیل"}
        </Button>
        <div className="flex items-center gap-1.5">
          <Select value={selectedTone} onValueChange={setSelectedTone}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TONE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            disabled={regenerating}
            onClick={() => onRegenerate(selectedTone)}
          >
            {regenerating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            ساخت دوباره با لحن {toneLabel(selectedTone)}
          </Button>
        </div>
      </div>
    </div>
  );
}
