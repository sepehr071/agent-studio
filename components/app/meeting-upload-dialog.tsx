"use client";

import { FileAudioIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSeriesAction } from "@/lib/actions/series";
import type { MeetingSeriesRow } from "@/lib/db/schema";
import { detectDir } from "@/lib/use-direction";
import { cn } from "@/lib/utils";
import { EMAIL_TONE_OPTIONS } from "./meeting-shared";

const NEW_SERIES = "__new__";
const NO_SERIES = "__none__";

/** Bytes → «۱۲٫۴ مگابایت». */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

/**
 * Upload an audio file by streaming the raw body (FormData buffers in memory;
 * the route reads the raw request body + X-Filename header per the engine
 * contract). XMLHttpRequest is used so we get an upload-progress callback.
 */
function uploadAudio(
  file: File,
  params: URLSearchParams,
  onProgress: (pct: number) => void,
): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/upload?${params.toString()}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as {
          id?: string;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && json.id) {
          resolve({ id: json.id });
        } else {
          reject(new Error(json.error ?? `وضعیت ${xhr.status}`));
        }
      } catch {
        reject(new Error("پاسخ نامعتبر از سرور دریافت شد."));
      }
    };
    xhr.onerror = () => reject(new Error("ارتباط با سرور برقرار نشد."));
    xhr.send(file);
  });
}

export function MeetingUploadDialog({
  open,
  onOpenChange,
  series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: MeetingSeriesRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [numSpeakers, setNumSpeakers] = useState("");
  const [tone, setTone] = useState("formal");
  const [seriesId, setSeriesId] = useState(NO_SERIES);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [dragging, setDragging] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setBrief("");
    setNumSpeakers("");
    setTone("formal");
    setSeriesId(NO_SERIES);
    setNewSeriesName("");
    setProgress(0);
    setStageLabel("");
    setError(null);
  }, []);

  const pickFile = useCallback(
    (f: File | null | undefined) => {
      if (!f) return;
      setFile(f);
      setError(null);
      if (!title.trim()) {
        setTitle(f.name.replace(/\.[^.]+$/, ""));
      }
    },
    [title],
  );

  const submit = useCallback(async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setProgress(0);

    try {
      // 1) Resolve series (create on the fly when requested).
      let resolvedSeriesId: string | null = null;
      if (seriesId === NEW_SERIES) {
        const name = newSeriesName.trim();
        if (!name) throw new Error("نام سری جلسات را وارد کنید.");
        setStageLabel("در حال ساخت سری…");
        const created = await createSeriesAction({ name, emailTone: tone });
        resolvedSeriesId = created.id;
      } else if (seriesId !== NO_SERIES) {
        resolvedSeriesId = seriesId;
      }

      // 2) Upload audio (raw body stream → disk).
      setStageLabel("در حال بارگذاری صدا…");
      const params = new URLSearchParams();
      if (title.trim()) params.set("title", title.trim());
      if (resolvedSeriesId) params.set("seriesId", resolvedSeriesId);
      params.set("emailTone", tone);
      const speakers = Number(numSpeakers);
      if (Number.isFinite(speakers) && speakers > 0) {
        params.set("numSpeakers", String(Math.floor(speakers)));
      }
      if (brief.trim()) params.set("brief", brief.trim());

      const { id } = await uploadAudio(file, params, setProgress);

      // 3) Kick the pipeline.
      setStageLabel("در حال آغاز پردازش…");
      const res = await fetch(`/api/meetings/${id}/process`, { method: "POST" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "آغاز پردازش جلسه ناموفق بود.");
      }

      onOpenChange(false);
      reset();
      router.push(`/meetings/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "بارگذاری جلسه ناموفق بود.");
      setStageLabel("");
    } finally {
      setBusy(false);
    }
  }, [
    file,
    busy,
    seriesId,
    newSeriesName,
    tone,
    title,
    numSpeakers,
    brief,
    onOpenChange,
    reset,
    router,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <div className="space-y-4">
          <DialogHeader className="block space-y-0">
            <DialogTitle className="font-heading font-bold text-base text-foreground">
              جلسه جدید
            </DialogTitle>
            <DialogDescription className="text-fg-3 text-xs">
              فایل صوتی جلسه را بارگذاری کنید تا رونوشت و خلاصه ساخته شود
            </DialogDescription>
          </DialogHeader>

          {/* dropzone */}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
              dragging
                ? "border-primary/60 bg-primary/10"
                : "border-foreground/15 hover:bg-foreground/5",
              busy && "cursor-not-allowed opacity-60",
            )}
          >
            {file ? (
              <>
                <FileAudioIcon className="size-8 text-primary" />
                <span className="font-medium text-fg-1 text-sm" dir="ltr">
                  {file.name}
                </span>
                <span className="text-fg-4 text-xs">{formatBytes(file.size)}</span>
              </>
            ) : (
              <>
                <UploadCloudIcon className="size-8 text-fg-3" />
                <span className="font-medium text-fg-2 text-sm">
                  فایل صوتی را اینجا رها کنید یا کلیک کنید
                </span>
                <span className="text-fg-4 text-xs">
                  MP3، WAV، M4A، OGG، WEBM
                </span>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.webm,.flac"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          {/* title */}
          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">عنوان جلسه</label>
            <Input
              value={title}
              dir={detectDir(title)}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً جلسهٔ هفتگی محصول"
              disabled={busy}
              className="text-sm"
            />
          </div>

          {/* brief */}
          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">
              زمینهٔ جلسه (اختیاری)
            </label>
            <Textarea
              value={brief}
              dir={detectDir(brief)}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="نام شرکت‌کنندگان، نام پروژه یا هر زمینه‌ای که به خلاصه‌سازی کمک کند"
              rows={2}
              disabled={busy}
              className="resize-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* speakers */}
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
                disabled={busy}
                dir="ltr"
                className="text-sm"
              />
            </div>

            {/* tone */}
            <div className="space-y-1.5">
              <label className="font-medium text-fg-3 text-xs">لحن ایمیل</label>
              <Select value={tone} onValueChange={setTone} disabled={busy}>
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

          {/* series */}
          <div className="space-y-1.5">
            <label className="font-medium text-fg-3 text-xs">سری جلسات</label>
            <Select value={seriesId} onValueChange={setSeriesId} disabled={busy}>
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
                <SelectItem value={NEW_SERIES}>+ سری جدید…</SelectItem>
              </SelectContent>
            </Select>
            {seriesId === NEW_SERIES && (
              <Input
                value={newSeriesName}
                dir={detectDir(newSeriesName)}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="نام سری جلسات"
                disabled={busy}
                className="text-sm"
              />
            )}
          </div>

          {busy && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-fg-3 text-xs">
                <Loader2Icon className="size-3.5 animate-spin" />
                {stageLabel}
              </div>
              <Progress value={progress} />
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs">
              <span dir="ltr" className="font-mono">
                ERR:
              </span>{" "}
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              <XIcon className="size-4" />
              انصراف
            </Button>
            <Button disabled={!file || busy} onClick={submit}>
              {busy ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  در حال پردازش…
                </>
              ) : (
                <>
                  <UploadCloudIcon className="size-4" />
                  بارگذاری و پردازش
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
