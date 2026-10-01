"use client";

import {
  ClipboardCheckIcon,
  ClockIcon,
  LayersIcon,
  ListTodoIcon,
  UsersIcon,
} from "lucide-react";
import type {
  MeetingSpeakerRow,
  MeetingSummaryRow,
  MeetingTranscriptRow,
} from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";
import {
  formatDuration,
  formatNumber,
  KpiChip,
  type MeetingSectionId,
} from "./meeting-shared";
import {
  ActionItemsList,
  DecisionsList,
  EmailDraft,
  MinutesTimeline,
  OpenQuestionsList,
  QaList,
  SectionEmpty,
} from "./meeting-summary-view";
import { SpeakerLegend, TranscriptBody } from "./meeting-transcript-view";

/** Persian heading per section — mirrors the rail labels. */
export const SECTION_TITLE: Record<MeetingSectionId, string> = {
  summary: "نمای کلی",
  actions: "اقدامات",
  decisions: "تصمیم‌ها",
  qa: "پرسش و پاسخ",
  open: "موارد باز",
  minutes: "صورت‌جلسه",
  email: "پیش‌نویس ایمیل",
  transcript: "رونوشت",
  speakers: "بلندگوها",
};

const SECTION_HINT: Partial<Record<MeetingSectionId, string>> = {
  summary: "نگاهی سریع به مهم‌ترین آمار و چکیدهٔ این جلسه.",
  actions: "کارهایی که باید پیگیری شوند، همراه با مسئول و مهلت.",
  decisions: "تصمیم‌هایی که در این جلسه نهایی شد.",
  qa: "پرسش‌هایی که مطرح و پاسخ داده شد.",
  open: "مواردی که هنوز جمع‌بندی نشده و نیاز به پیگیری دارد.",
  minutes: "خط زمانی گفت‌وگو بر پایهٔ رونوشت.",
  email: "پیش‌نویس ایمیل جمع‌بندی، آمادهٔ کپی و ارسال.",
  transcript: "متن کامل گفت‌وگو با تفکیک گوینده.",
  speakers: "گویندگان شناسایی‌شده؛ برای تغییر نام روی هرکدام بزنید.",
};

interface SectionContext {
  meetingId: string;
  summary: MeetingSummaryRow | null;
  transcript: MeetingTranscriptRow | null;
  speakers: MeetingSpeakerRow[];
  seriesName: string | null;
  durationS: number | null;
  onRegenerate: (tone?: string) => void;
  regenerating: boolean;
}

function OverviewBody({ ctx }: { ctx: SectionContext }) {
  const { summary, speakers, seriesName, durationS } = ctx;
  const actionCount = summary?.actionItemsJson?.length ?? 0;
  const duration = formatDuration(durationS);

  const kpis = [
    duration && {
      icon: <ClockIcon className="size-4" />,
      value: duration,
      label: "مدت جلسه",
      dir: "ltr" as const,
    },
    {
      icon: <UsersIcon className="size-4" />,
      value: formatNumber(speakers.length),
      label: "گوینده",
    },
    {
      icon: <ListTodoIcon className="size-4" />,
      value: formatNumber(actionCount),
      label: "اقدام",
    },
    seriesName && {
      icon: <LayersIcon className="size-4" />,
      value: seriesName,
      label: "سری جلسات",
    },
  ].filter(Boolean) as {
    icon: React.ReactNode;
    value: string;
    label: string;
    dir?: "ltr" | "rtl";
  }[];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiChip
            key={kpi.label}
            icon={kpi.icon}
            value={kpi.value}
            label={kpi.label}
            dir={kpi.dir}
          />
        ))}
      </div>

      <div className="glass space-y-2 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheckIcon className="size-4 text-primary" aria-hidden />
          <h3 className="font-heading font-medium text-fg-1 text-sm">
            خلاصهٔ مدیریتی
          </h3>
        </div>
        {summary?.execSummary ? (
          <p
            dir={detectDir(summary.execSummary)}
            className="text-fg-1 text-sm leading-relaxed"
          >
            {summary.execSummary}
          </p>
        ) : (
          <p className="text-fg-4 text-sm">خلاصه‌ای ثبت نشده است.</p>
        )}
      </div>
    </div>
  );
}

function SectionBody({
  id,
  ctx,
}: {
  id: MeetingSectionId;
  ctx: SectionContext;
}) {
  const { summary } = ctx;
  switch (id) {
    case "summary":
      return <OverviewBody ctx={ctx} />;
    case "actions":
      return <ActionItemsList items={summary?.actionItemsJson ?? []} />;
    case "decisions":
      return <DecisionsList items={summary?.decisionsJson ?? []} />;
    case "qa":
      return <QaList items={summary?.qaJson ?? []} />;
    case "open":
      return <OpenQuestionsList items={summary?.openQuestionsJson ?? []} />;
    case "minutes":
      return <MinutesTimeline segments={summary?.minutesJson ?? []} />;
    case "email":
      return summary ? (
        <EmailDraft
          subject={summary.emailSubject}
          body={summary.emailBody}
          tone={summary.emailTone}
          onRegenerate={(tone) => ctx.onRegenerate(tone)}
          regenerating={ctx.regenerating}
        />
      ) : (
        <SectionEmpty>پیش‌نویس ایمیلی ساخته نشده است.</SectionEmpty>
      );
    case "transcript":
      return (
        <TranscriptBody
          transcript={ctx.transcript}
          speakers={ctx.speakers}
        />
      );
    case "speakers":
      return <SpeakerLegend meetingId={ctx.meetingId} speakers={ctx.speakers} />;
  }
}

/**
 * Renders the single active meeting section: a heading, an optional hint, and
 * the section body. The shell swaps `activeId` to switch panels.
 */
export function MeetingSectionContent({
  activeId,
  ctx,
}: {
  activeId: MeetingSectionId;
  ctx: SectionContext;
}) {
  return (
    <section
      key={activeId}
      aria-label={SECTION_TITLE[activeId]}
      className="space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <header className="space-y-1">
        <h2 className="font-heading font-semibold text-fg-0 text-lg">
          {SECTION_TITLE[activeId]}
        </h2>
        {SECTION_HINT[activeId] && (
          <p className="text-fg-4 text-xs">{SECTION_HINT[activeId]}</p>
        )}
      </header>
      <SectionBody id={activeId} ctx={ctx} />
    </section>
  );
}
