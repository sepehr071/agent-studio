import { FileQuestionIcon } from "lucide-react";
import Link from "next/link";

/**
 * Shared not-found boundary for the (app) shell. Covers the detail routes
 * (meetings/projects/series/...) that call notFound() for an invalid/deleted
 * id but have no per-route boundary. Keeps the RTL/Persian glass shell instead
 * of falling back to Next's English LTR 404 page. dir is inherited from
 * <html dir="rtl">.
 */
export default function AppNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-destructive/12 text-destructive"
      >
        <FileQuestionIcon className="size-7" />
      </span>
      <div className="glass space-y-1.5 rounded-2xl px-6 py-5">
        <p className="font-heading font-bold text-lg">صفحه پیدا نشد</p>
        <p className="text-fg-3 text-sm">
          این نشانی نامعتبر است یا مورد موردنظر حذف شده است.
        </p>
      </div>
      <Link
        className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
        href="/"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}
