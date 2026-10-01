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
import { createSeriesAction, updateSeriesAction } from "@/lib/actions/series";
import type { MeetingSeriesRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";
import { EMAIL_TONE_OPTIONS } from "./meeting-shared";

export function SeriesDialog({
  open,
  onOpenChange,
  series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, edits this series instead of creating one. */
  series?: MeetingSeriesRow;
}) {
  const editing = Boolean(series);
  const [name, setName] = useState(series?.name ?? "");
  const [tone, setTone] = useState(series?.emailTone ?? "formal");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      if (editing && series) {
        await updateSeriesAction(series.id, { name: trimmed, emailTone: tone });
      } else {
        await createSeriesAction({ name: trimmed, emailTone: tone });
      }
      onOpenChange(false);
      if (!editing) {
        setName("");
        setTone("formal");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <div className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-base text-foreground">
              {editing ? "ویرایش سری" : "سری جدید"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">نام سری</label>
            <Input
              autoFocus
              value={name}
              dir={detectDir(name)}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="مثلاً جلسهٔ هفتگی محصول"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">
              لحن پیش‌فرض ایمیل
            </label>
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

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button disabled={pending || !name.trim()} onClick={submit}>
              {pending
                ? "در حال ذخیره…"
                : editing
                  ? "ذخیره تغییرات"
                  : "ساختن"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
