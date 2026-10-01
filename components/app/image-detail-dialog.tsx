"use client";

import {
  CopyIcon,
  DownloadIcon,
  HeartIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GeneratedImageRow } from "@/lib/db/schema";

function fileUrl(id: string): string {
  return `/api/images/${id}/file`;
}

/** Detail view: full image, metadata, copy-prompt, regenerate, favorite, delete. */
export function ImageDetailDialog({
  image,
  open,
  onOpenChange,
  onToggleFavorite,
  onDelete,
  onRegenerate,
  onDownload,
}: {
  image: GeneratedImageRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (image: GeneratedImageRow) => void;
  onDownload: (image: GeneratedImageRow) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!image) return null;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(image.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — no-op
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl sm:max-w-2xl">
        <DialogTitle className="text-sm">جزئیات تصویر</DialogTitle>
        <DialogDescription className="sr-only">
          مشاهده تصویر کامل، کپی پرامپت و اقدامات
        </DialogDescription>

        <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,16rem)]">
          <div className="flex items-center justify-center overflow-hidden rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
            {/* biome-ignore lint/a11y/useAltText: prompt used as alt below */}
            <img
              src={fileUrl(image.id)}
              alt={image.prompt.slice(0, 120)}
              className="max-h-[60vh] w-full object-contain"
            />
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-fg-4 text-xs">پرامپت</p>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-fg-1">
                {image.prompt}
              </p>
            </div>

            {image.negativePrompt && (
              <div className="space-y-1">
                <p className="text-fg-4 text-xs">پرامپت منفی</p>
                <p className="whitespace-pre-wrap break-words text-fg-2">
                  {image.negativePrompt}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-fg-4 text-xs">مدل</p>
              <p dir="ltr" className="break-all font-mono text-fg-2 text-xs">
                {image.modelId}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-fg-4 text-xs">
              <span className="rounded-md bg-foreground/5 px-2 py-0.5">
                {image.mode === "i2i" ? "تصویر به تصویر" : "متن به تصویر"}
              </span>
              {image.styleHint && (
                <span className="rounded-md bg-foreground/5 px-2 py-0.5">
                  {image.styleHint}
                </span>
              )}
              {image.aspectHint && (
                <span className="rounded-md bg-foreground/5 px-2 py-0.5">
                  {image.aspectHint}
                </span>
              )}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={copyPrompt}>
                <CopyIcon className="size-4" />
                {copied ? "کپی شد" : "کپی پرامپت"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRegenerate(image)}
              >
                <RefreshCwIcon className="size-4" />
                تولید دوباره
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(image)}
              >
                <DownloadIcon className="size-4" />
                دانلود
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-pressed={image.isFavorite}
                onClick={() => onToggleFavorite(image.id)}
              >
                <HeartIcon
                  className={cn(
                    "size-4",
                    image.isFavorite && "fill-current text-destructive",
                  )}
                />
                {image.isFavorite ? "حذف از علاقه‌مندی" : "علاقه‌مندی"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  onDelete(image.id);
                  onOpenChange(false);
                }}
              >
                <Trash2Icon className="size-4" />
                حذف
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
