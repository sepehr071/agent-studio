"use client";

import {
  LayersIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteSeriesAction } from "@/lib/actions/series";
import type { MeetingSeriesRow } from "@/lib/db/schema";
import { chartTint } from "@/lib/tint";
import { SeriesDialog } from "./series-dialog";
import { toneLabel } from "./meeting-shared";

export interface SeriesCardData extends MeetingSeriesRow {
  meetingCount: number;
}

function SeriesCard({ series }: { series: SeriesCardData }) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <div className="group glass relative flex flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lg">
        <Link
          href={`/series/${series.id}`}
          className="absolute inset-0 rounded-2xl"
          aria-label={series.name}
        />
        <div className="flex items-start justify-between">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
          >
            <LayersIcon className="size-5" />
          </span>
          <div className="relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-fg-4 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontalIcon className="size-4" />
                  <span className="sr-only">عملیات سری</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon className="size-3.5" /> ویرایش
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() =>
                    startTransition(() => deleteSeriesAction(series.id))
                  }
                >
                  <Trash2Icon className="size-3.5" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-heading font-medium text-foreground text-sm">
            {series.name}
          </h3>
          <p className="text-fg-4 text-xs">لحن ایمیل: {toneLabel(series.emailTone)}</p>
        </div>

        <div className="mt-auto flex items-center gap-1.5 text-fg-4 text-xs">
          <MicIcon className="size-3.5" />
          <span>{series.meetingCount} جلسه</span>
        </div>
      </div>
      <SeriesDialog open={editing} onOpenChange={setEditing} series={series} />
    </>
  );
}

export function SeriesList({ series }: { series: SeriesCardData[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="h-dvh overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading font-bold text-foreground text-lg">
                سری جلسات
              </h1>
              <p className="text-fg-3 text-sm">
                جلسه‌های تکرارشونده را گروه کنید تا واژگان تخصصی و نام گویندگان به
                خاطر سپرده شوند
              </p>
            </div>
            <Button onClick={() => setCreating(true)} type="button">
              <PlusIcon className="size-4" /> سری جدید
            </Button>
          </div>

          {series.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center">
              <span
                className="grid size-14 place-items-center rounded-2xl"
                style={{
                  background: `color-mix(in oklch, ${chartTint(4)} 12%, transparent)`,
                  color: chartTint(4),
                }}
              >
                <LayersIcon className="size-7" />
              </span>
              <div className="space-y-1">
                <p className="font-heading font-medium text-foreground">
                  هنوز سری‌ای نساخته‌اید
                </p>
                <p className="text-fg-3 text-sm">
                  یک سری بسازید تا جلسه‌های مرتبط را گروه کنید
                </p>
              </div>
              <Button
                className="mt-1"
                onClick={() => setCreating(true)}
                type="button"
              >
                <PlusIcon className="size-4" /> ساختن سری
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {series.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SeriesDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
