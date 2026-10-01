"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignSeriesAction,
  renameMeetingAction,
  setMeetingBriefAction,
  setNumSpeakersAction,
  updateMeetingAction,
} from "@/lib/actions/meetings";
import type { MeetingRow, MeetingSeriesRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";
import { EMAIL_TONE_OPTIONS } from "./meeting-shared";

const NO_SERIES = "__none__";

export function MeetingSettingsDialog({
  open,
  onOpenChange,
  meeting,
  series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingRow;
  series: MeetingSeriesRow[];
}) {
  const [title, setTitle] = useState(meeting.title);
  const [brief, setBrief] = useState(meeting.meetingBrief ?? "");
  const [numSpeakers, setNumSpeakers] = useState(
    meeting.numSpeakers != null ? String(meeting.numSpeakers) : "",
  );
  const [tone, setTone] = useState(meeting.emailTone ?? "formal");
  const [seriesId, setSeriesId] = useState(meeting.seriesId ?? NO_SERIES);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmedTitle = title.trim();
    startTransition(async () => {
      if (trimmedTitle && trimmedTitle !== meeting.title) {
        await renameMeetingAction(meeting.id, trimmedTitle);
      }
      if ((brief.trim() || null) !== (meeting.meetingBrief ?? null)) {
        await setMeetingBriefAction(meeting.id, brief);
      }
      const n = Number(numSpeakers);
      const normalized = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
      if (normalized !== (meeting.numSpeakers ?? null)) {
        await setNumSpeakersAction(meeting.id, normalized ?? 0);
      }
      if (tone !== (meeting.emailTone ?? "formal")) {
        await updateMeetingAction(meeting.id, { emailTone: tone });
      }
      const resolvedSeries = seriesId === NO_SERIES ? null : seriesId;
      if (resolvedSeries !== (meeting.seriesId ?? null)) {
        await assignSeriesAction(meeting.id, resolvedSeries);
      }
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
        aria-describedby={undefined}
      >
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-base text-foreground">
              تنظیمات جلسه
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">عنوان</label>
            <Input
              value={title}
              dir={detectDir(title)}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">زمینهٔ جلسه</label>
            <Textarea
              value={brief}
              dir={detectDir(brief)}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="نام شرکت‌کنندگان، پروژه و هر زمینه‌ای که به خلاصه کمک کند"
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-fg-4 text-xs">
              برای دیدن اثر، خلاصه را دوباره تولید کنید.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-fg-3 text-xs">
                تعداد گویندگان
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={numSpeakers}
                onChange={(e) => setNumSpeakers(e.target.value)}
                placeholder="خودکار"
                dir="ltr"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium text-fg-3 text-xs">لحن ایمیل</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="w-full">
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
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">سری جلسات</label>
            <Select value={seriesId} onValueChange={setSeriesId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SERIES}>بدون سری</SelectItem>
                {series.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button disabled={pending} onClick={save}>
              {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
