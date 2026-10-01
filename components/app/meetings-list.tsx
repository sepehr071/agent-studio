"use client";

import {
  ClockIcon,
  LayersIcon,
  MicIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteMeetingAction } from "@/lib/actions/meetings";
import type { MeetingRow, MeetingSeriesRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";
import { MeetingUploadDialog } from "./meeting-upload-dialog";
import {
  formatDate,
  formatDuration,
  StatusBadge,
} from "./meeting-shared";

function MeetingRowItem({
  meeting,
  seriesName,
}: {
  meeting: MeetingRow;
  seriesName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const duration = formatDuration(meeting.durationS);

  return (
    <li
      className={`group glass relative flex items-center gap-3 rounded-xl px-4 py-3 transition-shadow hover:shadow-md ${
        pending ? "opacity-50" : ""
      }`}
    >
      <Link
        href={`/meetings/${meeting.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={meeting.title}
      />

      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
      >
        <MicIcon className="size-5" />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-fg-1 text-sm">
          {meeting.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-4 text-xs">
          <span>{formatDate(meeting.createdAt)}</span>
          {duration && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" />
              <span dir="ltr">{duration}</span>
            </span>
          )}
          {seriesName && (
            <span className="inline-flex items-center gap-1 text-fg-3">
              <LayersIcon className="size-3" />
              {seriesName}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1.5">
        <StatusBadge status={meeting.status} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">عملیات جلسه</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-sm">
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                startTransition(() => deleteMeetingAction(meeting.id))
              }
            >
              <Trash2Icon className="size-3.5" /> حذف جلسه
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function MeetingsList({
  meetings,
  series,
}: {
  meetings: MeetingRow[];
  series: MeetingSeriesRow[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  const seriesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of series) map.set(s.id, s.name);
    return map;
  }, [series]);

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg">
                جلسات
              </h1>
              <p className="text-fg-3 text-sm">
                صدای جلسه‌ها را به رونوشت، خلاصه و پیش‌نویس ایمیل تبدیل کنید
              </p>
            </div>
            <Button onClick={() => setUploadOpen(true)} type="button">
              <PlusIcon className="size-4" /> جلسه جدید
            </Button>
          </div>

          {meetings.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
              <span
                className="grid size-14 place-items-center rounded-2xl"
                style={{
                  background: `color-mix(in oklch, ${chartTint(4)} 12%, transparent)`,
                  color: chartTint(4),
                }}
              >
                <MicIcon className="size-7" />
              </span>
              <div className="space-y-1">
                <p className="font-heading font-medium text-foreground">
                  هنوز جلسه‌ای ندارید
                </p>
                <p className="text-fg-3 text-sm">
                  اولین فایل صوتی را بارگذاری کنید تا رونوشت و خلاصهٔ آن ساخته شود
                </p>
              </div>
              <Button
                className="mt-1"
                onClick={() => setUploadOpen(true)}
                type="button"
              >
                <PlusIcon className="size-4" /> بارگذاری جلسه
              </Button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {meetings.map((m) => (
                <MeetingRowItem
                  key={m.id}
                  meeting={m}
                  seriesName={m.seriesId ? seriesById.get(m.seriesId) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <MeetingUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        series={series}
      />
    </div>
  );
}
