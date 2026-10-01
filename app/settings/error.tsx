"use client";

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid h-dvh place-items-center p-6">
      <div className="glass flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <span
          aria-hidden
          className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"
        >
          <TriangleAlertIcon className="size-7" />
        </span>

        <div className="space-y-1.5">
          <h1 className="font-bold font-heading text-foreground text-lg">
            مشکلی پیش آمد
          </h1>
          <p className="text-fg-3 text-sm leading-relaxed">
            بارگذاری تنظیمات با خطا روبه‌رو شد. می‌توانید دوباره تلاش کنید.
          </p>
        </div>

        {error.message && (
          <pre
            dir="ltr"
            className="max-h-32 w-full overflow-auto rounded-lg bg-muted/60 px-3 py-2 text-start font-mono text-[11px] text-fg-3 leading-relaxed"
          >
            {error.message}
          </pre>
        )}

        <Button className="gap-1.5" onClick={() => reset()} type="button">
          <RefreshCwIcon className="size-4" />
          تلاش دوباره
        </Button>
      </div>
    </div>
  );
}
